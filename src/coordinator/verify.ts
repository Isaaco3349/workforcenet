// Verification is intentionally deterministic and schema-based — no LLM
// call required. Each skill's worker output is checked against the shape
// the coordinator needs before payment is authorized.
import type { Skill } from "../types.js";

export function verifyOutput(skill: Skill, output: unknown): { ok: boolean; reason?: string } {
  if (output === null || output === undefined) {
    return { ok: false, reason: "empty output" };
  }

  switch (skill) {
    case "extract": {
      const o = output as { text?: string; pages?: number };
      if (typeof o.text !== "string" || o.text.trim().length < 20) {
        return { ok: false, reason: "extracted text too short or missing" };
      }
      return { ok: true };
    }
    case "categorize": {
      const o = output as { category?: string; confidence?: number };
      if (typeof o.category !== "string" || o.category.length === 0) {
        return { ok: false, reason: "missing category" };
      }
      if (typeof o.confidence !== "number" || o.confidence < 0 || o.confidence > 1) {
        return { ok: false, reason: "confidence out of range" };
      }
      return { ok: true };
    }
    case "report": {
      const o = output as { summary?: string; keyPoints?: string[] };
      if (typeof o.summary !== "string" || o.summary.trim().length < 30) {
        return { ok: false, reason: "summary too short or missing" };
      }
      if (!Array.isArray(o.keyPoints) || o.keyPoints.length === 0) {
        return { ok: false, reason: "missing key points" };
      }
      return { ok: true };
    }
    default:
      return { ok: false, reason: `unknown skill: ${skill}` };
  }
}
