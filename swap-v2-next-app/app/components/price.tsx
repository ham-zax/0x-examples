import { useEffect, useState, ChangeEvent } from "react";
import { Address } from "viem";
import {
  MAINNET_TOKENS,
  MAINNET_TOKENS_BY_SYMBOL,
  POLYGON_TOKENS,
  POLYGON_TOKEN_BY_SYMBOL,
  AFFILIATE_FEE,
  FEE_RECIPIENT,
} from "../../src/constants";
import ZeroExLogo from "../../src/images/white-0x-logo.png";
import Image from "next/image";
import qs from "qs";
import {
  ConnectButton,
  useActiveAccount,
  useActiveWallet,
  useActiveWalletChain,
  useReadContract,
  useSendTransaction,
  useWalletBalance,
} from "thirdweb/react";
import { client } from "../providers";
import { getContract, NATIVE_TOKEN_ADDRESS, toTokens } from "thirdweb";
import { toUnits } from "thirdweb";
import { approve, allowance } from "thirdweb/extensions/erc20";

import { ethereum, polygon } from "thirdweb/chains";
export function isNativeTokenAddress(address: Address) {
  return address.toLowerCase() === NATIVE_TOKEN_ADDRESS;
}
export const DEFAULT_BUY_TOKEN = (chainId: number) => {
  if (chainId === 1) {
    return "weth";
  } else if (chainId === 137) {
    return "matic";
  }
  return "usdc";
};

