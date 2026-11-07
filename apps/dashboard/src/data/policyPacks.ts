// Curated starter policies — the ready-made packs CLAUDE.md's glossary names
// ("safe coding agent", "read-only research agent", "no-PII") but that never
// existed until now. Each yaml string is real, valid v1 policy syntax
// (parseable by @adaptivegate/governance's parsePolicyDocument/evaluatePolicy
// — the same engine the gateway runs), not illustrative pseudo-YAML. Same
// static-data pattern as ./mcpCatalog.ts.
export interface PolicyPack {
  name: string;
  description: string;
  yaml: string;
}

export const POLICY_PACKS: PolicyPack[] = [
  {
    name: 'safe-coding-agent',
    description:
      'Lets a coding agent read, search and run most tools freely, but holds destructive-sounding calls for a human to approve first.',
    yaml: `version: 1
rules:
  - name: approve-deletes
    match:
      tool: "*delete*"
    action: require_approval
  - name: approve-drops
    match:
      tool: "*drop*"
    action: require_approval
  - name: approve-force-pushes
    match:
      tool: "*force*"
    action: require_approval
`,
  },
  {
    name: 'read-only-research-agent',
    description:
      'For an agent that should only look things up, never change anything — any write-shaped tool name needs approval, everything else is allowed.',
    yaml: `version: 1
rules:
  - name: allow-reads
    match:
      tool: "*search*"
    action: allow
  - name: allow-gets
    match:
      tool: "get_*"
    action: allow
  - name: approve-creates
    match:
      tool: "*create*"
    action: require_approval
  - name: approve-updates
    match:
      tool: "*update*"
    action: require_approval
  - name: approve-deletes
    match:
      tool: "*delete*"
    action: require_approval
`,
  },
  {
    name: 'deny-by-default',
    description:
      'Nothing is allowed until you add explicit allow rules above the catch-all deny — start here and grant tools one at a time as you confirm you trust them.',
    yaml: `version: 1
rules:
  - name: deny-everything
    match:
      tool: "*"
    action: deny
`,
  },
  {
    name: 'manual-review-everything',
    description:
      "For trying out a brand-new identity: every single call needs approval first. Loosen it once you've seen what it actually tries to do.",
    yaml: `version: 1
rules:
  - name: approve-everything
    match:
      tool: "*"
    action: require_approval
`,
  },
];
