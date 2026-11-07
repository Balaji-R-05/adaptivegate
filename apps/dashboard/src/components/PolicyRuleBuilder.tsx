import { Icon } from './Icon';
import { deriveRuleName, type PolicyAction, type PolicyRuleDraft } from '../lib/policyRules';

const ACTIONS: PolicyAction[] = ['allow', 'deny', 'require_approval'];

const ACTION_LABEL: Record<PolicyAction, string> = {
  allow: 'Allow',
  deny: 'Deny',
  require_approval: 'Require approval',
};

// Rule order matters — evaluatePolicy (packages/core/governance) uses
// first-match-wins, so reordering is a real semantic change, not cosmetic.
// Up/down buttons instead of drag-and-drop: this list is a handful of rows,
// not worth a drag library for.
export function PolicyRuleBuilder({
  rules,
  onChange,
}: {
  rules: PolicyRuleDraft[];
  onChange: (rules: PolicyRuleDraft[]) => void;
}) {
  function updateRule(index: number, patch: Partial<PolicyRuleDraft>) {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  function addRule() {
    const tool = '';
    const action: PolicyAction = 'require_approval';
    onChange([...rules, { name: deriveRuleName(tool, action, rules.length), tool, action }]);
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  function moveRule(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-space-sm">
      <p className="text-xs text-on-surface-variant">
        First matching rule wins, top to bottom. <code className="font-mono">*</code> matches
        anything — e.g. <code className="font-mono">github.create_*</code> matches every GitHub
        tool starting with "create".
      </p>

      {rules.length === 0 && (
        <p className="rounded-lg bg-surface-container-low px-space-md py-space-sm text-sm text-on-surface-variant">
          No rules yet — every call falls through to allow until you add one.
        </p>
      )}

      {rules.map((rule, index) => (
        <div
          key={index}
          className="flex flex-col gap-space-sm rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-space-sm sm:flex-row sm:items-center"
        >
          <div className="flex flex-col gap-space-xxs sm:w-16">
            <button
              type="button"
              onClick={() => moveRule(index, -1)}
              disabled={index === 0}
              className="flex h-6 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container disabled:opacity-30"
              aria-label="Move rule up"
            >
              <Icon name="arrow_upward" className="text-[14px]" />
            </button>
            <button
              type="button"
              onClick={() => moveRule(index, 1)}
              disabled={index === rules.length - 1}
              className="flex h-6 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container disabled:opacity-30"
              aria-label="Move rule down"
            >
              <Icon name="arrow_downward" className="text-[14px]" />
            </button>
          </div>

          <input
            value={rule.tool}
            onChange={(event) => {
              const tool = event.target.value;
              updateRule(index, {
                tool,
                name: rule.name.startsWith(`${rule.action}-`) ? deriveRuleName(tool, rule.action, index) : rule.name,
              });
            }}
            placeholder="tool pattern, e.g. github.create_*"
            className="flex-1 rounded border border-outline-variant px-space-sm py-space-xs font-mono text-sm"
          />

          <select
            value={rule.action}
            onChange={(event) => {
              const action = event.target.value as PolicyAction;
              updateRule(index, {
                action,
                name: rule.name.startsWith(`${rule.action}-`) ? deriveRuleName(rule.tool, action, index) : rule.name,
              });
            }}
            className="rounded border border-outline-variant px-space-sm py-space-xs text-sm"
          >
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABEL[action]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => removeRule(index)}
            className="flex h-8 items-center justify-center rounded-lg px-space-xs text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
            aria-label="Remove rule"
          >
            <Icon name="delete" className="text-[16px]" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRule}
        className="flex items-center gap-1 self-start rounded-lg px-space-sm py-space-xs text-sm font-medium text-primary transition-colors hover:bg-surface-container"
      >
        <Icon name="add" className="text-[16px]" />
        Add rule
      </button>
    </div>
  );
}
