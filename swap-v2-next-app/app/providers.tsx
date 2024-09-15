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
import { createThirdwebClient, defineChain } from "thirdweb";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { walletConnect } from "wagmi/connectors";
import { ThirdwebProvider } from "thirdweb/react";

const { wallets } = getDefaultWallets();

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string;

const config = getDefaultConfig({
  appName: "0x Token Swap dApp",
  projectId,
  wallets: [
    ...wallets,
    {
      groupName: "Other",
      wallets: [argentWallet, trustWallet, ledgerWallet],
    },
  ],
  chains: [mainnet],
  ssr: true,
});

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
export const BNB_SMART_CHAIN = /*@__PURE__*/ defineChain({
  id: 56,
  name: "BNB Smart Chain Mainnet",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  blockExplorers: [
    {
      name: "bscscan",
      url: "https://bscscan.com",
      apiUrl: "https://api.bscscan.com/api",
    },
  ],
  rpc: "https://56.rpc.thirdweb.com/xXtC_IK0yrz-wrPC9pDu9TtF0MAyG6OXixHXBNccACglHjxO8cUDjCPzVbkmI_Zk1BqMp4vgOCl2bIxfDwCWxA",
});
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