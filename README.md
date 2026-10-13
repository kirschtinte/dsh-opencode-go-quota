# dsh-opencode-go-quota

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that shows your
remaining **OpenCode Go** quota beside the composer, read live from the OpenCode Go usage API.

![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4D6BFE?logo=deepseek&logoColor=white)
![License](https://img.shields.io/github/license/kirschtinte/dsh-opencode-go-quota)
![Type](https://img.shields.io/badge/Type-Host%20plugin-blue)
![Data source](https://img.shields.io/badge/Data%20source-OpenCode%20Go%20usage%20API-important)
![Tool slot](https://img.shields.io/badge/Tool%20slot-composer%20dock-lightgrey)

[中文说明](README.zh.md)

```
● OpenCode Go   98% · 97% · 99%
```

Three windows, matching how OpenCode Go defines its limits:

| Window | Allowance | Shown as |
| --- | --- | --- |
| Rolling | 5-hour — 20% of the monthly limit | remaining % of that allowance |
| Weekly | 50% of the monthly limit | remaining % |
| Monthly | 100% of the monthly limit | remaining % |

Click the pill for a per-window breakdown with progress bars and reset countdowns.

## Requirements

- DeepSeek Harness with the Web UI
- An OpenCode Go subscription and its API key stored in Harness, under the credential
  reference `OPENCODE_GO_API_KEY` (the same key your `opencode-go` provider row already uses)

## Install

The plugin is a local Harness bundle with one runtime dependency, so install its packages
before handing the directory to Harness:

```bash
git clone https://github.com/kirschtinte/dsh-opencode-go-quota.git
cd dsh-opencode-go-quota
pnpm install        # or: npm install --omit=dev
```

The dependency is `@deepseek-ai/schemastery`, which declares the plugin's `Config` schema. It
has to be installed here rather than by Harness: `install_bundle` links the directory with
`link:`, and pnpm does not install a linked package's own dependencies. Skip this step and the
plugin still activates, but Harness cannot validate the row or render its configuration form.

Then ask Harness to install it — through the agent, using the bundled plugin manager with the
**absolute path** of the cloned directory as its target:

```
plugin_manager  action: install_bundle
                target: /absolute/path/to/dsh-opencode-go-quota
```

`install_bundle` writes the profile's `package.json` and `cordis.patch.yml` for you and links
the directory, so edits to the clone take effect on the next page refresh. Do not hand-edit the
profile files or run a package manager in the profile directory.

## Configuration

The row's `Config` schema is declared in [`index.js`](index.js), so Harness validates these
values on activation and the Plugin Manager renders a form for them. They can equally be set by
hand on the inserted row in your profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-opencode-go-quota
      name: '@local/dsh-opencode-go-quota'
      config:
        baseUrl: https://opencode.ai/zen/go   # API root; `/v1/usage` is appended
        credentialRef: OPENCODE_GO_API_KEY    # credential reference holding the key
        refreshMs: 60000                      # cache lifetime, 5000-3600000
```

All three are optional and fall back to exactly these defaults.

Changing the host half requires an application restart; the browser half reloads with a page
refresh.

## How it works

**Host half** ([`index.js`](index.js)) reads the credential through Harness's credential
service, calls `GET <baseUrl>/v1/usage`, normalizes the three windows into plain JSON and
caches the result. Apart from the `Config` schema it imports nothing: a profile-installed bundle
resolves bare specifiers against its own directory, so the packages Harness itself uses are out
of reach — `@deepseek-ai/schemastery` is the one exception, and it is a declared dependency
rather than a Harness internal. The service is exposed to the browser through Typert Gateway's
*source mode*, which derives a wire descriptor from runtime reflection instead of a generated
artifact — that is why the two exported methods take no arguments and are declared as a literal
prototype marker.

**Browser half** ([`client.js`](client.js)) mounts those endpoints as a `remote` namespace and
registers a pill into the `conversation.composer.dock` slot. It imports no Harness Client
package either: React comes from the module table, and every colour is a `--dsw-*` theme token,
so the popover matches shipped menus in both light and dark schemes.

Your API key never reaches the browser. The client only receives the parsed percentages.

## Notes and limitations

- **Polling.** The browser asks for a snapshot every 60 seconds and re-reads when the tab
  becomes visible; opening the panel forces a fresh read that bypasses the host cache.
- **Staleness is visible.** If a read fails, the last numbers stay on screen but are labelled
  with the time they were taken, and the reason appears underneath — stale figures never pass
  as current.
- **Light scheme.** The popover is dark-tinted glass in the dark scheme and a faint frosted
  layer in the light one. Over a white app background there is little behind it to refract, so
  the glass reads mostly through its edge highlight; that is inherent, not a styling defect.
- **The usage API is unofficial.** `https://opencode.ai/zen/go/v1/usage` is not part of
  OpenCode's documented public API. If OpenCode changes or removes it, the plugin will report
  the failure rather than show wrong numbers.

## Development

[`tools/contrast.mjs`](tools/contrast.mjs) is a local verification aid, not part of the plugin
at runtime. It reads the theme stylesheet out of an installed Harness, resolves the token
chain, and prints the contrast ratio of every text layer in both colour schemes, so palette
changes can be checked without eyeballing them:

```bash
node tools/contrast.mjs
```

It finds the theme package on its own, including reading it straight out of `app.asar`, where
Desktop Harness keeps its entire tree. If your Harness lives somewhere unusual, pass its root,
its `app.asar`, or the theme module itself as the first argument, or set `DSH_THEME_PATH`.

## License

Apache-2.0. See [LICENSE](LICENSE).

Copyright 2026 kirschtinte
