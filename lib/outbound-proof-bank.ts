// Case studies the outbound engine may cite, matched to a prospect's category.
//
// Two gates:
// - `namingApproved`: only then may an email name the brand. Otherwise copy says "a beverage brand
//   we run Amazon for", which is true and needs no permission.
// - `result`: the one specific result line. Copy never states a number that isn't here.
//
// Joey's rule (2026-10-15): anything published on flagshipgrowth.com/work is approved to use. So a
// brand is named only if the site names it, and `result` is copied word for word from the site's
// case study. Brands the site doesn't show stay unnamed with no result. Re-check work.html in the
// Flagship-website repo when the site changes.

export interface CaseStudy {
  brand: string;
  namingApproved: boolean;
  result: string | null;
}

export interface ProofCategory {
  key: string;
  label: string;
  // Lowercase words that map a prospect's free-text category onto this one.
  matches: string[];
  caseStudies: CaseStudy[];
}

/** Published on the website, with its result as stated there. */
const site = (brand: string, result: string | null = null): CaseStudy => ({ brand, namingApproved: true, result });
/** A client the website doesn't show: never named, no result. */
const unnamed = (brand: string): CaseStudy => ({ brand, namingApproved: false, result: null });

export const PROOF_BANK: ProofCategory[] = [
  {
    key: "food",
    label: "food and snacks",
    matches: ["food", "snack", "grocery", "candy", "sweet", "chocolate", "cookie", "popcorn", "jerky", "pantry", "syrup"],
    caseStudies: [
      site("Opopop", "+97% YoY unit growth and +89% YoY revenue growth on Amazon + Walmart; +25% units sold from search after A/B testing a new main image"),
      site("Smood Sweets", "built a new candy category from zero, launch-ready across Amazon and TikTok Shop"),
      site("Ramen Bae"),
    ],
  },
  {
    key: "beverage",
    label: "beverage and functional drinks",
    matches: ["beverage", "drink", "coffee", "tea", "energy", "brew", "kombucha", "electrolyte", "hydration"],
    caseStudies: [
      site("Rationale Brewing", "4x sales within 3 months, reaching #5 in category, and Amazon's Choice on the brand's highest-demand keyword"),
      site("Mac Energy", "launched into the top 50 of an ultra-competitive energy drink category within the first week"),
      site("VERB Energy"),
      unnamed("TUBR"),
    ],
  },
  {
    key: "wellness",
    label: "wellness and supplements",
    matches: ["supplement", "vitamin", "wellness", "health", "gummy", "gummies", "nutrition", "protein", "probiotic", "mushroom"],
    caseStudies: [
      site("SuperMush", "+74% YoY unit growth and +42% YoY revenue growth across a 5-SKU gummy line on Amazon + Walmart"),
      site("Nature's Answer", "an infographic system across the Sambucus elderberry line"),
      site("Hapad", "Buy Box from 50% to 96% and conversion rate from 10% to 23% over one year, $554K+ in sales across 32,000+ units"),
      site("Aura House"),
    ],
  },
  {
    key: "baby",
    label: "baby and parenting",
    matches: ["baby", "infant", "parent", "breastfeeding", "lactation", "nursing", "kids", "maternity"],
    caseStudies: [site("MAM Baby", "A+ content and landing pages across an award-winning bottle line")],
  },
  {
    key: "apparel",
    label: "apparel and lifestyle",
    matches: ["apparel", "clothing", "athletic", "workwear", "fashion", "hat", "lifestyle", "underwear", "scrubs"],
    caseStudies: [
      site("Wink (Carhartt)", "87% fewer item-level suppressions in 60 days, clearing the runway to a $10M wholesale target"),
      site("MeUndies"),
      site("Golden Tiger"),
      unnamed("JAX Athletics"),
    ],
  },
  {
    key: "home",
    label: "home goods",
    matches: ["home", "sleep", "mattress", "pillow", "bedding", "kitchen", "storage"],
    caseStudies: [site("Dormeo", "launched a new SKU with full account management from day one"), unnamed("Sidekick")],
  },
  {
    key: "personal_care",
    label: "footwear and personal care",
    matches: ["shoe", "footwear", "sneaker", "insole", "foot", "personal care", "beauty", "skincare", "grooming"],
    caseStudies: [
      site("Reshoevn8r", "repositioned the full catalog across brand store and bundles"),
      site("Hapad", "Buy Box from 50% to 96% and conversion rate from 10% to 23% over one year, $554K+ in sales across 32,000+ units"),
    ],
  },
  {
    key: "golf",
    label: "golf and outdoor lifestyle",
    matches: ["golf", "outdoor", "sport"],
    caseStudies: [unnamed("Stogie Golf")],
  },
  {
    key: "spirits",
    label: "spirits and celebrity brands",
    matches: ["spirit", "bourbon", "whiskey", "liquor", "wine"],
    caseStudies: [unnamed("Bingham's Bourbon")],
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
    return `- ${who}: ${c.result ? `${c.result} (use these exact numbers, no others)` : "no published result, so state no number or outcome for it"}`;
  });
  return `Category match: ${proof.label}. Allowed proof:\n${lines.join("\n")}\n${multiChannel}`;
}
