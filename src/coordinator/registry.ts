import type { WorkerInfo, Skill } from "../types.js";
import { getReputation } from "./ledger.js";

const workers = new Map<string, WorkerInfo>();

export function registerWorker(info: Omit<WorkerInfo, "reputation">): WorkerInfo {
  const full: WorkerInfo = { ...info, reputation: getReputation(info.id) };
  workers.set(info.id, full);
  return full;
}

export function listWorkersForSkill(skill: Skill): WorkerInfo[] {
  return [...workers.values()]
    .filter((w) => w.skill === skill)
    .map((w) => ({ ...w, reputation: getReputation(w.id) }));
}

export function getWorker(id: string): WorkerInfo | undefined {
  return workers.get(id);
}

export function allWorkers(): WorkerInfo[] {
  return [...workers.values()];
}
