// A worker is any HTTP service that implements two endpoints:
//   GET  /quote    -> { priceUsdc, etaSeconds }   (the worker's bid)
//   POST /execute  -> { output }                   (does the task, returns result)
// The coordinator never needs to know how a worker does its job internally —
// rule-based, a local model, or a full LLM call are all equally valid, as
// long as it speaks this contract.
import express from "express";
import type { Skill } from "../types.js";
import { extractText, categorize, generateReport } from "./tasks.js";

export interface WorkerConfig {
  skill: Skill;
  port: number;
  walletAddress: string;
  priceUsdc: number;
  etaSeconds: number;
}

export function startWorker(config: WorkerConfig) {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/quote", (_req, res) => {
    res.json({ priceUsdc: config.priceUsdc, etaSeconds: config.etaSeconds });
  });

  app.post("/execute", async (req, res) => {
    try {
      const output = await runTask(config.skill, req.body);
      res.json({ ok: true, output });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.listen(config.port, () => {
    console.log(
      `[worker:${config.skill}] listening on :${config.port} | wallet=${config.walletAddress} | quote=${config.priceUsdc} USDC / ${config.etaSeconds}s`,
    );
  });
}

async function runTask(skill: Skill, payload: any): Promise<unknown> {
  switch (skill) {
    case "extract":
      return extractText(payload.filePath as string);
    case "categorize":
      return categorize(payload.text as string);
    case "report":
      return generateReport(payload.text as string, payload.category as string);
    default:
      throw new Error(`unknown skill: ${skill}`);
  }
}
