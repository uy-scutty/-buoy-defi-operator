// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title MockAavePool
/// @notice Demo-controllable lending pool matching Aave V3's Pool interface shape.
/// @dev This is an ORIGINAL implementation — it does not import or copy Aave's
///      BUSL-1.1 licensed source. It only mirrors the public interface shape
///      (getUserAccountData, supply, repay, borrow) so that Sentinel's backend
///      adapter can be pointed at a real Aave V3 Pool later with no code changes,
///      per the IPositionSource abstraction defined in the architecture doc.
contract MockAavePool {
    // ---------------------------------------------------------------------
    // Types & storage
    // ---------------------------------------------------------------------

    struct AssetConfig {
        bool supported;
        uint256 priceUSD; // price scaled 1e18 (fixed, no oracle — demo only)
        uint256 ltvBps; // loan-to-value, basis points (e.g. 8000 = 80%)
        uint256 liquidationThresholdBps; // basis points (e.g. 8500 = 85%)
    }

    struct UserPosition {
        mapping(address => uint256) collateral; // asset => amount (asset's native decimals, assumed 18 here)
        mapping(address => uint256) debt; // asset => amount
    }

    address public owner;
    mapping(address => AssetConfig) public assets;
    mapping(address => UserPosition) private positions;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant HEALTH_FACTOR_PRECISION = 1e18;

    // ---------------------------------------------------------------------
    // Events (named to match Aave's for adapter familiarity)
    // ---------------------------------------------------------------------

    event Supply(address indexed asset, address indexed user, uint256 amount);
    event Repay(address indexed asset, address indexed user, uint256 amount);
    event Borrow(address indexed asset, address indexed user, uint256 amount);
    event AssetConfigured(address indexed asset, uint256 priceUSD, uint256 ltvBps, uint256 liquidationThresholdBps);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error AssetNotSupported();
    error InsufficientCollateral();
    error InsufficientDebt();
    error ZeroAmount();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonZero(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor() {
        owner = msg.sender;
    }

    // ---------------------------------------------------------------------
    // Admin: asset configuration (owner-only, demo/seed purposes)
    // ---------------------------------------------------------------------

    /// @notice Registers or updates an asset's demo price and risk parameters.
    function configureAsset(address asset, uint256 priceUSD, uint256 ltvBps, uint256 liquidationThresholdBps)
        external
        onlyOwner
    {
        assets[asset] = AssetConfig({
            supported: true, priceUSD: priceUSD, ltvBps: ltvBps, liquidationThresholdBps: liquidationThresholdBps
        });
        _trackAsset(asset);
        emit AssetConfigured(asset, priceUSD, ltvBps, liquidationThresholdBps);
    }

    /// @notice Owner-only helper to directly seed a user's position for demo scenarios
    ///         (e.g. pre-loading a wallet with a near-liquidation Health Factor).
    function seedPosition(
        address user,
        address collateralAsset,
        uint256 collateralAmount,
        address debtAsset,
        uint256 debtAmount
    ) external onlyOwner {
        if (!assets[collateralAsset].supported || !assets[debtAsset].supported) {
            revert AssetNotSupported();
        }
        positions[user].collateral[collateralAsset] = collateralAmount;
        positions[user].debt[debtAsset] = debtAmount;
    }

    // ---------------------------------------------------------------------
    // Core actions (mirror Aave V3 Pool naming)
    // ---------------------------------------------------------------------

    /// @notice Deposit collateral into the pool.
    function supply(address asset, uint256 amount) external nonZero(amount) {
        if (!assets[asset].supported) revert AssetNotSupported();
        positions[msg.sender].collateral[asset] += amount;
        emit Supply(asset, msg.sender, amount);
    }

    /// @notice Repay outstanding debt.
    function repay(address asset, uint256 amount) external nonZero(amount) {
        if (!assets[asset].supported) revert AssetNotSupported();
        uint256 currentDebt = positions[msg.sender].debt[asset];
        if (currentDebt < amount) revert InsufficientDebt();
        positions[msg.sender].debt[asset] = currentDebt - amount;
        emit Repay(asset, msg.sender, amount);
    }

    /// @notice Borrow against existing collateral.
    function borrow(address asset, uint256 amount) external nonZero(amount) {
        if (!assets[asset].supported) revert AssetNotSupported();
        positions[msg.sender].debt[asset] += amount;
        emit Borrow(asset, msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Views — matches Aave V3's getUserAccountData return shape
    // ---------------------------------------------------------------------

    /// @notice Returns aggregated account data, mirroring Aave V3's IPool.getUserAccountData.
    /// @dev All USD-denominated values are scaled 1e18. healthFactor is scaled 1e18;
    ///      type(uint256).max is returned when the user has no debt (matches Aave convention).
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralUSD,
            uint256 totalDebtUSD,
            uint256 availableBorrowsUSD,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        (totalCollateralUSD, currentLiquidationThreshold, ltv) = _aggregateCollateral(user);
        totalDebtUSD = _aggregateDebt(user);

        if (totalDebtUSD == 0) {
            healthFactor = type(uint256).max;
        } else {
            // HF = (collateral * liquidationThreshold) / debt
            healthFactor = (totalCollateralUSD * currentLiquidationThreshold * HEALTH_FACTOR_PRECISION)
                / (BPS_DENOMINATOR * totalDebtUSD);
        }

        uint256 maxBorrowUSD = (totalCollateralUSD * ltv) / BPS_DENOMINATOR;
        availableBorrowsUSD = maxBorrowUSD > totalDebtUSD ? maxBorrowUSD - totalDebtUSD : 0;
    }

    function getCollateralBalance(address user, address asset) external view returns (uint256) {
        return positions[user].collateral[asset];
    }

    function getDebtBalance(address user, address asset) external view returns (uint256) {
        return positions[user].debt[asset];
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /// @dev Weighted-average LTV and liquidation threshold across a fixed demo asset set.
    ///      NOTE: iterating a fixed small asset list is acceptable here only because the
    ///      MVP supports a tiny, hardcoded number of demo assets (see _demoAssetList).
    ///      A production version would use Aave's reserve-list pattern instead.
    function _aggregateCollateral(address user)
        internal
        view
        returns (uint256 totalUSD, uint256 weightedLiqThreshold, uint256 weightedLtv)
    {
        address[] memory list = _demoAssetList();
        uint256 weightedLiqSum;
        uint256 weightedLtvSum;

        for (uint256 i = 0; i < list.length; i++) {
            address asset = list[i];
            uint256 amount = positions[user].collateral[asset];
            if (amount == 0) continue;

            AssetConfig memory cfg = assets[asset];
            uint256 valueUSD = (amount * cfg.priceUSD) / 1e18;

            totalUSD += valueUSD;
            weightedLiqSum += valueUSD * cfg.liquidationThresholdBps;
            weightedLtvSum += valueUSD * cfg.ltvBps;
        }

        if (totalUSD > 0) {
            weightedLiqThreshold = weightedLiqSum / totalUSD;
            weightedLtv = weightedLtvSum / totalUSD;
        }
    }

    function _aggregateDebt(address user) internal view returns (uint256 totalUSD) {
        address[] memory list = _demoAssetList();
        for (uint256 i = 0; i < list.length; i++) {
            address asset = list[i];
            uint256 amount = positions[user].debt[asset];
            if (amount == 0) continue;
            totalUSD += (amount * assets[asset].priceUSD) / 1e18;
        }
    }

    /// @dev Returns the set of assets ever configured. Kept minimal for MVP —
    ///      revisit if the demo needs more than a handful of assets.
    address[] private _configuredAssets;

    function _demoAssetList() internal view returns (address[] memory) {
        return _configuredAssets;
    }

    // Track configured assets for iteration (called from configureAsset)
    function _trackAsset(address asset) internal {
        for (uint256 i = 0; i < _configuredAssets.length; i++) {
            if (_configuredAssets[i] == asset) return;
        }
        _configuredAssets.push(asset);
    }
}
