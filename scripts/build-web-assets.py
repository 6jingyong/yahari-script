"""Encode runtime images without changing source PNGs or resource IDs.
Run after build-action-thumbnails.py. Requires Pillow with WebP support.
"""
from pathlib import Path
from PIL import Image
import hashlib,json
pack=Path(__file__).resolve().parents[1]/'content-packs/courtroom-demo'
assets=pack/'assets'; catalog=json.loads((pack/'catalog.json').read_text()); provenance=json.loads((assets/'sources.json').read_text())
files={x['file'] for x in catalog['resources'].values()}|{'action-thumbnails.png'}
before=after=0; converted={}
for name in sorted(files):
    original=assets/name
    if original.suffix=='.webp':
        original=original.with_suffix('.png')
        if not original.exists(): original=(assets/name).with_suffix('.jpg')
    if original.suffix not in ('.png','.jpg','.jpeg') or not original.exists():continue
    target=original.with_suffix('.webp')
    with Image.open(original) as im:
        im.save(target,'WEBP',quality=88,method=6)
        with Image.open(target) as check:
            check.load(); assert check.size==im.size
            if im.mode=='RGBA':assert check.getchannel('A').tobytes()==im.getchannel('A').tobytes()
    before+=original.stat().st_size;after+=target.stat().st_size
    converted[name]=target.name
    provenance['assets']=[a for a in provenance['assets'] if a['file']!=target.name]
    provenance['assets'].append({'file':target.name,'source':'derived:'+original.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
for descriptor in catalog['resources'].values():
    descriptor['file']=converted.get(descriptor['file'],descriptor['file'])
# Thumbnail source is regenerated in the preceding step.
for a in provenance['assets']:
    if a['file']=='action-thumbnails.png':a['sha256']=hashlib.sha256((assets/a['file']).read_bytes()).hexdigest()
runtime_files={item['file'] for item in catalog['resources'].values()}|{'action-thumbnails.webp'}
missing=sorted(name for name in runtime_files if not (assets/name).is_file())
if missing: raise FileNotFoundError(f'Missing runtime images: {missing}')
for path in assets.iterdir():
    if path.is_file() and path.name not in runtime_files|{'sources.json'}:
        path.unlink()
provenance['assets']=[a for a in provenance['assets'] if a['file'] in runtime_files]
if {a['file'] for a in provenance['assets']}!=runtime_files:
    raise ValueError('Runtime asset provenance is incomplete')
(pack/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
(assets/'sources.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sourceBytes':before,'runtimeBytes':after,'reductionPercent':round((1-after/before)*100,1),'images':len(converted)}))
