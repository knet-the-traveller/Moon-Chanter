"""Acquire public POWER daily observations without changing legacy fixtures.

Four serial requests; raw response, request URL, retrieval time and checksum are
retained. Run with --cache /private/tmp/fieldshift-power-v1 to resume safely.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
PILOTS = [('munoz', 15.714, 120.906), ('ilagan', 16.975, 121.810),
          ('pototan', 10.952, 122.632), ('bukidnon', 8.156, 125.127)]
VARIABLES = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'RH2M', 'ALLSKY_SFC_SW_DWN']


def acquire(cache):
    cache.mkdir(parents=True, exist_ok=True)
    records = []
    for name, lat, lon in PILOTS:
        url = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + urllib.parse.urlencode({
            'parameters': ','.join(VARIABLES), 'community': 'AG', 'longitude': lon,
            'latitude': lat, 'start': '20140101', 'end': '20231231', 'format': 'JSON',
            'time-standard': 'LST'})
        path = cache / f'{name}.json'
        meta = cache / f'{name}.meta.json'
        if not path.exists():
            with urllib.request.urlopen(url, timeout=90) as response:
                raw = response.read()
            data = json.loads(raw)
            if not all(key in data.get('properties', {}).get('parameter', {}) for key in VARIABLES):
                raise ValueError('Missing POWER variables')
            path.write_bytes(raw)
            meta.write_text(json.dumps({'url': url, 'retrievedAt': datetime.datetime.now(
                datetime.timezone.utc).isoformat().replace('+00:00', 'Z')}))
            time.sleep(1)
        raw = path.read_bytes()
        metadata = json.loads(meta.read_text())
        if metadata['url'] != url:
            raise ValueError('Cached request differs')
        records.append({'id': name, 'lat': lat, 'lon': lon, **metadata,
                        'sha256': hashlib.sha256(raw).hexdigest(), 'payload': json.loads(raw)})
        print(name, 'acquired', flush=True)
    content = json.dumps({'schemaVersion': 1, 'id': 'power-pilots-v1', 'records': records}, separators=(',', ':')) + '\n'
    out = ROOT / 'src/data/real-data/power-v1.json'
    if out.exists() and out.read_text() != content:
        raise ValueError('Refusing to overwrite a different versioned package')
    out.write_text(content)
    with zipfile.ZipFile(ROOT / 'public/data/real-data/power-v1-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, _, _ in PILOTS:
            archive.writestr(zipfile.ZipInfo(f'{name}.json',(2026,11,15,0,0,0)),(cache / f'{name}.json').read_bytes(),compress_type=zipfile.ZIP_DEFLATED)
            archive.writestr(zipfile.ZipInfo(f'{name}.meta.json',(2026,11,15,0,0,0)),(cache / f'{name}.meta.json').read_bytes(),compress_type=zipfile.ZIP_DEFLATED)
    print('Wrote', out, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, required=True)
    acquire(parser.parse_args().cache)
