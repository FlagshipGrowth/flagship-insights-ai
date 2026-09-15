import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import "./globals.css";

// Brand guidelines (Flagship_Growth_Brand_Guidelines_FINAL.pdf, §03): Space Grotesk for
// headings/buttons/labels, Inter for body copy — never substitute a system font for either.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Flagship Insights AI",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#2447FF",
          colorBackground: "#F6F3EC",
          colorForeground: "#0B0D12",
          colorInput: "#F6F3EC",
          colorInputForeground: "#0B0D12",
          fontFamily: "var(--font-body), system-ui, sans-serif",
        },
        elements: {
          headerTitle: { fontFamily: "var(--font-heading), system-ui, sans-serif" },
          formButtonPrimary: { fontFamily: "var(--font-heading), system-ui, sans-serif" },
        },
      }}
    >
      <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
        <body>
          <header
            style={{
              padding: "12px 24px",
              borderBottom: "1px solid var(--paper-2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <a href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lockup-ink.svg" alt="Flagship Growth" style={{ height: 28 }} />
            </a>
            {/* Global so it shows on every screen for every signed-in role, including early-return
                fallback pages (e.g. "no brands set up yet") that don't build their own header —
                UserButton's own dropdown already covers both "Manage account" and "Sign out".
                <SignedIn> isn't available on this Clerk version (Core 3 error at build) — check
                auth() directly instead, same pattern already used elsewhere in this app. */}
            {userId && <UserButton />}
          </header>
          <ImpersonationBanner />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
