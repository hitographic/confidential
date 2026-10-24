/**
 * Cache "stale-while-revalidate" (SWR) untuk data dari Google Apps Script.
 *
 * Prinsipnya: tampilkan data cache SEGERA (tanpa spinner), lalu segarkan
 * diam-diam di background. Ini yang membuat halaman list langsung muncul
 * saat user kembali dari form, tanpa menunggu cold-start GAS (2-4 dtk).
 *
 * TTL default 5 menit; bisa dioverride per pemanggilan.
 */

const PREFIX = 'matrika_swr:'

/** Map key -> promise in-flight, agar request identik tidak dobel. */
const inflight = new Map()

export function swrKey(scope, params) {
  return `${scope}:${JSON.stringify(params || {})}`
}

export function swrRead(key, ttlMs = 5 * 60 * 1000) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (!data) return null
    if (ttlMs > 0 && Date.now() - ts > ttlMs) return null
    return data
  } catch {
    return null
  }
}

export function swrWrite(key, data) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    /* kuota penuh — abaikan, bukan fatal */
  }
}

export function swrInvalidate(scope) {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(PREFIX + scope + ':')) sessionStorage.removeItem(k)
    }
  } catch {
    /* noop */
  }
}

/**
 * Jalankan fetcher dengan cache SWR.
 * @param {string} scope  'list' | 'departemen' | 'checklist' | ...
 * @param {object} params parameter unik (ikut jadi bagian key)
 * @param {Function} fetcher () => Promise<any>
 * @param {object} [opts] { ttlMs, force }
 *   force=true -> abaikan permintaan in-flight yang sedang berjalan dan
 *   buat request baru (dipakai setelah aksi tulis, agar tidak dapat data basi).
 * @returns {Promise<any>}
 */
export function swr(scope, params, fetcher, opts = {}) {
  const key = swrKey(scope, params)
  const ttl = opts.ttlMs ?? 5 * 60 * 1000

  // dedupe request identik yang sedang berjalan
  if (!opts.force) {
    const running = inflight.get(key)
    if (running) return running
  }

  const job = (async () => {
    try {
      const fresh = await fetcher()
      // hanya cache respons sukses
      if (fresh && fresh.success !== false) swrWrite(key, fresh)
      return fresh
    } finally {
      // jangan hapus penanda in-flight milik request yang lebih baru
      if (inflight.get(key) === job) inflight.delete(key)
    }
  })()

  inflight.set(key, job)
  return job
}

/**
 * Ambil data list: cache dulu (langsung tampil), lalu revalidate.
 * onResult dipanggil dua kali bila ada cache: (cached, true) lalu (fresh, false).
 */
export function swrWithCache(scope, params, fetcher, { ttlMs, onResult }) {
  const key = swrKey(scope, params)
  const cached = swrRead(key, ttlMs)
  if (cached) onResult(cached, true)
  return swr(scope, params, fetcher, { ttlMs }).then((fresh) => {
    onResult(fresh, false)
    return fresh
  })
}
