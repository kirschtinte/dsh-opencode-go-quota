/**
 * Host half of the OpenCode Go quota bundle.
 *
 * This module deliberately imports nothing: a profile-installed bundle resolves
 * bare specifiers against its own directory, which holds no Harness packages.
 * Everything it needs is reached through `ctx` or plain ECMAScript.
 *
 * The service is exposed to the browser half over Typert Gateway's *source
 * mode*, which derives a wire descriptor from runtime reflection instead of a
 * generated artifact. That derivation reads two things off the service:
 *
 *   - an own `typertRemote` binding naming the service key and wire namespace;
 *   - a `remote-methods` prototype descriptor listing the exported methods.
 *
 * Source-mode parameter names come from parsing each method's source text, so
 * exported methods must be ordinary class methods with a plain, empty parameter
 * list. `usage` and `refresh` take no arguments for that reason, and because the
 * Client refuses a mounted descriptor whose parameters carry no strict codec.
 */

/** Wire namespace and Cordis service key; both are the same endpoint segment. */
const SERVICE_KEY = 'opencodeQuota'

/** Prototype property the Typert protocol reads its Remote markers from. */
const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'

/** Default OpenCode Go API root; `/v1/usage` is appended. */
const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go'

/** Credential reference holding the OpenCode Go key, as the provider row names it. */
const DEFAULT_CREDENTIAL_REF = 'OPENCODE_GO_API_KEY'

/** How long a snapshot stays fresh before the next read goes back to the network. */
const DEFAULT_REFRESH_MS = 60_000

/** Floor for the configured interval, so a misconfiguration cannot hammer the API. */
const MIN_REFRESH_MS = 5_000

/** Upper bound for one HTTP round trip. */
const REQUEST_TIMEOUT_MS = 15_000

/**
 * Sent so OpenCode can attribute this traffic to a coding agent rather than a
 * generic HTTP client; the session header matches the provider rows in
 * `cordis.patch.yml`.
 */
const USER_AGENT = 'deepseek-harness/opencode-go-quota'
const SESSION_LABEL = 'deepseek-harness'

/** Window identities, in the order the API returns them and the UI shows them. */
const WINDOW_ORDER = ['rolling', 'weekly', 'monthly']

/**
 * Resolve the configured row config into a frozen options object.
 * @param config - the Loader row's `config`, which may be absent entirely.
 * @returns resolved options with defaults applied.
 */
function normalizeOptions(config) {
  const source = config !== null && typeof config === 'object' ? config : {}
  const refreshMs = Number(source.refreshMs)
  const baseUrl = typeof source.baseUrl === 'string' && source.baseUrl.length > 0
    ? source.baseUrl.replace(/\/+$/, '')
    : DEFAULT_BASE_URL
  const credentialRef = typeof source.credentialRef === 'string' && source.credentialRef.length > 0
    ? source.credentialRef
    : DEFAULT_CREDENTIAL_REF
  return Object.freeze({
    baseUrl,
    credentialRef,
    refreshMs: Number.isFinite(refreshMs) && refreshMs >= MIN_REFRESH_MS ? refreshMs : DEFAULT_REFRESH_MS,
  })
}

/**
 * Read the API key for this connection.
 *
 * The credentials service keeps secret values out of configuration, so it is
 * asked first; a launch environment variable is the fallback for compositions
 * that mount no credential store.
 * @param ctx - the plugin context.
 * @param ref - credential reference name.
 * @returns the key, or `undefined` when it is unset.
 */
async function resolveApiKey(ctx, ref) {
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    const hit = await credentials.resolve(ref)
    const value = hit === null || hit === undefined ? undefined : hit.value
    if (typeof value === 'string' && value.length > 0) return value
  }
  const fromEnvironment = process.env[ref]
  return typeof fromEnvironment === 'string' && fromEnvironment.length > 0 ? fromEnvironment : undefined
}

/**
 * Coerce one usage window from the wire into the plain JSON the Client renders.
 * @param id - window identity.
 * @param raw - the window object as returned by the API.
 * @returns the window, or `undefined` when the payload is unusable.
 */
function normalizeWindow(id, raw) {
  if (raw === null || typeof raw !== 'object') return undefined
  const used = Number(raw.percent)
  if (!Number.isFinite(used)) return undefined
  const clamped = Math.min(100, Math.max(0, used))
  return {
    id,
    status: typeof raw.status === 'string' ? raw.status : 'unknown',
    usedPercent: clamped,
    remainingPercent: Math.round((100 - clamped) * 100) / 100,
    resetsAt: typeof raw.resetsAt === 'string' ? raw.resetsAt : null,
  }
}

/**
 * Build a failure snapshot. Failures are values rather than throws: the Client
 * renders the reason, and a thrown Remote call would only report a transport
 * fault instead.
 * @param code - stable machine-readable reason.
 * @param message - human-readable reason.
 * @returns the failure snapshot.
 */
