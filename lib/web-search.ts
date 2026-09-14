export type WebSearchResult = {
  readonly snippet: string;
  readonly title: string;
  readonly url: string;
};

/**
 * Web search for the AI's webSearch tool.
 *
 * Primary: Tavily (https://tavily.com) — built specifically for LLM agents,
 * returns clean JSON with a free tier (no card needed). Get a key at
 * https://app.tavily.com and set TAVILY_API_KEY in Railway's env vars.
 *
 * Fallback (used only if TAVILY_API_KEY isn't set): a best-effort scrape of
 * DuckDuckGo's HTML results page. This has no official free API, so the
 * scrape can break if they change their markup or rate-limit the request —
 * that's almost certainly why search "wasn't working" before. Add a Tavily
 * key to stop depending on this fallback.
 */
export async function webSearch(query: string): Promise<WebSearchResult[]> {
  if (process.env.TAVILY_API_KEY) {
    return webSearchTavily(query);
  }
  return webSearchDuckDuckGo(query);
}

async function webSearchTavily(query: string): Promise<WebSearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      max_results: 5,
      query,
      search_depth: "basic",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Tavily search failed with status ${response.status}${body ? `: ${truncate(body, 300)}` : ""}`);
  }

  const data = (await response.json()) as {
    results?: { title?: string; url?: string; content?: string }[];
  };

  return (data.results ?? [])
    .filter((result): result is { title: string; url: string; content?: string } => Boolean(result.url))
    .map((result) => ({
      snippet: truncate(result.content ?? "", 400),
      title: result.title ?? result.url,
      url: result.url,
    }));
}

async function webSearchDuckDuckGo(query: string): Promise<WebSearchResult[]> {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}`);
  }

  const html = await response.text();
  const results: WebSearchResult[] = [];
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  let match = resultRegex.exec(html);
  while (match && results.length < 5) {
    results.push({
      snippet: stripHtml(match[3]),
      title: stripHtml(match[2]),
      url: resolveRedirectUrl(match[1]),
    });
    match = resultRegex.exec(html);
  }

  return results;
}

function resolveRedirectUrl(href: string): string {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const real = url.searchParams.get("uddg");
    return real ? decodeURIComponent(real) : href;
  } catch {
    return href;
  }
}

function stripHtml(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
