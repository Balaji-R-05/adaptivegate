// Server-side invite allowlist for hosted mode. Self-hosted deployments
// typically leave ALLOWED_EMAILS unset, since anyone who can reach the
// instance already has full access to the host running it; hosted mode
// sets it to restrict sign-in to an invited group.
//
// Read lazily (not cached at module load) so a changed env var takes
// effect without a restart and so tests can set it per case.
export function isEmailAllowed(email: string): boolean {
  const raw = process.env.ALLOWED_EMAILS;
  if (!raw || raw.trim().length === 0) {
    return true;
  }

  const allowed = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return allowed.includes(email.toLowerCase());
}
