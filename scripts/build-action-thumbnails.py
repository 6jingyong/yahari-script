"""Build a small editor-only atlas; preview keeps the full-resolution art."""
import json
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "content-packs/courtroom-demo"
ASSETS = PACK / "assets"
catalog = json.loads((PACK / "catalog.json").read_text())
characters = catalog["characters"]
tile = 64
atlas = Image.new("RGBA", (tile * len(characters), tile * 8))

with tempfile.TemporaryDirectory() as temporary:
    for col, character in enumerate(characters):
        actions = character["poses"] + character["reactions"]
        if len(actions) != 8:
            raise ValueError(f"Expected eight actions for {character['id']}")
        loaded = {}
        for row, action in enumerate(actions):
            descriptor = catalog["resources"][action["asset"]]
            name = descriptor["file"]
            if name not in loaded:
                source = ASSETS / name
                if source.suffix == ".svg":
                    raster = Path(temporary) / (source.stem + ".png")
                    # The source uses SVG2 href on <use>. Inkscape's batch
                    # renderer needs the legacy xlink spelling for these refs.
                    compatible = Path(temporary) / name
                    svg = source.read_text()
                    compatible.write_text(svg.replace('<svg xmlns=',
                        '<svg xmlns:xlink="http://www.w3.org/1999/xlink" xmlns=', 1
                    ).replace('<use href=', '<use xlink:href='))
                    subprocess.run([
                        "inkscape", str(compatible), "--export-width=512",
                        f"--export-filename={raster}",
                    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    loaded[name] = Image.open(raster).convert("RGBA")
                else:
                    loaded[name] = Image.open(source).convert("RGBA")
            image = loaded[name]
            x, y, w, h = descriptor["frame"]
            if name.endswith(".svg"):
                # Rasterize at a quarter-size preview, then scale the catalog
                # crop from its SVG source dimensions to the rasterized sheet.
                match = re.search(r'<svg[^>]*\bwidth="([0-9.]+)"', svg)
                if not match:
                    raise ValueError(f"SVG has no numeric width: {name}")
                scale = image.width / float(match.group(1))
                x, y, w, h = [round(value * scale) for value in (x, y, w, h)]
            crop = image.crop((x, y, x + w, y + h))
            crop.thumbnail((tile - 4, tile - 4), Image.Resampling.LANCZOS)
            atlas.alpha_composite(crop, (col * tile + (tile - crop.width) // 2,
                                         row * tile + (tile - crop.height) // 2))

atlas.save(ASSETS / "action-thumbnails.png", optimize=True)
print(f"Action thumbnails: {len(characters)} characters, {len(characters)*8} actions, {atlas.width}x{atlas.height}")
