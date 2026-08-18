# Reviewer Notes

Guilty is a Manifest V3, local-only website activity tracker. It has no server, account, analytics, advertising, remote code, or network API.

## Test flow

1. Install the extension and pin Guilty to the toolbar.
2. Open or refresh a normal `https://` webpage.
3. Keep that tab visible and interact with it for approximately 10 seconds.
4. Open Guilty. The active domain appears in the selected time report, normally under Uncategorized unless it matches a default rule.
5. Open the Uncategorized category and use its dropdown to assign the domain to a category.
6. Open Settings to change categories, wildcard rules, colors, or idle timeout.
7. Click Share PNG to generate and copy a complete report image. Clipboard access occurs only from this user action.
8. Click Erase tracking history in Settings to delete all stored activity.

## Permission behavior

- `storage` stores settings and activity locally.
- `<all_urls>` allows the content script to detect active use on any website because cross-site measurement is the extension's disclosed single purpose.
- `clipboardWrite` copies a report PNG only after the user clicks Share PNG.

The content script reads `location.hostname`, `document.visibilityState`, focus state, and local interaction timing. It does not inspect or transmit page content.

## Notes

- Chrome internal pages such as `chrome://extensions` do not allow content scripts and are not tracked.
- A newly opened page may require a refresh after initial installation before tracking begins.
- Sites with less than one minute of activity are hidden from detailed site lists to reduce redirect noise, but category totals update normally.
