/**
 * Demo asset configuration — MUST match the values seeded in
 * contracts/script/Deploy.s.sol exactly, since the Execution Agent's math
 * (target repay/supply amounts) assumes these same prices and thresholds.
 * MVP scope is intentionally single-asset-pair (WETH collateral / USDC debt)
 * rather than a general multi-asset optimizer.
 */
export const DEMO_WETH_ADDRESS = "0x0000000000000000000000000000000000000001";
export const DEMO_USDC_ADDRESS = "0x0000000000000000000000000000000000000002";

export const WETH_PRICE_USD = 2000;
export const USDC_PRICE_USD = 1;
export const WETH_LIQUIDATION_THRESHOLD_PCT = 85; // matches deploy script's 8500 bps

export const TARGET_HEALTH_FACTOR = 1.5; // the safety margin recommendations aim to restore