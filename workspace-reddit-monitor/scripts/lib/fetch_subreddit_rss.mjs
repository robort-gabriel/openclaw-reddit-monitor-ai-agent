// Reddit often returns 403 for odd clients. Prefer `fetch` (Node 18+) with a browser-like User-Agent.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OpenClawRedditMonitor/1.0";

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function httpGet(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

/**
 * @param {string} subreddit
 * @param { number } limit
 * @returns {Promise<Array<{ title: string, link: string, guid: string, subreddit: string }>>}
 */
export async function fetchSubredditNewItems(subreddit, limit = 25) {
  const name = subreddit.replace(/^r\//, "");
  const url = `https://www.reddit.com/r/${encodeURIComponent(name)}/new.json?raw_json=1&limit=${limit}`;
  const json = await httpGet(url);
  const data = JSON.parse(json);
  const children = data?.data?.children;
  if (!Array.isArray(children)) {
    return [];
  }
  const out = [];
  for (const c of children) {
    const d = c?.data;
    if (!d || d.stickied) continue;
    const fullname = d.name;
    const title = d.title;
    const permalink = d.permalink;
    if (!title || !permalink || !fullname) continue;
    const link = `https://www.reddit.com${permalink}`;
    out.push({
      title: String(title).replace(/\s+/g, " ").trim(),
      link,
      guid: String(fullname),
      subreddit: d.subreddit || name,
    });
  }
  return out;
}

/** @param {{ title: string, link: string }} item */
export function itemPassesKeywords(item, keyword_include, keyword_exclude) {
  const blob = `${item.title} ${item.link}`.toLowerCase();
  for (const ex of keyword_exclude) {
    if (ex && blob.includes(String(ex).toLowerCase())) return false;
  }
  if (keyword_include.length === 0) return true;
  for (const inc of keyword_include) {
    if (inc && blob.includes(String(inc).toLowerCase())) return true;
  }
  return false;
}
