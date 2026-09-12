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

// "Anything inventory related is assigned to Sherilyn" — an absolute standing rule, not a
// fallback, enforced everywhere a task's team can end up as Inventory Team (creation, team
// changes on either task page, the onboarding template, and Slack task creation).
export const INVENTORY_TEAM = "Inventory Team";
export const INVENTORY_ASSIGNEE = "Sherilyn";

/** Applies the Inventory-Team-belongs-to-Sherilyn rule. Call this wherever a task's team is
 * being set, and use the result as the assignee instead of whatever was otherwise provided. */
export function resolveAssignee(team: string | null, assignee: string | null): string | null {
  return team === INVENTORY_TEAM ? INVENTORY_ASSIGNEE : assignee;
}
