import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

export const xLayerTestnet = defineChain({
    id: 1952,
    name: "X Layer Testnet",
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://testrpc.xlayer.tech"] },
    },
});

export const anvilLocal = defineChain({
    id: 31337,
    name: "Anvil Local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: ["http://127.0.0.1:8545"] },
    },
});

export const wagmiConfig = createConfig({
    chains: [anvilLocal, xLayerTestnet],
    connectors: [injected()],
    transports: {
        [anvilLocal.id]: http(),
        [xLayerTestnet.id]: http(),
    },
});