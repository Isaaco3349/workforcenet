// Submits a demo job once the coordinator and all three workers are running.
// Usage: npm run demo -- /path/to/doc1.pdf /path/to/doc2.pdf
const COORDINATOR_URL = process.env.COORDINATOR_URL ?? "http://localhost:4000";

async function waitForWorkers(minCount = 3, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${COORDINATOR_URL}/workers`).catch(() => null);
    if (res?.ok) {
      const workers = await res.json();
      if (workers.length >= minCount) return workers;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for workers to register with the coordinator");
}

async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error("Usage: npm run demo -- /path/to/doc1.pdf [doc2.pdf ...]");
    process.exit(1);
  }

  console.log("Waiting for workers to register...");
  const workers = await waitForWorkers();
  console.log(`${workers.length} worker(s) online.\n`);

  console.log(`Submitting job with ${inputs.length} document(s)...`);
  const res = await fetch(`${COORDINATOR_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs }),
  });

  const log = await res.json();
  console.log(JSON.stringify(log, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
