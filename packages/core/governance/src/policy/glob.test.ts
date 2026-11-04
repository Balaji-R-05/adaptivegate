import { describe, expect, it } from 'vitest';
import { matchesGlob } from './glob';

describe('matchesGlob', () => {
  it('matches an exact string with no wildcard', () => {
    expect(matchesGlob('echo', 'echo')).toBe(true);
    expect(matchesGlob('echo', 'echoes')).toBe(false);
  });

  it('matches a trailing wildcard', () => {
    expect(matchesGlob('github.create_*', 'github.create_issue')).toBe(true);
    expect(matchesGlob('github.create_*', 'github.delete_issue')).toBe(false);
  });

  it('matches a bare wildcard against anything', () => {
    expect(matchesGlob('*', 'anything.at.all')).toBe(true);
  });

  it('does not treat regex special characters as regex', () => {
    expect(matchesGlob('filesystem.read_file', 'filesystemXread_file')).toBe(false);
  });
});
