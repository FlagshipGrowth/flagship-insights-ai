export const TEAMS = [
  "Creative",
  "Inventory",
  "Ads",
  "Customer Service",
  "Catalog Team",
  "Account Manager",
] as const;

export type Team = (typeof TEAMS)[number];
