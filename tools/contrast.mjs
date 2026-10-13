/*
 * Reads the shipped theme stylesheet and reports contrast ratios for the quota
 * popover in both colour schemes. Not part of the plugin; a verification aid.
 *
 * Usage: node tools/contrast.mjs [harness-root-or-theme-js-or-app.asar]
 *        DSH_THEME_PATH=/path/to/theme/lib/client.js node tools/contrast.mjs
 */
import { existsSync, readFileSync, statSync } from 'node:fs'

/** Path of the theme module inside a Harness installation. */
const THEME_MODULE = 'node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'

/** Placements we can guess without being told. */
const CANDIDATES = [
  process.argv[2],
  process.env.DSH_THEME_PATH,
  // A source checkout: packages/client/ui-theme.
  process.argv[2] === undefined ? undefined : `${process.argv[2]}/${THEME_MODULE}`,
  '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar',
  `${process.env.HOME ?? ''}/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/${THEME_MODULE}`,
].filter((candidate) => typeof candidate === 'string' && candidate.length > 0)

/**
 * Read one file out of an asar archive. Desktop Harness ships its whole tree
 * inside `app.asar`, which is a single file rather than a directory, so the
 * theme module is unreachable through ordinary path resolution.
 * @param archive - path to the `.asar` file.
 * @param inner - slash-separated path inside the archive.
 * @returns the file text, or `undefined` when the archive has no such entry.
 */
function readFromAsar(archive, inner) {
  const handle = readFileSync(archive)
  // Pickle header: four little-endian u32s, then the JSON directory, then two
  // padding bytes before the first payload.
  const jsonSize = handle.readUInt32LE(12)
  const base = 16 + jsonSize + 2
  let node = JSON.parse(handle.subarray(16, 16 + jsonSize).toString('utf8'))
  for (const segment of inner.split('/')) {
    node = node?.files?.[segment]
    if (node === undefined) return undefined
  }
  if (node.offset === undefined) return undefined
  const start = base + Number(node.offset)
  return handle.subarray(start, start + Number(node.size)).toString('utf8')
}

/** Resolve the theme stylesheet source from whatever the caller pointed at. */
function loadThemeSource() {
  for (const candidate of CANDIDATES) {
    if (!existsSync(candidate)) continue
    if (statSync(candidate).isFile() && candidate.endsWith('.asar')) {
      const inner = readFromAsar(candidate, `dsh/${THEME_MODULE}`)
      if (inner !== undefined) return { path: `${candidate}!dsh/${THEME_MODULE}`, text: inner }
      continue
    }
    if (statSync(candidate).isFile()) return { path: candidate, text: readFileSync(candidate, 'utf8') }
  }
  return undefined
}

const theme = loadThemeSource()
if (theme === undefined) {
  console.error('contrast: cannot find the Harness theme package.')
  console.error('Pass the Harness root, its app.asar, or the theme module itself,')
  console.error('or set DSH_THEME_PATH. Tried:')
  for (const candidate of CANDIDATES) console.error(`  ${candidate}`)
  process.exit(1)
}

const sheet = theme.text.slice(theme.text.indexOf('body{--dsw-static-amber-100'))
if (sheet.length === 0) {
  console.error(`contrast: ${theme.path} carries no theme stylesheet; is this the right package?`)
  process.exit(1)
}

/** Slice out one `selector{...}` block's declarations. */
function block(start) {
  const i = sheet.indexOf(start)
  const j = sheet.indexOf('}', i)
  const out = {}
  for (const kv of sheet.slice(i, j).matchAll(/(--dsw-[a-z0-9-]+)\s*:\s*([^;]+)/g)) out[kv[1]] = kv[2].trim()
  return out
}

/** Follow `var(...)` chains to a literal. */
function resolve(name, table, depth = 0) {
  if (depth > 12) return null
  const value = table[name]
  if (value === undefined) return null
  const indirect = /^var\((--[a-z0-9-]+)\)$/.exec(value)
  return indirect ? resolve(indirect[1], table, depth + 1) : value
}

/** Parse #rgb, #rrggbb or #rrggbbaa into [r, g, b, a]. */
function color(text) {
  if (typeof text !== 'string') return null
  const m = /^#([0-9a-f]{3,8})$/i.exec(text.trim())
  if (m === null) return null
  let hex = m[1]
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('') + 'ff'
  if (hex.length === 6) hex += 'ff'
  if (hex.length !== 8) return null
  const n = parseInt(hex, 16)
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, (n & 255) / 255]
}

/** Source-over composite of `fg` (with alpha) onto opaque `bg`. */
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))

/** Mix two colours the way `color-mix(in srgb, a P%, b)` does. */
function mix(a, pa, b) {
  const pb = 1 - pa
  const alpha = pa * a[3] + pb * b[3]
  const rgb = [0, 1, 2].map((i) => (a[i] * pa * a[3] + b[i] * pb * b[3]) / alpha)
  return [...rgb, alpha]
}

const channel = (v) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (rgb) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const schemes = {
  LIGHT: { ...block('body{--dsw-static'), ...block('body{--dsw-alias-bg-base') },
  DARK: { ...block('body{--dsw-static'), ...block('body[data-ds-dark-theme]{--dsw-alias-bg-base') },
}

for (const [name, table] of Object.entries(schemes)) {
  const base = color(resolve('--dsw-alias-bg-base', table))
  const label = color(resolve('--dsw-alias-label-primary', table))
  const secondary = color(resolve('--dsw-alias-label-secondary', table))
  const idle = color(resolve('--dsw-alias-state-idle-primary', table))
  const success = color(resolve('--dsw-alias-state-success-primary', table))
  const black = color(resolve('--dsw-static-neutral-1000', table))

  // Mirrors the stylesheet: the popover and pill are black-tinted glass, at a
  // different alpha per colour scheme, composited over the app surface.
  const dark = name === 'DARK'
  const PANEL = dark ? 0.50 : 0.07
  const PILL = dark ? 0.58 : 0.10

  const panel = [black[0], black[1], black[2], PANEL]
  const panelOver = over(panel, base)

  console.log(`\n== ${name} ==`)
  console.log(`  popover background        rgb(${panelOver.map((v) => Math.round(v)).join(', ')})`)
  console.log(`  effective opacity         ${(panel[3] * 100).toFixed(1)}%`)
  const row = (label_, value) => console.log(`  ${label_.padEnd(24)}${value.toFixed(2)}:1`)
  row('title / labels / value', contrast(label, panelOver))
  row('reset line (new)', contrast(secondary, panelOver))
  row('reset line (was)', contrast(idle, panelOver))
  row('green value (folded)', contrast(over(mix(success, 0.58, label), panelOver), panelOver))
  row('green value (raw)', contrast(over(success, panelOver), panelOver))

  const pillOver = over([black[0], black[1], black[2], PILL], base)
  console.log('  -- pill at rest --')
  row('pill name / values', contrast(label, pillOver))
  row('pill status dot', contrast(success, pillOver))
}
