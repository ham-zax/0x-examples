import { useEffect, useState, ChangeEvent } from "react";
import { Address } from "viem";
import { createThirdwebClient } from "thirdweb";
import {
  MAINNET_TOKENS,
  MAINNET_TOKENS_BY_SYMBOL,
  POLYGON_TOKENS,
  POLYGON_TOKENS_BY_SYMBOL,
  AFFILIATE_FEE,
  FEE_RECIPIENT,
  BNB_TOKENS_BY_SYMBOL,
  BNB_TOKENS,
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
  useNetworkSwitcherModal,
  useSwitchActiveWalletChain,
} from "thirdweb/react";
import { BNB_SMART_CHAIN, client } from "../providers";
import { getContract, NATIVE_TOKEN_ADDRESS, toTokens, toUnits } from "thirdweb";
import { approve, allowance } from "thirdweb/extensions/erc20";
import { base, ethereum, polygon, sepolia } from "thirdweb/chains";
export function isNativeTokenAddress(address: Address) {
  return address.toLowerCase() === NATIVE_TOKEN_ADDRESS;
}
export const DEFAULT_BUY_TOKEN = (chainId: number) => {
  if (chainId === 1) {
    return "weth";
  } else if (chainId === 137) {
    return "pol";
  }
  else if (chainId === 56) {
    return "usdt";
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
      return POLYGON_TOKENS_BY_SYMBOL;
    } else if (chainId === 56) {
      return BNB_TOKENS_BY_SYMBOL;
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
    chainId === 137 ? POLYGON_TOKENS : chainId === 56 ? BNB_TOKENS : MAINNET_TOKENS;
  const tokensBySymbol =
    chainId === 137 ? POLYGON_TOKENS_BY_SYMBOL : chainId === 56 ? BNB_TOKENS_BY_SYMBOL : MAINNET_TOKENS_BY_SYMBOL;

  const tokenList = tokensByChain(chainId);
  const sellTokenObject = tokenList[sellToken] || tokenList[DEFAULT_BUY_TOKEN(chainId)];
  const buyTokenObject = tokenList[buyToken] || tokenList['usdc'];
  console.log("sellTokenObject", sellTokenObject);
  console.log("buyTokenObject", buyTokenObject);
  if (!sellTokenObject) {
    console.error(`Sell token ${sellToken} not found for chain ${chainId}. Using default.`);
  }
  if (!buyTokenObject) {
    console.error(`Buy token ${buyToken} not found for chain ${chainId}. Using USDC.`);
  }
  const sellTokenDecimals = sellTokenObject?.decimals || 18; // Default to 18 if undefined
  const buyTokenDecimals = buyTokenObject?.decimals || 18; // Default to 18 if undefined
  const sellTokenAddress = sellTokenObject?.address || NATIVE_TOKEN_ADDRESS; // Use native token address as fallback

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
    <div className="bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-900">
      <header className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 shadow-md">
        <a href="https://0x.org/" target="_blank" rel="noopener noreferrer" className="flex items-center">
          <Image src={ZeroExLogo} alt="0x Logo" width={40} height={40} className="mr-2" />
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">0x Swap</span>
        </a>
        <div className="flex items-center space-x-4">
          <NetworkSwitcher activeChain={activeChain} />
          <ConnectButton client={client} chains={[ethereum, polygon, BNB_SMART_CHAIN]} />
        </div>
      </header>

      <main className="container mx-auto p-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">0x Swap Demo</h1>

        <p className="text-lg text-center mb-8 text-gray-600 dark:text-gray-300">
          Explore the{" "}
          <a href="https://0x.org/docs/" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline">0x Docs</a>
          {" "}and{" "}
          <a href="https://github.com/0xProject/0x-examples/tree/main" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline">Code Examples</a>
          {" "}to build your own swap interface
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <div className="mb-6">
            <label htmlFor="sell" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sell</label>
            <div className="flex items-center space-x-4">
              <Image
                alt={sellToken}
                className="h-8 w-8 rounded-full"
                src={tokensBySymbol[sellToken]?.logoURI}
                width={32}
                height={32}
              />
              <select
                value={sellToken}
                name="sell-token-select"
                id="sell-token-select"
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                onChange={handleSellTokenChange}
              >
                {tokenOptions.map((token) => (
                  <option key={token.address} value={token.symbol.toLowerCase()}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              <input
                id="sell-amount"
                value={sellAmount}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                type="number"
                placeholder="Amount"
                onChange={(e) => {
                  setTradeDirection("sell");
                  setSellAmount(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="flex justify-center">
            <button
              className="w-1/2 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300 ease-in-out mb-6"
              onClick={swapTokens}
            >
              ↕ Swap Tokens
            </button>
          </div>


          <div className="mb-6">
            <label htmlFor="buy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Buy</label>
            <div className="flex items-center space-x-4">
              <Image
                alt={buyToken}
                className="h-8 w-8 rounded-full"
                src={tokensBySymbol[buyToken]?.logoURI}
                width={32}
                height={32}
              />
              <select
                name="buy-token-select"
                id="buy-token-select"
                value={buyToken}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                onChange={handleBuyTokenChange}
              >
                {tokenOptions.map((token) => (
                  <option key={token.address} value={token.symbol.toLowerCase()}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              <input
                id="buy-amount"
                value={buyAmount}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-100 cursor-not-allowed dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300"
                type="number"
                placeholder="Amount"
                disabled
              />
            </div>
          </div>

          {/* Affiliate Fee Display */}
          {price?.fees?.integratorFee?.amount && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Affiliate Fee: {Number(toTokens(BigInt(price.fees.integratorFee.amount), tokensBySymbol[buyToken].decimals))} {tokensBySymbol[buyToken].symbol}
            </div>
          )}

          {/* Tax Information Display */}
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {buyTokenTax.buyTaxBps !== "0" && (
              <p>{tokensBySymbol[buyToken].symbol} Buy Tax: {formatTax(buyTokenTax.buyTaxBps)}%</p>
            )}
            {sellTokenTax.sellTaxBps !== "0" && (
              <p>{tokensBySymbol[sellToken].symbol} Sell Tax: {formatTax(sellTokenTax.sellTaxBps)}%</p>
            )}
          </div>

          {taker ? (
            <ApproveOrReviewButton
              taker={taker}
              onClick={() => setFinalize(true)}
              sellTokenAddress={sellTokenAddress}
              disabled={inSufficientBalance}
              price={price}
              client={client}
              activeChain={activeChain}
            />
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-400">Loading price data...</div>
          )}
        </div>
      </main>
    </div>
  );

  function NetworkSwitcher({ activeChain }: { activeChain: any }) {
    // const switchChain = useSwitchActiveWalletChain();
    const { open: openNetworkSwitcherModal } = useNetworkSwitcherModal(

    );
/*     const handleSwitchChain = async (chainId: number) => {
      const chain = chainId === 1 ? ethereum : polygon;
      try {
        await switchChain(chain);
      } catch (error) {
        console.error("Failed to switch chain:", error);
      }
    }; */

    return (
      <div className="flex space-x-2">
        <button
          onClick={() => openNetworkSwitcherModal(
            {
              client,
              theme: 'dark',
              sections: [
                { label: 'Recently used', chains: [ethereum, polygon,BNB_SMART_CHAIN] },
                { label: 'Popular', chains: [base, ethereum, polygon,BNB_SMART_CHAIN] },
              ]
            }
          )}
          className="px-4 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          Switch Network
        </button>
        <span className="px-4 py-2 text-sm bg-gray-100 rounded-md dark:bg-gray-600 dark:text-white">
          Current: {activeChain ? activeChain.name : 'Not connected'}
        </span>
      </div>
    );
  }

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
    const hasAllowanceIssue = price?.issues?.allowance !== null && price?.issues?.allowance !== undefined;
    const spender = price?.issues?.allowance?.spender;

    const contract = getContract({
      client,
      chain: activeChain,
      address: sellTokenAddress,
    });

    const { data: allowanceData, isLoading: isAllowanceLoading } = useReadContract(allowance, {
      contract,
      owner: taker,
      spender: spender,
    });

    const { mutate: sendTransaction, isPending: isApproving } = useSendTransaction();

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
