# Buoy — Your AI DeFi Operations Engineer

**Stay afloat.** Buoy is an autonomous multi-agent AI system that monitors DeFi lending positions 24/7, explains liquidation risk in plain English, and prepares — but never auto-executes — transactions for the user to review and approve.

Built for the X Layer Hackathon.

## The Problem

DeFi borrowers must constantly track Health Factor, LTV, and liquidation risk. Missing a market move can mean instant liquidation. Manual monitoring doesn't scale — for users or for protocol teams.

## What Buoy Does

1. Connect your wallet
2. Buoy reads your real on-chain lending position
3. A **Risk Agent** computes Health Factor, LTV, and liquidation threshold
4. A **Research Agent** gathers supporting protocol/market context
5. A **Supervisor Agent** synthesizes both into a plain-English risk explanation
6. An **Execution Agent** calculates a specific recommended action (repay or supply) and builds a real, unsigned ERC-4337 transaction
7. You review the exact calldata and sign it yourself — Buoy never executes on your behalf

## Architecture

- **Smart Contracts** (Foundry/Solidity): `MockAavePool` (Aave V3-interface-compatible lending pool), `SentinelSmartAccount` (ERC-4337 account), `SentinelAccountFactory` (CREATE2 factory), `AgentRegistry` (on-chain AI agent identity, ERC-8004-inspired)
- **Backend** (Node/Express/TypeScript): four-agent pipeline, Prisma/SQLite, Gemini/OpenAI-swappable LLM provider
- **Frontend** (Next.js/TypeScript/Tailwind v4): wagmi wallet integration, real-time agent status, execution preview

Deployed live on **X Layer Testnet** (chain ID 1952).

## Tech Stack

Solidity · Foundry · ERC-4337 Account Abstraction · Node.js · Express · Prisma · SQLite · Next.js · TypeScript · TailwindCSS · wagmi/viem · Google Gemini

## Running Locally

**Contracts:**
```bash
cd contracts
forge install
forge test
```

**Backend:**
```bash
cd apps/api
npm install
npx prisma migrate dev
npm run dev
```
Requires a `.env` with `XLAYER_TESTNET_RPC`, `MOCK_AAVE_POOL_ADDRESS`, `SENTINEL_ACCOUNT_FACTORY_ADDRESS`, `GEMINI_API_KEY`, `DATABASE_URL`.

**Frontend:**
```bash
cd apps/web
npm install
npm run dev
```

## Design Decisions Worth Knowing

- **`MockAavePool` is an original implementation**, not a copy of Aave's BUSL-1.1-licensed code — it matches Aave V3's `getUserAccountData` interface shape so the adapter can point at the real Aave V3 Pool on X Layer mainnet (live with $23B+ TVL) with a one-line config change.
- **No bundler integration** — transactions are prepared and signed by the user, stopping short of live submission to an ERC-4337 bundler. A deliberate scope decision for demo reliability within the hackathon timeline.
- **`AgentRegistry` is ERC-8004-inspired, not ERC-8004-compliant** — the standard is still evolving; our registry matches its converging field shape behind a swappable interface.