"use client";
import PriceView from "./components/price";
import QuoteView from "./components/quote";
import ZeroExLogo from "../src/images/white-0x-logo.png";
import Image from "next/image";
import { useState } from "react";

import type { PriceResponse } from "../src/utils/types";
import { ConnectButton, useActiveAccount, useActiveWalletChain } from "thirdweb/react";
import { client } from "./providers";
import { base, ethereum, polygon } from "thirdweb/chains";
// Page.tsx
function Page() {
  // const { address } = useAccount();

  // const chainId = useChainId() || 1;
  const activeAccount = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const chainId = activeChain?.id || 1;
  console.log("chainId: ", activeChain);
  console.log("address: ", activeAccount?.address);

  const [finalize, setFinalize] = useState(false);
  const [price, setPrice] = useState<PriceResponse | undefined>();
  const [quote, setQuote] = useState();
  
  return (
    <div
      className={`flex min-h-screen flex-col items-center  p-24`}
    >
      
    
      
      {finalize && price ? (
        <QuoteView
          taker={activeAccount?.address}
          price={price}
          quote={quote}
          setQuote={setQuote}
          chainId={chainId}
        />
      ) : (
        <PriceView
          taker={activeAccount?.address}
          price={price}
          setPrice={setPrice}
          setFinalize={() => setFinalize(true)}
          chainId={chainId}
          setQuote={setQuote} // Pass the setQuote function
        />
      )}
    </div>
  );
}

export default Page;
