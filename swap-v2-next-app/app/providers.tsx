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
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { createThirdwebClient } from "thirdweb";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { walletConnect } from "wagmi/connectors";
import { ThirdwebProvider } from "thirdweb/react";

const { wallets } = getDefaultWallets();

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string;

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "20px",
      }}
    >
      <ThirdwebProvider>
        {children}
      </ThirdwebProvider>
    </div>
  );
}

const clientId = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
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