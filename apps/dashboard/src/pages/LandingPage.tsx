import { useState } from 'react';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;
const GITHUB_URL = 'https://github.com/Balaji-R-05/adaptivegate';

const PILLARS = [
  {
    title: 'Routes',
    body: 'Hybrid BM25 + embedding retrieval exposes only the tools relevant to the current task, instead of the whole library — cutting token usage and improving tool-selection accuracy.',
  },
  {
    title: 'Recovers',
    body: 'Pluggable recovery policies (retry, fallback, reroute, escalate) handle tool failures automatically, instead of the agent retrying blindly or giving up.',
  },
  {
    title: 'Governs',
    body: 'A policy engine, approvals, guards, budgets and a hash-chained audit log sit in front of every call — nothing happens without it being recorded.',
  },
] as const;

const PROBLEMS = [
  {
    title: 'Context bloat',
    body: 'Hundreds of tool schemas consume tokens on every call, raising cost and latency and degrading tool-selection accuracy.',
  },
  {
    title: 'Brittle failures',
    body: 'When a tool errors, times out, or returns bad output, most agents retry blindly or give up.',
  },
  {
    title: 'No governance',
    body: 'Agents can call destructive tools, leak secrets, fall for prompt injection hidden in tool output, or run up costs — and nothing records what they did.',
  },
] as const;

const STEPS = [
  { title: 'Sign in', body: 'Sign in to the dashboard with GitHub (Supabase Auth).' },
  {
    title: 'Add your servers',
    body: 'Add your downstream MCP servers, choose a policy pack, and generate an API key.',
  },
  {
    title: 'Connect your client',
    body: 'Add the router MCP link to Claude Code or any MCP-capable client.',
  },
  {
    title: 'Every call is governed',
    body: "Tool calls flow through the gateway, which applies that user's servers and policies and records stats the dashboard displays.",
  },
] as const;

const FAQS = [
  {
    question: 'What is AdaptiveGate?',
    answer:
      'An open-source, self-correcting MCP gateway with built-in governance and a web dashboard for AI agents. It sits between an agent and a large library of MCP tools, routing, recovering, and governing every call in one drop-in layer.',
  },
  {
    question: 'Is it free?',
    answer:
      'Yes — free and open source under the MIT license. Self-host it or use it as a governance harness for your own agents.',
  },
  {
    question: 'What MCP servers can I connect?',
    answer:
      'Hosted mode accepts remote HTTP/SSE MCP servers. Support for locally run stdio servers is planned but not available yet.',
  },
  {
    question: 'Is this production-ready?',
    answer:
      'AdaptiveGate is an active final-year B.Tech project, built and documented in the open. The MVP (routing, recovery, policy engine, audit log, a governance benchmark) is still being built milestone by milestone — expect rough edges for now.',
  },
] as const;

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 py-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-base font-medium text-slate-900"
        aria-expanded={open}
      >
        {question}
        <span className="ml-4 text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="mt-2 text-sm text-slate-600">{answer}</p>}
    </div>
  );
}

export function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold">AdaptiveGate</span>
          <div className="flex items-center gap-4 text-sm">
            <a href={GITHUB_URL} className="text-slate-600 hover:text-slate-900">
              GitHub
            </a>
            <button
              type="button"
              onClick={onSignIn}
              className="rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
            >
              Sign in
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="mb-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Open source · MIT licensed
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Route, recover, and govern every MCP tool call.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          AdaptiveGate sits between your AI agent and a large library of MCP tools — exposing only
          relevant tools, recovering from failures automatically, and enforcing policy on every
          call.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onSignIn}
            className="rounded bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-700"
          >
            Sign in with GitHub
          </button>
          <a
            href={GITHUB_URL}
            className="rounded border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Three pillars */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-lg border border-slate-200 p-6">
              <h3 className="mb-2 text-lg font-semibold text-slate-900">{pillar.title}</h3>
              <p className="text-sm text-slate-600">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problems it solves */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-slate-900">
            Agents connected to many MCP servers run into three problems
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {PROBLEMS.map((problem) => (
              <div key={problem.title}>
                <h3 className="mb-2 text-base font-semibold text-slate-900">{problem.title}</h3>
                <p className="text-sm text-slate-600">{problem.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold text-slate-900">How it works</h2>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <ol className="flex flex-col gap-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="text-sm text-slate-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <img
            src="/flow.png"
            alt="Request flow: React dashboard talks REST/SSE to the Backend API and DB; the Gateway reads config from the same DB and exposes an MCP endpoint that clients like Claude Code connect to."
            className="w-full rounded-lg border border-slate-200"
          />
        </div>
      </section>

      {/* Connect snippet */}
      <section className="bg-slate-900 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-6 text-2xl font-bold text-white">Connect your client in one line</h2>
          <pre className="overflow-x-auto rounded-lg bg-slate-800 p-4 text-left text-sm text-slate-100">
            {`claude mcp add --transport http adaptivegate ${GATEWAY_URL}/mcp \\\n  --header "Authorization: Bearer ag_xxxxx"`}
          </pre>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">
          Frequently asked questions
        </h2>
        <div>
          {FAQS.map((faq) => (
            <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <span>&copy; {new Date().getFullYear()} AdaptiveGate &middot; MIT License</span>
          <a href={GITHUB_URL} className="hover:text-slate-900">
            github.com/Balaji-R-05/adaptivegate
          </a>
        </div>
      </footer>
    </div>
  );
}
