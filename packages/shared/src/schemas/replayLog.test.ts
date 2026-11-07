import { describe, expect, it } from 'vitest';
import { replayLogEntrySchema } from './replayLog';

describe('replayLogEntrySchema', () => {
  it('accepts a minimal entry with just a tool name', () => {
    expect(replayLogEntrySchema.safeParse({ tool: 'github.create_issue' }).success).toBe(true);
  });

  it('accepts a full entry', () => {
    const result = replayLogEntrySchema.safeParse({
      tool: 'github.create_issue',
      serverId: 'srv_1',
      actualAction: 'require_approval',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing tool', () => {
    expect(replayLogEntrySchema.safeParse({ serverId: 'srv_1' }).success).toBe(false);
  });

  it('rejects an unknown actualAction', () => {
    expect(replayLogEntrySchema.safeParse({ tool: 'x', actualAction: 'maybe' }).success).toBe(false);
  });
});