function failure(code, message) {
  return { ok: false, code, message, fetchedAt: new Date().toISOString() }
}

/**
 * Fetch and normalize the current usage snapshot.
 * @param options - resolved plugin options.
 * @param ctx - the plugin context, for credential resolution.
 * @returns a success or failure snapshot; never throws.
 */
async function requestUsage(ctx, options) {
  let apiKey
  try {
    apiKey = await resolveApiKey(ctx, options.credentialRef)
  } catch (error) {
    return failure('credential-read-failed', `Could not read ${options.credentialRef}: ${describeError(error)}`)
  }
  if (apiKey === undefined) {
    return failure('credential-missing', `No ${options.credentialRef} credential is stored or exported.`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${options.baseUrl}/v1/usage`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
        'user-agent': USER_AGENT,
        'x-opencode-session': SESSION_LABEL,
      },
      signal: controller.signal,
    })

    if (response.status === 401 || response.status === 403) {
      return failure('unauthorized', `${options.credentialRef} was rejected by OpenCode Go (HTTP ${response.status}).`)
    }
    if (!response.ok) {
      return failure('http-error', `OpenCode Go returned HTTP ${response.status}.`)
    }

    const payload = await response.json()
    const usage = payload === null || typeof payload !== 'object' ? undefined : payload.usage
    if (usage === null || typeof usage !== 'object') {
      return failure('malformed-response', 'The usage response carried no usage object.')
    }

    const windows = []
    for (const id of WINDOW_ORDER) {
      const window = normalizeWindow(id, usage[id])
      if (window !== undefined) windows.push(window)
    }
    if (windows.length === 0) {
      return failure('malformed-response', 'The usage response carried no readable windows.')
    }

    return { ok: true, windows, fetchedAt: new Date().toISOString() }
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.name === 'AbortError') {
      return failure('timeout', `OpenCode Go did not answer within ${REQUEST_TIMEOUT_MS} ms.`)
    }
    return failure('network-error', describeError(error))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Render an unknown thrown value as a readable single line.
 * @param error - the thrown value.
 * @returns the message.
 */
function describeError(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Remote-facing quota service. `usage` serves the cache and `refresh` bypasses
 * it, so a user-driven refresh never races the background cadence.
 */
class OpenCodeGoQuotaService {
  /**
   * @param ctx - the plugin context.
   * @param options - resolved plugin options.
   */
  constructor(ctx, options) {
    this.ctx = ctx
    this.options = options
    /** Last successful read and the time it was taken, or `null`. */
    this.cached = null
    /** In-flight read, so concurrent callers share one request. */
    this.pending = null
  }

  /**
   * Current snapshot, served from cache while it is fresh.
   * @returns the usage snapshot.
   */
  async usage() {
    return await this.read(false)
  }

  /**
   * Force a fresh read.
   * @returns the usage snapshot.
   */
  async refresh() {
    return await this.read(true)
  }

  /**
   * Read the snapshot, reusing the cache unless it is stale or bypassed.
   * @param force - whether to ignore a fresh cache entry.
   * @returns the usage snapshot.
   */
  async read(force) {
    const now = Date.now()
    if (!force && this.cached !== null && now - this.cached.at < this.options.refreshMs) {
      return this.cached.snapshot
    }
    if (this.pending !== null) return await this.pending

    const pending = requestUsage(this.ctx, this.options)
    this.pending = pending
    try {
      const snapshot = await pending
      if (snapshot.ok === true) this.cached = { at: Date.now(), snapshot }
      return snapshot
    } finally {
      this.pending = null
    }
  }
}

// The marker `Remote()` would write for `@Remote usage()` / `@Remote refresh()`.
// Declared literally because this bundle cannot import the decorator.
Object.defineProperty(OpenCodeGoQuotaService.prototype, REMOTE_METHOD_DESCRIPTOR, {
  configurable: true,
  value: Object.freeze({
    version: 1,
    methods: Object.freeze([
      Object.freeze({ method: 'usage', invocation: Object.freeze({ kind: 'direct' }) }),
      Object.freeze({ method: 'refresh', invocation: Object.freeze({ kind: 'direct' }) }),
    ]),
  }),
})

/**
 * Activate the quota service.
 * @param ctx - the plugin context.
 * @param config - the Loader row's config.
 */
export function apply(ctx, config) {
  const options = normalizeOptions(config)
  const service = new OpenCodeGoQuotaService(ctx, options)
  service.typertRemote = Object.freeze({
    service,
    serviceKey: SERVICE_KEY,
    namespace: SERVICE_KEY,
  })
  // `ctx.provide` is itself fiber-owned, so unloading the bundle withdraws the
  // service and every Remote endpoint derived from it.
  ctx.provide(SERVICE_KEY, service)
}
