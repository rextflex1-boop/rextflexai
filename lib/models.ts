// Shared between the client (model picker UI) and the server (chat route) —
// no server-only imports here, so this can be imported from "use client"
// components safely.

export type ModelTier = "silicon" | "titan" | "apex";

export type ModelTierInfo = {
  readonly id: ModelTier;
  readonly name: string;
  readonly description: string;
  readonly groqModelId: string;
  /** gpt-oss models have documented, safe support for the reasoning_effort
   * param on Groq — used to decide whether the Thinking toggle applies. */
  readonly supportsReasoningEffort: boolean;
  /** Shown as a small badge next to the name in the picker, if set. */
  readonly badge?: string;
};

export const MODEL_TIERS: readonly ModelTierInfo[] = [
  {
    description: "Fast and efficient — quick answers, everyday chat.",
    groqModelId: "openai/gpt-oss-20b",
    id: "silicon",
    name: "Silicon",
    supportsReasoningEffort: true,
  },
  {
    description: "Powerful core model for most tasks — the default.",
    groqModelId: "openai/gpt-oss-120b",
    id: "titan",
    name: "Titan",
    supportsReasoningEffort: true,
  },
  {
    badge: "Paid usage",
    description: "Ultimate intelligence — hard math, coding, and dev work.",
    groqModelId: "qwen/qwen3.8-27b",
    id: "apex",
    name: "Apex",
    supportsReasoningEffort: false,
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
