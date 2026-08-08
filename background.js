const DEFAULT_RULES = {
  Work: [
    "gmail.com", "mail.google.com", "docs.google.com", "drive.google.com",
    "notion.so", "slack.com", "office.com", "outlook.com", "trello.com",
    "asana.com", "linear.app", "figma.com", "github.com"
  ],
  Personal: [],
  Research: [
    "wikipedia.org", "scholar.google.com", "researchgate.net",
    "stackoverflow.com", "developer.mozilla.org", "arxiv.org"
  ],
  Shopping: [
    "amazon.com", "ebay.com", "walmart.com", "etsy.com", "target.com",
    "bestbuy.com", "costco.com", "homedepot.com", "lowes.com", "temu.com"
  ],
  Entertainment: [
    "youtube.com", "netflix.com", "hulu.com", "disneyplus.com",
    "max.com", "primevideo.com", "twitch.tv", "vimeo.com", "spotify.com"
  ],
  "Social Media": [
    "x.com", "twitter.com", "facebook.com", "instagram.com", "linkedin.com",
    "reddit.com", "threads.net", "tiktok.com", "bsky.app", "mastodon.social"
  ],
  AI: [
    "chatgpt.com", "claude.ai", "gemini.google.com", "perplexity.ai",
    "copilot.microsoft.com", "grok.com", "poe.com", "deepseek.com",
    "mistral.ai", "you.com"
  ]
};

const MIN_REPORT_SITE_SECONDS = 60;
const DEFAULT_CATEGORY_COLOR = "#ff3b30";

let lastPing = { time: 0, domain: "" };

async function ensureDefaults() {
  const current = await chrome.storage.local.get(["rules", "settings", "categoryColors"]);
  if (!current.rules) {
    await chrome.storage.local.set({ rules: DEFAULT_RULES });
  } else {
    const rules = { ...current.rules };
    let changed = false;
    for (const category of Object.keys(DEFAULT_RULES)) {
      if (!Object.prototype.hasOwnProperty.call(rules, category)) {
        rules[category] = DEFAULT_RULES[category];
        changed = true;
      }
    }
    if (changed) await chrome.storage.local.set({ rules });
  }
  if (!current.settings) {
    await chrome.storage.local.set({
      settings: { enabled: true, trackUncategorized: true, idleSeconds: 60 }
    });
  }
  if (!current.categoryColors) {
    await chrome.storage.local.set({
      categoryColors: Object.fromEntries(Object.keys(current.rules || DEFAULT_RULES)
        .map(category => [category, DEFAULT_CATEGORY_COLOR]))
    });
  }
}

chrome.runtime.onInstalled.addListener(ensureDefaults);
chrome.runtime.onStartup.addListener(ensureDefaults);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    ACTIVE_PING: () => recordPing(message.domain),
    GET_STATS: () => getStats(message.range || "today", message.filter || null),
    GET_CONFIG: () => getConfig(),
    SAVE_CONFIG: () => saveConfig(message.rules, message.settings, message.categoryColors),
    ASSIGN_DOMAIN: () => assignDomain(message.domain, message.category),
    IMPORT_CONFIG: () => importConfig(message.config),
    RESET_STATS: () => resetStats(),
    EXPORT_DATA: () => exportData()
  };
  if (!handlers[message.type]) return;
  handlers[message.type]().then(sendResponse);
  return true;
});

function dayKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

function cleanDomain(domain) {
  return String(domain || "").trim().toLowerCase().replace(/^www\./, "");
}

