import { useEffect, useState, ChangeEvent } from "react";
import { toUnits, toTokens, waitForReceipt } from "thirdweb";
import {
  useActiveAccount,
  useActiveWalletChain,
  useEstimateGas,
  useReadContract,
  useSendTransaction,
  useWalletBalance,
  useWaitForReceipt,
  ConnectButton
} from "thirdweb/react";
import {
  getContract,
  readContract,
  prepareContractCall,
} from "thirdweb";
import { Address } from "viem";
import {
  PERMIT2_ADDRESS,
  MAINNET_TOKENS,
  MAINNET_TOKENS_BY_SYMBOL,
  MAINNET_EXCHANGE_PROXY,
  MAX_ALLOWANCE,
  AFFILIATE_FEE,
  FEE_RECIPIENT,
  POLYGON_TOKEN_BY_SYMBOL,
  POLYGON_TOKENS,
} from "../../src/constants";
import { permit2Abi } from "../../src/utils/permit2abi";
import ZeroExLogo from "../../src/images/white-0x-logo.png";
import Image from "next/image";
import qs from "qs";
import { client } from "../providers";
import { WaitForReceiptOptions } from "thirdweb/transaction";

export const DEFAULT_BUY_TOKEN = (chainId: number) => {
  if (chainId === 1) {
    return "weth";
  }
};

