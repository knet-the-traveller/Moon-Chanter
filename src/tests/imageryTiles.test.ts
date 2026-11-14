import { afterEach, describe, expect, it, vi } from 'vitest';
import { hideEmptyTrueColorTile } from '../components/imageryTiles';

afterEach(() => vi.unstubAllGlobals());
describe('empty NASA True Color tile fallback', () => {
  it.each([
    [[0, 0, 0, 255, 0, 0, 0, 255], true],
    [[0, 0, 0, 255, 0, 1, 0, 255], false],
    [[255, 255, 255, 255], false],
    [[], false]
  ] as const)('hides only entirely black imagery: %j', (pixels, expected) => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({
      drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(pixels) })
    }) }) });
    const tile = { naturalWidth: 2, naturalHeight: 1, classList: { add: vi.fn() } };
    expect(hideEmptyTrueColorTile(tile as unknown as HTMLImageElement)).toBe(expected);
    expect(tile.classList.add).toHaveBeenCalledTimes(expected ? 1 : 0);
  });

  it('preserves the tile when canvas access is denied', () => {
    vi.stubGlobal('document', { createElement: () => { throw new Error('Canvas unavailable'); } });
    const tile = { naturalWidth: 2, naturalHeight: 1, classList: { add: vi.fn() } };
    expect(hideEmptyTrueColorTile(tile as unknown as HTMLImageElement)).toBe(false);
    expect(tile.classList.add).not.toHaveBeenCalled();
  });
});
