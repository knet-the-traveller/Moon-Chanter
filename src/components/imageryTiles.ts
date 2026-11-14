// GIBS can return an opaque, entirely black JPEG for a no-observation tile (HTTP 200).
// Hide only those empty True Color tiles so the disclosed NASA background shows through.
export function hideEmptyTrueColorTile(tile: HTMLImageElement): boolean {
  if (!tile.naturalWidth || !tile.naturalHeight) return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = tile.naturalWidth;
    canvas.height = tile.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return false;
    context.drawImage(tile, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    if (!data.length) return false;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) return false;
    }
    tile.classList.add('field-empty-imagery-tile');
    return true;
  } catch {
    // Keep imagery visible if the browser cannot inspect the cross-origin pixels.
    return false;
  }
}
