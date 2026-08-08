let lastActivity = Date.now();
let idleSeconds = 60;

chrome.storage.local.get("settings").then(({ settings }) => {
  idleSeconds = settings?.idleSeconds || 60;
});

chrome.storage.onChanged.addListener(changes => {
  if (changes.settings) idleSeconds = changes.settings.newValue?.idleSeconds || 60;
});

function markActive() {
  lastActivity = Date.now();
}

["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"].forEach(event => {
  window.addEventListener(event, markActive, { passive: true });
});

function isActive() {
  return document.visibilityState === "visible" &&
    document.hasFocus() &&
    Date.now() - lastActivity < idleSeconds * 1000;
}

function ping() {
  if (isActive()) {
    chrome.runtime.sendMessage({
      type: "ACTIVE_PING",
      domain: location.hostname
    }).catch(() => {});
  }
}

setInterval(ping, 5_000);
ping();
