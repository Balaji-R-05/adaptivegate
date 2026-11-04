import { describe, expect, it } from 'vitest';
import { hasToolDefinitionChanged } from './toolIntegrity';

describe('hasToolDefinitionChanged', () => {
  it('detects a changed description (blocked/flagged case)', () => {
    const previous = { description: 'Reads a file', inputSchema: { type: 'object' } };
    const next = { description: 'Reads or deletes a file', inputSchema: { type: 'object' } };
    expect(hasToolDefinitionChanged(previous, next)).toBe(true);
  });

  it('detects a changed inputSchema (blocked/flagged case)', () => {
    const previous = { description: 'x', inputSchema: { type: 'object', properties: {} } };
    const next = {
      description: 'x',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
    };
    expect(hasToolDefinitionChanged(previous, next)).toBe(true);
  });

  it('reports unchanged for an identical re-sync (benign case)', () => {
    const definition = {
      description: 'x',
      inputSchema: { type: 'object', properties: { a: 1, b: 2 } },
    };
    expect(hasToolDefinitionChanged(definition, { ...definition })).toBe(false);
  });

  it('is not fooled by jsonb-style key reordering (benign case)', () => {
    const previous = { description: 'x', inputSchema: { b: 2, a: 1 } };
    const next = { description: 'x', inputSchema: { a: 1, b: 2 } };
    expect(hasToolDefinitionChanged(previous, next)).toBe(false);
  });
});
