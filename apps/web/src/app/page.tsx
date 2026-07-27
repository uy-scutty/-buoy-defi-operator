"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { motion } from "framer-motion";

const headline = "Stay afloat.";

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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div
        className="absolute w-[700px] h-[700px] rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--brand-violet), transparent 70%)" }}
      />

      <div className="max-w-2xl text-center relative z-10">
        <motion.p
          className="font-mono text-sm tracking-widest uppercase mb-4 font-medium"
          style={{ color: "var(--brand-cyan)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          Introducing Buoy
        </motion.p>

        <motion.h1
          className="font-display text-6xl sm:text-7xl font-bold tracking-tight mb-4"
          style={{ color: "var(--text-primary)" }}
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.4, delayChildren: 0.3 } },
          }}
        >
          {headline.split(" ").map((word, i) => (
            <motion.span
              key={i}
              className="inline-block mr-4"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
              }}
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          className="font-display text-2xl sm:text-3xl mb-8 font-medium"
          style={{ color: "var(--brand-cyan)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          Your AI DeFi operations engineer.
        </motion.p>

        <motion.p
          className="text-lg mb-10 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7, duration: 0.5 }}
        >
          Buoy watches your lending positions 24/7, explains liquidation risk in
          plain English, and protects you automatically — on your own terms.
        </motion.p>

        <motion.button
          onClick={() => connect({ connector: connectors[0] })}
          disabled={isPending}
          className="font-sans font-bold px-8 py-3 rounded-full disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-cyan)", color: "#0B0620" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.9, duration: 0.5 }}
          whileHover={{ scale: 1.04, boxShadow: "0 0 30px rgba(34, 211, 238, 0.6)" }}
          whileTap={{ scale: 0.97 }}
        >
          {isPending ? "Connecting..." : "Connect wallet"}
        </motion.button>
      </div>
    </div>
  );
}