import { env, isProductionDeployment } from "@/lib/env";

/**
 * A visible marker on anything that is not the live site.
 *
 * The failure this prevents is mundane and expensive: someone moderates a real
 * report, or deletes a review, on what turns out to be staging — or worse,
 * assumes production is staging and tests a destructive action on live data.
 * A banner that cannot be missed is cheaper than either.
 *
 * Renders nothing in production, so it costs the real site nothing.
 */
export function EnvironmentBanner() {
  if (isProductionDeployment) return null;

  const isStaging = env.APP_ENV === "staging";

  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-xs)",
        padding: "6px var(--space-m)",
        background: isStaging ? "var(--amber)" : "var(--surface-2)",
        color: isStaging ? "#1a1206" : "var(--ink-2)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--step--2)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        borderBlockEnd: "1px solid var(--line)",
      }}
    >
      <strong>{isStaging ? "Staging" : "Development"}</strong>
      <span style={{ opacity: 0.85, textTransform: "none", letterSpacing: 0 }}>
        {isStaging
          ? "Test data, separate database. Nothing here is real."
          : "Local development build."}
      </span>
    </div>
  );
}
