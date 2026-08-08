const RANGE_LABELS = {
  today: "Today", week: "This Week", lastWeek: "Last Week",
  month: "This Month", year: "This Year"
};
let state = { range: "today", filter: null, stats: null, categories: [], categoryColors: {}, categoryComparisonColors: {} };

const format = seconds => {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
})[char]);

function lighterShade(hex) {
  const value = hex.replace("#", "");
  const rgb = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  return `#${rgb.map(channel => Math.round(channel + (255 - channel) * .45)
    .toString(16).padStart(2, "0")).join("")}`;
}

function rows(items, type) {
  if (!items.length) return `<div class="empty">No guilt in this period.</div>`;
  const max = Math.max(...items.flatMap(item => [item.seconds || 0, item.previousSeconds || 0]), 1);
  return items.slice(0, 10).map(item => {
    const label = type === "site" ? item.domain : item.name;
    const picker = type === "site" && item.category === "Uncategorized"
      ? `<select class="category-picker" data-domain="${escapeHtml(item.domain)}" aria-label="Categorize ${escapeHtml(item.domain)}">
          <option value="">Move to category…</option>
          ${state.categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
        </select>`
      : "";
    const color = state.categoryColors[item.name] || "#ff3b30";
    const comparisonColor = state.categoryComparisonColors[item.name] || lighterShade(color);
    const comparison = type === "category" && item.previousSeconds !== null
      ? `<div class="comparison">
          <div class="comparison-line"><small>Now</small><div class="progress"><i style="width:${item.seconds / max * 100}%;background:${color}"></i></div><b>${format(item.seconds)}</b></div>
          <div class="comparison-line"><small>Last</small><div class="progress"><i style="width:${item.previousSeconds / max * 100}%;background:${comparisonColor}"></i></div><b>${format(item.previousSeconds)}</b></div>
        </div>`
      : `<div class="progress"><i style="width:${item.seconds / max * 100}%;background:${color}"></i></div>`;
    return `<div class="row" data-type="${type}" data-value="${escapeHtml(label)}">
      <div><div class="name">${escapeHtml(label)}</div>
      ${type === "site" ? `<div class="meta">${escapeHtml(item.category)}</div>${picker}` : ""}</div>
      <b>${format(item.seconds)}</b>
      ${comparison}
    </div>`;
  }).join("");
}

function chart(days) {
  const display = days.length > 31
    ? days.filter((_, index) => index % Math.ceil(days.length / 24) === 0)
    : days;
  const max = Math.max(...display.map(day => day.seconds), 60);
  return display.map((day, index) => `
    <div class="day ${index === display.length - 1 ? "today" : ""}" title="${day.label}: ${format(day.seconds)}">
      <div class="bar-wrap"><div class="bar" style="height:${Math.max(3, day.seconds / max * 100)}%"></div></div>
      <label>${display.length <= 14 ? escapeHtml(day.label) : ""}</label>
    </div>`).join("");
}

async function render() {
  const [stats, config] = await Promise.all([
    chrome.runtime.sendMessage({ type: "GET_STATS", range: state.range, filter: state.filter }),
    chrome.runtime.sendMessage({ type: "GET_CONFIG" })
  ]);
  state.stats = stats;
  state.categories = Object.keys(config.rules).filter(name => name !== "Uncategorized");
  state.categoryColors = config.categoryColors;
  state.categoryComparisonColors = config.categoryComparisonColors;
  const title = state.filter ? state.filter.value : RANGE_LABELS[state.range];
  document.querySelector("#reportTitle").textContent = title.toUpperCase();
  document.querySelector("#total").textContent = format(stats.total);
  document.querySelector("#allTime").textContent = `All time: ${format(stats.allTime)}`;
  document.querySelector("#back").hidden = !state.filter;
  document.querySelector("#context").textContent = state.filter
    ? `${RANGE_LABELS[state.range]} · ${state.filter.type === "site" ? "Site" : "Category"}`
    : "Categories";
  document.querySelector("#compareKey").hidden = state.range !== "week" || !!state.filter;
  const items = state.filter?.type === "category" ? stats.sites
    : state.filter?.type === "site" ? [{
      domain: state.filter.value,
      category: stats.sites[0]?.category || "",
      seconds: stats.total
    }] : stats.categories;
  document.querySelector("#report").innerHTML = rows(
    items, state.filter?.type === "category" || state.filter?.type === "site" ? "site" : "category"
  );
  document.querySelector("#chart").innerHTML = chart(stats.days);
  bindRows();
}

function bindRows() {
  document.querySelectorAll(".category-picker").forEach(picker => {
    picker.addEventListener("click", event => event.stopPropagation());
    picker.addEventListener("change", async event => {
      event.stopPropagation();
      const category = picker.value;
      if (!category) return;
      picker.disabled = true;
      await chrome.runtime.sendMessage({
        type: "ASSIGN_DOMAIN", domain: picker.dataset.domain, category
      });
      await render();
    });
  });
  document.querySelectorAll(".row").forEach(row => row.addEventListener("click", () => {
    if (state.filter?.type === "site") return;
    state.filter = { type: row.dataset.type, value: row.dataset.value };
    render();
  }));
}

