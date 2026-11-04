// Detectors matching the categories CLAUDE.md's example policy names
// (`detectors: [api_key, aws_key, email, phone]`). Applied to what gets
// logged (tool call arguments/output in the audit payload), not to what's
// sent downstream or returned to the agent — CLAUDE.md: "redact secrets and
// PII before anything is written to logs."
// Order matters: more specific patterns run first so the generic api_key
// catch-all doesn't swallow part of an email/phone/AWS key before its own
// detector gets a chance.
const DETECTORS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'aws_key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'email', pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { name: 'phone', pattern: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  // Generic long alphanumeric/underscore/dash tokens that look like API
  // keys (e.g. "sk-...", "ag_...", bearer tokens) — deliberately broad, at
  // the cost of some false positives, since over-redacting a log is far
  // cheaper than leaking a real secret into one.
  { name: 'api_key', pattern: /\b[A-Za-z0-9_-]{20,}\b/g },
];

export interface RedactResult {
  redacted: string;
  found: string[];
}

export function redactSecrets(text: string): RedactResult {
  const found: string[] = [];
  let redacted = text;

  for (const detector of DETECTORS) {
    redacted = redacted.replace(detector.pattern, () => {
      found.push(detector.name);
      return `[REDACTED:${detector.name}]`;
    });
  }

  return { redacted, found };
}
