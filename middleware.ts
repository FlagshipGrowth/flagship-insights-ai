import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/slack(.*)", // verified via its own Slack signature check, not Clerk — see lib/slack.ts
  "/api/clients/(.*)/logo", // meant to be embeddable as a plain <img src> with no auth
  "/api/leads/from-contact-form", // called cross-origin from flagshipgrowth.com's contact form
  "/api/marketing/sync", // verified via its own shared-secret check, not Clerk — see route.ts
  "/api/marketing/recommendations", // same shared-secret check as /api/marketing/sync
  "/api/marketing/creatives", // same shared-secret check as /api/marketing/sync
  "/api/marketing/creative-image/(.*)", // meant to be embeddable as a plain <img src> with no auth
  "/api/tiktok-shop/sync", // verified via its own shared-secret check, not Clerk — see route.ts
  "/api/sellerise/sync", // verified via its own shared-secret check, not Clerk — see route.ts
  "/api/outbound/ingest", // same shared-secret check, for the outbound-sourcing agent
  "/api/outbound/audit-queue", // same shared-secret check, for the outbound-audit agent
  "/api/outbound/audits", // same shared-secret check, for the outbound-audit agent
  "/api/outbound/replies", // same shared-secret check, for the sending tool's reply webhook
  "/api/outbound/instantly-webhook", // same shared-secret check, set as a header on the Instantly webhook
  "/api/outbound/audit-image/(.*)", // public once the audit is approved; checks owner itself before that
  "/audit/(.*)", // prospect-facing audit page; only renders approved audits to anyone but owners
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // /__clerk/:path* is Clerk's own proxy path (newer SDK versions use it for some features) —
  // must come after the api/trpc matcher.
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)", "/__clerk/:path*"],
};
