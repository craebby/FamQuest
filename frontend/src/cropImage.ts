import type { Area } from 'react-easy-crop'

/** Kantenlänge der gespeicherten Profilbilder (das Backend skaliert ohnehin auf diese Größe). */
export const AVATAR_SIZE = 512

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image load failed'))
    image.src = src
  })
}

/**
 * Schneidet den gewählten Bereich aus und liefert ein quadratisches Bild.
 * WebP, wo der Browser es erzeugen kann, sonst PNG (z. B. Safari); das Backend nimmt beides.
 */
export async function cropToBlob(src: string, area: Area, size = AVATAR_SIZE): Promise<Blob> {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas not supported')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encoding failed'))),
      'image/webp',
      0.9,
    ),
  )
}
