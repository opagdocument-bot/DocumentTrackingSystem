/**
 * Shrink a captured page to something storable.
 *
 * The prototype keeps documents in localStorage, which a phone photo would
 * exhaust on its own. Drawing it down to 400px and re-encoding gives a preview
 * of a few tens of kilobytes — enough for a viewer to read the RECEIVED stamp
 * in the audit trail, small enough to keep.
 *
 * Returns undefined for anything that is not an image (a scanned PDF, say), and
 * for any failure: the update still goes through, just without a preview.
 */
const MAX_EDGE = 400

export async function makeThumb(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    return canvas.toDataURL('image/jpeg', 0.55)
  } catch {
    return undefined
  }
}
