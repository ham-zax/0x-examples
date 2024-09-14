import { useEffect, useState, ChangeEvent } from "react";
import { ethers, formatUnits, parseUnits } from "ethers";
import {
  useBalance,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
  useWriteContract,
  useReadContract,
} from "wagmi";
import { erc20Abi, Address } from "viem";
import {
  MAINNET_TOKENS,
  MAINNET_TOKENS_BY_SYMBOL,
  POLYGON_TOKENS,
  POLYGON_TOKEN_BY_SYMBOL,
  MAX_ALLOWANCE,
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
  useSetActiveWallet,
} from "thirdweb/react";
import { client } from "../providers";
import { Chain, toTokens } from "thirdweb";
import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import { ethereum, polygon } from "thirdweb/chains";
import { viemAdapter } from "thirdweb/adapters/viem";
import { createWalletAdapter } from "thirdweb/wallets";
import { useWaitForTransactionReceipt } from "wagmi";
export const NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export function isNativeTokenAddress(address: string | undefined): boolean {
  return (
    address?.toLowerCase() === NATIVE_TOKEN_ADDRESS ||
    address?.toLowerCase() === '0x0000000000000000000000000000000000000000'
  );
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
  setQuote,
}: {
  price: any;
  taker: Address | undefined;
  setPrice: (price: any) => void;
  setFinalize: (finalize: boolean) => void;
  setQuote: (quote: any) => void;
}) {
  const [sellToken, setSellToken] = useState<string>("weth");
  const [buyToken, setBuyToken] = useState<string>("usdc");
  const [sellAmount, setSellAmount] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("");
  const [tradeDirection, setTradeDirection] = useState<string>("sell");
  const [error, setError] = useState([]);
  const [buyTokenTax, setBuyTokenTax] = useState({
    buyTaxBps: "0",
    sellTaxBps: "0",
  });
  const [sellTokenTax, setSellTokenTax] = useState({
    buyTaxBps: "0",
    sellTaxBps: "0",
  });

  const activeWallet = useActiveWallet();
  const activeChain = useActiveWalletChain();
  const activeAccount = useActiveAccount();
  const chainId = activeChain?.id ?? 1;

  const isWalletConnected = activeAccount !== undefined;
  const isChainDefined = activeChain !== undefined;

  const { data: walletClient } = useWalletClient();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const setActiveWallet = useSetActiveWallet();

  useEffect(() => {
    const setActive = async () => {
      if (!walletClient) {
        console.error("Wallet client is not defined");
        return;
      }

      const wchainId = await walletClient.getChainId();

      const chainMap: { [key: number]: Chain } = {
        1: ethereum,
        137: polygon,
        // Add other chain mappings
      };

      const chain = chainMap[wchainId];

      if (!chain) {
        console.error(`Unsupported chain ID: ${wchainId}`);
        return;
      }

      const adaptedAccount = viemAdapter.walletClient.fromViem({
        walletClient: walletClient,
      });

      const thirdwebWallet = createWalletAdapter({
        client,
        adaptedAccount,
        chain,
        onDisconnect: async () => {
          await disconnectAsync();
        },
        switchChain: async (newChain: Chain) => {
          await switchChainAsync({
            chainId: newChain.id as 1 | 137,
          });
        },
      });

      setActiveWallet(thirdwebWallet);
    };

    setActive();
  }, [walletClient, disconnectAsync, switchChainAsync, setActiveWallet]);

  useEffect(() => {
    const disconnectIfNeeded = async () => {
      if (activeWallet && !walletClient) {
        await activeWallet.disconnect();
      }
    };

    disconnectIfNeeded();
  }, [walletClient, activeWallet]);

  const tokensByChain = (chainId: number) => {
    if (chainId === 1) {
      return MAINNET_TOKENS_BY_SYMBOL;
    } else if (chainId === 137) {
      return POLYGON_TOKEN_BY_SYMBOL;
    }
    console.warn(`Unsupported chain ID: ${chainId}. Defaulting to Mainnet tokens.`);
    return MAINNET_TOKENS_BY_SYMBOL;
  };

  const tokenOptions = chainId === 137 ? POLYGON_TOKENS : MAINNET_TOKENS;
  const tokensBySymbol = tokensByChain(chainId);

  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [provider, setProvider] = useState<ethers.Provider | null>(null);

  useEffect(() => {
    async function getSignerAndProvider() {
      if (isWalletConnected && isChainDefined) {
        const ethersSigner = await ethers6Adapter.signer.toEthers({
          client,
          chain: activeChain,
          account: activeAccount,
        });
        setSigner(ethersSigner);

        const ethersProvider = ethers6Adapter.provider.toEthers({
          client,
          chain: activeChain,
        });
        setProvider(ethersProvider);
      }
    }
    getSignerAndProvider();
  }, [activeAccount, activeChain, client, isWalletConnected, isChainDefined]);

  const sellTokenObject = tokensBySymbol[sellToken];
  const buyTokenObject = tokensBySymbol[buyToken];

  const sellTokenDecimals = sellTokenObject?.decimals;
  const buyTokenDecimals = buyTokenObject?.decimals;
  const sellTokenAddress = sellTokenObject?.address;

  const handleSellTokenChange = (e: ChangeEvent<HTMLSelectElement>) => {
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

  useEffect(() => {
    if (!sellTokenObject) {
      console.error(`Sell token ${sellToken} not found for chain ${chainId}`);
      setSellToken(Object.keys(tokensBySymbol)[0]);
    }
    if (!buyTokenObject) {
      console.error(`Buy token ${buyToken} not found for chain ${chainId}`);
      setBuyToken(Object.keys(tokensBySymbol)[1]);
    }
  }, [chainId, sellToken, buyToken]);

  useEffect(() => {
    setSellToken(DEFAULT_BUY_TOKEN(chainId));
    setBuyToken("usdc");
  }, [chainId]);

  const parsedSellAmount =
  sellAmount && tradeDirection === 'sell'
    ? parseUnits(sellAmount, sellTokenDecimals).toString()
    : undefined;


  const parsedBuyAmount =
    buyAmount && tradeDirection === "buy"
      ? parseUnits(buyAmount, buyTokenDecimals).toString()
      : undefined;

  useEffect(() => {
    const params = {
      chainId: chainId,
      sellToken: sellTokenObject?.address,
      buyToken: buyTokenObject?.address,
      sellAmount: parsedSellAmount,
      buyAmount: parsedBuyAmount,
      taker: activeAccount?.address,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: AFFILIATE_FEE,
      swapFeeToken: buyTokenObject?.address,
      tradeSurplusRecipient: FEE_RECIPIENT,
    };
    console.log("API request parameters:", params);

    async function main() {
      const response = await fetch(`/api/price?${qs.stringify(params)}`);
      const data = await response.json();
      console.log("API response data:", data);
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

  const { data: balanceData } = useBalance({
    address: taker,
    chainId: chainId,
    ...(!isNativeTokenAddress(sellTokenObject?.address)
      ? { token: sellTokenObject?.address }
      : {}),
  });
  

  const inSufficientBalance =
    balanceData && sellAmount
      ? parseUnits(sellAmount, sellTokenDecimals) > balanceData.value
      : true;

  const formatTax = (taxBps: string) => (parseFloat(taxBps) / 100).toFixed(2);

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
            <a href="https://github.com/0xProject/0x-examples/tree/main">Code</a>
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
              width={36}
              height={36}
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
              width={36}
              height={36}
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
            {price?.fees?.integratorFee?.amount ? (
              "Affiliate Fee: " +
              Number(
                formatUnits(
                  BigInt(price.fees.integratorFee.amount),
                  tokensBySymbol[buyToken].decimals
                )
              ) +
              " " +
              tokensBySymbol[buyToken].symbol
            ) : null}
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

        {taker && parsedSellAmount ? (
          <ApproveOrReviewButton
            taker={taker}
            onClick={() => {
              setFinalize(true);
            }}
            sellTokenAddress={sellTokenAddress}
            disabled={inSufficientBalance}
            price={price}
            parsedSellAmount={parsedSellAmount}
            chainId={chainId}
          />
        ) : (
          <ConnectButton client={client} />
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
    parsedSellAmount,
    chainId,
  }: {
    taker: Address;
    onClick: () => void;
    sellTokenAddress: Address;
    disabled?: boolean;
    price: any;
    parsedSellAmount: string;
    chainId: number;
  }) {
    const spender = price?.issues?.allowance?.spender;

    // Check allowance
    const { data: allowance, refetch } = useReadContract({
      address: sellTokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [taker, spender],
      chainId: chainId,
    });
    console.log("disabled", disabled);
    // Determine if approval is needed
    const needsApproval =
      allowance && BigInt(allowance.toString()) < BigInt(parsedSellAmount);

    // Write contract
    const {
      data: writeData,
      writeContract,
      error: writeError,
      status,
      isSuccess,
    } = useWriteContract();

    useEffect(() => {
      if (isSuccess) {
        refetch(); // Refetch allowance after approval
      }
    }, [isSuccess, refetch]);

    const isWriting = status === "pending";

    // Wait for transaction receipt
    const { data: txReceipt, isLoading: isWaiting } = useWaitForTransactionReceipt({
      hash: writeData,
      chainId: chainId,
    });

    if (!price || !spender) {
      // No price data or no allowance issues; show "Review Trade" button
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

    if (needsApproval) {
      return (
        <button
          type="button"
          disabled={isWriting || isWaiting}
          onClick={() =>
            writeContract({
              address: sellTokenAddress,
              abi: erc20Abi,
              functionName: 'approve',
              args: [spender, MAX_ALLOWANCE],
            })
          }
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-700"
        >
          {isWriting || isWaiting ? "Approving..." : "Approve"}
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
