// Shared between the client (model picker UI) and the server (chat route) —
// no server-only imports here, so this can be imported from "use client"
// components safely.

export type ModelTier = "silicon" | "titan" | "apex";

export type ModelTierInfo = {
  readonly id: ModelTier;
  readonly name: string;
  readonly description: string;
  readonly geminiModelId: string;
  /** gpt-oss models have documented, safe support for the reasoning_effort
   * param on Groq — used to decide whether the Thinking toggle applies. */
  /** Shown as a small badge next to the name in the picker, if set. */
  readonly badge?: string;
};

export const MODEL_TIERS: readonly ModelTierInfo[] = [
  {
    description: "Fast and efficient — Gemini 2.5 Flash for everyday chat.",
    geminiModelId: "gemini-2.5-flash",
    id: "silicon",
    name: "Silicon",
  },
  {
    description: "Powerful Gemini Flash tier for most tasks — the default.",
    geminiModelId: "gemini-3.1-flash-lite",
    id: "titan",
    name: "Titan",
  },
  {
    badge: "Paid usage",
    description: "Top Gemini Flash tier — advanced reasoning, coding, and image understanding.",
    geminiModelId: "gemini-3.8-flash",
    id: "apex",
    name: "Apex",
  },
] as const;

export const DEFAULT_MODEL_TIER: ModelTier = "titan";

const TIER_IDS = new Set<string>(MODEL_TIERS.map((tier) => tier.id));

export function isModelTier(value: string): value is ModelTier {
  return TIER_IDS.has(value);
}

export function getModelTierInfo(tier: string): ModelTierInfo {
  return MODEL_TIERS.find((t) => t.id === tier) ?? getDefaultTierInfo();
}

function getDefaultTierInfo(): ModelTierInfo {
  // Non-null: DEFAULT_MODEL_TIER is always one of MODEL_TIERS' ids above.
  return MODEL_TIERS.find((t) => t.id === DEFAULT_MODEL_TIER) as ModelTierInfo;
}
