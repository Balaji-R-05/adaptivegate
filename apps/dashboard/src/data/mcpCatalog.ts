// Curated, not scraped — every entry here has actually been connected to in
// real testing (a real MCP initialize + tools/list handshake against the
// live URL, see docs/evaluation.md), except GitHub's official hosted MCP
// server, whose endpoint is corroborated by that same document rather than
// guessed. Deliberately small: a marketplace entry that points at a broken
// or renamed URL is worse than no entry at all.

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
  {
    name: 'context7',
    url: 'https://mcp.context7.com/mcp',
    auth: { type: 'none' },
    description: 'Up-to-date, version-specific library and framework documentation.',
    category: 'Documentation',
  },
  {
    name: 'firecrawl',
    url: 'https://mcp.firecrawl.dev/v2/mcp',
    auth: { type: 'bearer', tokenEnvPlaceholder: 'FIRECRAWL_API_KEY' },
    description: 'Web search, scrape and parse. Connects without a key, but every real call rejected with "Anonymous keyless access is unavailable" when checked for real — needs a real API key despite its advertised keyless mode.',
    category: 'Web',
  },
  {
    name: 'exa',
    url: 'https://mcp.exa.ai/mcp',
    auth: { type: 'none' },
    description: 'AI-native web search and page fetching.',
    category: 'Web',
  },
  {
    name: 'federal-register',
    url: 'https://federal-register.1102tools.com/mcp',
    auth: { type: 'none' },
    description: 'Search and read US Federal Register documents, agencies and comment periods.',
    category: 'Data',
  },
];
