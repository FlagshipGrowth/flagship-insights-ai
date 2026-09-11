import { neon } from "@neondatabase/serverless";
import { getConnectionString } from "@netlify/database";

// Separate from netlify/functions/lib/db.ts on purpose — the Next.js app and the standalone
// Netlify Functions (sync-nightly, sync-on-login-background) are different deployables with
// different bundlers, even though they share the same database.
//
// getConnectionString() reads Netlify DB's own env var (NETLIFY_DB_URL) — NOT a generic
// DATABASE_URL, which Netlify DB never sets. Use this instead of process.env.DATABASE_URL.
export function getDb() {
  return neon(getConnectionString());
}
