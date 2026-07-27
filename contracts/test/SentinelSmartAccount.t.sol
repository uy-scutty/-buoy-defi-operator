// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {SentinelSmartAccount} from "../src/SentinelSmartAccount.sol";

contract SentinelSmartAccountTest is Test {
    EntryPoint entryPoint;
    SentinelSmartAccount account;

    uint256 ownerPrivateKey = 0xA11CE;
    address owner;

    address target;

    function setUp() public {
        owner = vm.addr(ownerPrivateKey);
        entryPoint = new EntryPoint();
        account = new SentinelSmartAccount(entryPoint, owner);

        vm.deal(address(this), 10 ether);
        entryPoint.depositTo{value: 1 ether}(address(account));

        target = address(new Counter());
    }

    function _buildUserOp(bytes memory callData) internal view returns (PackedUserOperation memory) {
        return PackedUserOperation({
            sender: address(account),
            nonce: entryPoint.getNonce(address(account), 0),
            initCode: "",
            callData: callData,
            accountGasLimits: bytes32(uint256(1_000_000) << 128 | uint256(1_000_000)),
            preVerificationGas: 100_000,
            gasFees: bytes32(uint256(1 gwei) << 128 | uint256(1 gwei)),
            paymasterAndData: "",
            signature: ""
        });
    }

    function _sign(PackedUserOperation memory userOp) internal view returns (bytes memory) {
        bytes32 userOpHash = entryPoint.getUserOpHash(userOp);
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function test_ValidateUserOp_AcceptsCorrectOwnerSignature() public {
        bytes memory callData =
            abi.encodeWithSignature("execute(address,uint256,bytes)", target, 0, abi.encodeCall(Counter.increment, ()));

        PackedUserOperation memory userOp = _buildUserOp(callData);
        userOp.signature = _sign(userOp);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        address bundler = makeAddr("bundler");
        address payable beneficiary = payable(makeAddr("beneficiary"));

        vm.startPrank(bundler, bundler);
        entryPoint.handleOps(ops, beneficiary);
        vm.stopPrank();

        assertEq(Counter(target).count(), 1);
    }

    function test_ValidateUserOp_RejectsWrongSigner() public {
        uint256 wrongKey = 0xBAD;
        bytes memory callData = abi.encodeWithSignature(
            "execute(address,uint256,bytes)", target, uint256(0), abi.encodeCall(Counter.increment, ())
        );
        PackedUserOperation memory userOp = _buildUserOp(callData);

        bytes32 userOpHash = entryPoint.getUserOpHash(userOp);
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethSignedHash);
        userOp.signature = abi.encodePacked(r, s, v);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        vm.expectRevert();
        entryPoint.handleOps(ops, payable(address(this)));
    }

    function test_RevertWhen_ExecuteCalledDirectlyNotViaEntryPoint() public {
        vm.expectRevert();
        account.execute(target, 0, abi.encodeCall(Counter.increment, ()));
    }

    function test_EntryPoint_ReturnsCorrectAddress() public view {
        assertEq(address(account.entryPoint()), address(entryPoint));
    }
}

/// @dev Minimal helper contract just to give execute() a real target to call in tests.
contract Counter {
    uint256 public count;

    function increment() external {
        count += 1;
    }
}
