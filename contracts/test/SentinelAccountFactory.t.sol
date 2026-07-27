// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {SentinelAccountFactory} from "../src/SentinelAccountFactory.sol";
import {SentinelSmartAccount} from "../src/SentinelSmartAccount.sol";

contract SentinelAccountFactoryTest is Test {
    EntryPoint entryPoint;
    SentinelAccountFactory factory;

    address ownerA = address(0xA11CE);
    address ownerB = address(0xB0B);

    function setUp() public {
        entryPoint = new EntryPoint();
        factory = new SentinelAccountFactory(entryPoint);
    }

    function test_GetAddress_MatchesActualDeployment() public {
        uint256 salt = 0;
        address predicted = factory.getAddress(ownerA, salt);

        SentinelSmartAccount deployed = factory.createAccount(ownerA, salt);

        assertEq(address(deployed), predicted);
    }

    function test_CreateAccount_IsIdempotent() public {
        uint256 salt = 0;

        SentinelSmartAccount first = factory.createAccount(ownerA, salt);
        SentinelSmartAccount second = factory.createAccount(ownerA, salt);

        assertEq(address(first), address(second));
    }

    function test_DifferentOwners_ProduceDifferentAddresses() public {
        uint256 salt = 0;
        address addrA = factory.getAddress(ownerA, salt);
        address addrB = factory.getAddress(ownerB, salt);

        assertTrue(addrA != addrB);
    }

    function test_DifferentSalts_ProduceDifferentAddressesForSameOwner() public {
        address addrSalt0 = factory.getAddress(ownerA, 0);
        address addrSalt1 = factory.getAddress(ownerA, 1);

        assertTrue(addrSalt0 != addrSalt1);
    }

    function test_DeployedAccount_HasCorrectOwnerAndEntryPoint() public {
        SentinelSmartAccount deployed = factory.createAccount(ownerA, 0);

        assertEq(deployed.owner(), ownerA);
        assertEq(address(deployed.entryPoint()), address(entryPoint));
    }

    function test_CreateAccount_EmitsEventOnFirstDeployOnly() public {
        uint256 salt = 0;

        vm.expectEmit(true, true, false, false);
        emit SentinelAccountFactory.AccountCreated(ownerA, factory.getAddress(ownerA, salt), salt);
        factory.createAccount(ownerA, salt);

        // Second call must NOT emit again (idempotent, no redeploy) — checked
        // implicitly by recordLogs and asserting only 1 AccountCreated total.
        vm.recordLogs();
        factory.createAccount(ownerA, salt);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 0);
    }
}
