"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignTypedData,
} from "wagmi";
import { parseUnits } from "viem";
import PDFViewer from "@/components/PDFViewer";

const BASE_CONTRACT = "0xb092a63840b1b319d40ee59096fb8b3dd708d1b6"; // Legacy Base ERC1155 contract
const BASE_CHAIN_ID = 8453;

const CELO_CHAIN_ID = 42220;
const CELO_CONTRACT = "0xfeb246a925e6b4ec5f66e2850bf149945be34604";
const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as `0x${string}`;
const TOKEN_ID = 1;
const USDC_DECIMALS = 6;
const PRICE = parseUnits("13", USDC_DECIMALS);

const erc1155Abi = [
  {
    constant: true,
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const hekimaAbi = [
  {
    name: "permitAndMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const usdcAbi = [
  {
    name: "nonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

export default function Home() {
  const { address, isConnected, chain } = useAccount();
  const { data: hash, writeContract } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { isLoading: isMinting, isSuccess: minted } = useWaitForTransactionReceipt({ hash });

  const baseNFT = useReadContract({
    address: BASE_CONTRACT,
    abi: erc1155Abi,
    functionName: "balanceOf",
    args: [address ?? "0x", BigInt(TOKEN_ID)],
    chainId: BASE_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const celoNFT = useReadContract({
    address: CELO_CONTRACT,
    abi: hekimaAbi,
    functionName: "balanceOf",
    args: [address ?? "0x"],
    chainId: CELO_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const usdcNonce = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "nonces",
    args: [address ?? "0x"],
    chainId: CELO_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  useEffect(() => {
    if (minted) {
      celoNFT.refetch?.();
    }
  }, [minted]);

  const ownsNFT =
    isConnected && (Number(baseNFT.data) > 0 || Number(celoNFT.data) > 0);

  const handlePermitAndMint = async () => {
    if (!address || chain?.id !== CELO_CHAIN_ID || usdcNonce.data == null) return;

    const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min

    const domain = {
      name: "USD Coin",
      version: "2",
      chainId: CELO_CHAIN_ID,
      verifyingContract: USDC_ADDRESS,
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      owner: address,
      spender: CELO_CONTRACT,
      value: PRICE,
      nonce: usdcNonce.data,
      deadline,
    };

    const signature = await signTypedDataAsync({
      domain,
      types,
      message,
      primaryType: "Permit",
    });

    const { r, s, v } = splitSig(signature);

    writeContract({
      address: CELO_CONTRACT,
      abi: hekimaAbi,
      functionName: "permitAndMint",
      args: [1, deadline, v, r, s],
      chainId: CELO_CHAIN_ID,
    });
  };

  const splitSig = (sig: `0x${string}`) => {
    const r = sig.slice(0, 66);
    const s = "0x" + sig.slice(66, 130);
    const v = parseInt(sig.slice(130, 132), 16);
    return { r, s, v };
  };

  return (
    <div className="min-h-screen pt-[80px] flex flex-col items-center justify-center px-4 pb-10 pt-10">
      <div className="max-w-full max-h-[calc(100vh-80px-64px)]">
        <Image
          src="/balance.jpg"
          alt="Balance"
          width={600}
          height={600}
          className="object-contain"
          unoptimized
        />
      </div>

      <div className="text-2xl italic font-bold text-white text-center space-y-4 mt-20">
        <p>Written by Sister Tibebwa</p>
        <p>
          Cover illustration by{" "}
          <a
            href="https://x.com/Artoftas"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            artoftas
          </a>
        </p>
      </div>

      <div className="text-xl text-center text-white space-y-4 mt-8">
        <p className="max-w-[600px]">
          In order to read this unique work, you need to purchase an NFT. This
          costs $13. You&apos;ll need a{" "}
          <a
            href="https://www.alchemy.com/overviews/web3-wallets"
            target="_blank"
            className="underline font-bold"
          >
            web3 wallet
          </a>
          .
        </p>
      </div>

      <div className="mt-10 flex flex-col items-center space-y-6 w-full max-w-7xl">
        <ConnectButton />

        {isConnected && (
          <>
            {baseNFT.isLoading || celoNFT.isLoading ? (
              <p className="text-lg">Checking NFT ownership...</p>
            ) : ownsNFT ? (
              <div className="w-full mt-10 px-4">
                <PDFViewer fileUrl="/wisdom/hekima.pdf" />
              </div>
            ) : (
              <div className="text-center">
                {isMinting ? (
                  <p className="text-lg">Minting your NFT...</p>
                ) : (
                  <>
                    <p className="text-lg mb-4">
                      You do not own the required NFT yet.
                    </p>
                    <button
                      onClick={handlePermitAndMint}
                      className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Mint for 13 USDC on Celo
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
