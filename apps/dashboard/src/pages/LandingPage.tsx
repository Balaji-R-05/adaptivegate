import { useState, type FormEvent, type SVGProps } from 'react';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;
const GITHUB_URL = 'https://github.com/Balaji-R-05/adaptivegate';

// Small inline icons (no icon-library dependency) — plain SVG primitives,
// not traced from any third-party icon set.
function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <circle cx="10" cy="10" r="6" />
      <line x1="15" y1="15" x2="20" y2="20" strokeLinecap="round" />
    </svg>
  );
}
function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="M4 12a8 8 0 0 1 14-5.3" strokeLinecap="round" />
      <polyline points="18 3 18 7 14 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12a8 8 0 0 1-14 5.3" strokeLinecap="round" />
      <polyline points="6 21 6 17 10 17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" strokeLinejoin="round" />
    </svg>
  );
}
function IconUnlock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.8-1.2" strokeLinecap="round" />
    </svg>
  );
}
function IconLink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path
        d="M9 15l6-6M8 16l-2 2a3 3 0 1 1-4-4l3-3M16 8l2-2a3 3 0 1 1 4 4l-3 3"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconBolt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <polygon points="13 2 4 14 11 14 9 22 20 9 13 9" />
    </svg>
  );
}
function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="4" y="13" width="3" height="7" />
      <rect x="10.5" y="9" width="3" height="11" />
      <rect x="17" y="5" width="3" height="15" />
    </svg>
  );
}
function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M15 14c2.8.3 5 2.8 5 6" strokeLinecap="round" />
    </svg>
  );
}
function IconConnector(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <rect x="3" y="9" width="8" height="6" rx="1" />
      <rect x="13" y="9" width="8" height="6" rx="1" />
      <line x1="11" y1="12" x2="13" y2="12" strokeLinecap="round" />
    </svg>
  );
}

