// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title AgentRegistry
/// @notice Minimal on-chain identity registry for Sentinel's internal AI agents
///         (Supervisor, Risk, Research, Execution), built to the field shape
///         ERC-8004 is converging on: Agent ID, Name, Description, Wallet,
///         Capabilities, Metadata.
/// @dev ERC-8004 is still evolving at time of writing. This is an ORIGINAL,
///      minimal implementation — not a claim of ERC-8004 compliance. It is
///      accessed only through IAgentRegistry-shaped calls from the backend,
///      so swapping in the official standard's registry later requires no
///      changes to calling code, only redeploying/repointing this contract.
contract AgentRegistry {
    struct AgentInfo {
        uint256 id;
        string name;
        string description;
        address wallet;
        string capabilitiesURI; // pointer to off-chain JSON (capabilities list)
        string metadataURI;     // pointer to off-chain JSON (free-form metadata)
        bool active;
    }

    address public owner;
    uint256 private _nextAgentId = 1;

    mapping(uint256 => AgentInfo) private _agents;

    event AgentRegistered(
        uint256 indexed agentId,
        string name,
        address indexed wallet
    );
    event AgentUpdated(uint256 indexed agentId);
    event AgentDeactivated(uint256 indexed agentId);

    error NotOwner();
    error AgentNotFound();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Registers a new agent identity. Owner-only — Sentinel's backend
    ///         registers its four fixed agents once at deploy time; this is not
    ///         a permissionless registry for arbitrary third-party agents in the MVP.
    function registerAgent(
        string calldata name,
        string calldata description,
        address wallet,
        string calldata capabilitiesURI,
        string calldata metadataURI
    ) external onlyOwner returns (uint256 agentId) {
        agentId = _nextAgentId++;

        _agents[agentId] = AgentInfo({
            id: agentId,
            name: name,
            description: description,
            wallet: wallet,
            capabilitiesURI: capabilitiesURI,
            metadataURI: metadataURI,
            active: true
        });

        emit AgentRegistered(agentId, name, wallet);
    }

    /// @notice Updates an existing agent's mutable fields (wallet, capabilities, metadata).
    function updateAgent(
        uint256 agentId,
        address wallet,
        string calldata capabilitiesURI,
        string calldata metadataURI
    ) external onlyOwner {
        AgentInfo storage agent = _agents[agentId];
        if (agent.id == 0) revert AgentNotFound();

        agent.wallet = wallet;
        agent.capabilitiesURI = capabilitiesURI;
        agent.metadataURI = metadataURI;

        emit AgentUpdated(agentId);
    }

    function deactivateAgent(uint256 agentId) external onlyOwner {
        AgentInfo storage agent = _agents[agentId];
        if (agent.id == 0) revert AgentNotFound();

        agent.active = false;
        emit AgentDeactivated(agentId);
    }

    function getAgent(uint256 agentId) external view returns (AgentInfo memory) {
        AgentInfo memory agent = _agents[agentId];
        if (agent.id == 0) revert AgentNotFound();
        return agent;
    }

    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }
}