import { useEffect, useState, ChangeEvent } from "react";
import { toUnits, toTokens } from "thirdweb";
import { ConnectButton, useActiveAccount, useActiveWalletChain, useEstimateGas } from "thirdweb/react";
import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
  waitForReceipt,
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
} from "../../src/constants";
import { permit2Abi } from "../../src/utils/permit2abi";
import ZeroExLogo from "../../src/images/white-0x-logo.png";
import Image from "next/image";
import qs from "qs";
import { client } from "../providers";
import { erc20Abi } from "../../src/utils/erc20abi";
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
}: {
  price: any;
  taker: Address | undefined;
  setPrice: (price: any) => void;
  setFinalize: (finalize: boolean) => void;
  chainId: number;
}) {
  const [sellToken, setSellToken] = useState("weth");
  const [buyToken, setBuyToken] = useState("usdc");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [tradeDirection, setTradeDirection] = useState("sell");
  const [error, setError] = useState([]);

  const activeAccount = useActiveAccount();
  const activeChain = useActiveWalletChain();

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
    return MAINNET_TOKENS_BY_SYMBOL;
  };

  const sellTokenObject = tokensByChain(chainId)[sellToken];
  console.log("sellTokenObject", sellTokenObject);
  const buyTokenObject = tokensByChain(chainId)[buyToken];

  const sellTokenDecimals = sellTokenObject.decimals;
  const buyTokenDecimals = buyTokenObject.decimals;
  const sellTokenAddress = sellTokenObject.address;

  // Near the top of your component, where you define parsedSellAmount
  const parsedSellAmount = sellAmount && tradeDirection === "sell"
    ? toUnits(sellAmount, sellTokenDecimals)
    : undefined;

  const parsedBuyAmount =
    buyAmount && tradeDirection === "buy"
      ? toUnits(buyAmount, buyTokenDecimals).toString()
      : undefined;

  const { mutate: estimateGas } = useEstimateGas();

  const fetchBalance = async () => {
    if (activeAccount?.address && sellTokenObject.address && activeChain) {
      const contract = getContract({
        address: sellTokenObject.address,
        abi: erc20Abi,
        client,
        chain: activeChain
      });
      try {
        const balance = await readContract({
          contract,
          method: "balanceOf", // Changed from functionName to method
          params: [activeAccount.address as Address], // Changed from args to params
        });
        return BigInt(balance);
      } catch (error) {
        console.error("Error fetching balance:", error);
        return BigInt(0);
      }
    }
    return BigInt(0);
  };

  const [balance, setBalance] = useState<bigint>(BigInt(0));
  useEffect(() => {
    fetchBalance().then(setBalance);
  }, [activeAccount, sellTokenObject.address]);

  console.log("taker sellToken balance: ", balance);

  const inSufficientBalance =
    balance && sellAmount
      ? toUnits(sellAmount, sellTokenDecimals) > balance
      : true;
  // Fetch price data and set the buyAmount whenever the sellAmount changes
  useEffect(() => {
    const params = {
      chainId: chainId,
      sellToken: sellTokenObject.address,
      buyToken: buyTokenObject.address,
      sellAmount: parsedSellAmount,
      buyAmount: parsedBuyAmount,
      taker,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: AFFILIATE_FEE,
      swapFeeToken: buyTokenObject.address,
      tradeSurplusRecipient: FEE_RECIPIENT,
    };

    async function main() {
      const response = await fetch(`/api/price?${qs.stringify(params)}`);
      const data = await response.json();

      if (data?.validationErrors?.length > 0) {
        // error for sellAmount too low
        setError(data.validationErrors);
      } else {
        setError([]);
      }
      if (data.buyAmount) {
        setBuyAmount(toTokens(data.buyAmount, buyTokenDecimals));
        setPrice(data);
      }
    }

    if (sellAmount !== "") {
      main();
    }
  }, [
    sellTokenObject.address,
    buyTokenObject.address,
    parsedSellAmount,
    parsedBuyAmount,
    chainId,
    sellAmount,
    setPrice,
    FEE_RECIPIENT,
    AFFILIATE_FEE,
  ]);

  // Hook for fetching balance information for specified token for a specific taker address
  /*   const { data, isError, isLoading } = useBalance({
      address: taker,
      token: sellTokenObject.address,
    }); */

  // console.log("taker sellToken balance: ", data);



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
        <ConnectButton client={client} />
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
              src={MAINNET_TOKENS_BY_SYMBOL[sellToken].logoURI}
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
                {MAINNET_TOKENS.map((token) => {
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
          <label htmlFor="buy" className="text-gray-300 mb-2 mr-2">
            Buy
          </label>
          <section className="flex mb-6 mt-4 items-start justify-center">
            <label htmlFor="buy-token" className="sr-only"></label>
            <Image
              alt={buyToken}
              className="h-9 w-9 mr-2 rounded-md"
              src={MAINNET_TOKENS_BY_SYMBOL[buyToken].logoURI}
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
              {/* <option value="">--Choose a token--</option> */}
              {MAINNET_TOKENS.map((token) => {
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
                  MAINNET_TOKENS_BY_SYMBOL[buyToken].decimals
                )
              ) +
              " " +
              MAINNET_TOKENS_BY_SYMBOL[buyToken].symbol
              : null}
          </div>
        </div>

        {taker ? (
          <ApproveOrReviewButton
            sellTokenAddress={MAINNET_TOKENS_BY_SYMBOL[sellToken].address}
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
    const spender = price?.issues.allowance.spender;


    // Read allowance
    const [allowance, setAllowance] = useState<bigint>(BigInt(0));

    const fetchAllowance = async () => {
      if (taker && spender && sellTokenAddress && activeChain) {
        const contract = getContract({
          address: sellTokenAddress,
          abi: erc20Abi,
          client,
          chain: activeChain
        });
        try {
          const result = await readContract({
            contract,
            method: "allowance",
            params: [taker, spender],
          });
          setAllowance(BigInt(result));
        } catch (error) {
          console.error("Error fetching allowance:", error);
          setAllowance(BigInt(0));
        }
      } else {
        setAllowance(BigInt(0));
      }
    };
    useEffect(() => {
      if (taker && spender && sellTokenAddress) {
        fetchAllowance();
      }
    }, [taker, spender, sellTokenAddress]);
    // Send transaction for approval

    const [isApproving, setIsApproving] = useState(false);

    const handleApprove = async () => {
      setIsApproving(true);
      try {
        if (activeChain) {
          const contract = getContract({
            address: sellTokenAddress,
            abi: erc20Abi,
            client,
            chain: activeChain
          });

          const preparedCall = await prepareContractCall({
            contract,
            method: "approve",
            params: [spender, MAX_ALLOWANCE],
          });

          if (!activeAccount) {
            throw new Error("No active account");
          }

          const result = await sendTransaction({
            transaction: preparedCall,
            account: activeAccount,
          });

          console.log("Approval transaction sent:", result.transactionHash);

          // Wait for transaction confirmation
          const receipt = await waitForReceipt(result);
          console.log("Approval transaction confirmed:", receipt);

          // Refetch allowance after approval
          await fetchAllowance();
        }
      } catch (error) {
        console.error("Approval failed:", error);
      } finally {
        setIsApproving(false);
      }
    };

    if (parsedSellAmount && allowance < parsedSellAmount) {
      return (
        <button
          type="button"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
          onClick={handleApprove}
          disabled={isApproving}
        >
          {isApproving ? "Approving…" : "Approve"}
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