export default function PriceView({
  price,
  taker,
  setPrice,
  setFinalize,
  chainId,
  setQuote
}: {
  price: any;
  taker: Address | undefined;
  setPrice: (price: any) => void;
  setFinalize: (finalize: boolean) => void;
  chainId: number;
  setQuote: (quote: any) => void; // Add this prop type

}) {
  const [sellToken, setSellToken] = useState("weth");
  const [buyToken, setBuyToken] = useState("usdc");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [tradeDirection, setTradeDirection] = useState("sell");
  const [error, setError] = useState([]);

  const activeAccount = useActiveAccount();
  const activeChain = useActiveWalletChain() || {
    "id": 1,
    "name": "Ethereum",
    "nativeCurrency": {
      "name": "Ether",
      "symbol": "ETH",
      "decimals": 18
    },
    "blockExplorers": [
      {
        "name": "Etherscan",
        "url": "https://etherscan.io"
      }
    ],
    "rpc": "https://1.rpc.thirdweb.com"
  };

  const handleSellTokenChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSellToken(e.target.value);
  };
  function handleBuyTokenChange(e: ChangeEvent<HTMLSelectElement>) {
    setBuyToken(e.target.value);
  }

  const exchangeProxy = (chainId: number): Address => {
    if (chainId === 1) {
      return MAINNET_EXCHANGE_PROXY;
    }
    return MAINNET_EXCHANGE_PROXY;
  };

  const tokensByChain = (chainId: number) => {
    if (chainId === 1) {
      return MAINNET_TOKENS_BY_SYMBOL;
    }
    if (chainId === 137) {
      return POLYGON_TOKEN_BY_SYMBOL;
    }
    return MAINNET_TOKENS_BY_SYMBOL;
  };

  const sellTokenObject = tokensByChain(chainId)[sellToken];
  if (!sellTokenObject) {
    console.error(`Token ${sellToken} not found for chain ${chainId}`);
    // Handle the error appropriately (e.g., show an error message to the user)
    console.error("Token not found");
  }

  console.log("sellTokenObject", sellTokenObject);
  const buyTokenObject = tokensByChain(chainId)[buyToken];

  const sellTokenDecimals = sellTokenObject?.decimals;
  const buyTokenDecimals = buyTokenObject?.decimals;
  const sellTokenAddress = sellTokenObject?.address;

  const parsedSellAmount = sellAmount && tradeDirection === "sell"
    ? toUnits(sellAmount, sellTokenDecimals)
    : undefined;

  const parsedBuyAmount =
    buyAmount && tradeDirection === "buy"
      ? toUnits(buyAmount, buyTokenDecimals).toString()
      : undefined;

  const { data: balance, isLoading, isError } = useWalletBalance({
    client,
    address: activeAccount?.address,
    chain: activeChain,
  });
  console.log("data: ", {
    client,
    address: activeAccount?.address,
    chain: activeChain,
    tokenAddress: sellTokenAddress
  });
  console.log("balance: ", balance, isLoading, isError);

  const inSufficientBalance =
    balance && sellAmount
      ? toUnits(sellAmount, sellTokenDecimals) > balance.value
      : true;
  // Fetch price data and set the buyAmount whenever the sellAmount changes
  useEffect(() => {
    const params = {
      chainId: chainId,
      sellToken: sellTokenObject?.address,
      buyToken: buyTokenObject?.address,
      sellAmount: parsedSellAmount,
      buyAmount: parsedBuyAmount,
      taker,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: AFFILIATE_FEE,
      swapFeeToken: buyTokenObject?.address,
      tradeSurplusRecipient: FEE_RECIPIENT,
    };

    async function main() {
      const response = await fetch(`/api/price?${qs.stringify(params)}`);
      const data = await response.json();

      if (data?.validationErrors?.length > 0) {
        setError(data.validationErrors);
      } else {
        setError([]);
      }
      if (data.buyAmount) {
        setBuyAmount(toTokens(data.buyAmount, buyTokenDecimals));
        setPrice(data);
        setQuote(data); // Set the quote state when fetching price data
      }
    }

    if (sellAmount !== "") {
      main();
    }

    // Update the sellToken and buyToken when the chain changes
    if (chainId === 1) {
      setSellToken("weth");
      setBuyToken("usdc");
    } else if (chainId === 137) {
      setSellToken("matic");
      setBuyToken("usdc");
    }
  }, [
    sellTokenObject?.address,
    buyTokenObject?.address,
    parsedSellAmount,
    parsedBuyAmount,
    chainId,
    sellAmount,
    setPrice,
    FEE_RECIPIENT,
    AFFILIATE_FEE,
  ]);
  const swapTokens = () => {
    const tempSellToken = sellToken;
    setSellToken(buyToken);
    setBuyToken(tempSellToken);
  };
  // Hook for fetching balance information for specified token for a specific taker address
  /*   const { data, isError, isLoading } = useBalance({
      address: taker,
      token: sellTokenObject?.address,
    }); */

  // console.log("taker sellToken balance: ", data);

  const tokenOptions = chainId === 137 ? POLYGON_TOKENS : MAINNET_TOKENS;
  const tokensBySymbol = chainId === 137 ? POLYGON_TOKEN_BY_SYMBOL : MAINNET_TOKENS_BY_SYMBOL;


  return (
    <div>
      <div className="container mx-auto p-10">
        <header className="text-center py-4">
          <h1 className="text-3xl font-bold">0x Swap Demo</h1>
        </header>

        <p className="text-md text-center p-4 text-gray-500">
          Check out the{" "}
          <u className="underline">
            <a href="https://0x.org/docs/">0x Docs</a>
          </u>{" "}
          and{" "}
          <u className="underline">
            <a href="https://github.com/0xProject/0x-examples/tree/main">
              Code
            </a>
          </u>{" "}
          to build your own
        </p>

        <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-md mb-3">
          <label htmlFor="sell" className="text-gray-300 mb-2 mr-2">
            Sell
          </label>
          <section className="mt-4 flex items-start justify-center">
            <label htmlFor="sell-select" className="sr-only"></label>
            <Image
              alt={sellToken}
              className="h-9 w-9 mr-2 rounded-md"
              src={tokensBySymbol[sellToken]?.logoURI}
              width={6}
              height={6}
            />

            <div className="h-14 sm:w-full sm:mr-2">
              <select
                value={sellToken}
                name="sell-token-select"
                id="sell-token-select"
                className="mr-2 w-50 sm:w-full h-9 rounded-md"
                onChange={handleSellTokenChange}
              >
                {/* <option value="">--Choose a token--</option> */}
                {tokenOptions.map((token) => {
                  return (
                    <option
                      key={token.address}
                      value={token.symbol.toLowerCase()}
                    >
                      {token.symbol}
                    </option>
                  );
                })}
              </select>
            </div>
            <label htmlFor="sell-amount" className="sr-only"></label>
            <input
              id="sell-amount"
              value={sellAmount}
              className="h-9 rounded-md"
              style={{ border: "1px solid black" }}
              type="number"
              onChange={(e) => {
                setTradeDirection("sell");
                setSellAmount(e.target.value);
              }}
            />
          </section>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded mt-4 mb-4"
            onClick={swapTokens}
          >
            Swap Tokens
          </button>

          <label htmlFor="buy" className="text-gray-300 mb-2 mr-2">
            Buy
          </label>
          <section className="flex mb-6 mt-4 items-start justify-center">
            <label htmlFor="buy-token" className="sr-only"></label>
            <Image
              alt={buyToken}
              className="h-9 w-9 mr-2 rounded-md"
              src={tokensBySymbol[buyToken]?.logoURI}
              width={6}
              height={6}
            />
            <select
              name="buy-token-select"
              id="buy-token-select"
              value={buyToken}
              className="mr-2 w-50 sm:w-full h-9 rounded-md"
              onChange={(e) => handleBuyTokenChange(e)}
            >
              {tokenOptions.map((token) => {
                return (
                  <option
                    key={token.address}
                    value={token.symbol.toLowerCase()}
                  >
                    {token.symbol}
                  </option>
                );
              })}
            </select>
            <label htmlFor="buy-amount" className="sr-only"></label>
            <input
              id="buy-amount"
              value={buyAmount}
              className="h-9 rounded-md bg-white cursor-not-allowed"
              type="number"
              style={{ border: "1px solid black" }}
              disabled
              onChange={(e) => {
                setTradeDirection("buy");
                setBuyAmount(e.target.value);
              }}
            />
          </section>

          <div className="text-slate-400">
            {price && price.fees.integratorFee.amount
              ? "Affiliate Fee: " +
              Number(
                toTokens(
                  BigInt(price.fees.integratorFee.amount),
                  tokensBySymbol[buyToken].decimals
                )
              ) +
              " " +
              tokensBySymbol[buyToken].symbol
              : null}
          </div>
        </div>

        {taker && tokensBySymbol[sellToken] ? (
          <ApproveOrReviewButton
            sellTokenAddress={tokensBySymbol[sellToken].address}
            taker={taker}
            onClick={() => {
              setFinalize(true);
            }}
            disabled={inSufficientBalance}
            price={price}
          />
        ) : (
          <div>ConnectButton.Custom was here not needed fornow</div>
        )}
      </div>
    </div>
  );

  function ApproveOrReviewButton({
    taker,
    onClick,
    sellTokenAddress,
    disabled,
    price,
  }: {
    taker: Address;
    onClick: () => void;
    sellTokenAddress: Address;
    disabled?: boolean;
    price: any;
  }) {
    const handleClick = async () => {
      onClick();
    };

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-25"
      >
        {disabled ? "Insufficient Balance" : "Review Trade"}
      </button>
    );
  }
}