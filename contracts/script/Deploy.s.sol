// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {MockAavePool} from "../src/MockAavePool.sol";
import {SentinelAccountFactory} from "../src/SentinelAccountFactory.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {BuoyVault} from "../src/BuoyVault.sol";
import {TestERC20} from "../src/TestERC20.sol";

/// @notice Deploys all Buoy contracts, real mintable test tokens, and seeds
///         a genuinely multi-asset demo position (two collateral assets,
///         two debt assets) to prove the system reasons about arbitrary
///         positions, not one hardcoded pair.
contract Deploy is Script {
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address constant AUTOMATION_ADDRESS = 0x8C348594ABf5920aDFf51575C74ff4FE52c84Ffb;

    address deployer;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        (address weth, address wbtc, address usdc, address dai) = _deployTokens();
        MockAavePool pool = _deployAndConfigurePool(weth, wbtc, usdc, dai);
        SentinelAccountFactory factory = new SentinelAccountFactory(IEntryPoint(ENTRY_POINT));
        AgentRegistry registry = _deployAndRegisterAgents();
        BuoyVault vault = new BuoyVault(AUTOMATION_ADDRESS);

        vm.stopBroadcast();

        _logResults(pool, factory, registry, vault, weth, wbtc, usdc, dai);
    }

    function _deployTokens() internal returns (address weth, address wbtc, address usdc, address dai) {
        TestERC20 wethToken = new TestERC20("Test WETH", "WETH", 18);
        TestERC20 wbtcToken = new TestERC20("Test WBTC", "WBTC", 8);
        TestERC20 usdcToken = new TestERC20("Test USDC", "USDC", 6);
        TestERC20 daiToken = new TestERC20("Test DAI", "DAI", 18);

        usdcToken.mint(deployer, 5000e6);
        daiToken.mint(deployer, 5000e18);
        wethToken.mint(deployer, 5e18);
        wbtcToken.mint(deployer, 0.5e8);

        return (address(wethToken), address(wbtcToken), address(usdcToken), address(daiToken));
    }

    function _deployAndConfigurePool(address weth, address wbtc, address usdc, address dai)
        internal
        returns (MockAavePool pool)
    {
        pool = new MockAavePool();
        pool.configureAsset(weth, "WETH", 18, 2000e18, 8000, 8500);
        pool.configureAsset(wbtc, "WBTC", 8, 60000e18, 7500, 8000);
        pool.configureAsset(usdc, "USDC", 6, 1e18, 0, 0);
        pool.configureAsset(dai, "DAI", 18, 1e18, 0, 0);

        pool.seedPosition(deployer, weth, 1e18, usdc, 1200e6);
        pool.seedPosition(deployer, wbtc, 0.02e8, dai, 500e18);
    }

    function _deployAndRegisterAgents() internal returns (AgentRegistry registry) {
        registry = new AgentRegistry();

        registry.registerAgent(
            "Supervisor Agent",
            "Coordinates Risk, Research, and Execution agents; synthesizes the final explanation and recommendation.",
            deployer,
            "ipfs://buoy/agents/supervisor/capabilities.json",
            "ipfs://buoy/agents/supervisor/metadata.json"
        );
        registry.registerAgent(
            "Risk Agent",
            "Computes Health Factor and a full multi-asset position breakdown from on-chain data.",
            deployer,
            "ipfs://buoy/agents/risk/capabilities.json",
            "ipfs://buoy/agents/risk/metadata.json"
        );
        registry.registerAgent(
            "Research Agent",
            "Gathers protocol documentation and market context to support the Supervisor's explanation.",
            deployer,
            "ipfs://buoy/agents/research/capabilities.json",
            "ipfs://buoy/agents/research/metadata.json"
        );
        registry.registerAgent(
            "Execution Agent",
            "Builds prepared transactions and, when authorized, executes protective actions via the Buoy Vault.",
            deployer,
            "ipfs://buoy/agents/execution/capabilities.json",
            "ipfs://buoy/agents/execution/metadata.json"
        );
    }

    function _logResults(
        MockAavePool pool,
        SentinelAccountFactory factory,
        AgentRegistry registry,
        BuoyVault vault,
        address weth,
        address wbtc,
        address usdc,
        address dai
    ) internal view {
        console.log("=== Buoy - X Layer Testnet Deployment ===");
        console.log("Deployer:", deployer);
        console.log("MockAavePool:", address(pool));
        console.log("SentinelAccountFactory:", address(factory));
        console.log("AgentRegistry:", address(registry));
        console.log("BuoyVault:", address(vault));
        console.log("EntryPoint (existing):", ENTRY_POINT);
        console.log("Test WETH:", weth);
        console.log("Test WBTC:", wbtc);
        console.log("Test USDC:", usdc);
        console.log("Test DAI:", dai);
        console.log("Automation Address:", AUTOMATION_ADDRESS);
    }
}