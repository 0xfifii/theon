"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, fallback, http } from "wagmi";
import { injected } from "@wagmi/core";
import { useState, type ReactNode } from "react";
import { elysium, RPC_URL, RPC_FALLBACK } from "@/lib/config";
import { LaunchpadProvider } from "@/lib/launchpad";
import { I18nProvider } from "@/lib/i18n";

const wagmiConfig = createConfig({
  chains: [elysium],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [elysium.id]: RPC_FALLBACK ? fallback([http(RPC_URL), http(RPC_FALLBACK)]) : http(RPC_URL) },
  ssr: true,
});

export default function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <I18nProvider>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <LaunchpadProvider>{children}</LaunchpadProvider>
      </QueryClientProvider>
    </WagmiProvider>
    </I18nProvider>
  );
}
