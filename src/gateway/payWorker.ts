// Pays a worker in USDC via Circle Gateway: sign a burn intent against the
// coordinator's unified balance, submit it for attestation, then mint on the
// destination chain into the worker's wallet. Adapted from Circle's verified
// self-managed EVM quickstart (transfer-from-evm.ts).
import { createPublicClient, createWalletClient, getContract, http } from "viem";
import {
  account,
  chainConfig,
  GATEWAY_API_BASE,
  GATEWAY_MINTER_ADDRESS,
  DEST_CHAIN,
  stringifyBigInts,
} from "./config.js";
import {
  createPaymentBurnIntent,
  burnIntentTypedData,
  gatewayMinterAbi,
} from "./burnIntent.js";

export interface PayResult {
  ok: boolean;
  mintTxHash?: `0x${string}`;
  error?: string;
}

export async function payWorkerUsdc(params: {
  recipientAddress: `0x${string}`;
  amountUsdc: number;
}): Promise<PayResult> {
  const { recipientAddress, amountUsdc } = params;

  try {
    // [1] Build and sign the burn intent against the coordinator's balance.
    const intent = createPaymentBurnIntent({
      depositorAddress: account.address,
      recipientAddress,
      amountUsdc,
    });
    const typedData = burnIntentTypedData(intent);
    const signature = await account.signTypedData(typedData);
    const requests = [{ burnIntent: typedData.message, signature }];

    // [2] Submit to the Gateway API for attestation.
    const response = await fetch(`${GATEWAY_API_BASE}/v1/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stringifyBigInts(requests),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Gateway API error ${response.status}: ${text}` };
    }

    const json = (await response.json()) as {
      attestation?: string;
      signature?: string;
    };
    const { attestation, signature: operatorSig } = json;

    if (!attestation || !operatorSig) {
      return { ok: false, error: "Gateway API response missing attestation" };
    }

    // [3] Mint on the destination chain into the worker's wallet.
    const destConfig = chainConfig[DEST_CHAIN];

    const destClient = createPublicClient({
      chain: destConfig.chain,
      transport: http(),
    });
    const walletClient = createWalletClient({
      account,
      chain: destConfig.chain,
      transport: http(),
    });

    const minter = getContract({
      address: GATEWAY_MINTER_ADDRESS,
      abi: gatewayMinterAbi,
      client: { public: destClient, wallet: walletClient },
    });

    const mintTx = await minter.write.gatewayMint(
      [attestation as `0x${string}`, operatorSig as `0x${string}`],
      { account },
    );
    await destClient.waitForTransactionReceipt({ hash: mintTx });

    return { ok: true, mintTxHash: mintTx };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
