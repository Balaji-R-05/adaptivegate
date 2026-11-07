// Material Symbols has no brand/logo glyphs (it's a generic icon set, not
// company logos), so this picks a semantically-fitting icon from the
// server's name/URL rather than a literal brand mark — best-effort, falls
// back to a plain server icon for anything unrecognized. Shared between
// ServersPage and MarketplacePage so both use the same mapping.
const ICON_RULES: Array<{ match: RegExp; icon: string; colorClass: string }> = [
  { match: /github/i, icon: 'code', colorClass: 'text-on-surface' },
  { match: /microsoft|learn\.microsoft/i, icon: 'menu_book', colorClass: 'text-secondary' },
  { match: /deepwiki|wiki/i, icon: 'auto_stories', colorClass: 'text-secondary' },
  { match: /drawio|diagram/i, icon: 'schema', colorClass: 'text-primary' },
  { match: /fetch|fetcher|web/i, icon: 'public', colorClass: 'text-secondary' },
  { match: /ip-address|ip\.app/i, icon: 'lan', colorClass: 'text-on-surface' },
  { match: /qr/i, icon: 'qr_code_2', colorClass: 'text-on-surface' },
  { match: /faostat|agri/i, icon: 'agriculture', colorClass: 'text-tertiary' },
  { match: /filings|sec/i, icon: 'account_balance', colorClass: 'text-tertiary' },
  { match: /trade|tradetime|market/i, icon: 'show_chart', colorClass: 'text-tertiary' },
  { match: /growo|growth/i, icon: 'trending_up', colorClass: 'text-primary' },
  { match: /fixture|localhost|127\.0\.0\.1/i, icon: 'science', colorClass: 'text-on-surface-variant' },
  { match: /slack/i, icon: 'forum', colorClass: 'text-secondary' },
  { match: /jira|ticket/i, icon: 'task_alt', colorClass: 'text-primary' },
  { match: /database|postgres|sql/i, icon: 'database', colorClass: 'text-tertiary' },
  { match: /aws|cloud/i, icon: 'cloud', colorClass: 'text-secondary' },
  { match: /calendar/i, icon: 'calendar_month', colorClass: 'text-primary' },
  { match: /email|mail/i, icon: 'mail', colorClass: 'text-secondary' },
  { match: /weather/i, icon: 'partly_cloudy_day', colorClass: 'text-tertiary' },
  { match: /context7|docs\.|documentation/i, icon: 'menu_book', colorClass: 'text-secondary' },
  { match: /firecrawl|^exa\b|exa\.ai/i, icon: 'travel_explore', colorClass: 'text-secondary' },
  { match: /federal-register|federal register/i, icon: 'account_balance', colorClass: 'text-tertiary' },
];

export function iconForServer(name: string, url: string): { icon: string; colorClass: string } {
  const haystack = `${name} ${url}`;
  const rule = ICON_RULES.find((r) => r.match.test(haystack));
  return rule ?? { icon: 'dns', colorClass: 'text-primary' };
}
