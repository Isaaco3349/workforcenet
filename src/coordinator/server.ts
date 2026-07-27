import express from "express";
import { randomUUID } from "node:crypto";
import { registerWorker, allWorkers } from "./registry.js";
import { runJob } from "./coordinator.js";
import { getReceipts } from "./ledger.js";
import type { Job, Skill } from "../types.js";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4000);

// Workers call this on startup to join the network.
app.post("/workers/register", (req, res) => {
  const { id, skill, url, walletAddress } = req.body as {
    id?: string;
    skill: Skill;
    url: string;
    walletAddress: string;
  };
  const worker = registerWorker({
    id: id ?? randomUUID(),
    skill,
    url,
    walletAddress: walletAddress as `0x${string}`,
  });
  console.log(`[coordinator] registered worker ${worker.id} (${worker.skill}) @ ${worker.url}`);
  res.json(worker);
});

app.get("/workers", (_req, res) => {
  res.json(allWorkers());
});

// Submits a job: { "inputs": ["/path/to/a.pdf", "/path/to/b.pdf"] }
app.post("/jobs", async (req, res) => {
  const { inputs } = req.body as { inputs: string[] };
  if (!Array.isArray(inputs) || inputs.length === 0) {
    res.status(400).json({ error: "inputs must be a non-empty array of file paths" });
    return;
  }

  const job: Job = { id: randomUUID(), createdAt: new Date().toISOString(), inputs };
  console.log(`[coordinator] job ${job.id} received: ${inputs.length} document(s)`);

  const log = await runJob(job);
  res.json(log);
});

app.get("/receipts", (_req, res) => {
  res.json(getReceipts());
});

app.listen(PORT, () => {
  console.log(`[coordinator] listening on :${PORT}`);
});
