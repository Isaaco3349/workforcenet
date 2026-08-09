# WorkforceNet

**Live pitch site:** https://workforcenet.vercel.app

A coordinator agent splits an incoming job into subtasks. Worker agents bid
for the work. The coordinator picks a winner, verifies the output, and pays
the worker instantly in real testnet USDC via **Circle Gateway**, minting on
**Arc Testnet / Base Sepolia**.

```
User submits job (PDFs)
        │
        ▼
 Coordinator ──splits into──▶ extract → categorize → report  (per document)
        │
        ├─ broadcasts each subtask to registered workers
        ├─ workers bid (price, ETA) via GET /quote
        ├─ coordinator picks the winner (price × reputation)
        ├─ winner executes via POST /execute
        ├─ coordinator verifies output (schema/sanity checks — no AI required)
        └─ on success: pays the worker in USDC via Circle Gateway, on-chain
```

Workers are plain HTTP services. They don't need to call any AI API — the
included workers are deterministic (PDF text extraction, keyword-based
categorization, extractive summarization) — but any service that implements
`GET /quote` + `POST /execute` can join the network.

## Why this is real, not simulated

Payment uses Circle's actual Gateway REST API and on-chain contracts on
public testnets:

- Burn intents are signed with real EIP-712 signatures (`viem`)
- Attestations come from Circle's live `gateway-api-testnet.circle.com`
- `gatewayMint` is a real transaction on Base Sepolia / Arc Testnet
- Every payout gets a real transaction hash, viewable on a block explorer

This means **you need funded testnet wallets to run it end-to-end**. See
Setup below.

## Verified working

A full end-to-end run has completed successfully — extraction, categorization,
report generation, verification, and real on-chain settlement, three for three:

- `0x3f9fdfd39ebc571f626803648092f3b24a9e4f953824d79c9a631d2343d259d5`
- `0xdffd513d95ea2e971fbdba7d1171c7e4a599e25054bf46809995b2fc99c8554d`
- `0xf85cf9a1429c25736be5940d80bf4361f07cd72a89b1fa7cf96d8f601d3b58f4`

Check any of these on [Base Sepolia's explorer](https://sepolia.basescan.org)
to confirm.

## Project layout

```
src/
  types.ts                  shared types
  gateway/
    config.ts                Gateway contract addresses, domain IDs, chain config
    burnIntent.ts             EIP-712 burn intent construction (verified against Circle docs)
    payWorker.ts               sign → attest → mint orchestration
    deposit.ts                 fund the coordinator's Gateway balance
    checkBalances.ts            check the coordinator's unified balance
  coordinator/
    server.ts                  Express API: /workers/register, /jobs, /receipts
    coordinator.ts              splitting, bidding, verification, payment orchestration
    registry.ts                  in-memory worker registry
    verify.ts                    deterministic output verification per skill
    ledger.ts                     JSON-file reputation + receipt log (data/ledger.json)
  worker/
    service.ts                  generic worker HTTP service (quote/execute)
    tasks.ts                     extract / categorize / report task logic
    run.ts                       CLI entrypoint + self-registration with coordinator
  demo.ts                       end-to-end demo runner
```

## Setup

### 1. Install dependencies

```bash
npm install
```

Requires **Node.js 22.6+** (uses `tsx` to run TypeScript directly, no build
step).

### 2. Get testnet funds

- Get testnet USDC + native gas from the [Circle Faucet](https://faucet.circle.com)
  for **Arc Testnet** (the default source chain — USDC is Arc's native gas
  token, so one faucet claim covers both).
- Get testnet ETH for **Base Sepolia** (the destination chain, used to pay
  gas for the mint transaction) from a faucet such as the
  [Coinbase Developer Platform Faucet](https://portal.cdp.coinbase.com/products/faucet).
- Generate a coordinator EVM keypair (e.g. `viem`'s `generatePrivateKey()`)
  and fund that address from both faucets above.
- Generate one payout address per worker (these just receive funds — no
  private key needed by the worker process).

> **Security note:** generate a fresh private key yourself and keep it out
> of version control (`.env` is already gitignored). Never use a
> well-known/test private key (e.g. `0x000...001`) for anything that will
> hold real or testnet value — these are publicly known and actively
> monitored by bots that sweep funds the instant they arrive.

### 3. Configure environment

```bash
cp .env.example .env
# edit .env: set EVM_PRIVATE_KEY to the coordinator's key
```

### 4. Deposit into the coordinator's Gateway balance

```bash
npm run deposit       # deposits 5 USDC on Arc Testnet by default
npm run balances       # confirm the deposit landed (may take a few minutes for finality)
```

### 5. Run the network

In separate terminals:

```bash
npm run coordinator

WORKER_WALLET_ADDRESS=0x...worker1 npm run worker:extract
WORKER_WALLET_ADDRESS=0x...worker2 npm run worker:categorize
WORKER_WALLET_ADDRESS=0x...worker3 npm run worker:report
```

Each worker self-registers with the coordinator on startup.

### 6. Submit a job

```bash
npm run demo -- /absolute/path/to/doc1.pdf /absolute/path/to/doc2.pdf
# ✓ paid worker (extract)     0.5 USDC   tx 0x3f9fdfd3...
# ✓ paid worker (categorize)  0.5 USDC   tx 0xdffd513d...
# ✓ paid worker (report)      0.5 USDC   tx 0xf85cf9a1...
```

Watch the coordinator's logs for bidding, verification, and mint transaction
hashes. Check `data/ledger.json` for the full receipt trail, or
`GET /receipts` on the coordinator.

## Extending toward the full pitch

This MVP uses a fixed 3-stage pipeline and price-weighted-by-reputation
bidding. The roadmap described in the original pitch — open worker
registration with advertised skills/prices, competitive multi-worker
bidding per subtask, and reputation-gated task eligibility — is a thin layer
on top of `registry.ts` and `coordinator.ts`; the payment and verification
plumbing here doesn't change.