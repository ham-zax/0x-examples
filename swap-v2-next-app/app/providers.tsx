"use client";

import * as React from "react";
import {
  RainbowKitProvider,
  getDefaultWallets,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import {
  argentWallet,
  trustWallet,
  ledgerWallet,
} from "@rainbow-me/rainbowkit/wallets";
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { createThirdwebClient } from "thirdweb";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { ThirdwebProvider } from "thirdweb/react";

export const config = createConfig({
	chains: [mainnet, sepolia, polygon, base, baseSepolia],
	connectors: [injected(), coinbaseWallet({ appName: "Create Wagmi" })],
	ssr: true,
	transports: {
		[mainnet.id]: http(),
		[sepolia.id]: http(),
		[polygon.id]: http(),
		[base.id]: http(),
		[baseSepolia.id]: http(),
	},
});

declare module "wagmi" {
	interface Register {
		config: typeof config;
	}
}


const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "20px",
      }}
    >
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

const clientId = createThirdwebClient({
  secretKey: "xXtC_IK0yrz-wrPC9pDu9TtF0MAyG6OXixHXBNccACglHjxO8cUDjCPzVbkmI_Zk1BqMp4vgOCl2bIxfDwCWxA",
});
if (!clientId) {
  throw new Error("No client ID provided");
}

export const client = clientId;

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