import { describe, expect, it } from 'vitest';
import { parsePolicyDocument, PolicyParseError } from './parse';

describe('parsePolicyDocument', () => {
  it('parses a valid policy document', () => {
    const yaml = `
version: 1
rules:
  - name: no-deletes
    match:
      tool: "filesystem.delete_*"
    action: deny
`;
    const doc = parsePolicyDocument(yaml);
    expect(doc.rules).toHaveLength(1);
    expect(doc.rules[0]?.action).toBe('deny');
  });

  it('rejects invalid YAML syntax', () => {
    expect(() => parsePolicyDocument('version: 1\n  rules: [')).toThrow(PolicyParseError);
  });

  it('rejects YAML that does not match the policy schema', () => {
    expect(() => parsePolicyDocument('version: 2\nrules: []')).toThrow(PolicyParseError);
    expect(() =>
      parsePolicyDocument('version: 1\nrules:\n  - name: x\n    match: {}\n    action: nope'),
    ).toThrow(PolicyParseError);
  });
});
