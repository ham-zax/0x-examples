"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { mainnet, sepolia, polygon, base, baseSepolia } from "wagmi/chains";
import { createThirdwebClient } from "thirdweb";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { ThirdwebProvider } from "thirdweb/react";
import { injected } from "wagmi/connectors";

// Create Wagmi config
export const config = createConfig({
  chains: [mainnet, sepolia, polygon, base, baseSepolia],
  connectors: [injected()], // Empty array as we're using Thirdweb wallet
  ssr: false,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});
console.log("config", config);
declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

const queryClient = new QueryClient();

// Create Thirdweb client
const clientId = createThirdwebClient({
  secretKey: "xXtC_IK0yrz-wrPC9pDu9TtF0MAyG6OXixHXBNccACglHjxO8cUDjCPzVbkmI_Zk1BqMp4vgOCl2bIxfDwCWxA",
});
if (!clientId) {
  throw new Error("No client ID provided");
}

export const client = clientId;

// Define Thirdweb wallets
const thirdwebWallet = [
  createWallet("io.metamask"),
  inAppWallet({
    auth: {
      options: [
        "email",
        "google",
        "apple",
        "facebook",
        "phone",
      ],
    },
  }),
];

export const thirdwebWallets = thirdwebWallet;

// Providers component
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "20px" }}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ThirdwebProvider>
            {children}
          </ThirdwebProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </div>
  );
}
