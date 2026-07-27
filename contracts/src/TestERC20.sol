// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestERC20
/// @notice A mintable ERC-20 for testnet demo purposes only. Anyone can mint
///         to themselves — this contract must NEVER be used past the testnet
///         demo stage. Production deployment points at real token addresses
///         (real USDC, real WETH, etc.) instead of this contract entirely.
contract TestERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name, string memory symbol, uint8 decimalsValue) ERC20(name, symbol) {
        _decimals = decimalsValue;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Anyone can mint to any address — intentional for testnet
    ///         demo purposes, so you can freely fund test wallets.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}