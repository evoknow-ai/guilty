# Guilty

Your attention, accounted for.

Idea by Mohammed Kabir. Developed by his agents.

**Your attention, accounted for.**

Guilty is a private Chrome extension that tracks active website time by category.
Everything stays locally in Chrome.

## What counts as active

Time is counted only when:

- A web page is the visible tab in the focused browser window
- You have recently used the mouse, keyboard, scrolling, wheel, or touch
- Tracking is enabled

Leaving a tab open does not continuously inflate your time.

## Included categories

- Work
- Personal
- Research
- Shopping
- Entertainment
- Social Media
- AI
- Uncategorized

Categories and domains can be added, renamed, or removed in Settings.

## Domain rules and wildcards

Rules can be exact domains or wildcard patterns:

- `google.com` matches Google and its subdomains
- `*google.com` matches Google and its subdomains
- `*.evoknow.io` matches Evoknow and all of its subdomains

When several rules match a website, the rule with the longest matching domain
wins. This lets a broad rule such as `*google.com` coexist with a more specific
rule such as `docs.google.com`.

## Reports and sharing

View Today, This Week, Last Week, This Month, or This Year. Click a category to
see its tracked domains, then click a domain for its report. **Share PNG** copies
the current report image to the clipboard and opens your chosen social network;
paste the image into the post composer.

Sites with less than one minute of activity in the selected report period are
hidden from the site list. This keeps brief redirects and accidental page opens
from cluttering reports. Their raw seconds remain in local history and the site
appears automatically after reaching one minute.

## Install or update

1. Unzip `Guilty.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. If Guilty is already loaded, click its **Reload** button. Otherwise, click
   **Load unpacked** and select the unzipped folder.
5. Pin **Guilty** to the Chrome toolbar.

Tracking starts on pages opened or refreshed after installation.

## Privacy

Guilty has no server, account, analytics, advertising, or network transmission.
History and settings are stored only in Chrome's local extension storage.
Custom categories, wildcard rules, and preferences are saved in Chrome's local
extension storage. Version 3.3 also uses a stable extension identity so loading
future Guilty builds preserves that storage. Settings can be backed up and
restored from the Settings page.
