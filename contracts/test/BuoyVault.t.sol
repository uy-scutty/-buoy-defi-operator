// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {BuoyVault} from "../src/BuoyVault.sol";
import {MockAavePool} from "../src/MockAavePool.sol";

/// @dev Minimal test-only ERC-20 with an open mint, so tests can freely
///      fund test users without needing a faucet or complex setup.
contract TestToken is ERC20 {
    constructor() ERC20("Test USDC", "tUSDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BuoyVaultTest is Test {
    BuoyVault vault;
    MockAavePool pool;
    TestToken token;

    address owner = address(this);
    address automation = address(0xA0);
    address user = address(0xBEEF);
    address otherUser = address(0xCAFE);

    function setUp() public {
        token = new TestToken();
        pool = new MockAavePool();
        vault = new BuoyVault(automation);

        pool.configureAsset(address(token), "tUSDC", 18, 1e18, 8000, 8500);

        token.mint(user, 10_000e18);
        token.mint(otherUser, 10_000e18);
    }

    // ---------------------------------------------------------------------
    // Deposit / Withdraw
    // ---------------------------------------------------------------------

    function test_Deposit_IncreasesBalance() public {
        vm.startPrank(user);
        token.approve(address(vault), 500e18);
        vault.deposit(address(token), 500e18);
        vm.stopPrank();

        assertEq(vault.getBalance(user, address(token)), 500e18);
        assertEq(token.balanceOf(address(vault)), 500e18);
    }

    function test_Withdraw_ReturnsFundsToUser() public {
        vm.startPrank(user);
        token.approve(address(vault), 500e18);
        vault.deposit(address(token), 500e18);
        vault.withdraw(address(token), 200e18);
        vm.stopPrank();

        assertEq(vault.getBalance(user, address(token)), 300e18);
        assertEq(token.balanceOf(user), 10_000e18 - 300e18);
    }

    function test_RevertWhen_WithdrawExceedsBalance() public {
        vm.startPrank(user);
        token.approve(address(vault), 500e18);
        vault.deposit(address(token), 500e18);

        vm.expectRevert(BuoyVault.InsufficientVaultBalance.selector);
        vault.withdraw(address(token), 1000e18);
        vm.stopPrank();
    }

    function test_UsersBalancesAreIsolated() public {
        vm.startPrank(user);
        token.approve(address(vault), 500e18);
        vault.deposit(address(token), 500e18);
        vm.stopPrank();

        vm.startPrank(otherUser);
        token.approve(address(vault), 300e18);
        vault.deposit(address(token), 300e18);
        vm.stopPrank();

        assertEq(vault.getBalance(user, address(token)), 500e18);
        assertEq(vault.getBalance(otherUser, address(token)), 300e18);
    }

    // ---------------------------------------------------------------------
    // Daily cap
    // ---------------------------------------------------------------------

    function test_SetDailyCap_StoresValue() public {
        vm.prank(user);
        vault.setDailyCap(address(token), 100e18);

        assertEq(vault.getRemainingDailyAllowance(user, address(token)), 100e18);
    }

    // ---------------------------------------------------------------------
    // Protective action (automation-only)
    // ---------------------------------------------------------------------

    function _fundAndCapUser(address who, uint256 depositAmt, uint256 cap) internal {
        vm.startPrank(who);
        token.approve(address(vault), depositAmt);
        vault.deposit(address(token), depositAmt);
        vault.setDailyCap(address(token), cap);
        vm.stopPrank();
    }

    function test_ExecuteProtectiveAction_RepaysUsingOnlyThatUsersFunds() public {
        _fundAndCapUser(user, 1000e18, 500e18);
        pool.seedPosition(user, address(token), 0, address(token), 300e18);

        vm.prank(automation);
        vault.executeProtectiveAction(user, address(token), 200e18, BuoyVault.ActionType.REPAY, address(pool));

        assertEq(vault.getBalance(user, address(token)), 800e18);
        assertEq(vault.getRemainingDailyAllowance(user, address(token)), 300e18);
    }

    function test_RevertWhen_NonAutomationCallsProtectiveAction() public {
        _fundAndCapUser(user, 1000e18, 500e18);
        pool.seedPosition(user, address(token), 0, address(token), 300e18);

        vm.expectRevert(BuoyVault.NotAutomation.selector);
        vm.prank(user);
        vault.executeProtectiveAction(user, address(token), 200e18, BuoyVault.ActionType.REPAY, address(pool));
    }

    function test_RevertWhen_ExceedsDailyCap() public {
        _fundAndCapUser(user, 1000e18, 100e18);
        pool.seedPosition(user, address(token), 0, address(token), 300e18);

        vm.prank(automation);
        vm.expectRevert(BuoyVault.DailyCapExceeded.selector);
        vault.executeProtectiveAction(user, address(token), 150e18, BuoyVault.ActionType.REPAY, address(pool));
    }

    function test_RevertWhen_ExceedsVaultBalance() public {
        _fundAndCapUser(user, 100e18, 500e18);
        pool.seedPosition(user, address(token), 0, address(token), 300e18);

        vm.prank(automation);
        vm.expectRevert(BuoyVault.InsufficientVaultBalance.selector);
        vault.executeProtectiveAction(user, address(token), 200e18, BuoyVault.ActionType.REPAY, address(pool));
    }

    function test_ProtectiveAction_CannotTouchOtherUsersFunds() public {
        _fundAndCapUser(user, 1000e18, 500e18);
        _fundAndCapUser(otherUser, 1000e18, 500e18);
        pool.seedPosition(user, address(token), 0, address(token), 300e18);

        vm.prank(automation);
        vault.executeProtectiveAction(user, address(token), 200e18, BuoyVault.ActionType.REPAY, address(pool));

        // otherUser's balance must be completely untouched
        assertEq(vault.getBalance(otherUser, address(token)), 1000e18);
    }

    function test_DailyCapResetsOnNewDay() public {
        _fundAndCapUser(user, 1000e18, 100e18);
        pool.seedPosition(user, address(token), 0, address(token), 300e18);

        vm.prank(automation);
        vault.executeProtectiveAction(user, address(token), 100e18, BuoyVault.ActionType.REPAY, address(pool));

        assertEq(vault.getRemainingDailyAllowance(user, address(token)), 0);

        vm.warp(block.timestamp + 1 days);

        assertEq(vault.getRemainingDailyAllowance(user, address(token)), 100e18);
    }

    // ---------------------------------------------------------------------
    // Owner-only
    // ---------------------------------------------------------------------

    function test_SetAutomationAddress_OwnerOnly() public {
        address newAutomation = address(0xD00D);
        vault.setAutomationAddress(newAutomation);
        assertEq(vault.automationAddress(), newAutomation);
    }

    function test_RevertWhen_NonOwnerSetsAutomationAddress() public {
        vm.expectRevert(BuoyVault.NotOwner.selector);
        vm.prank(user);
        vault.setAutomationAddress(address(0xD00D));
    }
}