# Testing AdaptiveGate end to end

This covers every layer: automated suites, the gateway's MCP surface, governance, recovery,
routing, the dashboard, and the benchmark/replay tooling. Run things roughly in this order the
first time; after that, pick whichever section matches what you changed.

## 0. One-time setup

Two ways to get a working Supabase project here — pick one:

- **Supabase Cloud**: `.env` at the repo root (git-ignored; copy `.env.example`):
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase
    project's Settings → API.
  - `DATABASE_URL` — Supabase's **Direct connection** string (not the pooler; the server is a
    long-lived process).
  - `VITE_GATEWAY_URL=http://localhost:3000`, `DASHBOARD_URL=http://localhost:5173` (defaults;
    only needed if you run on different ports).
  - In Supabase: enable GitHub OAuth (Authentication → Providers).
- **Fully local, no cloud account** — see [docs/self-hosting.md](self-hosting.md) instead; it
  covers the same `.env` values plus the local Docker stack that stands in for Supabase Cloud.

Either way, then apply the Drizzle schema:
```bash
pnpm install
pnpm db:generate   # only if you changed packages/db/src/schema.ts
pnpm db:migrate
```

Start everything:
```bash
pnpm dev   # server on :3000, dashboard on :5173, in parallel
```
Confirm the gateway is up: `curl http://localhost:3000/health` → `{"status":"ok"}`.

## 1. Automated checks (run these after every change)

```bash
pnpm typecheck   # tsc --noEmit across every package
pnpm lint        # eslint .
pnpm test        # vitest (backend + packages) + the dashboard's own vitest run
pnpm build       # tsc builds + the dashboard's vite build
```
`pnpm test` currently runs ~215 tests (backend/governance/router/recovery unit + integration
tests, plus dashboard component smoke tests). A real regression shows up here first — don't skip
straight to manual testing.

### Dashboard tests specifically
If you ever see a Vitest "worker exited unexpectedly" crash running the dashboard suite, it's a
local multi-worker flake, not a real failure — retry with a single fork:
```bash
cd apps/dashboard && npx vitest run --pool=forks --poolOptions.forks.singleFork
```

### Playwright e2e (dashboard)
```bash
pnpm --filter @adaptivegate/dashboard run test:e2e
```
Covers `apps/dashboard/e2e/smoke.spec.ts`. Needs the dashboard dev server reachable (Playwright's
config may start it itself — check `apps/dashboard/playwright.config.ts` if it fails to connect).

## 2. The first real end-to-end loop (do this once to prove the whole system works)

1. **Sign in**: open `http://localhost:5173`, sign in with GitHub or email/password - both work on
   either setup.
2. **Connect a downstream server** (Servers page): either
   - add a real public no-auth MCP server from the **Marketplace** page (one click), or
   - start the bundled fixture and add it manually:
     ```bash
     pnpm --filter @adaptivegate/server run fixture:downstream   # serves one `echo` tool on :3100
     ```
     Servers → Add MCP server → name `fixture`, URL `http://localhost:3100/mcp`, auth `none`.
3. **Create a policy** (Policies page): click "Add Policy Pack", pick a curated pack (e.g.
   `safe-coding-agent`) or build rules by hand, Deploy. Without any policy, every `call_tool`
   denies by default (fail-closed) — this step is required before step 5 works.
4. **Create an API key** (Connect page): label it, copy the key shown (shown once, never again).
5. **Connect a real MCP client** — copy the "Claude Code CLI" snippet from the Connect page and
   run it in a terminal (it's a single line on purpose — multi-line `\` continuation breaks in
   PowerShell):
   ```bash
   claude mcp add --transport http adaptivegate http://localhost:3000/mcp --header "Authorization: Bearer ag_..."
   claude mcp get adaptivegate   # confirm Status: ✔ Connected
   ```
6. **Exercise all three gateway tools** from inside a real Claude Code session connected to
   `adaptivegate`:
   - `search_tools` with a natural-language query → should return the fixture's `echo` tool (or
     whatever real server you connected).
   - `check_policy` with the `name`/`serverId` search_tools returned → `{"action":"allow"}` (or
     `deny`/`require_approval` depending on your policy).
   - `call_tool` with the same `name`/`serverId` → the real downstream result.
7. **Confirm it's logged**: Overview page's stats should tick up; Audit page should show new
   events; click "Verify Chain" — should report every event's hash intact.

If all seven steps work, the full request path (API key → policy → router → downstream → guards
→ audit) is proven end to end with a real client, not a mock.

## 3. Governance

