// Worker task logic. Deliberately deterministic and dependency-light — no
// AI API required. This is the "any software service can register as an
// autonomous worker" story: workers just need to implement bid()/execute().
import { readFile } from "node:fs/promises";
// @ts-expect-error - pdf-parse has no bundled types
import pdfParse from "pdf-parse";

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","is","are",
  "was","were","be","been","this","that","it","as","at","by","from","has","have",
]);

export async function extractText(filePath: string): Promise<{ text: string; pages: number }> {
  const buf = await readFile(filePath);
  const parsed = await pdfParse(buf);
  return { text: parsed.text.trim(), pages: parsed.numpages };
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  financial: ["revenue", "invoice", "balance", "expense", "budget", "tax", "audit"],
  legal: ["agreement", "contract", "clause", "liability", "jurisdiction", "party"],
  technical: ["system", "api", "architecture", "database", "protocol", "server"],
  hr: ["employee", "salary", "benefits", "onboarding", "policy", "leave"],
};

export function categorize(text: string): { category: string; confidence: number } {
  const lower = text.toLowerCase();
  let best = { category: "general", score: 0 };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce(
      (sum, kw) => sum + (lower.match(new RegExp(`\\b${kw}\\b`, "g"))?.length ?? 0),
      0,
    );
    if (score > best.score) best = { category, score };
  }

  const confidence = best.score === 0 ? 0.3 : Math.min(0.95, 0.5 + best.score * 0.05);
  return { category: best.category, confidence };
}

/** Extractive summary: scores sentences by keyword frequency, keeps the top N. */
export function generateReport(
  text: string,
  category: string,
): { summary: string; keyPoints: string[] } {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 25);

  const freq = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    if (STOPWORDS.has(word)) continue;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  const scored = sentences.map((sentence) => {
    const words = sentence.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    const score = words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / (words.length || 1);
    return { sentence: sentence.trim(), score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5).map((s) => s.sentence);

  return {
    summary: `[${category}] ${top.slice(0, 2).join(" ")}`.slice(0, 600),
    keyPoints: top,
  };
}
