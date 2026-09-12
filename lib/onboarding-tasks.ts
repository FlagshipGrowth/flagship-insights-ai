import { getDb } from "./db";

// Same checklist as migration 0017's one-time backfill for existing brands — kept as its own
// copy (not generated from the migration) since a migration is a frozen, one-time statement,
// while this runs fresh for every new brand going forward, from the Clerk "organization.created"
// webhook (app/api/webhooks/clerk/route.ts).
export interface OnboardingTaskTemplate {
  category: string;
  title: string;
  description?: string;
  assignee?: string;
}

export const ONBOARDING_TASKS: OnboardingTaskTemplate[] = [
  { category: "Catalog & Setup", title: "Account Health (INFORM Act & Compliance)" },
  { category: "Catalog & Setup", title: "Complete Master Spec Sheet" },
  { category: "Catalog & Setup", title: "Brand Registry Access" },
  { category: "Catalog & Setup", title: "Category Approval" },
  {
    category: "Catalog & Setup",
    title: "Manufacturing vs. Amazon Barcode Setup",
    description: "See ClickUp SOP.",
    assignee: "FSG",
  },
  { category: "Catalog & Setup", title: "SKU Creation" },
  { category: "Catalog & Setup", title: "FBA Listing Creation" },
  { category: "Catalog & Setup", title: "Variant Merging" },

  { category: "Inventory Management (FBA)", title: "Capacity Manager Health" },
  { category: "Inventory Management (FBA)", title: "Warehouse Address" },
  { category: "Inventory Management (FBA)", title: "Return Handling" },
  { category: "Inventory Management (FBA)", title: "FBA Inventory Plan" },

  { category: "FBM Capabilities", title: "Handling Time" },
  { category: "FBM Capabilities", title: "Weekend Operations" },
  { category: "FBM Capabilities", title: "Fulfilled by Merchant (FBM)" },
  { category: "FBM Capabilities", title: "Pilot Order — FBM" },

  { category: "Listing Optimization", title: "SEO Copy" },
  { category: "Listing Optimization", title: "Infographic Images" },
  { category: "Listing Optimization", title: "Main Image" },
  { category: "Listing Optimization", title: "A+ Content (Basic)" },
  { category: "Listing Optimization", title: "A+ Premium Content" },
  { category: "Listing Optimization", title: "Brand Story" },
  { category: "Listing Optimization", title: "Brand Store" },
  { category: "Listing Optimization", title: "Product Video" },

  { category: "Advertising", title: "Ad Account Setup" },
  { category: "Advertising", title: "Ad Strategy & Launch Plan" },
  { category: "Advertising", title: "Budget Alignment" },
  { category: "Advertising", title: "Pricing Strategy" },

  { category: "Marketing Initiatives", title: "Attribution Links" },
  { category: "Marketing Initiatives", title: "Cross Promotions" },
  { category: "Marketing Initiatives", title: "Vine Enrollment" },
  { category: "Marketing Initiatives", title: "Subscribe & Save" },
  { category: "Marketing Initiatives", title: "Virtual Bundles" },
  { category: "Marketing Initiatives", title: "Business Pricing — Tier Discount" },
  { category: "Marketing Initiatives", title: "Creator Connections" },

  { category: "Software", title: "Helium 10" },

  { category: "Optional", title: "Shelf Life" },
  { category: "Optional", title: "Product Documentation (Lab Test, COA, SDS)" },
];

export async function seedOnboardingTasks(brandId: string): Promise<void> {
  const sql = getDb();
  for (const t of ONBOARDING_TASKS) {
    await sql`
      insert into tasks (brand_id, category, title, description, assignee, status)
      values (${brandId}, ${t.category}, ${t.title}, ${t.description ?? null}, ${t.assignee ?? null}, 'todo')
    `;
  }
}
