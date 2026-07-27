// One-time (or top-up) deposit of USDC into the coordinator's Gateway Wallet
// on SOURCE_CHAIN. Run this before the demo so the coordinator has a unified
// balance to pay workers from. Get testnet USDC from https://faucet.circle.com
// Run with: npm run deposit
import { createPublicClient, createWalletClient, getContract, http, erc20Abi, formatUnits } from "viem";
import { account, chainConfig, GATEWAY_WALLET_ADDRESS, SOURCE_CHAIN } from "./config.js";

const DEPOSIT_AMOUNT = BigInt(process.env.DEPOSIT_AMOUNT_USDC ?? "5") * 1_000000n;

const gatewayWalletAbi = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

async function main() {
  const sourceConfig = chainConfig[SOURCE_CHAIN];
  console.log(`Using account: ${account.address}`);
  console.log(`Depositing on: ${sourceConfig.chain.name}\n`);

  const publicClient = createPublicClient({ chain: sourceConfig.chain, transport: http() });
  const walletClient = createWalletClient({ account, chain: sourceConfig.chain, transport: http() });

  const usdc = getContract({
    address: sourceConfig.usdcAddress,
    abi: erc20Abi,
    client: { public: publicClient, wallet: walletClient },
  });
  const gatewayWallet = getContract({
    address: GATEWAY_WALLET_ADDRESS,
    abi: gatewayWalletAbi,
    client: { public: publicClient, wallet: walletClient },
  });

  const balance = await usdc.read.balanceOf([account.address]);
  console.log(`Current wallet USDC balance: ${formatUnits(balance, 6)} USDC`);
  if (balance < DEPOSIT_AMOUNT) {
    throw new Error(
      `Insufficient USDC to deposit ${formatUnits(DEPOSIT_AMOUNT, 6)}. Top up at https://faucet.circle.com`,
    );
  }

  console.log(`Approving ${formatUnits(DEPOSIT_AMOUNT, 6)} USDC...`);
  const approveTx = await usdc.write.approve([GATEWAY_WALLET_ADDRESS, DEPOSIT_AMOUNT], { account });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log(`Approved: ${approveTx}`);

  console.log(`Depositing ${formatUnits(DEPOSIT_AMOUNT, 6)} USDC to Gateway Wallet...`);
  const depositTx = await gatewayWallet.write.deposit([sourceConfig.usdcAddress, DEPOSIT_AMOUNT], { account });
  await publicClient.waitForTransactionReceipt({ hash: depositTx });
  console.log(`Deposited: ${depositTx}`);
  console.log(`\nWaiting for finality, then run: npm run balances`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
