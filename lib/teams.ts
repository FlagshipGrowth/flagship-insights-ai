export const TEAMS = [
  "Creative Team",
  "Inventory Team",
  "Ads Team",
  "Customer Service Team",
  "Catalog Team",
  "Account Manager",
  "SEO Team",
] as const;

export type Team = (typeof TEAMS)[number];
