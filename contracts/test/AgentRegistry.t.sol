// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry registry;

    address nonOwner = address(0xBEEF);
    address agentWallet = address(0xCAFE);

    function setUp() public {
        registry = new AgentRegistry();
    }

    function test_RegisterAgent_AssignsSequentialIds() public {
        uint256 id1 = registry.registerAgent("Risk Agent", "Computes risk metrics", agentWallet, "ipfs://caps1", "ipfs://meta1");
        uint256 id2 = registry.registerAgent("Research Agent", "Gathers context", agentWallet, "ipfs://caps2", "ipfs://meta2");

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(registry.totalAgents(), 2);
    }

    function test_GetAgent_ReturnsCorrectData() public {
        uint256 id = registry.registerAgent(
            "Supervisor Agent",
            "Coordinates the system",
            agentWallet,
            "ipfs://caps",
            "ipfs://meta"
        );

        AgentRegistry.AgentInfo memory agent = registry.getAgent(id);

        assertEq(agent.id, id);
        assertEq(agent.name, "Supervisor Agent");
        assertEq(agent.description, "Coordinates the system");
        assertEq(agent.wallet, agentWallet);
        assertEq(agent.capabilitiesURI, "ipfs://caps");
        assertEq(agent.metadataURI, "ipfs://meta");
        assertTrue(agent.active);
    }

    function test_RevertWhen_NonOwnerRegistersAgent() public {
        vm.expectRevert(AgentRegistry.NotOwner.selector);
        vm.prank(nonOwner);
        registry.registerAgent("Fake Agent", "desc", agentWallet, "caps", "meta");
    }

    function test_RevertWhen_GettingNonexistentAgent() public {
        vm.expectRevert(AgentRegistry.AgentNotFound.selector);
        registry.getAgent(999);
    }

    function test_UpdateAgent_ChangesFields() public {
        uint256 id = registry.registerAgent("Execution Agent", "Builds transactions", agentWallet, "caps1", "meta1");

        address newWallet = address(0xD00D);
        registry.updateAgent(id, newWallet, "caps2", "meta2");

        AgentRegistry.AgentInfo memory agent = registry.getAgent(id);
        assertEq(agent.wallet, newWallet);
        assertEq(agent.capabilitiesURI, "caps2");
        assertEq(agent.metadataURI, "meta2");
    }

    function test_DeactivateAgent_SetsActiveFalse() public {
        uint256 id = registry.registerAgent("Risk Agent", "desc", agentWallet, "caps", "meta");

        registry.deactivateAgent(id);

        AgentRegistry.AgentInfo memory agent = registry.getAgent(id);
        assertFalse(agent.active);
    }

    function test_RevertWhen_NonOwnerUpdatesAgent() public {
        uint256 id = registry.registerAgent("Risk Agent", "desc", agentWallet, "caps", "meta");

        vm.expectRevert(AgentRegistry.NotOwner.selector);
        vm.prank(nonOwner);
        registry.updateAgent(id, nonOwner, "caps2", "meta2");
    }
}