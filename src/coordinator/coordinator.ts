import { randomUUID } from "node:crypto";
import type { Job, Subtask, WorkerInfo, Skill, Receipt } from "../types.js";
import { listWorkersForSkill } from "./registry.js";
import { verifyOutput } from "./verify.js";
import { recordOutcome, recordReceipt } from "./ledger.js";
import { payWorkerUsdc } from "../gateway/payWorker.js";

interface SubtaskLogEntry {
  subtask: Subtask;
  winner?: WorkerInfo;
  bidPriceUsdc?: number;
  output?: unknown;
  verified?: boolean;
  receipt?: Receipt;
  error?: string;
}

export interface JobRunLog {
  job: Job;
  steps: SubtaskLogEntry[];
}

/** Splits a job (a set of documents) into the fixed 3-stage pipeline. */
function splitJob(job: Job): Subtask[] {
  const extractSubtasks: Subtask[] = job.inputs.map((filePath) => ({
    id: randomUUID(),
    jobId: job.id,
    skill: "extract",
    payload: { filePath },
  }));

  // categorize + report depend on extraction; wired up per-document in runJob
  return extractSubtasks;
}

async function getBids(skill: Skill) {
  const candidates = listWorkersForSkill(skill);
  const bids = await Promise.all(
    candidates.map(async (worker) => {
      try {
        const res = await fetch(`${worker.url}/quote`);
        if (!res.ok) return null;
        const quote = (await res.json()) as { priceUsdc: number; etaSeconds: number };
        return { worker, ...quote };
      } catch {
        return null;
      }
    }),
  );
  return bids.filter((b): b is NonNullable<typeof b> => b !== null);
}

/** Lowest price wins, weighted down for low-reputation workers. */
function selectWinner(bids: Awaited<ReturnType<typeof getBids>>) {
  if (bids.length === 0) return null;
  const scored = bids.map((b) => ({
    ...b,
    score: b.priceUsdc * (1 + (100 - b.worker.reputation) / 100),
  }));
  scored.sort((a, b) => a.score - b.score);
  return scored[0];
}

async function runSubtask(
  subtask: Subtask,
): Promise<SubtaskLogEntry> {
  const bids = await getBids(subtask.skill);
  const winner = selectWinner(bids);

  if (!winner) {
    return { subtask, error: `no workers available for skill "${subtask.skill}"` };
  }

  let output: unknown;
  try {
    const res = await fetch(`${winner.worker.url}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subtask.payload),
    });
    const body = (await res.json()) as { ok: boolean; output?: unknown; error?: string };
    if (!body.ok) throw new Error(body.error ?? "worker execution failed");
    output = body.output;
  } catch (err) {
    recordOutcome(winner.worker.id, false);
    return {
      subtask,
      winner: winner.worker,
      bidPriceUsdc: winner.priceUsdc,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const verification = verifyOutput(subtask.skill, output);
  if (!verification.ok) {
    recordOutcome(winner.worker.id, false);
    const receipt: Receipt = {
      subtaskId: subtask.id,
      jobId: subtask.jobId,
      workerId: winner.worker.id,
      workerWallet: winner.worker.walletAddress,
      amountUsdc: 0,
      status: "skipped",
      timestamp: new Date().toISOString(),
    };
    recordReceipt(receipt);
    return {
      subtask,
      winner: winner.worker,
      bidPriceUsdc: winner.priceUsdc,
      output,
      verified: false,
      error: `verification failed: ${verification.reason}`,
      receipt,
    };
  }

  // Verified — pay the worker for real, on-chain, via Circle Gateway.
  const payment = await payWorkerUsdc({
    recipientAddress: winner.worker.walletAddress as `0x${string}`,
    amountUsdc: winner.priceUsdc,
  });

  recordOutcome(winner.worker.id, payment.ok);

  const receipt: Receipt = {
    subtaskId: subtask.id,
    jobId: subtask.jobId,
    workerId: winner.worker.id,
    workerWallet: winner.worker.walletAddress,
    amountUsdc: winner.priceUsdc,
    status: payment.ok ? "paid" : "failed",
    mintTxHash: payment.mintTxHash,
    gatewayError: payment.error,
    timestamp: new Date().toISOString(),
  };
  recordReceipt(receipt);

  return {
    subtask,
    winner: winner.worker,
    bidPriceUsdc: winner.priceUsdc,
    output,
    verified: true,
    receipt,
  };
}

/**
 * Runs the full pipeline for a job: extract -> categorize -> report, per
 * input document, with bidding + verified USDC payment at every stage.
 */
export async function runJob(job: Job): Promise<JobRunLog> {
  const steps: SubtaskLogEntry[] = [];
  const extractSubtasks = splitJob(job);

  for (const extractTask of extractSubtasks) {
    const extractResult = await runSubtask(extractTask);
    steps.push(extractResult);
    if (!extractResult.verified) continue;

    const extractOutput = extractResult.output as { text: string };

    const categorizeTask: Subtask = {
      id: randomUUID(),
      jobId: job.id,
      skill: "categorize",
      payload: { text: extractOutput.text },
      dependsOn: [extractTask.id],
    };
    const categorizeResult = await runSubtask(categorizeTask);
    steps.push(categorizeResult);
    if (!categorizeResult.verified) continue;

    const categorizeOutput = categorizeResult.output as { category: string };

    const reportTask: Subtask = {
      id: randomUUID(),
      jobId: job.id,
      skill: "report",
      payload: { text: extractOutput.text, category: categorizeOutput.category },
      dependsOn: [categorizeTask.id],
    };
    const reportResult = await runSubtask(reportTask);
    steps.push(reportResult);
  }

  return { job, steps };
}
