import { getDb } from "./db";

export interface BrandOption {
  id: string;
  name: string;
  clientName: string;
}

/** Every brand in the system, for the "Add Brand" picker on /internal's Manage Users — grouped
 * by their current owning client (brands.client_id) just for context in the picker; picking one
 * doesn't change that ownership, see setBrandAccessForUser. */
export async function getAllBrandsForPicker(): Promise<BrandOption[]> {
  const sql = getDb();
  const rows = await sql`
    select b.id, b.name, c.name as client_name
    from brands b
    join clients c on c.id = b.client_id
    order by c.name, b.name
  `;
  return rows.map((r: any) => ({ id: r.id, name: r.name, clientName: r.client_name }));
}

export async function getBrandAccessForUser(userId: string): Promise<string[]> {
  const sql = getDb();
  const rows = await sql`select brand_id from user_brand_access where user_id = ${userId}`;
  return rows.map((r: any) => r.brand_id as string);
}

/** Every grant, grouped by user — for the "Manage users" table on /internal, so it can show each
 * row's current picks without an N+1 query per row. */
export async function getBrandAccessMap(): Promise<Map<string, string[]>> {
  const sql = getDb();
  const rows = await sql`select user_id, brand_id from user_brand_access`;
  const map = new Map<string, string[]>();
  for (const r of rows as any[]) {
    const list = map.get(r.user_id) ?? [];
    list.push(r.brand_id);
    map.set(r.user_id, list);
  }
  return map;
}

/** Replace-all, same convention as lib/assignments.ts's saveAssignments — low write frequency,
 * no concurrent-edit concern at this scale. Purely additive visibility: never touches
 * brands.client_id, so a brand's actual ownership is unaffected by who else can see it. */
export async function setBrandAccessForUser(userId: string, brandIds: string[]): Promise<void> {
  const sql = getDb();
  await sql`delete from user_brand_access where user_id = ${userId}`;
  for (const brandId of brandIds) {
    await sql`insert into user_brand_access (user_id, brand_id) values (${userId}, ${brandId}) on conflict do nothing`;
  }
}
