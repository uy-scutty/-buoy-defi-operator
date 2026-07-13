"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  useEffect(() => {
    if (isConnected && address) {
      router.push("/dashboard");
    }
  }, [isConnected, address, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <p className="font-mono text-sm text-risk-low tracking-widest uppercase mb-4">
          Introducing Buoy
        </p>
        <h1 className="font-display text-6xl sm:text-7xl font-semibold tracking-tight text-text-primary mb-6">
          Stay Afloat.
        </h1>
        <p className="font-display text-2xl sm:text-3xl text-text-secondary mb-8">
          Your AI DeFi Operations Engineer.
        </p>
        <p className="text-lg text-text-secondary mb-10 leading-relaxed">
          Buoy watches your lending positions 24/7, explains liquidation risk in
          plain English, and prepares transactions for you to approve — never auto-executes.
        </p>
        <button
          onClick={() => connect({ connector: connectors[0] })}
          disabled={isPending}
          className="font-sans font-medium bg-risk-low text-background px-8 py-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Connecting..." : "Connect Wallet"}
        </button>
      </div>
    </div>
  );
}