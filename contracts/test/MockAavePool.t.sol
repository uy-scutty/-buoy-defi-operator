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
        pool.configureAsset(weth, "WETH", 18, 2000e18, 8000, 8500);
        // USDC: $1, 0% LTV (not usable as collateral in this demo), 0% liq threshold

        pool.configureAsset(usdc, "USDC", 18, 1e18, 0, 0);
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
        pool.repay(usdc, 700e18, user);
        (, uint256 totalDebtUSD,,,, uint256 healthFactor) = pool.getUserAccountData(user);
        assertEq(totalDebtUSD, 1000e18);
        assertEq(healthFactor, 1.7e18);
    }

    function test_Supply_IncreasesCollateral() public {
        vm.prank(user);
        pool.supply(weth, 2e18, user);

        uint256 balance = pool.getCollateralBalance(user, weth);
        assertEq(balance, 2e18);
    }


function test_RevertWhen_RepayExceedsDebt() public {
    pool.seedPosition(user, weth, 1e18, usdc, 500e18);

    vm.expectRevert(MockAavePool.InsufficientDebt.selector);
    vm.prank(user);
    pool.repay(usdc, 600e18, user);  // trying to repay more than the 500 debt
}

function test_Borrow_IncreasesDebt() public {
    pool.seedPosition(user, weth, 1e18, usdc, 1000e18);

    vm.prank(user);
    pool.borrow(usdc, 500e18);

    assertEq(pool.getDebtBalance(user, usdc), 1500e18);
}

    function test_RevertWhen_NonOwnerConfiguresAsset() public {
        vm.expectRevert(MockAavePool.NotOwner.selector);
        vm.prank(user);
        pool.configureAsset(weth, "WETH", 18, 2000e18, 8000, 8500);
    }

    

    function test_GetUserPositions_ReturnsMultiAssetBreakdown() public {
    pool.seedPosition(user, weth, 1e18, usdc, 1000e18);

    MockAavePool.AssetPosition[] memory positions = pool.getUserPositions(user);

    assertEq(positions.length, 2);

    // Order matches _demoAssetList insertion order: weth, then usdc
    assertEq(positions[0].asset, weth);
    assertEq(positions[0].symbol, "WETH");
    assertEq(positions[0].collateralAmount, 1e18);
    assertEq(positions[0].collateralUSD, 2000e18);
    assertEq(positions[0].debtAmount, 0);

    assertEq(positions[1].asset, usdc);
    assertEq(positions[1].symbol, "USDC");
    assertEq(positions[1].debtAmount, 1000e18);
    assertEq(positions[1].debtUSD, 1000e18);
    assertEq(positions[1].collateralAmount, 0);
}

function test_GetUserPositions_EmptyForNoPosition() public view {
    MockAavePool.AssetPosition[] memory positions = pool.getUserPositions(user);
    assertEq(positions.length, 0);
}

function test_GetUserPositions_OnlyIncludesAssetsWithNonzeroBalance() public {
    // User only supplies WETH, never touches USDC
    vm.prank(user);
    pool.supply(weth, 1e18, user);

    MockAavePool.AssetPosition[] memory positions = pool.getUserPositions(user);

    assertEq(positions.length, 1);
    assertEq(positions[0].symbol, "WETH");
}
}
