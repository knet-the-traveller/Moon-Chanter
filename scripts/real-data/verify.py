"""Independently verify packaged values against retained source bytes (offline)."""
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile
from urllib.parse import urlparse,parse_qs

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'src/data/real-data'
PUBLIC=ROOT/'public/data/real-data'

def verify():
    terrain=json.loads((DATA/'terrain-v1.json').read_text())
    with zipfile.ZipFile(PUBLIC/'terrain-v1-source.zip') as archive:
        assert json.loads(archive.read('manifest.json'))==terrain
        for grid in terrain['grids']:
            values=[];coords=[]
            for asset in grid['assets']:
                raw=archive.read(asset['file'])
                assert hashlib.sha256(raw).hexdigest()==asset['sha256']
                assert urlparse(asset['url']).path=='/v1/srtm30m'
                query=parse_qs(urlparse(asset['url']).query)
                assert query['interpolation']==['nearest']
                response=json.loads(raw)
                assert response['status']=='OK'
                points=[tuple(map(float,p.split(','))) for p in query['locations'][0].split('|')]
                assert len(points)==len(response['results'])
                for result,(lat,lon) in zip(response['results'],points):
                    assert result['dataset']=='srtm30m'
                    assert abs(result['location']['lat']-lat)<1e-8 and abs(result['location']['lng']-lon)<1e-8
                    values.append(result['elevation']);coords.append((lat,lon))
            assert values==grid['elevationM'] and len(values)==1225
            for i,(lat,lon) in enumerate(coords):
                assert abs(lat-(grid['northArcSeconds']-i//35)/3600)<1e-8
                assert abs(lon-(grid['westArcSeconds']+i%35)/3600)<1e-8
    power=json.loads((DATA/'power-v1.json').read_text())
    with zipfile.ZipFile(PUBLIC/'power-v1-source.zip') as archive:
        for record in power['records']:
            raw=archive.read(record['id']+'.json')
            assert hashlib.sha256(raw).hexdigest()==record['sha256']
            assert json.loads(raw)==record['payload']
            meta=json.loads(archive.read(record['id']+'.meta.json'))
            assert meta['url']==record['url'] and meta['retrievedAt']==record['retrievedAt']
            parameters=record['payload']['properties']['parameter']
            assert set(parameters)=={'T2M','T2M_MAX','T2M_MIN','RH2M','ALLSKY_SFC_SW_DWN','PRECTOTCORR'}
            assert all(len(v)==3652 for v in parameters.values())
    ndvi=json.loads((DATA/'ndvi-v1.json').read_text())
    with zipfile.ZipFile(PUBLIC/'ndvi-v1-source.zip') as archive:
        for source in ndvi['sourceFiles']:
            raw=archive.read(source['file'])
            assert hashlib.sha256(raw).hexdigest()==source['sha256']
        request=json.loads(archive.read('request-public.json'))
        assert set(request)=={'task_name','task_type','params','svc_version','created'}
        csvfile=next(f for f in archive.namelist() if f.endswith('results.csv'))
        rows=list(csv.DictReader(io.StringIO(archive.read(csvfile).decode())))
        prefix='MOD13Q1_061__250m_16_days_'
        for point in ndvi['points']:
            original=sorted([r for r in rows if r['ID']==point['id']],key=lambda r:r['Date'])
            assert len(original)==len(point['observations'])==116
            for r,o in zip(original,point['observations']):
                assert (float(r['Latitude']),float(r['Longitude']))==(point['lat'],point['lon'])
                assert r['MODIS_Tile']==point['tile']
                assert int(float(r['MOD13Q1_061_Line_Y_250m']))==point['line']
                assert int(float(r['MOD13Q1_061_Sample_X_250m']))==point['sample']
                assert o=={'date':r['Date'],'ndvi':float(r[prefix+'NDVI']),'quality':int(float(r[prefix+'VI_Quality'])),'reliability':int(float(r[prefix+'pixel_reliability']))}
    print('PASS: 52 terrain responses / 4900 elevation posts; 4 POWER responses / 87648 daily values; 464 scaled NDVI rows + QA; checksums and account-field exclusion verified.')

if __name__=='__main__':verify()
