/**
 * Aset mock untuk screenshot — generator PNG murni Node (tanpa dependensi).
 *
 * - photoPng()      : "foto temuan" 640x640 (rak penyimpanan sederhana)
 * - signaturePng(i) : coretan tanda tangan 480x200 transparan (varian 0/1)
 *
 * Dipakai oleh scripts/screenshot-fitur.mjs agar screenshot tidak memakai
 * logo resmi sebagai foto/tanda tangan (lebih mirip dokumen asli).
 */
import zlib from 'node:zlib'

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
export function encodePng(w, h, rgba) {
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0
    raw.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------- primitif gambar
// rectFill/gradV/disc/stroke ditulis eksplisit agar sederhana & jelas
function rectFill(px, w, h, x0, y0, x1, y1, [r, g, b]) {
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(h, Math.round(y1)); y++)
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(w, Math.round(x1)); x++) {
      const i = (y * w + x) * 4
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
    }
}
function gradV(px, w, h, y0, y1, [r0, g0, b0], [r1, g1, b1]) {
  for (let y = Math.max(0, y0 | 0); y < Math.min(h, y1 | 0); y++) {
    const t = (y - y0) / Math.max(1, y1 - y0)
    const r = Math.round(r0 + (r1 - r0) * t)
    const g = Math.round(g0 + (g1 - g0) * t)
    const b = Math.round(b0 + (b1 - b0) * t)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
    }
  }
}
function disc(px, w, h, cx, cy, rad, [r, g, b], a = 255) {
  const r2 = rad * rad
  for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(h - 1, Math.ceil(cy + rad)); y++)
    for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(w - 1, Math.ceil(cx + rad)); x++) {
      const dx = x - cx, dy = y - cy
      if (dx * dx + dy * dy > r2) continue
      const i = (y * w + x) * 4
      if (a === 255) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255 }
      else {
        const al = a / 255
        px[i] = Math.round(px[i] * (1 - al) + r * al)
        px[i + 1] = Math.round(px[i + 1] * (1 - al) + g * al)
        px[i + 2] = Math.round(px[i + 2] * (1 - al) + b * al)
        px[i + 3] = 255
      }
    }
}
function stroke(px, w, h, pts, rad, color, alpha = 255) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      disc(px, w, h, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rad, color, alpha)
    }
  }
}

// ---------------------------------------------------------------- foto temuan
export function photoPng() {
  const w = 640, h = 640
  const px = new Uint8Array(w * h * 4)

  // dinding (gradasi) + lantai
  gradV(px, w, h, 0, 470, [223, 229, 237], [198, 207, 219])
  rectFill(px, w, h, 0, 470, w, h, [142, 150, 163])
  rectFill(px, w, h, 0, 470, w, 478, [116, 124, 137])
  // garis kuning safety lantai
  rectFill(px, w, h, 0, 566, w, 582, [216, 181, 62])
  // bayangan rak di lantai saja (clip y >= 470)
  for (let y = 474; y < 540; y++) {
    for (let x = 130; x < 510; x++) {
      const dx = x - 320, dy = y - 505
      if (dx * dx + dy * dy > 190 * 190) continue
      const i = (y * w + x) * 4
      px[i] = Math.max(0, px[i] - 24)
      px[i + 1] = Math.max(0, px[i + 1] - 24)
      px[i + 2] = Math.max(0, px[i + 2] - 24)
    }
  }

  // rak: tiang + rak kayu
  const post = [100, 306, 512]
  for (const x of post) rectFill(px, w, h, x, 64, x + 15, 470, [104, 72, 46])
  const shelves = [172, 302, 432]
  for (const y of shelves) rectFill(px, w, h, 92, y, 536, y + 15, [124, 90, 58])

  // kardus di tiap rak
  const boxColors = [[219, 162, 94], [206, 147, 82], [226, 174, 107], [211, 154, 88]]
  const rows = [105, 235, 365]
  rows.forEach((yTop, ri) => {
    const slots = [[112, 196], [206, 290], [330, 414], [424, 508]]
    slots.forEach(([x0, x1], si) => {
      const col = boxColors[(ri + si) % boxColors.length]
      rectFill(px, w, h, x0, yTop, x1, 172 + ri * 130, col)
      // lakban tengah
      rectFill(px, w, h, (x0 + x1) / 2 - 5, yTop, (x0 + x1) / 2 + 5, 172 + ri * 130,
        [col[0] - 45, col[1] - 40, col[2] - 30])
      // label putih
      const yMid = yTop + 22
      rectFill(px, w, h, x0 + 8, yMid, x1 - 8, yMid + 26, [246, 246, 242])
      rectFill(px, w, h, x0 + 13, yMid + 7, x1 - 20, yMid + 11, [80, 88, 100])
      rectFill(px, w, h, x0 + 13, yMid + 15, x1 - 34, yMid + 19, [110, 118, 130])
    })
  })

  // palet bawah
  rectFill(px, w, h, 96, 444, 532, 470, [163, 112, 66])
  rectFill(px, w, h, 96, 458, 532, 470, [139, 94, 55])
  // tiang penyangga bawah rak
  for (const x of post) rectFill(px, w, h, x, 432, x + 15, 470, [92, 63, 40])

  // sedikit "noise" agar tidak terlalu flat
  for (let i = 0; i < 2400; i++) {
    const x = (i * 73) % w
    const y = (i * 149) % h
    const idx = (y * w + x) * 4
    const d = ((i * 31) % 17) - 8
    px[idx] = Math.max(0, Math.min(255, px[idx] + d))
    px[idx + 1] = Math.max(0, Math.min(255, px[idx + 1] + d))
    px[idx + 2] = Math.max(0, Math.min(255, px[idx + 2] + d))
  }

  return encodePng(w, h, px)
}

// ---------------------------------------------------------------- tanda tangan
export function signaturePng(variant = 0) {
  const w = 480, h = 200
  const px = new Uint8Array(w * h * 4) // transparan (alpha 0)
  const color = variant === 0 ? [26, 42, 116] : [20, 55, 105]
  const phase = variant === 0 ? 0.4 : 1.9
  const amp = variant === 0 ? 46 : 38

  // goresan utama (gelombang makin besar ke kanan)
  const pts = []
  for (let x = 40; x <= 430; x += 3) {
    const t = (x - 40) / 390
    const y = 105
      - amp * Math.sin(t * Math.PI * (variant === 0 ? 3 : 3.6) + phase) * (0.45 + 0.55 * t)
      - 26 * Math.sin(t * Math.PI * 7 + phase) * 0.35
      - 14 * t
    pts.push([x, y])
  }
  stroke(px, w, h, pts, 4, color)

  // coretan bawah (swoosh)
  const base = []
  for (let x = 46; x <= 440; x += 4) {
    const t = (x - 46) / 394
    const y = 156 + 16 * Math.sin(t * Math.PI) - 8 * t
    base.push([x, y])
  }
  stroke(px, w, h, base, 2.5, color)

  // loop akhir khas tanda tangan
  const loop = []
  for (let a = 0; a <= Math.PI * 2.1; a += 0.18) {
    loop.push([418 + 26 * Math.cos(a + phase), 128 + 20 * Math.sin(a + phase)])
  }
  stroke(px, w, h, loop, 3, color)

  return encodePng(w, h, px)
}
