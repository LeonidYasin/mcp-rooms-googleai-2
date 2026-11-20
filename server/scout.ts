import { logger } from './logger';

export interface RawScoutItem {
  id: string;
  sourceUrl: string;
  platform: 'github' | 'hackernews' | 'reddit';
  authorHandle: string;
  title: string;
  body: string;
  tags?: string[];
  createdAt: number;
}

function cleanHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Fetches real open issues and discussions from GitHub with tags:
 * help wanted, co-founder, looking for contributors, mcp, ai-agent.
 */
export async function fetchGitHubIssues(limitPerQuery: number = 8): Promise<RawScoutItem[]> {
  const token = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
  const headers: Record<string, string> = {
    'User-Agent': 'mcp-rooms-autonomous-scout/1.0',
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const queries = [
    'is:issue is:open label:"help wanted" mcp',
    'is:issue is:open label:"help wanted" "ai-agent"',
    'is:issue is:open "looking for contributors" ai',
    'is:issue is:open "co-founder" OR "cofounder"',
    'is:issue is:open "looking for" mcp',
  ];

  const results: RawScoutItem[] = [];
  const seenUrls = new Set<string>();

  for (const q of queries) {
    try {
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=${limitPerQuery}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        logger.warn(`GitHub API search failed (${res.status}): ${await res.text()}`);
        continue;
      }
      const data = await res.json() as any;
      const items = data.items || [];

      for (const item of items) {
        if (!item.html_url || seenUrls.has(item.html_url)) continue;
        seenUrls.add(item.html_url);

        const labels = Array.isArray(item.labels)
          ? item.labels.map((l: any) => (typeof l === 'string' ? l : l.name || '')).filter(Boolean)
          : [];

        results.push({
          id: `gh_${item.id}`,
          sourceUrl: item.html_url,
          platform: 'github',
          authorHandle: item.user?.login || 'anonymous',
          title: item.title || 'Untitled GitHub Request',
          body: (item.body || item.title || '').slice(0, 4000),
          tags: labels,
          createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
        });
      }
    } catch (err: any) {
      logger.warn(`Error querying GitHub Search API for '${q}': ${err.message}`);
    }
  }

  return results;
}

/**
 * Fetches real comments and threads from Hacker News (Who is hiring, Who wants to be hired, Seeking freelancer).
 */
export async function fetchHackerNewsPosts(limit: number = 15): Promise<RawScoutItem[]> {
  const headers = { 'User-Agent': 'mcp-rooms-autonomous-scout/1.0' };
  const results: RawScoutItem[] = [];
  const seenUrls = new Set<string>();

  // 1. Comments from Who wants to be hired / Seeking work / Seeking freelancer
  try {
    const hnCommentsUrl = `https://hn.algolia.com/api/v1/search_by_date?tags=comment&query=SEEKING+WORK&hitsPerPage=${limit}`;
    const res = await fetch(hnCommentsUrl, { headers });
    if (res.ok) {
      const data = await res.json() as any;
      for (const hit of data.hits || []) {
        const text = cleanHtml(hit.comment_text || '');
        if (!text || text.length < 30) continue;
        const postUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
        if (seenUrls.has(postUrl)) continue;
        seenUrls.add(postUrl);

        // Derive title from first line of comment or default
        const firstLine = text.split('\n')[0].trim().slice(0, 100);
        const title = firstLine || `Hacker News Post by ${hit.author || 'contributor'}`;

        results.push({
          id: `hn_${hit.objectID}`,
          sourceUrl: postUrl,
          platform: 'hackernews',
          authorHandle: hit.author || 'hn_user',
          title,
          body: text.slice(0, 4000),
          tags: ['hackernews', 'who-is-hiring', 'freelancer'],
          createdAt: hit.created_at ? new Date(hit.created_at).getTime() : Date.now(),
        });
      }
    }
  } catch (err: any) {
    logger.warn(`Error querying HN comments: ${err.message}`);
  }

  // 2. Stories from Ask HN: Looking for cofounder / Who is hiring
  try {
    const hnStoriesUrl = `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=cofounder&hitsPerPage=${limit}`;
    const res = await fetch(hnStoriesUrl, { headers });
    if (res.ok) {
      const data = await res.json() as any;
      for (const hit of data.hits || []) {
        const postUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
        if (seenUrls.has(postUrl)) continue;
        seenUrls.add(postUrl);

        const storyText = cleanHtml(hit.story_text || hit.title || '');
        results.push({
          id: `hn_story_${hit.objectID}`,
          sourceUrl: postUrl,
          platform: 'hackernews',
          authorHandle: hit.author || 'hn_user',
          title: hit.title || 'Ask HN Request',
          body: storyText.slice(0, 4000),
          tags: ['hackernews', 'story', 'cofounder'],
          createdAt: hit.created_at ? new Date(hit.created_at).getTime() : Date.now(),
        });
      }
    }
  } catch (err: any) {
    logger.warn(`Error querying HN stories: ${err.message}`);
  }

  return results;
}

