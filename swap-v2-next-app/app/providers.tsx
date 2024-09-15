"use client";

import * as React from "react";
import {
  bsc,
  mainnet,
  polygon,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { createThirdwebClient, defineChain } from "thirdweb";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { ThirdwebProvider } from "thirdweb/react";

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string;


const config = createConfig({
  chains: [mainnet, polygon, bsc],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
  },
});
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "20px",
      }}
    >
      <ThirdwebProvider>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </ThirdwebProvider>
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