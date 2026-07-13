// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";

/// @title SentinelSmartAccount
/// @notice Minimal ERC-4337 smart account, single-owner ECDSA validation.
/// @dev Deployed per-user by SentinelAccountFactory via CREATE2. Deliberately
///      does NOT allow the owner to call execute()/executeBatch() directly as
///      an EOA — every action must flow through a signed UserOperation via the
///      EntryPoint, matching Sentinel's "prepared, never auto-executed" model.
///      This is a direct constructor deployment (no proxy/clone pattern) —
///      simpler and sufficient for MVP scope; a clone-factory would only be
///      justified at a deployment volume this project doesn't have.
contract SentinelSmartAccount is BaseAccount {
    address public immutable owner;
    IEntryPoint private immutable _entryPoint;

    uint256 private constant SIG_VALIDATION_SUCCESS = 0;
    uint256 private constant SIG_VALIDATION_FAILED = 1;

    error InvalidSignatureLength();

    constructor(IEntryPoint entryPointAddr, address ownerAddr) {
        _entryPoint = entryPointAddr;
        owner = ownerAddr;
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    /// @inheritdoc BaseAccount
    /// @dev Signature is expected over the Ethereum Signed Message hash of
    ///      userOpHash — i.e. what a standard wallet produces via personal_sign,
    ///      matching the client-side signing step in the ERC-4337 Integration Plan.
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        view
        override
        returns (uint256 validationData)
    {
        bytes32 ethSignedHash = _toEthSignedMessageHash(userOpHash);
        address recovered = _recoverSigner(ethSignedHash, userOp.signature);

        if (recovered == owner) {
            return SIG_VALIDATION_SUCCESS;
        }
        return SIG_VALIDATION_FAILED;
    }

    /// @dev Standard "\x19Ethereum Signed Message:\n32" prefix, matching personal_sign.
    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    /// @dev Manual ECDSA recovery — no OpenZeppelin dependency needed for this single use.
    function _recoverSigner(bytes32 hash, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) revert InvalidSignatureLength();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) v += 27;

        return ecrecover(hash, v, r, s);
    }

    /// @notice Allows the account to receive ETH (e.g. for EntryPoint prefunding).
    receive() external payable {}
}
