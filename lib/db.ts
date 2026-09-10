import { neon } from "@neondatabase/serverless";

// Separate from netlify/functions/lib/db.ts on purpose — the Next.js app and the standalone
// Netlify Functions (sync-nightly, sync-on-login-background) are different deployables with
// different bundlers, even though they share the same database.
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  return neon(url);
}
