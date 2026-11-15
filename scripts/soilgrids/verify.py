"""Offline numerical audit: manifest, native rasters, nodata and geographic bounds.

Run after acquiring data. The source URL/checksum/time of every raster is retained.
Optional --live re-reads one source window per hub to independently spot-check.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import transform
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[2]



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

def verify(live=False):
    package = json.loads((ROOT / 'src/data/soilgrids/pilots-v1.json').read_text())
    checked = 0
    with zipfile.ZipFile(ROOT / 'public/data/soilgrids/pilots-v1-rasters.zip') as archive:
        assert json.loads(archive.read('manifest.json')) == package, 'Archive manifest differs'
        assert archive.read('DATA_LICENSE.txt') == (ROOT / 'public/data/soilgrids/DATA_LICENSE.txt').read_bytes()
        assert len(archive.namelist()) == 146 and len(set(archive.namelist())) == 146
        for grid in package['grids']:
            valid = 0
            for asset in grid['assets']:
                data = archive.read(asset['archivePath'])
                assert hashlib.sha256(data).hexdigest() == asset['sha256'], 'Raster checksum differs'
                with rasterio.open(io.BytesIO(data)) as ds:
                    assert ds.shape == (9, 9) and ds.nodata == -32768
                    assert ds.crs.to_dict() == CRS.from_string(package['crs']).to_dict()
                    assert ds.transform.a == 250 and ds.transform.e == -250
                    assert list(ds.bounds) == grid['nativeBounds']
                    raw = ds.read(1).reshape(-1)
                    values = [None if v == -32768 else int(v) for v in raw]
                    assert values == grid['readings'][asset['property']][asset['depth']][asset['statistic']]
                    if asset['property'] == 'phh2o' and asset['depth'] == '0-5cm' and asset['statistic'] == 'mean':
                        valid = sum(v is not None for v in values)
                        xs, ys = zip(*(ds.transform * (c, r) for r in range(10) for c in range(10)))
                        lons, lats = transform(ds.crs, 'EPSG:4326', xs, ys)
                        assert np.allclose(np.column_stack([lons, lats]), grid['nodes'], atol=1e-9, rtol=0)
                        if live:
                            # Fresh original tile read, not the clipped raster or WCS.
                            with rasterio.Env(GDAL_HTTP_TIMEOUT=25, GDAL_HTTP_MAX_RETRY=0,
                                              GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'):
                                with rasterio.open('/vsicurl/' + asset['url']) as source:
                                    row, col = source.index(ds.bounds.left, ds.bounds.top)
                                    actual = source.read(1, window=Window(col, row, 9, 9))
                                    assert native_parameters(source.crs) == native_parameters(CRS.from_string(package['crs']))
                                    assert source.nodata == -32768 and np.array_equal(actual.reshape(-1), raw)
                checked += 1
            print(f"{grid['id']}: {valid}/81 valid top-depth pH cells; preset raw value {grid['readings']['phh2o']['0-5cm']['mean'][40]}")
    print(f'PASS: {checked} raster checksums/arrays and all native grids; live source checks={4 if live else 0}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true')
    verify(parser.parse_args().live)
