"""Import AppEEARS scaled point CSV, preserving QA and public source evidence.
Never publish the account-bearing original request JSON. Its public parameters
are copied through an explicit allowlist. Existing versioned output is immutable.
"""
import argparse
import csv
import datetime
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[2]
BASE='fieldshift-ndvi-2020-2024-pilots-v1'
PREFIX='MOD13Q1_061__250m_16_days_'
PILOTS={'munoz':(15.714,120.906),'ilagan':(16.975,121.810),'pototan':(10.952,122.632),'bukidnon':(8.156,125.127)}

def convert(folder):
    csvpath=folder/(BASE+'-MOD13Q1-061-results.csv')
    request=json.loads((folder/(BASE+'-request.json')).read_text())
    expected_layers={'_250m_16_days_NDVI','_250m_16_days_VI_Quality','_250m_16_days_pixel_reliability'}
    if request['task_type']!='point' or {x['layer'] for x in request['params']['layers']}!=expected_layers or any(x['product']!='MOD13Q1.061' for x in request['params']['layers']):
        raise ValueError('Unexpected product/request')
    groups={key:[] for key in PILOTS}
    identity={}
    for row in csv.DictReader(csvpath.open()):
        key=row['ID'];lat,lon=PILOTS[key]
        if float(row['Latitude'])!=lat or float(row['Longitude'])!=lon:raise ValueError('Coordinates differ')
        date=datetime.date.fromisoformat(row['Date'])
        if not datetime.date(2019,12,19)<=date<=datetime.date(2024,12,31):raise ValueError('Unexpected date')
        pixel={'tile':row['MODIS_Tile'],'line':int(float(row['MOD13Q1_061_Line_Y_250m'])),'sample':int(float(row['MOD13Q1_061_Sample_X_250m']))}
        if key in identity and identity[key]!=pixel:raise ValueError('Mixed native pixels')
        identity[key]=pixel
        def number(name):
            value=row[PREFIX+name]
            if value in ('','NaN','nan'):return None
            return float(value)
        ndvi=number('NDVI');quality=number('VI_Quality');reliability=number('pixel_reliability')
        # AppEEARS has ALREADY applied scale 0.0001. Preserve the scaled fill
        # sentinel (-0.3) as null rather than a plausible vegetation value.
        if ndvi==-0.3:ndvi=None
        elif ndvi is not None and not -0.2<=ndvi<=1:raise ValueError('Unexpected NDVI scale/range')
        if quality is not None and not quality.is_integer():raise ValueError('Fractional QA flag')
        if reliability is not None and not reliability.is_integer():raise ValueError('Fractional reliability flag')
        quality=None if quality is None or quality==65535 else int(quality)
        reliability=None if reliability is None or reliability==-1 else int(reliability)
        groups[key].append({'date':date.isoformat(),'ndvi':ndvi,'quality':quality,'reliability':reliability})
    points=[]
    for key,(lat,lon) in PILOTS.items():
        rows=sorted(groups[key],key=lambda r:r['date'])
        if len(rows)!=116 or len({r['date'] for r in rows})!=116:raise ValueError('Missing or duplicate composites')
        points.append({'id':key,'lat':lat,'lon':lon,**identity[key],'observations':rows})
    files={}
    for suffix in ['-MOD13Q1-061-results.csv','-MOD13Q1-061-metadata.xml','-granule-list.txt']:
        path=folder/(BASE+suffix);files[path.name]=path.read_bytes()
    files['README.md']=(folder/'README.md').read_bytes()
    # Explicitly exclude user_id and any future private fields in NASA output.
    public_request={key:request[key] for key in ['task_name','task_type','params','svc_version','created']}
    files['request-public.json']=(json.dumps(public_request,indent=2)+'\n').encode()
    manifest=[{'file':name,'sha256':hashlib.sha256(raw).hexdigest()} for name,raw in files.items()]
    data={'schemaVersion':1,'id':'mod13q1-pilots-v1','product':'MOD13Q1.061','source':'NASA MODIS Terra via AppEEARS 3.137',
          'citation':'https://doi.org/10.5067/MODIS/MOD13Q1.061','requestedPeriod':'2020-01-01/2024-12-31',
          'scaleAlreadyApplied':True,'retrievedAt':None,'sourceFiles':manifest,'points':points}
    content=json.dumps(data,separators=(',',':'))+'\n'
    out=ROOT/'src/data/real-data/ndvi-v1.json'
    if out.exists() and out.read_text()!=content:raise ValueError('Refusing to replace a different versioned package')
    out.write_text(content)
    with zipfile.ZipFile(ROOT/'public/data/real-data/ndvi-v1-source.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for name,raw in files.items():
            info=zipfile.ZipInfo(name,(2026,11,15,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;archive.writestr(info,raw)
    print('Imported',sum(len(p['observations']) for p in points),'scaled observations; account fields excluded')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);convert(parser.parse_args().input)
