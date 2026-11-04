// Minimal glob matching for tool-name patterns like "github.create_*" — just
// `*` as a wildcard, nothing fancier (no `?`, `**`, character classes).
export function matchesGlob(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}
