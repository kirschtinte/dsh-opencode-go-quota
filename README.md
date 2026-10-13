# opencode-go-quota

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that shows your
remaining **OpenCode Go** quota beside the composer, read live from the OpenCode Go usage API.

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

The plugin is a local Harness bundle. Clone it somewhere permanent, then install that
directory into your profile:

```bash
git clone https://github.com/kirschtinte/opencode-go-quota.git
```

Then ask Harness to install it — through the agent, using the bundled plugin manager with the
**absolute path** of the cloned directory as its target:

```
plugin_manager  action: install_bundle
                target: /absolute/path/to/opencode-go-quota
```

`install_bundle` writes the profile's `package.json` and `cordis.patch.yml` for you and links
the directory, so edits to the clone take effect on the next page refresh. Do not hand-edit the
profile files or run a package manager in the profile directory.

## Configuration

Options live on the inserted row in your profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: opencode-go-quota
      name: '@local/opencode-go-quota'
      config:
        baseUrl: https://opencode.ai/zen/go   # API root; `/v1/usage` is appended
        credentialRef: OPENCODE_GO_API_KEY    # credential reference holding the key
        refreshMs: 60000                      # cache lifetime, minimum 5000
```

Changing the host half requires an application restart; the browser half reloads with a page
refresh.

## How it works

**Host half** ([`index.js`](index.js)) reads the credential through Harness's credential
service, calls `GET <baseUrl>/v1/usage`, normalizes the three windows into plain JSON and
caches the result. It imports nothing: a profile-installed bundle resolves bare specifiers
against its own directory, which holds no Harness packages. The service is exposed to the
browser through Typert Gateway's *source mode*, which derives a wire descriptor from runtime
reflection instead of a generated artifact — that is why the two exported methods take no
arguments and are declared as a literal prototype marker.

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
