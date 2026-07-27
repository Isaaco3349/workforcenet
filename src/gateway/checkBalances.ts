// Checks the coordinator's unified USDC balance across supported testnet
// domains. Run with: npm run balances
import { account, GATEWAY_API_BASE } from "./config.js";

const DOMAINS: Record<string, number> = {
  arcTestnet: 26,
  baseSepolia: 6,
};

interface GatewayBalancesResponse {
  balances: Array<{ domain: number; balance: string }>;
}

async function main() {
  console.log(`Depositor address: ${account.address}\n`);

  const body = {
    token: "USDC",
    sources: Object.values(DOMAINS).map((domain) => ({
      domain,
      depositor: account.address,
    })),
  };

  const res = await fetch(`${GATEWAY_API_BASE}/v1/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Gateway API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const result = (await res.json()) as GatewayBalancesResponse;

  let total = 0;
  for (const balance of result.balances) {
    const chain =
      Object.keys(DOMAINS).find((k) => DOMAINS[k] === balance.domain) ??
      `Domain ${balance.domain}`;
    const amount = parseFloat(balance.balance);
    console.log(`${chain}: ${amount.toFixed(6)} USDC`);
    total += amount;
  }
  console.log(`\nTotal: ${total.toFixed(6)} USDC`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
