import MiniSearch from 'minisearch';
import type { IndexedTool, RankedTool } from './types';

interface Doc {
  id: number;
  name: string;
  description: string;
}

export function bm25Route(tools: IndexedTool[], query: string, topK: number): RankedTool[] {
  const miniSearch = new MiniSearch<Doc>({
    fields: ['name', 'description'],
    storeFields: ['name'],
  });

  // Index by array position, not tool name — tool names aren't guaranteed
  // unique across a user's different downstream servers.
  miniSearch.addAll(
    tools.map((tool, id) => ({ id, name: tool.name, description: tool.description })),
  );

  return miniSearch
    .search(query)
    .slice(0, topK)
    .map((result) => ({ name: result.name as string, score: result.score }));
}
