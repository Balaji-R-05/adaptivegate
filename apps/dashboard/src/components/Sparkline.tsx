// Purely decorative — matches the mockup's own hardcoded sparkline paths.
// There's no time-series endpoint behind these yet, so this never carries a
// fabricated trend number alongside it (CLAUDE.md: don't claim improvements
// without real numbers).
export function Sparkline({ path, colorClass }: { path: string; colorClass: string }) {
  return (
    <svg className={`h-5 w-16 ${colorClass}`} fill="none" viewBox="0 0 64 20">
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}
