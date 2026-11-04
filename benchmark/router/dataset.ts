// Synthetic tool catalog + test queries for the router benchmark. Not
// connected to any real MCP server — this evaluates the retrieval algorithms
// in packages/core/router against representative tool descriptions spanning
// several categories, independent of whatever servers are actually
// configured on any given machine.

export interface BenchmarkTool {
  name: string;
  description: string;
}

export const TOOLS: BenchmarkTool[] = [
  { name: 'filesystem.read_file', description: 'Read the contents of a file from disk' },
  { name: 'filesystem.write_file', description: 'Write content to a file on disk' },
  { name: 'filesystem.list_directory', description: 'List files and folders in a directory' },
  { name: 'github.create_issue', description: 'Create a new issue in a GitHub repository' },
  { name: 'github.create_pull_request', description: 'Open a new pull request on GitHub' },
  { name: 'github.search_repositories', description: 'Search for GitHub repositories by keyword' },
  { name: 'slack.send_message', description: 'Send a message to a Slack channel' },
  { name: 'slack.list_channels', description: 'List the channels in a Slack workspace' },
  { name: 'web.search', description: 'Search the web for a query and return results' },
  { name: 'web.fetch_page', description: 'Fetch and read the contents of a web page URL' },
  { name: 'calendar.create_event', description: 'Create a new event on a calendar' },
  { name: 'calendar.list_events', description: 'List upcoming events on a calendar' },
  { name: 'database.run_query', description: 'Run a SQL query against a database' },
  { name: 'database.list_tables', description: 'List the tables in a database' },
  { name: 'email.send_email', description: 'Send an email to a recipient' },
  { name: 'email.search_inbox', description: 'Search the inbox for emails matching a query' },
  { name: 'jira.create_ticket', description: 'Create a new ticket in Jira' },
  { name: 'weather.get_forecast', description: 'Get the weather forecast for a location' },
];

export interface BenchmarkQuery {
  query: string;
  expected: string;
}

export const QUERIES: BenchmarkQuery[] = [
  { query: "I need to read what's inside a file", expected: 'filesystem.read_file' },
  { query: 'open a pull request on GitHub', expected: 'github.create_pull_request' },
  { query: "post an update to the team's slack channel", expected: 'slack.send_message' },
  { query: 'look up the weather for tomorrow', expected: 'weather.get_forecast' },
  { query: 'find emails from my boss', expected: 'email.search_inbox' },
  { query: 'schedule a meeting on my calendar', expected: 'calendar.create_event' },
  { query: 'run a SQL query to get user counts', expected: 'database.run_query' },
  { query: 'search the internet for the latest news', expected: 'web.search' },
];
