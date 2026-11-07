// Curated, not scraped — every entry here has actually been connected and
// used through this gateway in real testing this session (see
// docs/evaluation.md's live-catalog evaluation), except GitHub's official
// hosted MCP server, whose endpoint is corroborated by that same document
// rather than guessed. Deliberately small: a marketplace entry that points
// at a broken or renamed URL is worse than no entry at all.

export interface CatalogEntry {
  name: string;
  url: string;
  auth: { type: 'none' } | { type: 'bearer'; tokenEnvPlaceholder: string };
  description: string;
  category: string;
}

export const MCP_CATALOG: CatalogEntry[] = [
  {
    name: 'github',
    url: 'https://api.githubcopilot.com/mcp/',
    auth: { type: 'bearer', tokenEnvPlaceholder: 'GITHUB_MCP_TOKEN' },
    description: "GitHub's official hosted MCP server — repos, issues, pull requests.",
    category: 'Development',
  },
  {
    name: 'microsoft-learn',
    url: 'https://learn.microsoft.com/api/mcp',
    auth: { type: 'none' },
    description: 'Search Microsoft Learn and Azure documentation, with code samples.',
    category: 'Documentation',
  },
  {
    name: 'deepwiki',
    url: 'https://mcp.deepwiki.com/mcp',
    auth: { type: 'none' },
    description: "Ask questions about any public GitHub repository's codebase.",
    category: 'Development',
  },
  {
    name: 'drawio',
    url: 'https://mcp.draw.io/mcp',
    auth: { type: 'none' },
    description: 'Create and reference flowcharts and diagrams.',
    category: 'Productivity',
  },
  {
    name: 'fetcher',
    url: 'https://api.fetcher.cloud/mcp',
    auth: { type: 'none' },
    description: 'Render and extract content from web pages.',
    category: 'Web',
  },
  {
    name: 'ip-address-api',
    url: 'https://ip.app/mcp',
    auth: { type: 'none' },
    description: 'IP geolocation, ASN, header and security lookups.',
    category: 'Utilities',
  },
  {
    name: 'fixedqr',
    url: 'https://fixedqr.com/mcp',
    auth: { type: 'none' },
    description: 'Generate QR codes from a URL.',
    category: 'Utilities',
  },
  {
    name: 'faostat',
    url: 'https://faostat.caseyjhand.com/mcp',
    auth: { type: 'none' },
    description: 'UN agricultural production statistics (FAOSTAT).',
    category: 'Data',
  },
  {
    name: 'filings-intel',
    url: 'https://filings.datakoot.com/mcp',
    auth: { type: 'none' },
    description: 'SEC filings and insider trading data for public companies.',
    category: 'Finance',
  },
  {
    name: 'tradetime',
    url: 'https://mcp.tradeti.me/mcp',
    auth: { type: 'none' },
    description: 'Trading session hours and market-open status for major exchanges.',
    category: 'Finance',
  },
  {
    name: 'growo',
    url: 'https://mcp.usegrowo.com/',
    auth: { type: 'none' },
    description: 'Child growth percentile and BMI percentile calculators.',
    category: 'Health',
  },
];
