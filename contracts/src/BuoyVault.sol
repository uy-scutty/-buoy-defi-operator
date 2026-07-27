// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMockAavePool {
    function repay(address asset, uint256 amount, address onBehalfOf) external;
    function supply(address asset, uint256 amount, address onBehalfOf) external;
}

/// @title BuoyVault
/// @notice A single shared contract where every user's deposited protection
///         funds are tracked separately (per-user, per-token balances) even
///         though they live in one contract. Buoy's automation address can
///         trigger protective actions (repay/supply) using ONLY a specific
///         user's own tracked balance, capped at a daily limit that user
///         sets themselves. Users can withdraw their own funds at any time.
/// @dev This is deliberately NOT a pooled/fungible fund — see project design
///      notes: "B1" model, one contract, strictly separated internal ledger.
contract BuoyVault {
    using SafeERC20 for IERC20;

    enum ActionType {
        REPAY,
        SUPPLY
    }

    address public owner;
    address public automationAddress;

    // user => token => balance currently held in the vault for that user
    mapping(address => mapping(address => uint256)) public balances;

    // user => token => daily cap Buoy's automation may spend for that user
    mapping(address => mapping(address => uint256)) public dailyCaps;

    // user => token => amount already used today
    mapping(address => mapping(address => uint256)) private dailyUsed;
    // user => token => day index (block.timestamp / 1 days) of last usage
    mapping(address => mapping(address => uint256)) private lastUsedDay;

    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event DailyCapSet(address indexed user, address indexed token, uint256 cap);
    event ProtectiveActionExecuted(
        address indexed user, address indexed token, uint256 amount, ActionType action
    );
    event AutomationAddressUpdated(address indexed newAutomationAddress);

    error NotOwner();
    error NotAutomation();
    error ZeroAmount();
    error InsufficientVaultBalance();
    error DailyCapExceeded();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAutomation() {
        if (msg.sender != automationAddress) revert NotAutomation();
        _;
    }

    modifier nonZero(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }

    constructor(address automationAddr) {
        owner = msg.sender;
        automationAddress = automationAddr;
    }

    // ---------------------------------------------------------------------
    // User-facing: deposit, withdraw, set own daily cap
    // ---------------------------------------------------------------------

    /// @notice Deposit any ERC-20 token into your own vault balance.
    function deposit(address token, uint256 amount) external nonZero(amount) {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender][token] += amount;
        emit Deposited(msg.sender, token, amount);
    }

    /// @notice Withdraw your own funds at any time. Never restricted —
    ///         this is your money, Buoy only ever borrows authority over it,
    ///         never custody of it in the ownership sense.
    function withdraw(address token, uint256 amount) external nonZero(amount) {
        if (balances[msg.sender][token] < amount) revert InsufficientVaultBalance();
        balances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    /// @notice Set (or update) the maximum amount of a given token Buoy's
    ///         automation may use per day to protect you. Set to 0 to
    ///         effectively disable automation for that token.
    function setDailyCap(address token, uint256 cap) external {
        dailyCaps[msg.sender][token] = cap;
        emit DailyCapSet(msg.sender, token, cap);
    }

    // ---------------------------------------------------------------------
    // Automation-only: the capped "emergency key"
    // ---------------------------------------------------------------------

    /// @notice Executes a protective action (repay or supply) on behalf of
    ///         `user`, using ONLY that user's own vault balance, capped at
    ///         their own configured daily limit. Callable only by Buoy's
    ///         automation address.
    function executeProtectiveAction(
        address user,
        address token,
        uint256 amount,
        ActionType action,
        address pool
    ) external onlyAutomation nonZero(amount) {
        if (balances[user][token] < amount) revert InsufficientVaultBalance();

        uint256 today = block.timestamp / 1 days;
        if (lastUsedDay[user][token] != today) {
            dailyUsed[user][token] = 0;
            lastUsedDay[user][token] = today;
        }

        if (dailyUsed[user][token] + amount > dailyCaps[user][token]) {
            revert DailyCapExceeded();
        }

        dailyUsed[user][token] += amount;
        balances[user][token] -= amount;

        if (action == ActionType.REPAY) {
            IMockAavePool(pool).repay(token, amount, user);
        } else {
            IMockAavePool(pool).supply(token, amount, user);
        }

        emit ProtectiveActionExecuted(user, token, amount, action);
    }

    // ---------------------------------------------------------------------
    // Owner-only: rotate the automation address if needed
    // ---------------------------------------------------------------------

    function setAutomationAddress(address newAutomationAddress) external onlyOwner {
        automationAddress = newAutomationAddress;
        emit AutomationAddressUpdated(newAutomationAddress);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getBalance(address user, address token) external view returns (uint256) {
        return balances[user][token];
    }

    function getRemainingDailyAllowance(address user, address token) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        uint256 usedToday = (lastUsedDay[user][token] == today) ? dailyUsed[user][token] : 0;
        uint256 cap = dailyCaps[user][token];
        return usedToday >= cap ? 0 : cap - usedToday;
    }
}