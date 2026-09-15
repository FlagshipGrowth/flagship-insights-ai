import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/slack(.*)", // verified via its own Slack signature check, not Clerk — see lib/slack.ts
  "/api/clients/(.*)/logo", // meant to be embeddable as a plain <img src> with no auth
  "/api/leads/from-contact-form", // called cross-origin from flagshipgrowth.com's contact form
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
