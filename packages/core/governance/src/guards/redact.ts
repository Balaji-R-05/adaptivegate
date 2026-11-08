// Detectors matching an example policy's detector names
// (`detectors: [api_key, aws_key, email, phone]`). Applied to what gets
// logged (tool call arguments/output in the audit payload), not to what's
// sent downstream or returned to the agent — secrets/PII must be redacted
// before anything is written to logs, not after.
// Order matters: more specific patterns run first so the generic api_key
// catch-all doesn't swallow part of an email/phone/AWS key before its own
// detector gets a chance.
// A canonical UUID (8-4-4-4-12 hex) is the single most common false
// positive for the generic `api_key` catch-all below — real-world tool
// output (e.g. Azure/Microsoft Learn docs) is full of resource IDs shaped
// exactly like this, and at 36 chars including dashes it clears the
// catch-all's length bar easily. Found via real usage, not synthesized:
// one live call redacted ~109 ordinary GUIDs as "api_key" matches.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DETECTORS: Array<{ name: string; pattern: RegExp; isMatch?: (value: string) => boolean }> = [
  { name: 'aws_key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'email', pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { name: 'phone', pattern: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  // Generic long alphanumeric/underscore/dash tokens that look like API
  // keys (e.g. "sk-...", "ag_...", bearer tokens) — deliberately broad, at
  // the cost of some false positives, since over-redacting a log is far
  // cheaper than leaking a real secret into one. The UUID exclusion above
  // is the one precise carve-out earned by a real false positive; this
  // stays broad otherwise on purpose.
  {
    name: 'api_key',
    pattern: /\b[A-Za-z0-9_-]{20,}\b/g,
    isMatch: (value) => !UUID_PATTERN.test(value),
  },
];

export interface RedactResult {
  redacted: string;
  found: string[];
}

export function redactSecrets(text: string): RedactResult {
  const found: string[] = [];
  let redacted = text;

  for (const detector of DETECTORS) {
    redacted = redacted.replace(detector.pattern, (match) => {
      if (detector.isMatch && !detector.isMatch(match)) {
        return match;
      }
      found.push(detector.name);
      return `[REDACTED:${detector.name}]`;
    });
  }

  return { redacted, found };
}
