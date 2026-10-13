/**
 * Browser half of the OpenCode Go quota bundle.
 *
 * Registers a compact remaining-quota pill below the composer. The numbers come
 * from the Host half over Typert Gateway: the bundle mounts its own zero-argument
 * `opencodeQuota` endpoints, because a profile-installed bundle ships no
 * generated Remote artifact and the Client refuses a descriptor whose parameters
 * carry no strict codec.
 *
 * Nothing here imports a Harness Client package. React arrives from the module
 * table, the popover copies MainMenu's material technique (a dedicated blurred
 * layer behind the content) and reuses the host's own surface tokens, so the
 * result matches shipped menus in either colour scheme.
 */

window.__ModuleLoader__.load({
  id: '@local/opencode-go-quota',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React

    /** Locale dictionary namespace. */
    const NS = 'opencode-go-quota'
    /** Wire namespace the Host half publishes. */
    const SERVICE_KEY = 'opencodeQuota'
    /** Slot filler id; unique so the pill sits beside shipped dock entries. */
    const ENTRY_ID = 'opencode-go-quota'
    /** How often the browser asks for a snapshot. */
    const POLL_MS = 60_000
    /**
     * Upper bound on one Remote round trip. A dropped carrier can leave a call
     * pending forever, and an awaited promise that never settles would wedge the
     * poll chain and pin the refresh control disabled, freezing the pill on its
     * last good reading with no way back.
     */
    const REMOTE_TIMEOUT_MS = 20_000
    /** Class prefix; every rule below is scoped under it. */
    const P = 'ogq'

    const en = {
      label: 'OpenCode Go',
      quota: 'Remaining quota',
      loading: 'Reading quota…',
      retry: 'Retry',
      refresh: 'Refresh now',
      refreshing: 'Refreshing…',
      updatedAt: 'updated',
      stale: 'last reading',
      unavailable: 'Quota unavailable',
      rolling: '5-hour',
      weekly: 'Weekly',
      monthly: 'Monthly',
      resetsIn: 'resets in',
      resetUnknown: 'reset time unknown',
    }

    const zh = {
      label: 'OpenCode Go',
      quota: '剩余额度',
      loading: '正在读取额度…',
      retry: '重试',
      refresh: '立即刷新',
      refreshing: '刷新中…',
      updatedAt: '更新于',
      stale: '最后读取',
      unavailable: '额度不可用',
      rolling: '5 小时',
      weekly: '每周',
      monthly: '每月',
      resetsIn: '重置于',
      resetUnknown: '重置时间未知',
    }

    /** Window ordering and display keys. */
    const WINDOW_LABEL = { rolling: 'rolling', weekly: 'weekly', monthly: 'monthly' }

    /**
     * Stylesheet for the pill and the popover.
     *
     * The material mirrors `MenuSurface.module.css`: the filter sits on its own
     * inset layer rather than on the surface itself, so the surface keeps a plain
     * box and the popover can stay absolutely positioned. Only theme tokens are
     * referenced for text, surfaces and strokes; the low-alpha white gradients are
     * the specular sheen of the glass itself, which is a material effect rather
     * than a themed colour.
     */
    const CSS = `
.${P}-root { position: relative; display: inline-flex; align-items: center; }

.${P}-pill {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 11px;
  border: 0;
  border-radius: 999px;
  font: var(--dsw-font-xxs-12);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: transform 140ms cubic-bezier(.2, .9, .25, 1);
  -webkit-tap-highlight-color: transparent;
}
.${P}-pill:active { transform: scale(.975); }
.${P}-pill:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
/* Material: black-tinted translucent glass. The host menu fill is a blue-gray
 * (#43454a), which reads as a lit slab sitting on the near-black app surface no
 * matter how translucent it is; tinting the same blur with black keeps it a dark
 * sheet of glass instead. The resting capsule carries the fuller glass and
 * interaction lightens it, so the engaged state reads as the same sheet thinning
 * under the pointer rather than a control switching on. */
.${P}-pill__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: color-mix(in srgb, var(--dsw-static-neutral-1000) 10%, transparent);
  box-shadow: var(--dsw-elevation-stroke);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  transition: background 160ms ease;
}
.${P}-pill:hover .${P}-pill__bg,
.${P}-pill:focus-visible .${P}-pill__bg,
.${P}-pill[aria-expanded='true'] .${P}-pill__bg {
  background: color-mix(in srgb, var(--dsw-static-neutral-1000) 5%, transparent);
}
body[data-ds-dark-theme] .${P}-pill__bg {
  background: color-mix(in srgb, var(--dsw-static-neutral-1000) 58%, transparent);
}
body[data-ds-dark-theme] .${P}-pill:hover .${P}-pill__bg,
body[data-ds-dark-theme] .${P}-pill:focus-visible .${P}-pill__bg,
body[data-ds-dark-theme] .${P}-pill[aria-expanded='true'] .${P}-pill__bg {
  background: color-mix(in srgb, var(--dsw-static-neutral-1000) 38%, transparent);
}
.${P}-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  /* At rest the dot sits straight on the app background, where pure green is only
   * 2.3:1 in light mode. A hairline edge defines it without draining the hue. */
  box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--dsw-alias-label-primary) 24%, transparent);
}
.${P}-pill__name { color: var(--dsw-alias-label-primary); font-weight: 500; }
.${P}-pill__values {
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: .01em;
}

.${P}-panel {
  position: absolute;
  bottom: 36px;
  left: 0;
  z-index: 60;
  isolation: isolate;
  min-width: 284px;
  padding: 14px 16px 13px;
  border-radius: var(--dsw-radius-xl);
  color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-elevation-prominent);
  transform-origin: 18% 100%;
  animation: ${P}-rise 190ms cubic-bezier(.2, .9, .25, 1);
}
.${P}-panel__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  border-radius: inherit;
  background: color-mix(in srgb, var(--dsw-static-neutral-1000) 7%, transparent);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
}
body[data-ds-dark-theme] .${P}-panel__bg {
  background: color-mix(in srgb, var(--dsw-static-neutral-1000) 50%, transparent);
}
/* Specular sheen: a raking highlight from the top-left corner. Light mode keeps a
 * restrained one, because a white wash over an already pale surface reads as
 * milkiness rather than glass. */
.${P}-panel__bg::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(152deg, rgb(255 255 255 / 9%) 0%, transparent 40%);
}
body[data-ds-dark-theme] .${P}-panel__bg::before {
  background:
    linear-gradient(152deg, rgb(255 255 255 / 20%) 0%, rgb(255 255 255 / 5%) 26%, transparent 58%),
    linear-gradient(0deg, rgb(255 255 255 / 9%) 0%, transparent 16%);
}
/* Rim: the hairline of light along the slab's edge. Painted last so it stays
 * crisp above the sheen, and carrying most of the glass cue once the fill itself
 * is nearly transparent. */
.${P}-panel__bg::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 .5px 0 rgb(255 255 255 / 32%),
    inset .5px 0 0 rgb(255 255 255 / 12%),
    inset 0 -.5px 0 rgb(0 0 0 / 10%);
}

.${P}-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.${P}-head__meta { display: inline-flex; align-items: center; gap: 10px; }
.${P}-title { font: var(--dsw-font-xs-strong-13); color: var(--dsw-alias-label-primary); }
.${P}-stamp {
  font: var(--dsw-font-xxs-12);
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.${P}-action {
  font: var(--dsw-font-xxs-strong-12);
  color: var(--dsw-alias-link);
  background: none;
  border: 0;
  padding: 0;
  border-radius: var(--dsw-radius-xs);
  cursor: pointer;
}
.${P}-action:hover { text-decoration: underline; }
.${P}-action:disabled { opacity: .5; cursor: default; text-decoration: none; }
.${P}-action:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

.${P}-rows { display: flex; flex-direction: column; gap: 13px; margin-top: 13px; }
.${P}-row { display: flex; flex-direction: column; gap: 6px; }
.${P}-row__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.${P}-row__label { font: var(--dsw-font-xs-13); font-weight: 500; color: var(--dsw-alias-label-primary); }
.${P}-row__value {
  font: var(--dsw-font-xs-strong-13);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  letter-spacing: .01em;
}
.${P}-track {
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 13%, transparent);
  box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
}
.${P}-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 320ms cubic-bezier(.2, .9, .25, 1);
}
.${P}-reset { font: var(--dsw-font-xxs-12); color: var(--dsw-alias-label-secondary); }

.${P}-state { display: flex; flex-direction: column; gap: 8px; margin-top: 13px; }
.${P}-muted { font: var(--dsw-font-xxs-12); color: var(--dsw-alias-label-secondary); }
.${P}-error {
  font: var(--dsw-font-xxs-12);
  color: var(--dsw-alias-state-error-primary);
  word-break: break-word;
}

@keyframes ${P}-rise {
  from { opacity: 0; transform: translateY(8px) scale(.96); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .${P}-panel { animation: none; }
  .${P}-fill, .${P}-pill { transition: none; }
}
`

    /**
     * Why the Remote contribution failed to mount, when it did. Kept so the pill
     * can report a wiring fault instead of an endless "loading" state.
     */
    let mountFailure = null

    /**
     * Resolve the mounted Remote namespace.
     *
     * Reaching `remote.<namespace>` is an injected access: Cordis only permits it
     * from a scope that declares `remote.<namespace>`, which is why the caller
     * must be the nested scope created in `apply`.
     * @param ctx - a Client context declaring the namespace as an injection.
     * @returns the namespace service, or `undefined` while it mounts.
     */
    function quotaNamespace(ctx) {
      const remote = ctx.remote
      if (remote === undefined) return undefined
      const namespace = remote[SERVICE_KEY]
      return namespace !== undefined && typeof namespace.usage === 'function' ? namespace : undefined
    }

    /**
     * Settle a promise within a bound, turning a hung carrier into an ordinary
     * failure the callback chain can recover from.
     * @param promise - the pending operation.
     * @param ms - the budget in milliseconds.
     * @param label - what the operation was, for the failure message.
     * @returns the resolved value.
     * @throws when the budget elapses first, or the operation rejects.
     */
    function withTimeout(promise, ms, label) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} did not answer within ${ms} ms`)), ms)
        Promise.resolve(promise).then(
          (value) => {
            clearTimeout(timer)
            resolve(value)
          },
          (error) => {
            clearTimeout(timer)
            reject(error)
          },
        )
      })
    }

    /**
     * Call one Remote endpoint and unwrap its result envelope.
     * @param ctx - the Client plugin context.
     * @param method - `usage` or `refresh`.
     * @returns the snapshot.
     * @throws when the namespace is unmounted, the call stalls, or the Host reported a failure.
     */
    async function callQuota(ctx, method) {
      const namespace = quotaNamespace(ctx)
      if (namespace === undefined) {
        if (mountFailure !== null) throw new Error(`quota endpoint failed to mount: ${mountFailure.message}`)
        throw new Error('quota endpoint is not mounted yet')
      }
      const result = await withTimeout(namespace[method](), REMOTE_TIMEOUT_MS, `opencodeQuota.${method}`)
      if (result === null || typeof result !== 'object') throw new Error('quota endpoint returned no result')
      if (result.ok !== true) {
        const code = result.error === undefined ? 'unknown' : result.error.code
        const message = result.error === undefined ? 'unknown failure' : result.error.message
        throw new Error(`${code}: ${message}`)
      }
      return result.value
    }

    /**
     * Accent token for a remaining percentage, used for the dot and the bar.
     * @param remaining - remaining percentage, 0-100.
     * @returns the theme token naming that state.
     */
    function severityToken(remaining) {
      if (remaining <= 10) return 'var(--dsw-alias-state-error-primary)'
      if (remaining <= 30) return 'var(--dsw-alias-state-warn-primary)'
      return 'var(--dsw-alias-state-success-primary)'
    }

    /**
     * Legible variant of an accent for text. The raw state tokens are tuned for
     * dots and gauges: pure green only clears AA on a dark surface, so each accent
     * is folded toward the scheme's own label colour, which darkens it in light
     * mode and lightens it in dark mode.
     * @param accent - the state token.
     * @returns a colour expression legible in either scheme.
     */
    function accentText(accent) {
      return `color-mix(in srgb, ${accent} 58%, var(--dsw-alias-label-primary))`
    }

    /**
     * Format a percentage without trailing noise.
     * @param value - the percentage.
     * @returns display text.
     */
    function formatPercent(value) {
      const rounded = Math.round(value * 10) / 10
      return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`
    }

    /**
     * Render the distance to a reset instant as a compact duration.
     * @param iso - the reset instant, or `null`.
     * @param t - the bound locale dictionary.
     * @returns display text.
     */
    function formatReset(iso, t) {
      if (typeof iso !== 'string') return t('resetUnknown')
      const target = Date.parse(iso)
      if (Number.isNaN(target)) return t('resetUnknown')
      const seconds = Math.round((target - Date.now()) / 1000)
      if (seconds <= 0) return `${t('resetsIn')} 0m`
      const days = Math.floor(seconds / 86_400)
      const hours = Math.floor((seconds % 86_400) / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const parts = []
      if (days > 0) parts.push(`${days}d`)
      if (hours > 0) parts.push(`${hours}h`)
      if (days === 0) parts.push(`${minutes}m`)
      return `${t('resetsIn')} ${parts.join(' ')}`
    }

    /**
     * Render an instant as a local wall clock, so a reading can be judged for age
     * at a glance instead of being taken on trust.
     * @param iso - the reading instant.
     * @returns local `HH:MM:SS`.
     */
    function formatClock(iso) {
      const at = new Date(iso)
      if (Number.isNaN(at.getTime())) return '--:--:--'
      const pad = (value) => String(value).padStart(2, '0')
      return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
    }

    /**
     * Read the localized label for a window id.
     * @param id - window identity.
     * @param t - the bound locale dictionary.
     * @returns display text.
     */
    function windowLabel(id, t) {
      const key = WINDOW_LABEL[id]
      return key === undefined ? id : t(key)
    }

    /**
     * One remaining-quota row with its gauge.
     * @param props - window data and the bound dictionary.
     * @returns the row element.
     */
    function WindowRow({ window, t }) {
      const accent = severityToken(window.remainingPercent)
      return h(
        'div',
        { className: `${P}-row` },
        h(
          'div',
          { className: `${P}-row__head` },
          h('span', { className: `${P}-row__label` }, windowLabel(window.id, t)),
          h('span', { className: `${P}-row__value`, style: { color: accentText(accent) } },
            formatPercent(window.remainingPercent)),
        ),
        h(
          'div',
          { className: `${P}-track`, role: 'img', 'aria-label': `${windowLabel(window.id, t)} ${formatPercent(window.remainingPercent)}` },
          h('div', { className: `${P}-fill`, style: { width: `${Math.min(100, Math.max(0, window.remainingPercent))}%`, background: accent } }),
        ),
        h('span', { className: `${P}-reset` }, formatReset(window.resetsAt, t)),
      )
    }

    /**
     * The composer-dock quota pill and its detail popover.
     * @param props - slot props plus the injected quota bridge.
     * @returns the pill element.
     */
    function QuotaBadge({ bridge }) {
      const [snapshot, setSnapshot] = useState(null)
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const [open, setOpen] = useState(false)
      const root = useRef(null)

      // The slot owner may rebuild injected props on every render. Reading the
      // bridge through a ref keeps `load` stable: an identity change here would
      // restart the poll effect on each render and turn it into a request loop.
      const bridgeRef = useRef(bridge)
      bridgeRef.current = bridge

      const load = useCallback(async (method) => {
        setBusy(true)
        try {
          setSnapshot(await callQuota(bridgeRef.current.ctx, method))
          setError(null)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy(false)
        }
      }, [])

      useEffect(() => {
        let cancelled = false
        let timer
        // The next poll is scheduled in `finally`, so one stalled or failed read
        // costs a cycle instead of ending the chain.
        const tick = async () => {
          try {
            await load('usage')
          } finally {
            if (!cancelled) timer = setTimeout(tick, POLL_MS)
          }
        }
        tick()
        return () => {
          cancelled = true
          clearTimeout(timer)
        }
      }, [load])

      // A window that was hidden while time passed shows stale numbers: re-read
      // as soon as it becomes visible again.
      useEffect(() => {
        const onVisible = () => {
          if (document.visibilityState === 'visible') load('usage')
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
      }, [load])

      useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        const onPointer = (event) => {
          if (root.current !== null && !root.current.contains(event.target)) setOpen(false)
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('pointerdown', onPointer)
        return () => {
          document.removeEventListener('keydown', onKey)
          document.removeEventListener('pointerdown', onPointer)
        }
      }, [open])

      const t = bridge.t
      const windows = snapshot === null || snapshot.ok !== true ? [] : snapshot.windows
      const worst = windows.reduce((low, w) => Math.min(low, w.remainingPercent), 100)

      const summary = windows.length > 0
        ? windows.map((w) => formatPercent(w.remainingPercent)).join(' · ')
        : error !== null
          ? t('unavailable')
          : t('loading')

      const dotColour = error !== null
        ? 'var(--dsw-alias-state-error-primary)'
        : windows.length === 0
          ? 'var(--dsw-alias-label-secondary)'
          : severityToken(worst)

      return h(
        'div',
        { className: `${P}-root`, ref: root },
        h('style', null, CSS),
        h(
          'button',
          {
            type: 'button',
            className: `${P}-pill`,
            // Opening is the moment the user asks about their quota, so it reads
            // through to the network instead of showing a cached number.
            onClick: () => {
              const next = !open
              setOpen(next)
              if (next) load('refresh')
            },
            title: error === null ? `${t('quota')} — ${summary}` : `${t('quota')} — ${error}`,
            'aria-expanded': open,
          },
          h('span', { className: `${P}-pill__bg` }),
          h('span', { className: `${P}-dot`, style: { background: dotColour, opacity: busy ? 0.45 : 1 } }),
          h('span', { className: `${P}-pill__name` }, t('label')),
          h('span', { className: `${P}-pill__values` }, summary),
        ),
        open
          ? h(
            'div',
            { className: `${P}-panel`, role: 'dialog', 'aria-label': t('quota'), 'data-menu-material': '' },
            h('div', { className: `${P}-panel__bg` }),
            h(
              'div',
              { className: `${P}-head` },
              h('span', { className: `${P}-title` }, t('quota')),
              h(
                'div',
                { className: `${P}-head__meta` },
                snapshot !== null && snapshot.ok === true && typeof snapshot.fetchedAt === 'string'
                  ? h(
                    'span',
                    { className: `${P}-stamp` },
                    `${error === null ? t('updatedAt') : t('stale')} ${formatClock(snapshot.fetchedAt)}`,
                  )
                  : null,
                h(
                  'button',
                  {
                    type: 'button',
                    className: `${P}-action`,
                    onClick: () => load('refresh'),
                    disabled: busy,
                    title: t('refresh'),
                  },
                  busy ? t('refreshing') : t('refresh'),
                ),
              ),
            ),
            windows.length === 0
              ? error === null
                ? h('div', { className: `${P}-state` }, h('span', { className: `${P}-muted` }, t('loading')))
                : null
              : h('div', { className: `${P}-rows` }, windows.map((w) => h(WindowRow, { key: w.id, window: w, t }))),
            // A failed read keeps the last numbers visible but never silently:
            // the reason sits under them, so stale figures cannot pass as current.
            error !== null
              ? h(
                'div',
                { className: `${P}-state` },
                h('span', { className: `${P}-error` }, error),
                h(
                  'button',
                  { type: 'button', className: `${P}-action`, style: { alignSelf: 'flex-start' }, onClick: () => load('refresh') },
                  t('retry'),
                ),
              )
              : null,
          )
          : null,
      )
    }

    /** Services the badge needs: the slot registry, Remote client and locale. */
    const inject = ['slots', 'remote', 'locale']

    /**
     * Mount the quota endpoints and contribute the composer-dock pill.
     * @param ctx - the Client plugin context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'opencode-go-quota: dictionaries')

      // Source mode on the Host derives the endpoints from the service itself,
      // so the Client descriptor only has to name them. Both take no arguments,
      // which is what keeps a hand-written descriptor acceptable here.
      const mounted = ctx.remote.$mount({
        package: '@local/opencode-go-quota',
        descriptors: ['usage', 'refresh'].map((method) => ({
          id: `@local/opencode-go-quota#${SERVICE_KEY}/${method}`,
          service: SERVICE_KEY,
          namespace: SERVICE_KEY,
          method,
          invocation: { kind: 'direct' },
          parameters: [],
          result: { mode: 'src-json' },
        })),
      })
      if (mounted !== undefined && typeof mounted.catch === 'function') {
        mounted.catch((error) => {
          mountFailure = error instanceof Error ? error : new Error(String(error))
          ctx.logger.error(error)
        })
      }

      // The namespace service above is created by the mount, so this scope stays
      // parked until it exists. Declaring it here rather than on the plugin keeps
      // activation from deadlocking on a service this same plugin provides.
      ctx.inject(['slots', 'locale', 'remote', 'remote.opencodeQuota'], (scoped) => {
        scoped.slots.inject('conversation.composer.dock', () => scoped.slots.register({
          name: 'conversation.composer.dock',
          id: ENTRY_ID,
          order: 20,
          locale: NS,
          inject: () => ({ bridge: { ctx: scoped, t: scoped.locale.bind(NS) } }),
        }, QuotaBadge))
      })
    }

    return { inject, apply }
  },
})