- **Policy enforcement**: on the Policies page, deploy a pack with a `deny` or `require_approval`
  rule matching a tool you can call, then try it from your MCP client — confirm the exact
  behavior (immediate error for deny; "requires approval" error for require_approval).
- **Approvals**: after a `require_approval` denial, go to the Approvals page, approve it, then
  retry the exact same `call_tool` from the client — it should now succeed once (one-time
  consumption; a second identical call needs a fresh approval).
- **Budgets / kill switch**: on the Identities page, create an identity, open **Edit limits**, set
  a small daily budget (e.g. 2) and pin a policy; create an API key for that identity (via the
  identity's own key, not the unscoped Connect-page key); call a tool 3 times — the 3rd should
  deny with `budget_exceeded`. Toggle the identity off ("Disable (kill switch)") and confirm every
  call now denies with `identity_disabled` regardless of budget/policy.
- **Scope**: in Edit limits, uncheck "All connected servers" and leave only one server checked;
  calling a tool on a different real connected server should deny with `out_of_scope`.
- **Redaction & injection scan**: these run automatically on every real call — check the Audit
  page's event payloads for `redactedFields` on a call whose output contained something
  secret-shaped, and confirm a tool whose output contains an obvious prompt-injection phrase gets
  blocked (there's a regression test for this already: `packages/core/governance/src/guards/*.test.ts`).
- **Audit chain**: Audit page → "Verify Chain" after some real activity. A small number of
  permanently-broken old events (from before a hashing fix) is expected and explained in the UI;
  a *growing* broken count is a real bug.

### Governance attack benchmark (synthetic, deterministic)
```bash
pnpm --filter @adaptivegate/benchmark run governance
```
Reports attack-block rate, false-positive rate on benign scenarios, secret-detection rate, and
per-check latency. Saves a timestamped JSON to `experiments/` (never commit that file).

## 4. Recovery (failure injection)

```bash
pnpm --filter @adaptivegate/benchmark run recovery
```
Runs the seeded fault injector (`packages/core/recovery`) against retry/fallback/escalate
policies and reports success rate + added latency under injected failures. Deterministic (seeded
PRNG) — rerunning reproduces the same numbers.

To see recovery for real rather than synthetically: `apps/server/src/mcp/route.test.ts` has a
live integration test (`buildFlakyFixture`) that fails a real downstream connection twice then
succeeds, proving `retryPolicy` recovers an actual connection failure, not just a mocked one —
`pnpm --filter @adaptivegate/server run typecheck` isn't enough here, actually run:
```bash
npx vitest run apps/server/src/mcp/route.test.ts
```

## 5. Routing (ToolGate)

```bash
pnpm --filter @adaptivegate/benchmark run router
```
Compares BM25-only, embedding-only, and hybrid routing against the saved synthetic dataset
(`benchmark/router/dataset.ts`) — accuracy and latency per method.

### Against your own real, messy catalog (not synthetic)
```bash
pnpm --filter @adaptivegate/server run evaluate:live-catalog -- you@example.com
```
Hits every server you've actually connected: reports token reduction (meta-tools vs. exposing
every tool directly), `search_tools` routing accuracy/latency on a varied real query set, and
real `call_tool` latency + output size across several of your connected servers. This is the
script to run after connecting new marketplace servers or changing the router.

## 6. Dry-run policy replay

Test a candidate policy against your own real history before switching to it:
```bash
pnpm --filter @adaptivegate/server run export-log -- you@example.com session.jsonl
pnpm replay --log session.jsonl --policy policies/strict-example.yaml
```
Reports what the candidate policy would newly block or newly allow versus what actually happened.
Delete `session.jsonl` afterward (it's real account data, don't commit it).

## 7. Security surface

- **SSRF guard**: try adding a server with URL `http://localhost:1234/mcp` or
  `http://169.254.169.254/` on the Servers page — must be rejected (`packages/core/governance`'s
  `assertSafeDownstreamUrl`/`ssrf.ts` already has unit tests; this is the manual confirmation).
- **Rate limiting**: hammer `/mcp` or any `/api/*` route past ~120 requests/minute for one
  account — expect `429` with a `Retry-After` header; wait out the window and confirm it clears.
  (`apps/server/src/rateLimit/*.test.ts` covers this at the unit level already.)
- **API key hygiene**: confirm a revoked key immediately gets `401` on `/mcp`; confirm the
  dashboard never re-displays a key after creation (Connect page only shows it once, in-memory).
- **Cross-user isolation**: with two different Supabase accounts, confirm one account's API key
  can't see or call the other account's servers/policies/identities (every query in
  `apps/server/src/api/*.ts` is scoped by `userId` — spot-check by trying a key from account A
  against account B's `serverId` in `call_tool`).
- **Known gap, not yet implemented**: the invite-email allowlist CLAUDE.md requires is not
  enforced server-side yet — anyone who completes GitHub OAuth can currently sign in. Don't rely
  on this being restricted until that's built.

## 8. Dashboard-only features (no backend involved, verify in the browser)

- **Marketplace**: already-connected catalog entries show "Connected" (not addable again); a
  free entry adds with one click; an auth-required entry (currently just GitHub) expands an
  inline token-env-var-name field.
- **Policies page's Rules/Raw YAML toggle**: pick a curated pack, confirm the Rules tab's rows
  match it, confirm the YAML preview under "Preview compiled YAML" matches what Raw YAML mode
  shows; manually break the YAML in Raw mode (e.g. add a comment) and confirm the Rules tab
  becomes disabled rather than silently discarding your edit.
- **Edit Limits modal**: confirm you can set a real budget, clear it back to "Unlimited", pin and
  un-pin a policy, and scope to specific servers vs. "All connected servers" — all three save in
  one PATCH.

## 9. Policy, governance and performance — in real time

The trick is two panes open at once: the dashboard in a browser tab, and a terminal with a real
MCP client connected (Claude Code, per section 2's connect snippet). Every call you make in the
terminal shows up live in the dashboard — that's "real time" here, not a special mode.

### Policy, live
1. Dashboard → Policies page, Audit page open in two tabs (or two browser windows side by side).
2. In the terminal, run `check_policy` for some tool → note the action.
3. On the Policies page, edit the active pack (or deploy a new one) to flip that tool's rule —
   e.g. change it from `allow` to `deny`. Save.
4. Immediately rerun the *same* `check_policy` call in the terminal — the action changes on the
   very next call, with no restart, no cache to clear. If it doesn't, that's a real bug (policy
   lookup isn't supposed to cache — `evaluateCallToolPolicy` reads the latest policy row on every
   call).
5. Now run the actual `call_tool` for that tool and watch the Audit tab — a new `policy_decision`
   event appears within the page's normal refresh (TanStack Query re-fetches on window focus/
   interval; hit refresh if you don't want to wait).

### Governance, live
- **Kill switch**: Identities page → toggle an identity off. In the terminal, immediately call a
  tool with that identity's key → denies with `identity_disabled`. Toggle back on → the very next
  call succeeds. No propagation delay — it's a plain DB read on every call.
- **Budget**: Identities page shows `usedToday / limit` and a progress bar. Call tools with that
  identity's key in the terminal and refresh the Identities page between calls — watch the count
  climb and the bar fill in step with your real calls, then watch the next call deny once it hits
  the limit.
- **Approvals**: trigger a `require_approval` denial in the terminal, then open the Approvals
  page — it polls every 5s, so the pending request appears within 5 seconds without a manual
  refresh. Approve it there, then immediately retry the same call in the terminal — succeeds once
  (one-time consumption), and the Approvals page's pending count drops on its next poll.
- **Redaction/injection**: call a tool whose real output contains something secret-shaped or an
  injection phrase, then open the Audit page and expand that event — `redactedFields` or a
  `blocked: true` / `reason: "injection_scan"` payload appears immediately, reflecting exactly
  what that one real call produced.

### Performance, live
- **Per-call timing, no extra tooling**: any MCP client that prints request timing works (or
  just eyeball it — `call_tool` against a real downstream currently runs ~2-6s depending on the
  downstream service itself, `search_tools` ~0.5-1.5s including the local embedding model).
- **The Connect page's "Test Ping"** button gives you the gateway's bare `/health` latency with
  no auth/governance/routing in the path — a quick baseline to compare real `call_tool` latency
  against, so you can tell "the gateway is slow" apart from "this downstream server is slow."
- **For real numbers, not eyeballing**, run the live evaluator while you're connected — it opens
  its own short-lived client against your real indexed tools and prints a latency table
  immediately:
  ```bash
  pnpm --filter @adaptivegate/server run evaluate:live-catalog -- you@example.com
  ```
  Re-run it right after a change (new server, router tweak, pooling change) to see the before/
  after live, same account, same real servers.
- **Rate-limit timing**: fire calls in a tight loop in the terminal and watch for the real 429 —
  the `Retry-After` header tells you exactly how many seconds until the window resets; wait that
  long and the very next call succeeds again.

## Known non-goals right now
Don't expect these to work — they're explicitly out of scope per CLAUDE.md: MCP OAuth 2.1 for
client sign-in, local stdio downstream servers, public signup beyond the invite group, Rego/Cedar
policies.