function cleanRule(rule) {
  return String(rule || "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

function ruleDetails(rule) {
  const normalized = cleanRule(rule);
  const wildcard = normalized.startsWith("*");
  const base = normalized.replace(/^\*\./, "").replace(/^\*/, "");
  return { normalized, wildcard, base };
}

function matchScore(domain, rule) {
  const { wildcard, base } = ruleDetails(rule);
  if (!base || base.includes("*")) return -1;

  const matches = domain === base || domain.endsWith(`.${base}`);
  if (!matches) return -1;

  // Longer domains are more specific. An exact hostname wins over a parent
  // domain, and an explicit rule wins over an equivalent wildcard rule.
  return base.length * 100 + (domain === base ? 10 : 0) + (wildcard ? 0 : 1);
}

function categoryFor(domain, rules) {
  let best = { category: "Uncategorized", score: -1 };
  for (const [category, domains] of Object.entries(rules)) {
    for (const rule of domains) {
      const score = matchScore(domain, rule);
      if (score > best.score) best = { category, score };
    }
  }
  return best.category;
}

async function recordPing(rawDomain) {
  const domain = cleanDomain(rawDomain);
  if (!domain) return { ok: false };
  const now = Date.now();
  const { rules = DEFAULT_RULES, settings = {} } =
    await chrome.storage.local.get(["rules", "settings"]);
  if (settings.enabled === false) return { ok: true };

  const category = categoryFor(domain, rules);
  if (category === "Uncategorized" && settings.trackUncategorized === false) {
    lastPing = { time: now, domain };
    return { ok: true };
  }

  const delta = lastPing.time && lastPing.domain === domain
    ? Math.min((now - lastPing.time) / 1000, 6)
    : 0;
  lastPing = { time: now, domain };
  if (delta <= 0) return { ok: true };

  const { activity = {} } = await chrome.storage.local.get("activity");
  const day = dayKey();
  activity[day] ||= {};
  activity[day][domain] = (activity[day][domain] || 0) + delta;
  await chrome.storage.local.set({ activity });
  return { ok: true };
}

async function getConfig() {
  const { rules = DEFAULT_RULES, settings = {}, categoryColors = {} } =
    await chrome.storage.local.get(["rules", "settings", "categoryColors"]);
  return {
    rules,
    categoryColors: Object.fromEntries(Object.keys(rules).map(category => [
      category, categoryColors[category] || DEFAULT_CATEGORY_COLOR
    ])),
    settings: { enabled: true, trackUncategorized: true, idleSeconds: 60, ...settings }
  };
}

async function saveConfig(rules, settings, categoryColors = {}) {
  const cleaned = {};
  for (const [category, domains] of Object.entries(rules || {})) {
    const name = category.trim();
    if (!name) continue;
    cleaned[name] = [...new Set(domains.map(cleanRule).filter(Boolean))];
  }
  const cleanedColors = Object.fromEntries(Object.keys(cleaned).map(category => [
    category,
    /^#[0-9a-f]{6}$/i.test(categoryColors[category] || "")
      ? categoryColors[category]
      : DEFAULT_CATEGORY_COLOR
  ]));
  await chrome.storage.local.set({ rules: cleaned, settings, categoryColors: cleanedColors });
  return { ok: true };
}

async function assignDomain(rawDomain, category) {
  const domain = cleanDomain(rawDomain);
  const { rules = DEFAULT_RULES } = await chrome.storage.local.get("rules");
  if (!domain || !Object.prototype.hasOwnProperty.call(rules, category)) {
    return { ok: false };
  }

  const updated = Object.fromEntries(Object.entries(rules).map(([name, domains]) => [
    name,
    domains.filter(rule => cleanRule(rule) !== domain)
  ]));
  updated[category] = [...new Set([...updated[category], domain])];
  await chrome.storage.local.set({ rules: updated });
  return { ok: true };
}

async function importConfig(config) {
  if (!config || typeof config !== "object" || !config.rules || !config.settings) {
    throw new Error("Invalid Guilty settings file.");
  }
  return saveConfig(config.rules, config.settings, config.categoryColors);
}

function dateAtStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function rangeBounds(range, now = new Date()) {
  const end = dateAtStart(now);
  let start = new Date(end);
  if (range === "week") {
    const mondayOffset = (end.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  } else if (range === "lastWeek") {
    const mondayOffset = (end.getDay() + 6) % 7;
    end.setDate(end.getDate() - mondayOffset - 1);
    start = new Date(end);
    start.setDate(start.getDate() - 6);
  } else if (range === "month") {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else if (range === "year") {
    start = new Date(end.getFullYear(), 0, 1);
  }
  return { start, end };
}

async function getStats(range, filter) {
  const { activity = {}, rules = DEFAULT_RULES } =
    await chrome.storage.local.get(["activity", "rules"]);
  const { start, end } = rangeBounds(range);
  const days = [];
  const categoryTotals = {};
  const siteTotals = {};
  const previousCategoryTotals = {};

  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const key = dayKey(date);
    const sites = activity[key] || {};
    let total = 0;
    for (const [domain, seconds] of Object.entries(sites)) {
      const category = categoryFor(domain, rules);
      if (filter?.type === "category" && category !== filter.value) continue;
      if (filter?.type === "site" && domain !== filter.value) continue;
      total += seconds;
      siteTotals[domain] = (siteTotals[domain] || 0) + seconds;
      categoryTotals[category] = (categoryTotals[category] || 0) + seconds;
    }
    days.push({
      key,
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      seconds: Math.round(total)
    });
  }

  if (range === "week" && !filter) {
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 6);
    for (const date = previousStart; date <= previousEnd; date.setDate(date.getDate() + 1)) {
      const sites = activity[dayKey(date)] || {};
      for (const [domain, seconds] of Object.entries(sites)) {
        const category = categoryFor(domain, rules);
        previousCategoryTotals[category] = (previousCategoryTotals[category] || 0) + seconds;
      }
    }
  }

  const total = days.reduce((sum, day) => sum + day.seconds, 0);
  const allTime = Object.values(activity).reduce(
    (sum, sites) => sum + Object.values(sites).reduce((a, b) => a + b, 0), 0
  );

  return {
    range,
    filter,
    total: Math.round(total),
    allTime: Math.round(allTime),
    days,
    categories: [...new Set([...Object.keys(categoryTotals), ...Object.keys(previousCategoryTotals)])]
      .map(name => ({
        name,
        seconds: Math.round(categoryTotals[name] || 0),
        previousSeconds: range === "week" && !filter
          ? Math.round(previousCategoryTotals[name] || 0)
          : null
      }))
      .sort((a, b) => Math.max(b.seconds, b.previousSeconds || 0) - Math.max(a.seconds, a.previousSeconds || 0)),
    sites: Object.entries(siteTotals)
      .filter(([, seconds]) => seconds >= MIN_REPORT_SITE_SECONDS)
      .map(([domain, seconds]) => ({
        domain,
        category: categoryFor(domain, rules),
        seconds: Math.round(seconds)
      }))
      .sort((a, b) => b.seconds - a.seconds)
  };
}

async function resetStats() {
  await chrome.storage.local.set({ activity: {} });
  lastPing = { time: 0, domain: "" };
  return { ok: true };
}

async function exportData() {
  const data = await chrome.storage.local.get(["activity", "rules", "settings", "categoryColors"]);
  return { ...data, exportedAt: new Date().toISOString() };
}
