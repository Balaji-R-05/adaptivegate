import { describe, expect, it } from 'vitest';
import { hybridRoute } from './route';
import type { IndexedTool } from './types';

describe('hybridRoute', () => {
  it('surfaces a tool that ranks well on both keyword and semantic signals', () => {
    const tools: IndexedTool[] = [
      {
        name: 'filesystem.read_file',
        description: 'Read the contents of a file from disk',
        serverId: 's1',
        embedding: [1, 0, 0],
      },
      {
        name: 'github.create_issue',
        description: 'Create a new issue in a GitHub repository',
        serverId: 's1',
        embedding: [0, 1, 0],
      },
      {
        name: 'slack.send_message',
        description: 'Send a message to a Slack channel',
        serverId: 's2',
        embedding: [0, 0, 1],
      },
    ];

    const result = hybridRoute(tools, 'read a file from disk', [1, 0, 0], 2);
    expect(result[0]?.name).toBe('filesystem.read_file');
  });
});
