// Lightweight JSON-file ledger. A hackathon-scale substitute for a database:
// tracks worker reputation and every payment receipt so the demo has a
// visible, inspectable audit trail (data/ledger.json).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Receipt } from "../types.js";

const LEDGER_PATH = new URL("../../data/ledger.json", import.meta.url).pathname;

interface LedgerState {
  reputation: Record<string, number>; // workerId -> score 0-100
  receipts: Receipt[];
}

function load(): LedgerState {
  if (!existsSync(LEDGER_PATH)) return { reputation: {}, receipts: [] };
  return JSON.parse(readFileSync(LEDGER_PATH, "utf-8"));
}

function save(state: LedgerState) {
  mkdirSync(dirname(LEDGER_PATH), { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(state, null, 2));
}

export function getReputation(workerId: string): number {
  const state = load();
  return state.reputation[workerId] ?? 50;
}

export function recordOutcome(workerId: string, success: boolean) {
  const state = load();
  const current = state.reputation[workerId] ?? 50;
  const next = success ? Math.min(100, current + 3) : Math.max(0, current - 15);
  state.reputation[workerId] = next;
  save(state);
}

export function recordReceipt(receipt: Receipt) {
  const state = load();
  state.receipts.push(receipt);
  save(state);
}

export function getReceipts(): Receipt[] {
  return load().receipts;
}
