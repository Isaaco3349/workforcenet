// Chain configuration and account setup for Circle Gateway.
// Addresses, domain IDs, and the API base URL are copied verbatim from
// Circle's official docs (developers.circle.com/gateway) — do not edit
// these values without re-checking the source, since incorrect values
// or a stale Gateway Wallet/Minter address will cause signature or mint
// failures.
import { type Address } from "viem";
import { baseSepolia, arcTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

if (!process.env.EVM_PRIVATE_KEY) {
  throw new Error("EVM_PRIVATE_KEY not set in environment (see .env.example)");
}

export const account = privateKeyToAccount(
  process.env.EVM_PRIVATE_KEY as `0x${string}`,
);

// Gateway contract addresses — identical across all EVM testnets.
export const GATEWAY_WALLET_ADDRESS: Address =
  "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
export const GATEWAY_MINTER_ADDRESS: Address =
  "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

export const GATEWAY_API_BASE = "https://gateway-api-testnet.circle.com";

export const chainConfig = {
  arc: {
    chain: arcTestnet,
    usdcAddress: "0x3600000000000000000000000000000000000000" as Address,
    domainId: 26,
  },
  base: {
    chain: baseSepolia,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
    domainId: 6,
  },
} as const;

export type ChainKey = keyof typeof chainConfig;

export const SOURCE_CHAIN = (process.env.GATEWAY_SOURCE_CHAIN ??
  "arc") as ChainKey;
export const DEST_CHAIN = (process.env.GATEWAY_DEST_CHAIN ??
  "base") as ChainKey;

export function stringifyBigInts<T>(obj: T): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}
