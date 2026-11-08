import { getSupabase } from './supabase';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

async function authHeader(): Promise<HeadersInit> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ErrorBody {
  error?: string;
}

// Full-precision ISO 8601 with a timezone — exactly the shape every
// timestamp column in this app serializes to over JSON (Postgres
// `timestamp with time zone` via drizzle/pg, always with milliseconds and
// `Z`). Anchored start-to-end so it only matches a string that IS a
// timestamp, not one that merely contains one (a policy's YAML blob could
// otherwise false-positive on a substring match).
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// The shared Zod schemas (packages/shared) declare every timestamp field as
// `z.coerce.date()`, but that coercion only ever runs when something calls
// `.parse()` — this app never did, so every "Date" was actually the raw
// JSON string underneath, which crashed for real (PoliciesPage, then
// ApprovalsPage) wherever code trusted the type and called a Date method
// directly. Fixing it here, once, at the JSON boundary, instead of
// auditing every page for `new Date(...)` wrapping one call site at a
// time. Exported for its own unit test.
export function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value) ? new Date(value) : value;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    throw new Error(body.error ?? `request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return JSON.parse(await res.text(), reviveDates) as T;
}

// Thin wrapper over fetch for the dashboard's calls to apps/server's /api/*
// REST routes — server state itself is owned by TanStack Query, not this.
export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};
