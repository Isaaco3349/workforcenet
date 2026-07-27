// Usage: node --env-file=.env --experimental-strip-types src/worker/run.ts <skill> <port>
// Wallet + price are read from env so each worker can be a genuinely separate
// process/deployment with its own payout address.
import { startWorker } from "./service.js";
import type { Skill } from "../types.js";

const [, , skillArg, portArg] = process.argv;

if (!skillArg || !portArg) {
  console.error("Usage: npm run worker:<extract|categorize|report>");
  process.exit(1);
}

const walletAddress = process.env.WORKER_WALLET_ADDRESS;
if (!walletAddress) {
  console.error("Set WORKER_WALLET_ADDRESS in the environment before starting a worker.");
  process.exit(1);
}

const port = Number(portArg);

startWorker({
  skill: skillArg as Skill,
  port,
  walletAddress,
  priceUsdc: Number(process.env.WORKER_PRICE_USDC ?? "0.5"),
  etaSeconds: Number(process.env.WORKER_ETA_SECONDS ?? "5"),
});

// Self-register with the coordinator so it can be discovered for bidding.
// Retries briefly in case the coordinator hasn't started yet.
async function registerWithCoordinator(retriesLeft = 10) {
  const coordinatorUrl = process.env.COORDINATOR_URL ?? "http://localhost:4000";
  try {
    await fetch(`${coordinatorUrl}/workers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skill: skillArg,
        url: `http://localhost:${port}`,
        walletAddress,
      }),
    });
    console.log(`[worker:${skillArg}] registered with coordinator at ${coordinatorUrl}`);
  } catch {
    if (retriesLeft <= 0) {
      console.error(`[worker:${skillArg}] could not reach coordinator at ${coordinatorUrl}`);
      return;
    }
    setTimeout(() => registerWithCoordinator(retriesLeft - 1), 1000);
  }
}

registerWithCoordinator();
