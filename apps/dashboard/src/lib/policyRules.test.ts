import { describe, expect, it } from 'vitest';
import { POLICY_PACKS } from '../data/policyPacks';
import { rulesToYaml, yamlToRules, type PolicyRuleDraft } from './policyRules';

describe('rulesToYaml / yamlToRules round trip', () => {
  it('round-trips a single rule', () => {
    const rules: PolicyRuleDraft[] = [{ name: 'no-deletes', tool: 'filesystem.delete_*', action: 'deny' }];
    expect(yamlToRules(rulesToYaml(rules))).toEqual(rules);
  });

  it('round-trips several rules, preserving order', () => {
    const rules: PolicyRuleDraft[] = [
      { name: 'allow-reads', tool: '*search*', action: 'allow' },
      { name: 'approve-writes', tool: 'github.create_*', action: 'require_approval' },
      { name: 'deny-deletes', tool: '*delete*', action: 'deny' },
    ];
    expect(yamlToRules(rulesToYaml(rules))).toEqual(rules);
  });

  it('round-trips an empty rule list', () => {
    expect(yamlToRules(rulesToYaml([]))).toEqual([]);
  });

  it('escapes and unescapes a quote in a tool pattern', () => {
    const rules: PolicyRuleDraft[] = [{ name: 'weird', tool: 'tool."with".quotes', action: 'deny' }];
    expect(yamlToRules(rulesToYaml(rules))).toEqual(rules);
  });

  it('returns null for YAML it does not recognize the shape of', () => {
    expect(yamlToRules('version: 1\nrules:\n  # just a comment\n')).toBeNull();
    expect(yamlToRules('not even yaml-shaped')).toBeNull();
  });

  for (const pack of POLICY_PACKS) {
    it(`parses the real curated pack "${pack.name}" into rules`, () => {
      const rules = yamlToRules(pack.yaml);
      expect(rules).not.toBeNull();
      expect(rules!.length).toBeGreaterThan(0);
      // And re-serializing those rules reproduces semantically the same
      // document (not necessarily byte-identical whitespace).
      expect(yamlToRules(rulesToYaml(rules!))).toEqual(rules);
    });
  }
});
