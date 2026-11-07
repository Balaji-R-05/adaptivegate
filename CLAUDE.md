# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

AdaptiveGate is an open-source MCP gateway for AI agents with three jobs: route each request to only the relevant tools (cut token usage), recover from tool failures with swappable policies, and govern every call (policy enforcement, approvals, data protection, budgets, audit). Users sign in to a React dashboard, configure their MCP servers and policies, and receive a per-user router MCP link that their MCP client (e.g. Claude Code) connects to. It is a B.Tech final-year project, so code quality, reproducible experiments and clear documentation matter as much as features. It is meant to be freely usable by anyone as a governance harness.

The owner is learning TypeScript through this project, so keep code clear and idiomatic, prefer readable over clever, and add short comments where a TypeScript or library concept is non-obvious.

## Core Concepts

- **Gateway**: the MCP server (Streamable HTTP) the agent connects to; it proxies to downstream MCP servers.
- **ToolGate (router)**: hybrid retrieval, BM25 keyword search plus embedding similarity, merged with reciprocal rank fusion, selecting relevant tools instead of exposing the full library.
- **Recovery policy**: strategy applied on tool failure (`retry`, `fallback`, `reroute`, `escalate`). Must be swappable and comparable.
- **Registry**: index of all tools from connected servers, including their embeddings.
- **Governance layer**: policy engine, approvals, guards, budgets, identity and audit log applied to every call.
- **Policy pack**: a ready-made YAML policy set (e.g. safe coding agent, read-only research agent, no-PII).
- **Dashboard**: React UI for login, stats and configuration. It is only a control panel and is never in the MCP request path.
- **Backend API**: REST/SSE service holding users, API keys, server configs, policies and events. The gateway reads per-user config from the same database.

## System Layout

```
React dashboard ──REST/SSE──► Backend API + Supabase Postgres ◄── reads config ── Gateway (/mcp) ◄── MCP client
```

## Request Flow

API key → user lookup → policy engine → approval (if required) → router → downstream tool → output guards → audit log and event record. Recovery policies apply when the downstream call fails. Governance decisions happen before the call and again on the output.

## Repository Layout

pnpm monorepo, TypeScript throughout.

- `apps/server/`: Hono/Fastify app serving the `/mcp` gateway and the REST/SSE API (keep route handlers thin)
- `apps/dashboard/`: React + Vite + Tailwind + shadcn/ui + TanStack Query + Recharts
- `packages/core/router/`: hybrid ToolGate (MiniSearch BM25, pgvector embeddings, reciprocal rank fusion)
- `packages/core/recovery/`: recovery policies
- `packages/core/governance/`: `policy`, `approvals`, `guards`, `budgets`, `identity`, `audit`
- `packages/db/`: Drizzle schema and migrations
- `packages/shared/`: Zod schemas and inferred types shared by server, core and dashboard
- `benchmark/`: governance attack scenarios and failure injection
- `experiments/`: saved configs, seeds and results
- `policies/`: policy packs
- `docs/`

## Commands

> Update these as the project's tooling is finalized.

```bash
pnpm install
pnpm dev                 # server (API + /mcp) and dashboard together
pnpm build
pnpm test                # Vitest
pnpm test:e2e            # Playwright
pnpm lint                # ESLint
pnpm typecheck           # tsc --noEmit across all packages
pnpm format              # Prettier
pnpm db:generate         # create a Drizzle migration from schema changes
pnpm db:migrate          # apply migrations
pnpm replay --log logs/session.jsonl --policy policies/strict.yaml   # dry-run a policy
pnpm benchmark           # run the governance attack benchmark
```

## Conventions

### General

- Recovery policies and governance components sit behind common interfaces so new ones are drop-in
- Never hardcode downstream servers or rules; everything comes from the database, `config.yaml` or policy YAML files
- Prefer small, focused modules; keep `apps/server` handlers thin and put logic in `packages/core`
- Write a test alongside each new router, policy, guard, recovery or API change
- Every guard needs both a blocked case and a benign case (to track false positives)

### TypeScript

- `strict` mode on; avoid `any` (use `unknown` and narrow) and explain any unavoidable exception in a comment
- Define data shapes once as Zod schemas in `packages/shared` and derive types with `z.infer`; validate all external input (HTTP bodies, MCP messages, config and policy files) with them
- Prefer discriminated unions for results and policy actions over booleans and magic strings
- Use `async`/`await`; handle promise rejections explicitly
- No default exports in packages (named exports only) so imports stay greppable

