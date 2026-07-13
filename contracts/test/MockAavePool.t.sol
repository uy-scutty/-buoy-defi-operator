// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockAavePool} from "../src/MockAavePool.sol";

contract MockAavePoolTest is Test {
    MockAavePool pool;

    address owner = address(this);
    address user = address(0xBEEF);

    address weth = address(0x1);
    address usdc = address(0x2);

    function setUp() public {
        pool = new MockAavePool();

        // WETH: $2000, 80% LTV, 85% liquidation threshold
        pool.configureAsset(weth, 2000e18, 8000, 8500);
        // USDC: $1, 0% LTV (not usable as collateral in this demo), 0% liq threshold
        pool.configureAsset(usdc, 1e18, 0, 0);
    }

    function test_NoPosition_ReturnsMaxHealthFactor() public view {
        (,,,,, uint256 healthFactor) = pool.getUserAccountData(user);
        assertEq(healthFactor, type(uint256).max);
    }

    function test_SeedPosition_ComputesCorrectHealthFactor() public {
        // Seed: 1 WETH collateral ($2000), 1000 USDC debt ($1000)
        pool.seedPosition(user, weth, 1e18, usdc, 1000e18);

        (
            uint256 totalCollateralUSD,
            uint256 totalDebtUSD,,
            uint256 liquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        ) = pool.getUserAccountData(user);

        assertEq(totalCollateralUSD, 2000e18);
        assertEq(totalDebtUSD, 1000e18);
        assertEq(liquidationThreshold, 8500);
        assertEq(ltv, 8000);

        // HF = (2000 * 0.85) / 1000 = 1.7
        assertEq(healthFactor, 1.7e18);
    }

    function test_SeedPosition_NearLiquidation() public {
        // Seed a risky position for demo purposes: HF just above 1.0
        // 1 WETH ($2000) collateral, 1700 USDC debt
        // HF = (2000 * 0.85) / 1700 = 1.0 exactly
        pool.seedPosition(user, weth, 1e18, usdc, 1700e18);

        (,,,,, uint256 healthFactor) = pool.getUserAccountData(user);
        assertEq(healthFactor, 1e18);
    }

    function test_Repay_ReducesDebtAndImprovesHealthFactor() public {
        pool.seedPosition(user, weth, 1e18, usdc, 1700e18);

        vm.prank(user);
        pool.repay(usdc, 700e18);

        (, uint256 totalDebtUSD,,,, uint256 healthFactor) = pool.getUserAccountData(user);
        assertEq(totalDebtUSD, 1000e18);
        assertEq(healthFactor, 1.7e18);
    }

    function test_Supply_IncreasesCollateral() public {
        vm.prank(user);
        pool.supply(weth, 2e18);

        uint256 balance = pool.getCollateralBalance(user, weth);
        assertEq(balance, 2e18);
    }

    function test_RevertWhen_UnsupportedAsset() public {
        address fakeAsset = address(0x999);
        vm.expectRevert(MockAavePool.AssetNotSupported.selector);
        vm.prank(user);
        pool.supply(fakeAsset, 1e18);
    }

    function test_RevertWhen_NonOwnerConfiguresAsset() public {
        vm.expectRevert(MockAavePool.NotOwner.selector);
        vm.prank(user);
        pool.configureAsset(weth, 2000e18, 8000, 8500);
    }

    function test_RevertWhen_RepayExceedsDebt() public {
        pool.seedPosition(user, weth, 1e18, usdc, 500e18);

        vm.expectRevert(MockAavePool.InsufficientDebt.selector);
        vm.prank(user);
        pool.repay(usdc, 1000e18);
    }
}
