import { useEffect } from "react";
import { formatUnits } from "ethers";
import {
  useSignTypedData,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWalletClient,
  type BaseError,
} from "wagmi";
import { Address, concat, numberToHex, size, type Hex } from "viem";
import type { PriceResponse, QuoteResponse } from "../../src/utils/types";
import {
  MAINNET_TOKENS_BY_ADDRESS,
  AFFILIATE_FEE,
  FEE_RECIPIENT,
  POLYGON_TOKENS_BY_ADDRESS,
  BNB_TOKENS_BY_ADDRESS,
} from "../../src/constants";
import Image from "next/image";
import qs from "qs";

const TOKEN_LISTS = {
  1: MAINNET_TOKENS_BY_ADDRESS,
  56: BNB_TOKENS_BY_ADDRESS,
  137: POLYGON_TOKENS_BY_ADDRESS,
};

const getTokenInfo = (chainId: number, tokenAddress: string) => {
  const tokenList = TOKEN_LISTS[chainId as keyof typeof TOKEN_LISTS] || MAINNET_TOKENS_BY_ADDRESS;
  return tokenList[tokenAddress.toLowerCase()] || {
    symbol: 'Unknown',
    decimals: 18,
    logoURI: '/default-token.png'
  };
};

const formatTax = (taxBps: string) => (parseFloat(taxBps) / 100).toFixed(2);

export default function QuoteView({
  taker,
  price,
  quote,
  setQuote,
  chainId,
}: {
  taker: Address | undefined;
  price: PriceResponse;
  quote: QuoteResponse | undefined;
  setQuote: (price: any) => void;
  chainId: number;
}) {
  const { signTypedDataAsync } = useSignTypedData();
  const { data: walletClient } = useWalletClient();
  const {
    data: hash,
    isPending,
    error,
    sendTransaction,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  useEffect(() => {
    const fetchQuote = async () => {
      const params = {
        chainId,
        sellToken: price.sellToken,
        buyToken: price.buyToken,
        sellAmount: price.sellAmount,
        taker,
        swapFeeRecipient: FEE_RECIPIENT,
        swapFeeBps: AFFILIATE_FEE,
        swapFeeToken: price.buyToken,
        tradeSurplusRecipient: FEE_RECIPIENT,
      };

      try {
        const response = await fetch(`/api/quote?${qs.stringify(params)}`);
        const data = await response.json();
        setQuote(data);
      } catch (error) {
        console.error("Error fetching quote:", error);
      }
    };

    fetchQuote();
  }, [chainId, price, taker, setQuote]);

  if (!quote || !price) {
    return <div>Getting best quote...</div>;
  }

  const sellTokenInfo = getTokenInfo(chainId, price.sellToken);
  const buyTokenInfo = getTokenInfo(chainId, price.buyToken);

  const handlePlaceOrder = async () => {
    if (!quote.transaction || !sendTransaction) return;

    try {
      if (quote.permit2?.eip712) {
        const signature = await signTypedDataAsync(quote.permit2.eip712);
        const signatureLengthInHex = numberToHex(size(signature), {
          signed: false,
          size: 32,
        });

        quote.transaction.data = concat([
          quote.transaction.data as Hex,
          signatureLengthInHex as Hex,
          signature as Hex,
        ]);
      }

      await sendTransaction({
        account: walletClient?.account.address,
        gas: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: quote.transaction.value ? BigInt(quote.transaction.value) : undefined,
        chainId,
      });
    } catch (error) {
      console.error("Error placing order:", error);
    }
  };

  return (
    <div className="p-3 mx-auto max-w-screen-sm">
      <TokenInfoCard
        title="You pay"
        amount={formatUnits(quote.sellAmount, sellTokenInfo.decimals)}
        tokenInfo={sellTokenInfo}
      />

      <TokenInfoCard
        title="You receive"
        amount={formatUnits(quote.buyAmount, buyTokenInfo.decimals)}
        tokenInfo={buyTokenInfo}
      />

      <FeeAndTaxInfo quote={quote} buyTokenInfo={buyTokenInfo} sellTokenInfo={sellTokenInfo} />

      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
        disabled={isPending}
        onClick={handlePlaceOrder}
      >
        {isPending ? "Confirming..." : "Place Order"}
      </button>

      <TransactionStatus isConfirming={isConfirming} isConfirmed={isConfirmed} hash={hash} error={error} />
    </div>
  );
}

function TokenInfoCard({ title, amount, tokenInfo }: { title: string; amount: string; tokenInfo: { symbol: string; logoURI: string } }) {
  return (
    <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-sm mb-3">
      <div className="text-xl mb-2 text-white">{title}</div>
      <div className="flex items-center text-lg sm:text-3xl text-white">
        <Image
          alt={tokenInfo.symbol}
          className="h-9 w-9 mr-2 rounded-md"
          src={tokenInfo.logoURI}
          width={36}
          height={36}
        />
        <span>{amount}</span>
        <div className="ml-2">{tokenInfo.symbol}</div>
      </div>
    </div>
  );
}

function FeeAndTaxInfo({ quote, buyTokenInfo, sellTokenInfo }: { 
  quote: QuoteResponse, 
  buyTokenInfo: { symbol: string, decimals: number }, 
  sellTokenInfo: { symbol: string } 
}) {
  return (
    <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-sm mb-3">
      {quote.fees?.integratorFee?.amount && (
        <div className="text-slate-400">
          Affiliate Fee: {formatUnits(BigInt(quote.fees.integratorFee.amount), buyTokenInfo.decimals)} {buyTokenInfo.symbol}
        </div>
      )}
      {quote.tokenMetadata.buyToken.buyTaxBps && quote.tokenMetadata.buyToken.buyTaxBps !== "0" && (
        <div className="text-slate-400">
          {buyTokenInfo.symbol} Buy Tax: {formatTax(quote.tokenMetadata.buyToken.buyTaxBps)}%
        </div>
      )}
      {quote.tokenMetadata.sellToken.sellTaxBps && quote.tokenMetadata.sellToken.sellTaxBps !== "0" && (
        <div className="text-slate-400">
          {sellTokenInfo.symbol} Sell Tax: {formatTax(quote.tokenMetadata.sellToken.sellTaxBps)}%
        </div>
      )}
    </div>
  );
}

function TransactionStatus({ 
  isConfirming, 
  isConfirmed, 
  hash, 
  error 
}: { 
  isConfirming: boolean; 
  isConfirmed: boolean; 
  hash: string | undefined; 
  error: Error | null; 
}) {
  if (isConfirming) {
    return <div className="text-center mt-4">Waiting for confirmation ⏳ ...</div>;
  }
  if (isConfirmed) {
    return (
      <div className="text-center mt-4">
        Transaction Confirmed! 🎉{" "}
        <a href={`https://etherscan.io/tx/${hash}`} className="text-blue-500 hover:underline">
          Check Etherscan
        </a>
      </div>
    );
  }
  if (error) {
    return <div className="text-red-500 mt-4">Error: {(error as BaseError).shortMessage || error.message}</div>;
  }
  return null;
}