document.querySelectorAll("#ranges button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("#ranges button").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    state.range = button.dataset.range;
    render();
  });
});

document.querySelector("#back").addEventListener("click", () => {
  if (state.filter?.type === "site") {
    const category = state.stats.sites[0]?.category;
    state.filter = category ? { type: "category", value: category } : null;
  } else {
    state.filter = null;
  }
  render();
});

document.querySelector("#settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.querySelector("#credits").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("credits.html") });
});
document.querySelector("#export").addEventListener("click", async () => {
  const data = await chrome.runtime.sendMessage({ type: "EXPORT_DATA" });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url, download: `guilty-export-${new Date().toISOString().slice(0, 10)}.json`
  });
  link.click();
  URL.revokeObjectURL(url);
});

function reportPng() {
  const list = state.filter?.type === "category" ? state.stats.sites
    : state.filter?.type === "site" ? [{ domain: state.filter.value, seconds: state.stats.total }]
    : state.stats.categories;
  const comparing = state.range === "week" && !state.filter;
  const rowHeight = comparing ? 78 : 54;
  const chartHeight = 150;
  const height = Math.max(675, 330 + list.length * rowHeight + chartHeight);
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#080808"; ctx.fillRect(0, 0, 1200, height);
  ctx.fillStyle = "#fff"; ctx.font = "bold 42px sans-serif"; ctx.fillText("GUILTY", 70, 75);
  ctx.fillStyle = "#ff3b30"; ctx.fillText(".", 225, 75);
  ctx.fillStyle = "#777"; ctx.font = "24px sans-serif";
  ctx.fillText(`${RANGE_LABELS[state.range]}${state.filter ? ` · ${state.filter.value}` : ""}`, 70, 125);
  ctx.fillStyle = "#fff"; ctx.font = "bold 100px sans-serif"; ctx.fillText(format(state.stats.total), 70, 245);
  const max = Math.max(...list.flatMap(item => [item.seconds || 0, item.previousSeconds || 0]), 1);
  list.forEach((item, index) => {
    const y = 315 + index * rowHeight;
    const label = item.domain || item.name;
    ctx.fillStyle = "#ddd"; ctx.font = "22px sans-serif"; ctx.fillText(label.slice(0, 35), 70, y);
    ctx.fillStyle = "#777"; ctx.textAlign = "right"; ctx.fillText(format(item.seconds), 1110, y);
    ctx.textAlign = "left";
    const color = state.categoryColors[item.name] || "#ff3b30";
    ctx.fillStyle = "#242424"; ctx.fillRect(390, y - 17, 580, 10);
    ctx.fillStyle = color; ctx.fillRect(390, y - 17, 580 * item.seconds / max, 10);
    if (comparing) {
      ctx.fillStyle = "#666"; ctx.font = "15px sans-serif"; ctx.fillText("LAST", 70, y + 29);
      ctx.fillStyle = "#242424"; ctx.fillRect(390, y + 15, 580, 10);
      ctx.fillStyle = state.categoryComparisonColors[item.name] || lighterShade(color);
      ctx.fillRect(390, y + 15, 580 * (item.previousSeconds || 0) / max, 10);
      ctx.fillStyle = "#777"; ctx.textAlign = "right"; ctx.fillText(format(item.previousSeconds || 0), 1110, y + 29); ctx.textAlign = "left";
    }
  });
  const chartTop = 340 + list.length * rowHeight;
  const dayMax = Math.max(...state.stats.days.map(day => day.seconds), 60);
  const barWidth = Math.max(8, Math.min(54, 960 / Math.max(state.stats.days.length, 1) - 8));
  state.stats.days.forEach((day, index) => {
    const x = 70 + index * ((1060 - 70) / Math.max(state.stats.days.length, 1));
    const barHeight = Math.max(3, day.seconds / dayMax * 90);
    ctx.fillStyle = index === state.stats.days.length - 1 ? "#ff3b30" : "#282828";
    ctx.fillRect(x, chartTop + 95 - barHeight, barWidth, barHeight);
  });
  ctx.fillStyle = "#555"; ctx.font = "18px sans-serif";
  ctx.fillText("Your attention, accounted for.", 70, height - 35);
  return canvas;
}

document.querySelector("#share").addEventListener("click", async () => {
  const blob = await new Promise(resolve => reportPng().toBlob(resolve, "image/png"));
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    document.querySelector("#shareMenu").hidden = false;
  } catch {
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), { href: url, download: "guilty-report.png" });
    link.click(); URL.revokeObjectURL(url);
  }
});

const SOCIAL_URLS = {
  x: "https://x.com/compose/post", facebook: "https://www.facebook.com/",
  linkedin: "https://www.linkedin.com/feed/?shareActive=true", reddit: "https://www.reddit.com/submit"
};
document.querySelectorAll("[data-social]").forEach(button => button.addEventListener("click", () => {
  chrome.tabs.create({ url: SOCIAL_URLS[button.dataset.social] });
}));

render();
setInterval(render, 5_000);
