export const BUOY_VAULT_ADDRESS = "0xb8075D47DF15422e7AAaB50F31A11CEF53197553";

export const ERC20_ABI = [
    {
        type: "function",
        name: "approve",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "allowance",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
] as const;

export const VAULT_ABI = [
    {
        type: "function",
        name: "deposit",
        inputs: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "withdraw",
        inputs: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setDailyCap",
        inputs: [
            { name: "token", type: "address" },
            { name: "cap", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "getBalance",
        inputs: [
            { name: "user", type: "address" },
            { name: "token", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
] as const;

export const TEST_TOKENS = [
    { symbol: "WETH", address: "0x618Ca6A172371b2f364F02c96595f95CfDc1D5e9", decimals: 18 },
    { symbol: "WBTC", address: "0xC19e414e053538E05CA753648Cec0A2522a4791e", decimals: 8 },
    { symbol: "USDC", address: "0xd364559C1cB1E8BB01cAc3F99bA26DFF2E1f14bA", decimals: 6 },
    { symbol: "DAI", address: "0x813b223819b97C0444C15A7146ed4D0B2bBb8413", decimals: 18 },
];