export default function PriceView({
  price,
  taker,
  setPrice,
  setFinalize,
  chainId,
  setQuote,
}: {
  price: any;
  taker: Address | undefined;
  setPrice: (price: any) => void;
  setFinalize: (finalize: boolean) => void;
  setQuote: (quote: any) => void;
  chainId: number;
}) {
  const tokensByChain = (chainId: number) => {
    if (chainId === 1) {
      return MAINNET_TOKENS_BY_SYMBOL;
    } else if (chainId === 137) {
      return POLYGON_TOKEN_BY_SYMBOL;
    }
    console.warn(`Unsupported chain ID: ${chainId}. Defaulting to Mainnet tokens.`);
    return MAINNET_TOKENS_BY_SYMBOL;
  };
  const [sellToken, setSellToken] = useState(() => {
    const initialTokens = tokensByChain(chainId);
    return Object.keys(initialTokens)[0] || "weth";
  });
  const [buyToken, setBuyToken] = useState(() => {
    const initialTokens = tokensByChain(chainId);
    return Object.keys(initialTokens)[1] || "usdc";
  });
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [tradeDirection, setTradeDirection] = useState("sell");
  const [error, setError] = useState([]);
  const [buyTokenTax, setBuyTokenTax] = useState({
    buyTaxBps: "0",
    sellTaxBps: "0",
  });
  const [sellTokenTax, setSellTokenTax] = useState({
    buyTaxBps: "0",
    sellTaxBps: "0",
  });

  const tokenOptions =
    chainId === 137 ? POLYGON_TOKENS : MAINNET_TOKENS;
  const tokensBySymbol =
    chainId === 137 ? POLYGON_TOKEN_BY_SYMBOL : MAINNET_TOKENS_BY_SYMBOL;

  const tokenList = tokensByChain(chainId);
  const sellTokenObject = tokenList[sellToken];
  const buyTokenObject = tokenList[buyToken];
  console.log("sellTokenObject", sellTokenObject);
  console.log("buyTokenObject", buyTokenObject);
  if (!sellTokenObject) {
    console.error(`Sell token ${sellToken} not found for chain ${chainId}`);
  }
  if (!buyTokenObject) {
    console.error(`Buy token ${buyToken} not found for chain ${chainId}`);
  }
  const sellTokenDecimals = sellTokenObject?.decimals;
  const buyTokenDecimals = buyTokenObject?.decimals;
  const sellTokenAddress = sellTokenObject?.address;

  const activeWallet = useActiveWallet();
  const activeChain = useActiveWalletChain();
  const activeAccount = useActiveAccount();
  const {
    data: balanceData,
    isError,
    isLoading,
  } = useWalletBalance({
    client,
    chain: activeChain,
    address: taker,
    ...(sellTokenObject?.address && !isNativeTokenAddress(sellTokenObject.address)
    ? { tokenAddress: sellTokenObject.address }
    : {}),
  });


  // Ensure activeWallet and activeChain are defined
  const isWalletConnected = activeAccount !== undefined;
  const isChainDefined = activeChain !== undefined;

  const handleSellTokenChange = (e: ChangeEvent<HTMLSelectElement>) => {
    console.log("sellTokenObject before change:", sellTokenObject);
    setSellToken(e.target.value);
  };

  const handleBuyTokenChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setBuyToken(e.target.value);
  };

  const swapTokens = () => {
    const tempSellToken = sellToken;
    setSellToken(buyToken);
    setBuyToken(tempSellToken);
  };

  const parsedSellAmount =
    sellAmount && tradeDirection === "sell"
      ? toUnits(sellAmount, sellTokenDecimals).toString()
      : undefined;

  const parsedBuyAmount =
    buyAmount && tradeDirection === "buy"
      ? toUnits(buyAmount, buyTokenDecimals).toString()
      : undefined;
  console.log("taker:", taker);
  console.log("price:", price);
  console.log("price?.issues.allowance:", price?.issues?.allowance);
  useEffect(() => {
    if (!sellTokenObject) {
      console.error(`Sell token ${sellToken} not found for chain ${chainId}`);
      // Set a default token if the current one is not found
      setSellToken(Object.keys(tokenList)[0]);
    }
    if (!buyTokenObject) {
      console.error(`Buy token ${buyToken} not found for chain ${chainId}`);
      // Set a default token if the current one is not found
      setBuyToken(Object.keys(tokenList)[1]);
    }
  }, [chainId, sellToken, buyToken]);

  useEffect(() => {
    setSellToken(DEFAULT_BUY_TOKEN(chainId));
    setBuyToken("usdc");
  }, [chainId]);

  // Fetch price data and set the buyAmount whenever the sellAmount changes
  useEffect(() => {
    if (!sellTokenObject || !buyTokenObject) {
      console.error("Sell or buy token object is undefined");
      return;
    }
    console.log("sellTokenObject before price fetch:", sellTokenObject);
    const params = {
      chainId: chainId,
      sellToken: sellTokenObject.address,
      buyToken: buyTokenObject.address,
      sellAmount: parsedSellAmount,
      buyAmount: parsedBuyAmount,
      taker: taker,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: AFFILIATE_FEE,
      swapFeeToken: buyTokenObject.address,
      tradeSurplusRecipient: FEE_RECIPIENT,
    };
    console.log("API request parameters:", params);

    async function main() {
      const response = await fetch(`/api/price?${qs.stringify(params)}`);
      const data = await response.json();
      console.log("API response data:", data);
      // these used to be inside the buyamount if statement
      setPrice(data);
      setQuote(data);
      if (data.buyAmount) {
        setBuyAmount(toTokens(data.buyAmount, buyTokenDecimals));
      } else {
        console.warn("No buyAmount in API response");
      }
      if (data?.validationErrors?.length > 0) {
        setError(data.validationErrors);
      } else {
        setError([]);
      }
    }

    if (sellAmount !== "" && isWalletConnected && sellTokenObject && buyTokenObject) {
      main();
    } else {
      console.log("Not all conditions met for API call");
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
    activeAccount,
    isWalletConnected,
  ]);

  // Hook for fetching balance information for specified token for a specific taker address

  const inSufficientBalance =
    balanceData && sellAmount
      ? BigInt(toUnits(sellAmount, sellTokenDecimals)) > balanceData.value
      : true;
  console.log('Balance:', balanceData?.value);
  console.log('Sell Amount:', BigInt(toUnits(sellAmount, sellTokenDecimals)));
  console.log('inSufficientBalance:', inSufficientBalance);
  // Helper function to format tax basis points to percentage
  const formatTax = (taxBps: string) => (parseFloat(taxBps) / 100).toFixed(2);
  console.log("price " + JSON.stringify(price));
  console.log("taker " + JSON.stringify(taker));
  console.log("activeAccount " + JSON.stringify(activeAccount));
  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <a href="https://0x.org/" target="_blank" rel="noopener noreferrer">
          <Image src={ZeroExLogo} alt="Icon" width={50} height={50} />
        </a>
        <ConnectButton client={client} chain={ethereum} chains={[ethereum, polygon]} />
      </header>

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
              width={9}
              height={9}
            />

            <div className="h-14 sm:w-full sm:mr-2">
              <select
                value={sellToken}
                name="sell-token-select"
                id="sell-token-select"
                className="mr-2 w-50 sm:w-full h-9 rounded-md"
                onChange={handleSellTokenChange}
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
              width={9}
              height={9}
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

          {/* Affiliate Fee Display */}
          <div className="text-slate-400">
            {price?.fees?.integratorFee?.amount
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

          {/* Tax Information Display */}
          <div className="text-slate-400">
            {buyTokenTax.buyTaxBps !== "0" && (
              <p>
                {tokensBySymbol[buyToken].symbol +
                  ` Buy Tax: ${formatTax(buyTokenTax.buyTaxBps)}%`}
              </p>
            )}
            {sellTokenTax.sellTaxBps !== "0" && (
              <p>
                {tokensBySymbol[sellToken].symbol +
                  ` Sell Tax: ${formatTax(sellTokenTax.sellTaxBps)}%`}
              </p>
            )}
          </div>
        </div>

        {taker ? (
          <ApproveOrReviewButton
            taker={taker}
            onClick={() => {
              setFinalize(true);
            }}
            sellTokenAddress={sellTokenAddress}
            disabled={inSufficientBalance}
            price={price}
            client={client}
            activeChain={activeChain}
          />
        ) : (
          <div>Loading price data...</div>
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
    client,
    activeChain,
  }: {
    taker: Address;
    onClick: () => void;
    sellTokenAddress: Address;
    disabled?: boolean;
    price: any;
    client: any;
    activeChain: any;
  }) {
    const hasAllowanceIssue =
      price?.issues?.allowance !== null &&
      price?.issues?.allowance !== undefined;
    const spender = price?.issues?.allowance?.spender;

    const contract = getContract({
      client,
      chain: activeChain,
      address: sellTokenAddress,
    });

    const {
      data: allowanceData,
      isLoading: isAllowanceLoading,
      error: allowanceError,
    } = useReadContract(allowance, {
      contract,
      owner: taker,
      spender: spender,
    });

    const { mutateAsync: sendTransaction, status } = useSendTransaction();
    const isApproving = status === "pending";

    const handleApprove = async () => {
      const transaction = approve({
        contract,
        spender,
        amount: balanceData?.value ? toTokens(balanceData.value, sellTokenDecimals) : "0",
      });

      try {
        await sendTransaction(transaction);
      } catch (error) {
        console.error("Error during approval:", error);
      }
    };

    if (!hasAllowanceIssue) {
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-25"
        >
          {disabled ? "Insufficient Balance" : "Review Trade"}
        </button>
      );
    }
    if (isAllowanceLoading) {
      return <div>Checking allowance...</div>;
    }

    if (allowanceData === undefined || allowanceData === BigInt(0)) {
      return (
        <button
          type="button"
          onClick={handleApprove}
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-700"
        >
          {isApproving ? "Approving..." : "Approve"}
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-25"
      >
        {disabled ? "Insufficient Balance" : "Review Trade"}
      </button>
    );
  }
}