/**
 * Fetches relevant posts from subreddits (r/cofounder, r/forhire, r/SideProject) via public JSON API.
 */
export async function fetchRedditPosts(limit: number = 10): Promise<RawScoutItem[]> {
  const headers = { 'User-Agent': 'mcp-rooms-autonomous-scout:v1.0 (by /u/mcp_rooms_agent)' };
  const subreddits = ['cofounder', 'forhire', 'SideProject'];
  const results: RawScoutItem[] = [];
  const seenUrls = new Set<string>();

  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/new.json?limit=${limit}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        continue;
      }
      const data = await res.json() as any;
      const children = data?.data?.children || [];

      for (const child of children) {
        const p = child?.data;
        if (!p || !p.title) continue;
        const postUrl = `https://reddit.com${p.permalink}`;
        if (seenUrls.has(postUrl)) continue;
        seenUrls.add(postUrl);

        results.push({
          id: `reddit_${p.id}`,
          sourceUrl: postUrl,
          platform: 'reddit',
          authorHandle: p.author ? `u/${p.author}` : 'reddit_user',
          title: p.title,
          body: (p.selftext || p.title).slice(0, 4000),
          tags: ['reddit', `r/${sub}`, p.link_flair_text].filter(Boolean),
          createdAt: p.created_utc ? p.created_utc * 1000 : Date.now(),
        });
      }
    } catch (err: any) {
      logger.warn(`Error querying Reddit r/${sub}: ${err.message}`);
    }
  }

  return results;
}

/**
 * Main discovery pipeline: aggregates raw requests across GitHub, Hacker News, and Reddit.
 */
export async function discoverRawItems(options?: { maxItems?: number }): Promise<RawScoutItem[]> {
  const maxItems = options?.maxItems || 30;
  logger.info(`Starting Discovery Pipeline to fetch real requests (target: ${maxItems})...`);

  const [githubItems, hnItems, redditItems] = await Promise.all([
    fetchGitHubIssues(8),
    fetchHackerNewsPosts(12),
    fetchRedditPosts(6),
  ]);

  const allItems = [...githubItems, ...hnItems, ...redditItems];

  // Deduplicate by URL
  const uniqueMap = new Map<string, RawScoutItem>();
  for (const item of allItems) {
    if (!uniqueMap.has(item.sourceUrl)) {
      uniqueMap.set(item.sourceUrl, item);
    }
  }

  const deduplicated = Array.from(uniqueMap.values());
  // Sort newest first
  deduplicated.sort((a, b) => b.createdAt - a.createdAt);

  const selected = deduplicated.slice(0, maxItems);
  logger.info(`Discovery Pipeline finished: collected ${selected.length} unique raw items (${githubItems.length} GitHub, ${hnItems.length} HN, ${redditItems.length} Reddit).`);

  return selected;
}
