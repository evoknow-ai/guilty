const rulesEl = document.querySelector("#rules");
const statusEl = document.querySelector("#status");

function addCard(name = "", domains = [], color = "#ff3b30") {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-head">
      <input class="category" value="${escapeHtml(name)}" placeholder="Category name">
      <label class="color-label">Chart color <input class="category-color" type="color" value="${escapeHtml(color)}"></label>
      <button class="remove">Remove</button>
    </div>
    <textarea placeholder="example.com, *google.com, *.evoknow.io">${escapeHtml(domains.join(", "))}</textarea>
    <p class="hint">Comma-separated domains or wildcards. Examples: *google.com, *.evoknow.io. More-specific rules win.</p>`;
  card.querySelector(".remove").addEventListener("click", () => card.remove());
  rulesEl.appendChild(card);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[c]);
}

async function load() {
  const { rules, settings, categoryColors } = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
  rulesEl.innerHTML = "";
  document.querySelector("#enabled").checked = settings.enabled;
  document.querySelector("#uncategorized").checked = settings.trackUncategorized;
  document.querySelector("#idle").value = String(settings.idleSeconds);
  Object.entries(rules).forEach(([name, domains]) => addCard(name, domains, categoryColors[name]));
}

document.querySelector("#add").addEventListener("click", () => addCard());
document.querySelector("#save").addEventListener("click", async () => {
  const rules = {};
  const categoryColors = {};
  document.querySelectorAll(".card").forEach(card => {
    const name = card.querySelector(".category").value.trim();
    const domains = card.querySelector("textarea").value.split(",").map(v => v.trim()).filter(Boolean);
    if (name) {
      rules[name] = domains;
      categoryColors[name] = card.querySelector(".category-color").value;
    }
  });
  const settings = {
    enabled: document.querySelector("#enabled").checked,
    trackUncategorized: document.querySelector("#uncategorized").checked,
    idleSeconds: Number(document.querySelector("#idle").value)
  };
  await chrome.runtime.sendMessage({ type: "SAVE_CONFIG", rules, settings, categoryColors });
  statusEl.textContent = "Saved locally.";
  setTimeout(() => statusEl.textContent = "", 1500);
});

document.querySelector("#backup").addEventListener("click", async () => {
  const config = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
  const blob = new Blob([JSON.stringify({
    type: "guilty-settings",
    version: 1,
    ...config
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: `guilty-settings-${new Date().toISOString().slice(0, 10)}.json`
  });
  link.click();
  URL.revokeObjectURL(url);
  statusEl.textContent = "Settings backup downloaded.";
});

const restoreFile = document.querySelector("#restoreFile");
document.querySelector("#restore").addEventListener("click", () => restoreFile.click());
restoreFile.addEventListener("change", async () => {
  try {
    const config = JSON.parse(await restoreFile.files[0].text());
    if (config.type !== "guilty-settings") throw new Error("Not a Guilty settings file.");
    await chrome.runtime.sendMessage({ type: "IMPORT_CONFIG", config });
    await load();
    statusEl.textContent = "Settings restored.";
  } catch (error) {
    statusEl.textContent = error.message || "Could not restore settings.";
  } finally {
    restoreFile.value = "";
  }
});

document.querySelector("#reset").addEventListener("click", async () => {
  if (confirm("Permanently erase all Guilty tracking history?")) {
    await chrome.runtime.sendMessage({ type: "RESET_STATS" });
    statusEl.textContent = "History erased.";
  }
});

load();
