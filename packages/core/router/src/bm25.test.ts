import { describe, expect, it } from 'vitest';
import { bm25Route } from './bm25';
import type { IndexedTool } from './types';

const tools: IndexedTool[] = [
  {
    name: 'filesystem.read_file',
    description: 'Read the contents of a file from disk',
    serverId: 's1',
  },
  {
    name: 'github.create_issue',
    description: 'Create a new issue in a GitHub repository',
    serverId: 's1',
  },
  { name: 'slack.send_message', description: 'Send a message to a Slack channel', serverId: 's2' },
];

describe('bm25Route', () => {
  it('ranks the keyword-matching tool first', () => {
    const result = bm25Route(tools, 'read a file from disk', 3);
    expect(result[0]?.name).toBe('filesystem.read_file');
  });

  it('returns no more than topK results', () => {
    const result = bm25Route(tools, 'file', 1);
    expect(result).toHaveLength(1);
  });

  it('keeps duplicate tool names from different servers as separate results', () => {
    const duped: IndexedTool[] = [
      { name: 'search', description: 'Search GitHub issues', serverId: 's1' },
      { name: 'search', description: 'Search Slack messages', serverId: 's2' },
    ];
    // Both match "search"; the one that also matches "slack" ranks first,
    // but both are still distinct results, not deduplicated by name.
    const result = bm25Route(duped, 'search slack', 2);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('search');
  });
});
