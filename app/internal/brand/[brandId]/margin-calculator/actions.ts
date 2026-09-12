"use server";

import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { saveMarginInputs, type MarginInputEntry } from "@/lib/margin";

export async function saveMarginInputsAction(brandId: string, entries: MarginInputEntry[]): Promise<{ ok: boolean }> {
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return { ok: false };
  if (!(await canStaffAccessBrand(ctx, brandId))) return { ok: false };

  await saveMarginInputs(brandId, entries);
  return { ok: true };
}
