import { describe, expect, it } from 'vitest';
import { connectSnippet } from './connectSnippet';

describe('connectSnippet', () => {
  it('produces a single-line claude mcp add command with a header', () => {
    const snippet = connectSnippet('claude', 'ag_test');
    expect(snippet).not.toContain('\n');
    expect(snippet).toContain('claude mcp add');
    expect(snippet).toContain('--header "Authorization: Bearer ag_test"');
  });

  it('produces a single-line curl command', () => {
    const snippet = connectSnippet('curl', 'ag_test');
    expect(snippet).not.toContain('\n');
    expect(snippet).toContain('-H "Authorization: Bearer ag_test"');
  });

  it('produces a two-line codex snippet: export the key, then reference its env var name', () => {
    const snippet = connectSnippet('codex', 'ag_test');
    const lines = snippet.split('\n');
    expect(lines).toHaveLength(2);
    // The raw key appears only on the export line — codex mcp add itself
    // never takes the raw token, only --bearer-token-env-var <name>.
    expect(lines[0]).toContain('ag_test');
    expect(lines[1]).not.toContain('ag_test');
    expect(lines[1]).toContain('codex mcp add');
    expect(lines[1]).toContain('--bearer-token-env-var');
    expect(lines[1]).not.toContain('--header');
  });
});
