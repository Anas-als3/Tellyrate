import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/**
 * The shell every readable page sits in.
 *
 * Deliberately does NOT read the session. `cookies()` in a layout opts the
 * whole subtree into per-request rendering, which would stop /about and
 * /privacy from being prerendered at all and stop any CDN from serving a
 * facility page near the reader. The header fetches the viewer itself.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minBlockSize: "100dvh",
      }}
    >
      <SiteHeader />
      {/* The root layout's skip link points at this id. */}
      <main id="main" style={{ flex: "1 0 auto" }}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
