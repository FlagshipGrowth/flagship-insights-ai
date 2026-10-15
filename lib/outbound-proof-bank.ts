// Case studies the outbound engine may cite, matched to a prospect's category.
//
// Two gates, both off until Joey fills them in (an open decision in the build plan: "collect
// case-study results and naming permission for each client"):
// - `namingApproved`: only then may an email name the brand. Until then copy says "a beverage brand
//   we run Amazon for", which is true and needs no permission.
// - `result`: the one confirmed, specific result line. Copy never states a number that isn't here.
//
// Brands per category come from the flagship-outbound-engine skill's proof bank.

export interface CaseStudy {
  brand: string;
  namingApproved: boolean;
  result: string | null; // e.g. "grew Amazon revenue 84% in 6 months" — confirmed by Joey only
}

export interface ProofCategory {
  key: string;
  label: string;
  // Lowercase words that map a prospect's free-text category onto this one.
  matches: string[];
  caseStudies: CaseStudy[];
}

const cs = (brand: string): CaseStudy => ({ brand, namingApproved: false, result: null });

export const PROOF_BANK: ProofCategory[] = [
  {
    key: "beverage",
    label: "beverage and functional drinks",
    matches: ["beverage", "drink", "coffee", "tea", "energy", "brew", "kombucha", "mushroom", "food", "snack", "grocery"],
    caseStudies: [cs("TUBR"), cs("MAC Energy"), cs("Rationale Brewing"), cs("SuperMush")],
  },
  {
    key: "wellness",
    label: "wellness and supplements",
    matches: ["supplement", "vitamin", "wellness", "health", "gummy", "gummies", "nutrition", "protein"],
    caseStudies: [cs("Nature's Answer"), cs("Aura House"), cs("Hapad")],
  },
  {
    key: "apparel",
    label: "apparel and lifestyle",
    matches: ["apparel", "clothing", "athletic", "workwear", "fashion", "hat", "lifestyle"],
    caseStudies: [cs("Carhartt / WINK"), cs("JAX Athletics"), cs("Be You Tiful Athletics"), cs("Noggin Boss")],
  },
  {
    key: "home",
    label: "home goods",
    matches: ["home", "sleep", "mattress", "pillow", "bedding", "kitchen", "storage"],
    caseStudies: [cs("Dormeo"), cs("Sidekick")],
  },
  {
    key: "personal_care",
    label: "footwear and personal care",
    matches: ["shoe", "footwear", "sneaker", "personal care", "beauty", "skincare", "grooming"],
    caseStudies: [cs("Reshoevn8r")],
  },
  {
    key: "golf",
    label: "golf and outdoor lifestyle",
    matches: ["golf", "outdoor", "sport"],
    caseStudies: [cs("Stogie Golf")],
  },
  {
    key: "spirits",
    label: "spirits and celebrity brands",
    matches: ["spirit", "bourbon", "whiskey", "liquor", "wine"],
    caseStudies: [cs("Bingham's Bourbon")],
  },
];

export function proofForCategory(category: string | null): ProofCategory | null {
  if (!category) return null;
  const c = category.toLowerCase();
  return PROOF_BANK.find((p) => p.matches.some((m) => c.includes(m))) ?? null;
}

/** The proof lines the copy writer is allowed to use for this prospect, as prompt text. */
export function proofPromptFor(category: string | null): string {
  const proof = proofForCategory(category);
  const multiChannel =
    "- Always true and always allowed: Flagship runs Amazon, Walmart and TikTok Shop for real CPG clients today, under one team.";
  if (!proof) return `No category-matched case study for this brand. Don't cite one.\n${multiChannel}`;
  const lines = proof.caseStudies.map((c) => {
    const who = c.namingApproved ? c.brand : `a ${proof.label} brand (do NOT name it)`;
    return `- ${who}: ${c.result ?? "no confirmed result yet, so state no number or outcome for it"}`;
  });
  return `Category match: ${proof.label}. Allowed proof:\n${lines.join("\n")}\n${multiChannel}`;
}
