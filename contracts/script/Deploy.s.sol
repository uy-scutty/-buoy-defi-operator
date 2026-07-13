// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {MockAavePool} from "../src/MockAavePool.sol";
import {SentinelAccountFactory} from "../src/SentinelAccountFactory.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

/// @notice Deploys all four Sentinel contracts to X Layer testnet and wires
///         them together: configures demo assets on MockAavePool, registers
///         Sentinel's four AI agents on AgentRegistry, and seeds one demo
///         wallet with a near-liquidation position for the hackathon demo.
/// @dev Does NOT deploy an EntryPoint — the canonical v0.7 singleton at
///      0x0000000071727De22E5E9d8BAf0edAc6f37da032 is already live on X Layer
///      testnet (confirmed via `cast code` before writing this script).
contract Deploy is Script {
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    // Demo asset addresses — placeholders standing in for WETH/USDC on X Layer
    // testnet. Replace with real testnet token addresses once obtained; using
    // fixed placeholder addresses only works because MockAavePool tracks
    // balances internally rather than transferring real ERC-20 tokens (see
    // note in MockAavePool.sol — no token transfers occur in supply/repay/borrow
    // for MVP simplicity, only internal accounting).
    address constant DEMO_WETH = address(0x1);
    address constant DEMO_USDC = address(0x2);

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockAavePool and configure demo assets
        MockAavePool pool = new MockAavePool();
        pool.configureAsset(DEMO_WETH, 2000e18, 8000, 8500); // $2000, 80% LTV, 85% liq threshold
        pool.configureAsset(DEMO_USDC, 1e18, 0, 0);          // $1, not usable as collateral

        // Seed the deployer's own wallet with a near-liquidation position
        // (HF = 1.0 exactly) for demo purposes: 1 WETH collateral, 1700 USDC debt.
        pool.seedPosition(deployer, DEMO_WETH, 1e18, DEMO_USDC, 1700e18);

        // 2. Deploy SentinelAccountFactory, pointed at the existing EntryPoint
        SentinelAccountFactory factory = new SentinelAccountFactory(IEntryPoint(ENTRY_POINT));

        // 3. Deploy AgentRegistry and register Sentinel's four agents
        AgentRegistry registry = new AgentRegistry();

        uint256 supervisorId = registry.registerAgent(
            "Supervisor Agent",
            "Coordinates Risk, Research, and Execution agents; synthesizes the final explanation and recommendation.",
            deployer,
            "ipfs://sentinel/agents/supervisor/capabilities.json",
            "ipfs://sentinel/agents/supervisor/metadata.json"
        );
        uint256 riskId = registry.registerAgent(
            "Risk Agent",
            "Computes Health Factor, LTV, Liquidation Threshold, Total Collateral, and Total Debt from on-chain position data.",
            deployer,
            "ipfs://sentinel/agents/risk/capabilities.json",
            "ipfs://sentinel/agents/risk/metadata.json"
        );
        uint256 researchId = registry.registerAgent(
            "Research Agent",
            "Gathers protocol documentation, market context, and asset risk notes to support the Supervisor's explanation.",
            deployer,
            "ipfs://sentinel/agents/research/capabilities.json",
            "ipfs://sentinel/agents/research/metadata.json"
        );
        uint256 executionId = registry.registerAgent(
            "Execution Agent",
            "Builds unsigned UserOperation calldata for the Supervisor's recommended action (repay or supply).",
            deployer,
            "ipfs://sentinel/agents/execution/capabilities.json",
            "ipfs://sentinel/agents/execution/metadata.json"
        );

        vm.stopBroadcast();

       console.log("=== Sentinel Protocol Operator - X Layer Testnet Deployment ===");
        console.log("Deployer:", deployer);
        console.log("MockAavePool:", address(pool));
        console.log("SentinelAccountFactory:", address(factory));
        console.log("AgentRegistry:", address(registry));
        console.log("EntryPoint (existing):", ENTRY_POINT);
        console.log("Supervisor Agent ID:", supervisorId);
        console.log("Risk Agent ID:", riskId);
        console.log("Research Agent ID:", researchId);
        console.log("Execution Agent ID:", executionId);
    }
}