const PILLARS = [
  {
    title: 'Routes',
    body: 'Hybrid BM25 + embedding retrieval exposes only the tools relevant to the current task, instead of the whole library — cutting token usage and improving tool-selection accuracy.',
    icon: IconSearch,
    tint: 'bg-blue-500/10 text-blue-600',
  },
  {
    title: 'Recovers',
    body: 'Pluggable recovery policies (retry, fallback, reroute, escalate) handle tool failures automatically, instead of the agent retrying blindly or giving up.',
    icon: IconRefresh,
    tint: 'bg-violet-500/10 text-violet-600',
  },
  {
    title: 'Governs',
    body: 'A policy engine, approvals, guards, budgets and a hash-chained audit log sit in front of every call — nothing happens without it being recorded.',
    icon: IconShield,
    tint: 'bg-amber-500/10 text-amber-600',
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

const BENEFITS = [
  {
    title: 'Open Source',
    body: 'MIT licensed, forever free. Self-host it or use it as a governance harness for your own agents.',
    icon: IconUnlock,
    tint: 'bg-blue-500/15 text-blue-400',
  },
  {
    title: 'No Vendor Lock-in',
    body: 'Bring your own MCP servers, your own Supabase project, your own policies.',
    icon: IconLink,
    tint: 'bg-violet-500/15 text-violet-400',
  },
  {
    title: 'Fail-Closed by Default',
    body: "If a policy can't be evaluated or a guard errors, the call is denied or needs approval — never silently allowed.",
    icon: IconBolt,
    tint: 'bg-amber-500/15 text-amber-400',
  },
  {
    title: 'Full Visibility',
    body: 'Every call, decision, and recovery attempt goes into an append-only, hash-chained audit log.',
    icon: IconChart,
    tint: 'bg-teal-500/15 text-teal-400',
  },
  {
    title: 'Built in the Open',
    body: 'An active final-year B.Tech project, developed and documented publicly from the first commit.',
    icon: IconUsers,
    tint: 'bg-green-500/15 text-green-400',
  },
  {
    title: 'Works With Your Client',
    body: 'One router MCP link — connect Claude Code or any other MCP-capable client.',
    icon: IconConnector,
    tint: 'bg-pink-500/15 text-pink-400',
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

// Email/password sign-in, alongside GitHub OAuth - useful for self-hosted
// deployments that don't have a GitHub OAuth App set up.
function EmailPasswordForm({
  onSignIn,
  onSignUp,
}: {
  onSignIn: (email: string, password: string) => Promise<string | undefined>;
  onSignUp: (email: string, password: string) => Promise<string | undefined>;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const submit = mode === 'signin' ? onSignIn : onSignUp;
    const message = await submit(email, password);
    setSubmitting(false);
    setError(message);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-xs flex-col gap-2">
      <input
        type="email"
        required
        placeholder="Email"
        aria-label="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-indigo-200 focus:outline-none"
      />
      <input
        type="password"
        required
        placeholder="Password"
        aria-label="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-indigo-200 focus:outline-none"
      />
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-50 disabled:opacity-60"
      >
        {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>
      <button
        type="button"
        onClick={() => setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
        className="text-xs text-indigo-200 underline hover:text-white"
      >
        {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
      </button>
    </form>
  );
}

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

export function LandingPage({
  onSignIn,
  onEmailSignIn,
  onEmailSignUp,
}: {
  onSignIn: () => void;
  onEmailSignIn: (email: string, password: string) => Promise<string | undefined>;
  onEmailSignUp: (email: string, password: string) => Promise<string | undefined>;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Hero — gradient band with the nav blended into it, like mlflow.org */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-violet-800 to-blue-700">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 40px)',
          }}
        />

        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="text-lg font-semibold text-white">AdaptiveGate</span>
          <div className="flex items-center gap-4 text-sm">
            <a href={GITHUB_URL} className="text-indigo-100 hover:text-white">
              GitHub
            </a>
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full bg-white px-4 py-2 font-medium text-indigo-900 hover:bg-indigo-50"
            >
              Sign in
            </button>
          </div>
        </header>

        <section className="relative mx-auto max-w-4xl px-6 pb-24 pt-10 text-center">
          <p className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
            Open source · MIT licensed
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Route, recover, and govern every MCP tool call.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-indigo-100">
            AdaptiveGate sits between your AI agent and a large library of MCP tools — exposing only
            relevant tools, recovering from failures automatically, and enforcing policy on every
            call.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full bg-white px-6 py-3 font-medium text-indigo-900 hover:bg-indigo-50"
            >
              Sign in with GitHub
            </button>
            <a
              href={GITHUB_URL}
              className="rounded-full border border-white/40 px-6 py-3 font-medium text-white hover:bg-white/10"
            >
              View on GitHub
            </a>
          </div>

          <p className="mt-8 text-xs uppercase tracking-wider text-indigo-200">
            or continue with email — for self-hosted deployments without GitHub OAuth configured
          </p>
          <EmailPasswordForm onSignIn={onEmailSignIn} onSignUp={onEmailSignUp} />

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-indigo-100">
            <span className="rounded-full bg-white/10 px-3 py-1">MIT License</span>
            <span className="rounded-full bg-white/10 px-3 py-1">B.Tech Final-Year Project</span>
            <span className="rounded-full bg-white/10 px-3 py-1">Built in the open</span>
          </div>
        </section>
      </div>

      {/* Three pillars */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-lg border border-slate-200 p-6">
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${pillar.tint}`}
              >
                <pillar.icon className="h-5 w-5" />
              </div>
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
              <div key={problem.title} className="border-t-2 border-indigo-500 pt-4">
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-semibold text-white">
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
      <section className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-6 text-2xl font-bold text-white">Connect your client in one line</h2>
          <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-4 text-left text-sm text-indigo-100">
            {`claude mcp add --transport http adaptivegate ${GATEWAY_URL}/mcp \\\n  --header "Authorization: Bearer ag_xxxxx"`}
          </pre>
        </div>
      </section>

      {/* Why AdaptiveGate — dark benefits grid */}
      <section className="bg-slate-950 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-2 text-center text-2xl font-bold text-white">Why AdaptiveGate</h2>
          <p className="mb-10 text-center text-sm text-slate-400">
            Not a finished product yet — a governance harness being built openly, milestone by
            milestone.
          </p>
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title}>
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${benefit.tint}`}
                >
                  <benefit.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-semibold text-white">{benefit.title}</h3>
                <p className="text-sm text-slate-400">{benefit.body}</p>
              </div>
            ))}
          </div>
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

      {/* Get involved */}
      <footer className="bg-slate-950 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 flex items-center justify-center gap-2 text-xs font-medium tracking-wide text-indigo-400">
            <span className="h-2 w-2 rotate-45 bg-indigo-500" />
            GET INVOLVED
          </div>
          <h3 className="mb-8 text-center text-xl font-semibold text-white">
            Follow the project as it&apos;s built
          </h3>
          <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-4">
            <a
              href={GITHUB_URL}
              className="flex flex-col gap-1 bg-slate-950 p-5 text-sm hover:bg-slate-900"
            >
              <span className="font-medium text-white">GitHub</span>
              <span className="text-slate-400">Source code</span>
            </a>
            <a
              href={`${GITHUB_URL}#readme`}
              className="flex flex-col gap-1 bg-slate-950 p-5 text-sm hover:bg-slate-900"
            >
              <span className="font-medium text-white">Documentation</span>
              <span className="text-slate-400">Read the README</span>
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/LICENSE`}
              className="flex flex-col gap-1 bg-slate-950 p-5 text-sm hover:bg-slate-900"
            >
              <span className="font-medium text-white">License</span>
              <span className="text-slate-400">MIT</span>
            </a>
            <a
              href={`${GITHUB_URL}/issues`}
              className="flex flex-col gap-1 bg-slate-950 p-5 text-sm hover:bg-slate-900"
            >
              <span className="font-medium text-white">Issues</span>
              <span className="text-slate-400">Report a bug</span>
            </a>
          </div>
          <div className="flex flex-col items-center gap-2 text-sm text-slate-500 sm:flex-row sm:justify-between">
            <span>&copy; {new Date().getFullYear()} AdaptiveGate &middot; MIT License</span>
            <a href={GITHUB_URL} className="hover:text-white">
              github.com/Balaji-R-05/adaptivegate
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
