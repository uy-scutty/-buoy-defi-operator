// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SentinelSmartAccount} from "./SentinelSmartAccount.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";

/// @title SentinelAccountFactory
/// @notice Deploys SentinelSmartAccount instances deterministically via CREATE2.
/// @dev Called either directly by the backend (to predict an address before
///      deployment, for the /wallet/deploy-account API route) or via a
///      UserOperation's initCode field on a smart account's very first
///      operation, per the standard ERC-4337 factory pattern.
contract SentinelAccountFactory {
    IEntryPoint public immutable entryPoint;

    event AccountCreated(address indexed owner, address indexed account, uint256 salt);

    constructor(IEntryPoint entryPointAddr) {
        entryPoint = entryPointAddr;
    }

    /// @notice Deploys a SentinelSmartAccount for `owner`, or returns the existing
    ///         one if already deployed at the deterministic address.
    /// @dev MUST be idempotent — ERC-4337 calls this via initCode on every
    ///      UserOp until the account exists on-chain, so a second call must
    ///      NOT revert, it must simply return the already-deployed address.
    function createAccount(address owner, uint256 salt) external returns (SentinelSmartAccount) {
        address predicted = getAddress(owner, salt);

        uint256 codeSize = predicted.code.length;
        if (codeSize > 0) {
            return SentinelSmartAccount(payable(predicted));
        }

        SentinelSmartAccount account =
            new SentinelSmartAccount{salt: bytes32(salt)}(entryPoint, owner);

        emit AccountCreated(owner, address(account), salt);
        return account;
    }

    /// @notice Computes the deterministic address for a given owner/salt pair
    ///         WITHOUT deploying anything — used by the backend to return
    ///         `predictedAddress` before the user has sent any transaction.
    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes memory creationCode = abi.encodePacked(
            type(SentinelSmartAccount).creationCode,
            abi.encode(entryPoint, owner)
        );

        return _computeCreate2Address(bytes32(salt), keccak256(creationCode));
    }

    function _computeCreate2Address(bytes32 salt, bytes32 initCodeHash) internal view returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)
                    )
                )
            )
        );
    }
}