### Gateway and governance

- Policy evaluation must be deterministic and side-effect free; side effects (approvals, logging) happen outside the evaluator
- Default to **fail closed**: if a policy cannot be evaluated or a guard errors, deny or require approval, never silently allow
- Every routing decision, recovery attempt and governance decision goes through the audit log and the metrics module so experiments are reproducible
- Audit log is append-only and hash-chained; never add code paths that edit or delete past entries
- Redact secrets and PII before anything is written to logs
- Router changes must be evaluated against the saved benchmark, comparing BM25-only, embedding-only and hybrid

### Dashboard (React)

- Server state through TanStack Query; no ad-hoc fetching in components
- Never store tokens, API keys or downstream credentials in localStorage; rely on Supabase Auth's session handling
- API keys are displayed once at creation and never fetched again
- Components stay small; shared UI goes through shadcn/ui primitives

### Database

- All schema changes go through Drizzle migrations, never manual edits
- Enable Supabase row-level security on every user-owned table as a second layer behind application checks
- Store embeddings in pgvector columns; record the embedding model name alongside them so they can be regenerated

### Security (hosted mode)

- Hosted mode accepts **remote HTTP/SSE MCP servers only**. Never execute user-supplied stdio commands on the host
- Encrypt downstream credentials at rest with a server-side key; never return them to the browser
- Store API keys hashed; support revoke and rotate
- Scope **every** database query by user ID; add tests that one user's key cannot read or use another user's config
- Sign-in is restricted to an invite email allowlist; enforce it server-side, not only in the UI
- Rate limit the MCP endpoint, the API and embedding calls per user
- Validate and restrict outbound URLs for downstream servers (block localhost, private IP ranges and cloud metadata addresses) to prevent SSRF

## Working Guidelines

- Make a plan before large changes (new policy type, router rewrite, API, database schema or policy-format changes) and confirm it first
- Do not add dependencies without saying why
- Never commit secrets or API keys; use environment variables and a git-ignored `.env`; keep `.env.example` current
- Keep README, policy examples and `docs/` in sync with behavior changes
- When adding experiments, save the config, policy and random seed used under `experiments/` so results are reproducible for the report and paper
- Policy file format changes need a version bump and a migration note
- Commit small and often with clear messages
- Build in this order unless told otherwise (mirrors the README roadmap — keep both in sync; marks the actual completion order so far):
  1. Repo setup (monorepo, lint/format/CI) and shared Zod/Drizzle schemas — done
  2. Supabase login (GitHub OAuth; invite allowlist still pending) — done
  3. Minimal `/mcp` gateway proxying one server with hashed API-key auth — done
  4. Dashboard Servers and Connect pages (first end-to-end loop with a real Claude Code client) — done
  5. Hybrid router — done
  6. Policy engine and hash-chained audit log — done
  7. Recovery policies — done
  8. Guards — done
  9. Event logging and the Overview page — done
  10. Budgets, identity and approvals resolution — done (live push not done; approvals poll every 5s)
  11. Dry-run replay and scorecard
  12. Failure injection and the attack benchmark — done

## MVP Scope

In scope: gateway with hybrid router and API-key auth; dashboard login (one OAuth provider first), Servers and Connect pages; policy engine (allow, deny, require approval); budgets and kill switch; agent identity scopes; hash-chained audit log; dry-run replay and scorecard; failure injection and governance attack benchmark with measured results.

Stretch only after the MVP works: second OAuth provider, MCP OAuth 2.1, local stdio gateway, Rego/Cedar.

## Evaluation Notes

Every change that affects routing, recovery or governance must be measurable:

- Routing: token reduction vs. exposing all tools, routing accuracy (BM25-only vs. embedding-only vs. hybrid)
- Recovery: success rate and added latency under injected failures
- Governance: attack-block rate on the benchmark, false-positive rate on benign tasks, and latency/token overhead of governance checks

Test against a set of 5-10 real MCP servers. Do not claim improvements without numbers from the metrics module or benchmark.

## Out of Scope (for now)

- MCP OAuth 2.1 for client sign-in (API keys first)
- Local stdio server support (needs a locally run gateway)
- Public launch beyond the invite-only test group (about 5 users)
- Rego/Cedar policy languages (start with YAML)
