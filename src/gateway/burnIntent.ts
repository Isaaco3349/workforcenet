// EIP-712 burn intent construction for Circle Gateway.
//
// The `domain`, `EIP712Domain`, `TransferSpec`, and `BurnIntent` type
// definitions below are copied verbatim from Circle's official Gateway
// quickstart (developers.circle.com/gateway/quickstarts/unified-balance-evm).
// Per Circle's own integration rules: never modify these field names, types,
// or ordering — doing so produces invalid signatures.
import { randomBytes } from "node:crypto";
import { pad, zeroAddress, maxUint256, type Hex } from "viem";
import {
  GATEWAY_WALLET_ADDRESS,
  GATEWAY_MINTER_ADDRESS,
  chainConfig,
  SOURCE_CHAIN,
  DEST_CHAIN,
  type ChainKey,
} from "./config.js";

const MAX_FEE = 2_010000n; // 2.01 USDC — Gateway's documented example max fee

const domain = { name: "GatewayWallet", version: "1" };

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
] as const;

const TransferSpec = [
  { name: "version", type: "uint32" },
  { name: "sourceDomain", type: "uint32" },
  { name: "destinationDomain", type: "uint32" },
  { name: "sourceContract", type: "bytes32" },
  { name: "destinationContract", type: "bytes32" },
  { name: "sourceToken", type: "bytes32" },
  { name: "destinationToken", type: "bytes32" },
  { name: "sourceDepositor", type: "bytes32" },
  { name: "destinationRecipient", type: "bytes32" },
  { name: "sourceSigner", type: "bytes32" },
  { name: "destinationCaller", type: "bytes32" },
  { name: "value", type: "uint256" },
  { name: "salt", type: "bytes32" },
  { name: "hookData", type: "bytes" },
] as const;

const BurnIntent = [
  { name: "maxBlockHeight", type: "uint256" },
  { name: "maxFee", type: "uint256" },
  { name: "spec", type: "TransferSpec" },
] as const;

export const gatewayMinterAbi = [
  {
    type: "function",
    name: "gatewayMint",
    inputs: [
      { name: "attestationPayload", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

function addressToBytes32(address: string): Hex {
  return pad(address.toLowerCase() as Hex, { size: 32 });
}

/**
 * Builds a burn intent that pays `amountUsdc` from the coordinator's Gateway
 * balance on SOURCE_CHAIN to `recipientAddress` on DEST_CHAIN.
 */
export function createPaymentBurnIntent(params: {
  depositorAddress: `0x${string}`;
  recipientAddress: `0x${string}`;
  amountUsdc: number;
  sourceChain?: ChainKey;
  destChain?: ChainKey;
}) {
  const {
    depositorAddress,
    recipientAddress,
    amountUsdc,
    sourceChain = SOURCE_CHAIN,
    destChain = DEST_CHAIN,
  } = params;

  const sourceConfig = chainConfig[sourceChain];
  const destConfig = chainConfig[destChain];
  const value = BigInt(Math.round(amountUsdc * 1_000_000)); // USDC has 6 decimals

  return {
    maxBlockHeight: maxUint256,
    maxFee: MAX_FEE,
    spec: {
      version: 1,
      sourceDomain: sourceConfig.domainId,
      destinationDomain: destConfig.domainId,
      sourceContract: GATEWAY_WALLET_ADDRESS,
      destinationContract: GATEWAY_MINTER_ADDRESS,
      sourceToken: sourceConfig.usdcAddress,
      destinationToken: destConfig.usdcAddress,
      sourceDepositor: depositorAddress,
      destinationRecipient: recipientAddress,
      sourceSigner: depositorAddress,
      destinationCaller: zeroAddress,
      value,
      salt: ("0x" + randomBytes(32).toString("hex")) as Hex,
      hookData: "0x" as Hex,
    },
  };
}

export function burnIntentTypedData(
  burnIntent: ReturnType<typeof createPaymentBurnIntent>,
) {
  return {
    types: { EIP712Domain, TransferSpec, BurnIntent },
    domain,
    primaryType: "BurnIntent" as const,
    message: {
      ...burnIntent,
      spec: {
        ...burnIntent.spec,
        sourceContract: addressToBytes32(burnIntent.spec.sourceContract),
        destinationContract: addressToBytes32(
          burnIntent.spec.destinationContract,
        ),
        sourceToken: addressToBytes32(burnIntent.spec.sourceToken),
        destinationToken: addressToBytes32(burnIntent.spec.destinationToken),
        sourceDepositor: addressToBytes32(burnIntent.spec.sourceDepositor),
        destinationRecipient: addressToBytes32(
          burnIntent.spec.destinationRecipient,
        ),
        sourceSigner: addressToBytes32(burnIntent.spec.sourceSigner),
        destinationCaller: addressToBytes32(burnIntent.spec.destinationCaller),
      },
    },
  };
}
