export type PolicyAction = 'allow' | 'deny' | 'require_approval';

export interface PolicyRuleDraft {
  name: string;
  tool: string;
  action: PolicyAction;
}

const ACTIONS: PolicyAction[] = ['allow', 'deny', 'require_approval'];

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function unescapeYamlString(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

// Hand-written, not a general YAML serializer — the policy document's shape
// (packages/core/governance/src/policy/schema.ts) is fixed and small enough
// that string-templating it is safe, and it avoids pulling a Node-oriented
// YAML library (js-yaml, already a @adaptivegate/governance dependency) into
// the browser bundle for one simple, known-shape use.
export function rulesToYaml(rules: PolicyRuleDraft[]): string {
  if (rules.length === 0) {
    // `rules:` with nothing after it parses as null, not [] — the backend's
    // policyDocumentSchema (packages/core/governance) requires an array.
    return 'version: 1\nrules: []\n';
  }
  const ruleBlocks = rules.map(
    (rule) =>
      `  - name: ${rule.name}\n    match:\n      tool: "${escapeYamlString(rule.tool)}"\n    action: ${rule.action}`,
  );
  return `version: 1\nrules:\n${ruleBlocks.join('\n')}\n`;
}

const RULE_PATTERN =
  /- name:\s*(.+)\r?\n\s*match:\s*\r?\n\s*tool:\s*"((?:\\.|[^"\\])*)"\r?\n\s*action:\s*(allow|deny|require_approval)\s*/g;

// The inverse of rulesToYaml — deliberately strict, not a general YAML
// parser: only recognizes exactly the shape rulesToYaml (and this app's
// curated packs in ../data/policyPacks.ts) produces. Returns null for
// anything else, including valid-but-differently-formatted policy YAML, so
// the rule-builder UI can fall back to raw-YAML mode instead of silently
// misrepresenting a hand-written policy.
export function yamlToRules(yaml: string): PolicyRuleDraft[] | null {
  if (/^\s*version:\s*1\s*\r?\n\s*rules:\s*\[\s*\]\s*\r?\n?\s*$/.test(yaml)) return [];
  if (!/^\s*version:\s*1\s*\r?\n\s*rules:\s*\r?\n/.test(yaml)) return null;

  const rules: PolicyRuleDraft[] = [];
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  RULE_PATTERN.lastIndex = 0;
  while ((match = RULE_PATTERN.exec(yaml)) !== null) {
    const [, name, tool, action] = match;
    if (!name || tool === undefined || !ACTIONS.includes(action as PolicyAction)) return null;
    rules.push({ name: name.trim(), tool: unescapeYamlString(tool), action: action as PolicyAction });
    lastIndex = match.index + match[0].length;
  }

  // If anything meaningful (non-whitespace) is left over after the last
  // matched rule, the YAML has content this parser doesn't understand
  // (comments, extra fields, different formatting) — bail to raw mode
  // rather than silently dropping it.
  if (rules.length === 0 || yaml.slice(lastIndex).trim().length > 0) return null;

  return rules;
}

export function deriveRuleName(tool: string, action: PolicyAction, index: number): string {
  const slug = tool.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || `rule-${index}`;
  return `${action}-${slug}`;
}
