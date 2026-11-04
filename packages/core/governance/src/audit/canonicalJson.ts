// Postgres's `jsonb` column type reorders object keys internally (observed:
// by string length, then alphabetically — not insertion order), so a
// payload read back after storage has different key order than when it was
// written. A hashing scheme that feeds plain JSON.stringify output straight
// into a hash function is key-order-sensitive, so it would fail to verify
// its own untampered data purely because of that round trip — this is a
// real bug that was actually hit (see Milestone 6). Recursively sorting
// object keys before stringifying makes the hash depend only on the data,
// never on whatever order a particular JSON implementation happens to
// produce.
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
