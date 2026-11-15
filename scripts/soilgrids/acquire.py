"""Acquire native SoilGrids cells without resampling or replacing masked pixels.

Usage: python scripts/soilgrids/acquire.py --cache /tmp/fieldshift-soilgrids-v1
Cached downloads allow an interrupted acquisition to resume. Use a NEW cache and
package ID for a later release: ISRIC's /latest/ endpoint is mutable.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import time
import urllib.request
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
import rasterio
from rasterio.crs import CRS as RasterCRS
from rasterio.transform import Affine
from rasterio.warp import transform
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[2]
BASE = 'https://files.isric.org/soilgrids/latest/data/'
CRS = '+proj=igh +datum=WGS84 +units=m +no_defs'
DEPTHS = ['0-5cm', '5-15cm']
STATS = {'mean': 'mean', 'q05': 'Q0.05', 'q95': 'Q0.95'}
PROPERTIES = {
    'phh2o': {'mappedUnit': 'pH x 10', 'divisor': 10, 'unit': 'pH'},
    'clay': {'mappedUnit': 'g/kg', 'divisor': 10, 'unit': '%'},
    'sand': {'mappedUnit': 'g/kg', 'divisor': 10, 'unit': '%'},
    'silt': {'mappedUnit': 'g/kg', 'divisor': 10, 'unit': '%'},
    'soc': {'mappedUnit': 'dg/kg', 'divisor': 100, 'unit': '% SOC'},
    'bdod': {'mappedUnit': 'cg/cm3', 'divisor': 100, 'unit': 'g/cm3'},
}
# Existing preset coordinates, not municipality-wide profiles or farm locations.
PILOTS = [('munoz', 'Science City of Muñoz', 15.714, 120.906),
          ('ilagan', 'City of Ilagan', 16.975, 121.810),
          ('pototan', 'Pototan', 10.952, 122.632),
          ('bukidnon', 'Malaybalay', 8.156, 125.127)]
SIZE = 9



def native_parameters(crs):
    # Original tiles name the WGS84 ellipsoid but leave the datum unnamed.
    # ISRIC's master VRT assigns WGS84 (the documented reference used here).
    # Normalize this representation only; do not accept a different ellipsoid,
    # projection, units or numeric projection parameters.
    parameters = crs.to_dict()
    if parameters.get('datum') == 'WGS84':
        del parameters['datum']
        parameters['ellps'] = 'WGS84'
    return parameters

def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def download(url, path):
    if path.exists():
        return path.read_bytes()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                data = response.read(8_000_001)
            if len(data) > 8_000_000:
                raise ValueError('Unexpectedly large VRT')
            path.write_bytes(data)
            return data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def select_source(root, row, col):
    for source in root.findall('.//ComplexSource') + root.findall('.//SimpleSource'):
        rect = source.find('DstRect')
        x, y, w, h = (int(float(rect.get(key))) for key in ('xOff', 'yOff', 'xSize', 'ySize'))
        if x <= col and y <= row and col + SIZE <= x + w and row + SIZE <= y + h:
            src = source.find('SrcRect')
            if float(src.get('xSize')) != w or float(src.get('ySize')) != h:
                raise ValueError('Unexpected VRT resampling')
            return source, Window(col - x + int(src.get('xOff')), row - y + int(src.get('yOff')), SIZE, SIZE)
    raise ValueError('Pilot grid crosses a source tile or lacks coverage; do not silently clip')


def acquire(cache):
    cache.mkdir(parents=True, exist_ok=True)
    package = {
        'schemaVersion': 1, 'id': 'soilgrids-pilots-v1', 'productVersion': '2.0.0',
        'sourceUrl': BASE, 'citation': 'https://doi.org/10.5194/soil-7-217-2021',
        'license': 'CC-BY-4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'attribution': 'ISRIC — World Soil Information; SoilGrids 2.0 (Poggio et al., 2021). FieldShift extracted native pilot grids and converted nodata to null.',
        'observationPeriod': None, 'processingVersion': 'fieldshift-soilgrids-1',
        'crs': CRS, 'resolutionM': 250, 'nodata': -32768, 'properties': PROPERTIES,
        'depths': DEPTHS, 'grids': [],
    }
    archives = []
    grids = {}
    for property_name in PROPERTIES:
        for depth in DEPTHS:
            for statistic, suffix in STATS.items():
                layer = f'{property_name}_{depth}_{suffix}'
                vrt_url = f'{BASE}{property_name}/{layer}.vrt'
                vrt = download(vrt_url, cache / f'{layer}.vrt')
                root = ET.fromstring(vrt)
                # Provider WKT names differ from standard WGS84 names; compare
                # canonical projection parameters rather than those labels.
                if RasterCRS.from_wkt(root.findtext('SRS')).to_dict() != RasterCRS.from_string(CRS).to_dict():
                    raise ValueError('Unexpected source projection')
                affine = Affine.from_gdal(*(float(v) for v in root.findtext('GeoTransform').split(',')))
                if (affine.a, affine.e, affine.b, affine.d) != (250, -250, 0, 0):
                    raise ValueError('Unexpected grid geometry')
                version = root.find(".//MDI[@key='Code_version']")
                if version is None or version.text != 'v2.0.0':
                    raise ValueError('Unexpected SoilGrids version')
                for pilot_id, name, lat, lon in PILOTS:
                    x, y = transform('EPSG:4326', CRS, [lon], [lat])
                    c, r = ~affine * (x[0], y[0])
                    col, row = math.floor(c) - SIZE // 2, math.floor(r) - SIZE // 2
                    grid_affine = affine * Affine.translation(col, row)
                    if pilot_id not in grids:
                        xs, ys = zip(*(grid_affine * (c, r) for r in range(SIZE + 1) for c in range(SIZE + 1)))
                        lons, lats = transform(CRS, 'EPSG:4326', xs, ys)
                        left, top = grid_affine * (0, 0)
                        right, bottom = grid_affine * (SIZE, SIZE)
                        grids[pilot_id] = {
                            'id': pilot_id, 'name': name, 'center': {'lat': lat, 'lon': lon},
                            'rows': SIZE, 'cols': SIZE, 'nativeBounds': [left, bottom, right, top],
                            'nodes': [[round(a, 9), round(b, 9)] for a, b in zip(lons, lats)],
                            'readings': {}, 'assets': [],
                        }
                    grid = grids[pilot_id]
                    source, window = select_source(root, row, col)
                    tile_url = urljoin(vrt_url, source.findtext('SourceFilename'))
                    if urlparse(tile_url).netloc != 'files.isric.org' or not tile_url.startswith(BASE):
                        raise ValueError('Unexpected source hostname/path')
                    clipped = cache / f'{pilot_id}-{layer}.tif'
                    metadata_path = clipped.with_suffix('.json')
                    if not clipped.exists() or not metadata_path.exists():
                        for attempt in range(3):
                            try:
                                with rasterio.Env(GDAL_HTTP_TIMEOUT=25, GDAL_HTTP_MAX_RETRY=0,
                                                  GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'):
                                    with rasterio.open('/vsicurl/' + tile_url) as ds:
                                        if ds.nodata != -32768 or ds.transform.a != 250 or ds.transform.e != -250 or native_parameters(ds.crs) != native_parameters(RasterCRS.from_string(CRS)):
                                            raise ValueError('Unexpected source nodata/resolution')
                                        if not np.allclose(tuple(ds.window_transform(window)), tuple(grid_affine), atol=0.001, rtol=0):
                                            raise ValueError('Source and VRT geometries differ')
                                        values = ds.read(1, window=window)
                                if values.shape != (SIZE, SIZE):
                                    raise ValueError('Incomplete raster window')
                                with rasterio.open(clipped, 'w', driver='GTiff', width=SIZE, height=SIZE,
                                                   count=1, dtype='int16', crs=CRS, transform=grid_affine,
                                                   nodata=-32768, compress='deflate') as out:
                                    out.write(values, 1)
                                metadata_path.write_text(json.dumps({'retrievedAt': now(), 'url': tile_url}))
                                break
                            except Exception:
                                if attempt == 2:
                                    raise
                                time.sleep(2 * (attempt + 1))
                        time.sleep(0.15)  # serial acquisition; no burst of public requests
                    with rasterio.open(clipped) as ds:
                        if ds.nodata != -32768 or ds.shape != (SIZE, SIZE) or ds.transform != grid_affine or native_parameters(ds.crs) != native_parameters(RasterCRS.from_string(CRS)):
                            raise ValueError('Invalid cached raster')
                        values = ds.read(1).reshape(-1)
                    raw = [None if int(v) == -32768 else int(v) for v in values]
                    grid['readings'].setdefault(property_name, {}).setdefault(depth, {})[statistic] = raw
                    record = json.loads(metadata_path.read_text())
                    if record['url'] != tile_url:
                        raise ValueError('Cache source changed')
                    grid['assets'].append({
                        'property': property_name, 'depth': depth, 'statistic': statistic,
                        'url': tile_url, 'vrtUrl': vrt_url, 'vrtSha256': digest(vrt),
                        'sha256': digest(clipped.read_bytes()), 'retrievedAt': record['retrievedAt'],
                        'archivePath': clipped.name,
                    })
                    archives.append(clipped)
                print(f'Acquired {layer} for four pilot grids', flush=True)
    package['grids'] = list(grids.values())
    package['retrievedAt'] = max(asset['retrievedAt'] for grid in grids.values() for asset in grid['assets'])
    output = ROOT / 'src/data/soilgrids/pilots-v1.json'
    content = json.dumps(package, separators=(',', ':'), ensure_ascii=False) + '\n'
    if output.exists() and output.read_text() != content:
        raise ValueError('Versioned package already exists with different data. Use a new package ID/path/schema.')
    output.write_text(content)
    archive_path = ROOT / 'public/data/soilgrids/pilots-v1-rasters.zip'
    with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        def add(name, content):
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, content)
        for path in archives:
            add(path.name, path.read_bytes())
        add('manifest.json', json.dumps(package, ensure_ascii=False, indent=2))
        add('DATA_LICENSE.txt', (ROOT / 'public/data/soilgrids/DATA_LICENSE.txt').read_text())
    (archive_path.parent / 'SHA256SUMS').write_text(
        f'{digest(output.read_bytes())}  src/data/soilgrids/pilots-v1.json\n'
        f'{digest(archive_path.read_bytes())}  public/data/soilgrids/pilots-v1-rasters.zip\n')
    print(f'Wrote {output} ({output.stat().st_size} bytes) and {archive_path}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True)
    acquire(parser.parse_args().cache)
