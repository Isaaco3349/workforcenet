export type Skill = "extract" | "categorize" | "report";

export interface Job {
  id: string;
  createdAt: string;
  inputs: string[]; // e.g. paths or URLs to source documents
}

export interface Subtask {
  id: string;
  jobId: string;
  skill: Skill;
  // Free-form payload passed to the worker. For "extract" this is the doc
  // path; for "categorize"/"report" it's the output of prior subtasks.
  payload: unknown;
  dependsOn?: string[]; // subtask ids that must complete first
}

export interface WorkerInfo {
  id: string;
  skill: Skill;
  url: string; // base URL of the worker's HTTP service
  walletAddress: `0x${string}`;
  reputation: number; // 0-100, starts at 50
}

export interface Bid {
  workerId: string;
  subtaskId: string;
  priceUsdc: number;
  etaSeconds: number;
}

export interface TaskResult {
  subtaskId: string;
  workerId: string;
  output: unknown;
  ok: boolean;
  error?: string;
}

export interface Receipt {
  subtaskId: string;
  jobId: string;
  workerId: string;
  workerWallet: string;
  amountUsdc: number;
  status: "paid" | "failed" | "skipped";
  mintTxHash?: string;
  gatewayError?: string;
  timestamp: string;
}
