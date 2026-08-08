# Contributing to Guilty

Thanks for helping improve Guilty.

## Before you start

- Search existing issues before opening a new one.
- Use the bug or feature issue template when possible.
- Keep changes focused and avoid adding network services, analytics, or tracking.
- Preserve Guilty's local-only privacy model.

## Local development

1. Fork and clone the repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository folder.
5. After changing files, click **Reload** on the extension card and refresh any test tabs.

Before submitting a pull request, run:

```bash
node --check background.js
node --check tracker.js
node --check popup.js
node --check options.js
```

## Pull requests

- Explain what changed and why.
- Include screenshots for visible UI changes.
- Describe how you tested the change.
- Update `CHANGELOG.md` for user-facing changes.
- Do not commit generated ZIP packages.

By contributing, you agree that your contribution will be licensed under the MIT License.
