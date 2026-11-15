"""Acquire native 1 arc-second SRTM posts via the public Open Topo Data mirror.
Serial requests, <=100 posts/request, >=1.1 seconds between requests. Retain
responses/checksums for audit. Re-run with the same cache to resume.
"""
import argparse,datetime,hashlib,json,time,urllib.request,urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PILOTS=[('munoz',15.714,120.906),('ilagan',16.975,121.810),('pototan',10.952,122.632),('bukidnon',8.156,125.127)]
SIZE=35  # 33 x 33 usable posts plus a one-post slope halo (~1 km extent)
BASE='https://api.opentopodata.org/v1/srtm30m'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
def acquire(cache):
 cache.mkdir(parents=True,exist_ok=True)
 grids=[]
 for name,lat,lon in PILOTS:
  north=round(lat*3600)+SIZE//2;west=round(lon*3600)-SIZE//2
  points=[((north-r)/3600,(west+c)/3600) for r in range(SIZE) for c in range(SIZE)]
  values=[];assets=[]
  for start in range(0,len(points),100):
   batch=points[start:start+100];path=cache/f'{name}-{start}.json';meta=path.with_suffix('.meta.json')
   url=BASE+'?'+urllib.parse.urlencode({'locations':'|'.join(f'{a:.10f},{b:.10f}' for a,b in batch),'interpolation':'nearest'})
   if not path.exists():
    for attempt in range(4):
     try:
      with urllib.request.urlopen(url,timeout=30) as response: raw=response.read()
      payload=json.loads(raw)
      if payload.get('status')!='OK':raise ValueError(str(payload)[:200])
      path.write_bytes(raw);meta.write_text(json.dumps({'url':url,'retrievedAt':now()}));break
     except Exception:
      if attempt==3:raise
      time.sleep(3*(attempt+1))
    time.sleep(1.1)
   raw=path.read_bytes();payload=json.loads(raw);record=json.loads(meta.read_text())
   if record['url']!=url or payload.get('status')!='OK' or len(payload['results'])!=len(batch):raise ValueError('Invalid cache/response')
   for item,(a,b) in zip(payload['results'],batch):
    if item['dataset']!='srtm30m' or abs(item['location']['lat']-a)>1e-8 or abs(item['location']['lng']-b)>1e-8:raise ValueError('Coordinate/dataset mismatch')
    value=item['elevation']
    if value is not None and (not isinstance(value,(int,float)) or not -500<=value<=9000):raise ValueError('Invalid elevation')
    values.append(value)
   assets.append({**record,'sha256':hashlib.sha256(raw).hexdigest(),'file':path.name})
   print(name,start,'acquired',flush=True)
  grids.append({'id':name,'lat':lat,'lon':lon,'rows':SIZE,'cols':SIZE,'northArcSeconds':north,'westArcSeconds':west,'elevationM':values,'assets':assets})
 data={'schemaVersion':1,'id':'srtm-pilots-v1','source':'NASA/USGS SRTM GL1 v003 via Open Topo Data','sourceUrl':BASE,'citation':'https://doi.org/10.5067/MEaSUREs/SRTM/SRTMGL1.003','licenseUrl':'https://www.usa.gov/government-copyright','observationPeriod':'2000-02-11/2000-02-21','verticalDatum':'EGM96 geoid','resolutionArcSeconds':1,'retrievedAt':max(a['retrievedAt'] for g in grids for a in g['assets']),'grids':grids}
 out=ROOT/'src/data/real-data/terrain-v1.json';content=json.dumps(data,separators=(',',':'))+'\n'
 if out.exists() and out.read_text()!=content:raise ValueError('Refusing to overwrite a different versioned package')
 out.write_text(content)
 import zipfile
 with zipfile.ZipFile(ROOT/'public/data/real-data/terrain-v1-source.zip','w',zipfile.ZIP_DEFLATED) as archive:
  for grid in grids:
   for asset in grid['assets']:archive.writestr(zipfile.ZipInfo(asset['file'],(2026,11,15,0,0,0)),(cache/asset['file']).read_bytes(),compress_type=zipfile.ZIP_DEFLATED)
  archive.writestr(zipfile.ZipInfo('manifest.json',(2026,11,15,0,0,0)),content,compress_type=zipfile.ZIP_DEFLATED)
 print('Wrote',out,flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);acquire(p.parse_args().cache)
