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
      
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
        }}
      >
     {/*    <a href="https://0x.org/" target="_blank" rel="noopener noreferrer">
          <Image src={ZeroExLogo} alt="Icon" width={50} height={50} />
        </a> */}
        <ConnectButton
          chains={[polygon, ethereum, base]}
          theme={"light"}
          detailsModal={
          
            {
          /*     footer: ({ close }) => (
                <button onClick={close} className="text-white">
                  Close
                </button>
              ),
 */
              hideSwitchWallet: false,
            }
          }
          
          connectModal={{ showThirdwebBranding:false, title: "Connect Wallet to Halal.io", size: "wide", welcomeScreen: { title: "Welcome to Halal.io", subtitle: "Find all the Halal Token", img: { src: "https://knowledgbase.s3.eu-west-3.amazonaws.com/output-onlinepngtools+(5)+(1).png",  width: 200, height: 200 } } }}
          client={client}
          
        />
      </header>
      
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
