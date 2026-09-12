import { getDb } from "./db";

// Same checklist as migration 0017's one-time backfill for existing brands — kept as its own
// copy (not generated from the migration) since a migration is a frozen, one-time statement,
// while this runs fresh for every new brand going forward, from the Clerk "organization.created"
// webhook (app/api/webhooks/clerk/route.ts). Department assignments match migration 0021's
// backfill of the same checklist on existing brands.
export interface OnboardingTaskTemplate {
  category: string;
  title: string;
  team: string;
  description?: string;
  assignee?: string;
}

export const ONBOARDING_TASKS: OnboardingTaskTemplate[] = [
  { category: "Catalog & Setup", title: "Account Health (INFORM Act & Compliance)", team: "Catalog Team" },
  { category: "Catalog & Setup", title: "Complete Master Spec Sheet", team: "Account Manager" },
  { category: "Catalog & Setup", title: "Brand Registry Access", team: "Account Manager" },
  { category: "Catalog & Setup", title: "Category Approval", team: "Catalog Team" },
  {
    category: "Catalog & Setup",
    title: "Manufacturing vs. Amazon Barcode Setup",
    team: "Catalog Team",
    description: "See ClickUp SOP.",
    assignee: "FSG",
  },
  { category: "Catalog & Setup", title: "SKU Creation", team: "Catalog Team" },
  { category: "Catalog & Setup", title: "FBA Listing Creation", team: "Catalog Team" },
  { category: "Catalog & Setup", title: "Variant Merging", team: "Catalog Team" },

  { category: "Inventory Management (FBA)", title: "Capacity Manager Health", team: "Inventory Team" },
  { category: "Inventory Management (FBA)", title: "Warehouse Address", team: "Inventory Team" },
  { category: "Inventory Management (FBA)", title: "Return Handling", team: "Inventory Team" },
  { category: "Inventory Management (FBA)", title: "FBA Inventory Plan", team: "Inventory Team" },

  { category: "FBM Capabilities", title: "Handling Time", team: "Inventory Team" },
  { category: "FBM Capabilities", title: "Weekend Operations", team: "Inventory Team" },
  { category: "FBM Capabilities", title: "Fulfilled by Merchant (FBM)", team: "Inventory Team" },
  { category: "FBM Capabilities", title: "Pilot Order — FBM", team: "Inventory Team" },

  { category: "Listing Optimization", title: "SEO Copy", team: "SEO Team" },
  { category: "Listing Optimization", title: "Infographic Images", team: "Creative Team" },
  { category: "Listing Optimization", title: "Main Image", team: "Creative Team" },
  { category: "Listing Optimization", title: "A+ Content (Basic)", team: "Creative Team" },
  { category: "Listing Optimization", title: "A+ Premium Content", team: "Creative Team" },
  { category: "Listing Optimization", title: "Brand Story", team: "Creative Team" },
  { category: "Listing Optimization", title: "Brand Store", team: "Creative Team" },
  { category: "Listing Optimization", title: "Product Video", team: "Creative Team" },

  { category: "Advertising", title: "Ad Account Setup", team: "Ads Team" },
  { category: "Advertising", title: "Ad Strategy & Launch Plan", team: "Ads Team" },
  { category: "Advertising", title: "Budget Alignment", team: "Ads Team" },
  { category: "Advertising", title: "Pricing Strategy", team: "Ads Team" },

  { category: "Marketing Initiatives", title: "Attribution Links", team: "Account Manager" },
  { category: "Marketing Initiatives", title: "Cross Promotions", team: "Account Manager" },
  { category: "Marketing Initiatives", title: "Vine Enrollment", team: "Account Manager" },
  { category: "Marketing Initiatives", title: "Subscribe & Save", team: "Account Manager" },
  { category: "Marketing Initiatives", title: "Virtual Bundles", team: "Account Manager" },
  { category: "Marketing Initiatives", title: "Business Pricing — Tier Discount", team: "Account Manager" },
  { category: "Marketing Initiatives", title: "Creator Connections", team: "Account Manager" },

  { category: "Software", title: "Helium 10", team: "Account Manager" },

  { category: "Optional", title: "Shelf Life", team: "Catalog Team" },
  { category: "Optional", title: "Product Documentation (Lab Test, COA, SDS)", team: "Catalog Team" },
];

export async function seedOnboardingTasks(brandId: string): Promise<void> {
  const sql = getDb();
  for (const t of ONBOARDING_TASKS) {
    await sql`
      insert into tasks (brand_id, category, title, description, assignee, team, status)
      values (${brandId}, ${t.category}, ${t.title}, ${t.description ?? null}, ${t.assignee ?? null}, ${t.team}, 'todo')
    `;
  }
}
