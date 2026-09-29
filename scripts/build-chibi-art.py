"""Cut the approved generated atlases into Courtroom demo resources.

Run from the repository root. The source atlases are retained in art-source/
so subsequent art passes can preserve character designs and scene palette.
"""
from pathlib import Path
from io import BytesIO
from PIL import Image
from install_action_sheets import install as install_action_sheets

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content-packs/courtroom-demo/art-source"
DEST = ROOT / "content-packs/courtroom-demo/assets"

def save_verified(image: Image.Image, path: Path) -> None:
    """Encode in memory, then check both the encoded bytes and the disk copy."""
    for attempt in range(3):
        buffer = BytesIO()
        if path.suffix == ".jpg":
            image.save(buffer, format="JPEG", quality=88, subsampling=0)
        else:
            image.save(buffer, format="PNG", compress_level=6)
        data = buffer.getvalue()
        with Image.open(BytesIO(data)) as check:
            check.load()
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(data)
        try:
            with Image.open(temporary) as check:
                check.load()
            temporary.replace(path)
            return
        except (OSError, ValueError):
            temporary.unlink(missing_ok=True)
    raise RuntimeError(f"Could not write a decodable PNG: {path}")

CAST = [
    ("cast-core.webp", ["phoenix", "edgeworth", "maya", "judge", "witness"], 5),
    ("cast-support-a.webp", ["von-karma", "gumshoe", "mia"], 3),
    ("cast-support-b.webp", ["apollo", "klavier", "ema"], 3),
    ("cast-support-c.webp", ["trucy", "lotta", "yogi"], 3),
]

SCENES = [
    ("courtroom-atlas.webp", 2, ["courtroom", "stage-defense", "stage-prosecution", "witness-stand"]),
    ("investigation-atlas-a.webp", 3, ["lobby", "office", "police-records", "detention-room", "prosecutor-office", "evidence-room"]),
    ("investigation-atlas-b.webp", 3, ["lake-dock", "boathouse", "elevator-hall", "records-basement", "parking-garage", "hospital-room"]),
]

for filename, names, columns in CAST:
    image = Image.open(SOURCE / filename).convert("RGBA")
    for row, variant in enumerate(("neutral", "gesture", "reaction")):
        for col, name in enumerate(names):
            x0, x1 = round(col * image.width / columns), round((col + 1) * image.width / columns)
            y0, y1 = round(row * image.height / 3), round((row + 1) * image.height / 3)
            cell = image.crop((x0, y0, x1, y1))
            bounds = cell.getchannel("A").getbbox()
            if not bounds:
                raise ValueError(f"Empty cell: {name}/{variant}")
            figure = cell.crop(bounds)
            figure.thumbnail((490, 375), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (512, 384))
            canvas.alpha_composite(figure, ((512 - figure.width) // 2, 384 - figure.height))
            save_verified(canvas, DEST / f"chibi-{name}-{variant}.png")

install_action_sheets()

for filename, columns, names in SCENES:
    image = Image.open(SOURCE / filename).convert("RGB")
    rows = len(names) // columns
    for index, name in enumerate(names):
        col, row = index % columns, index // columns
        x0, x1 = round(col * image.width / columns), round((col + 1) * image.width / columns)
        y0, y1 = round(row * image.height / rows), round((row + 1) * image.height / rows)
        cell = image.crop((x0, y0, x1, y1))
        # The renderer is 4:3. Crop symmetrically instead of distorting the art.
        target_width = min(cell.width, round(cell.height * 4 / 3))
        target_height = min(cell.height, round(cell.width * 3 / 4))
        left = (cell.width - target_width) // 2
        top = (cell.height - target_height) // 2
        cell = cell.crop((left, top, left + target_width, top + target_height))
        save_verified(cell.resize((768, 576), Image.Resampling.LANCZOS), DEST / f"chibi-{name}.jpg")

save_verified(Image.open(SOURCE / "night-corridor.webp").convert("RGB").resize(
    (768, 576), Image.Resampling.LANCZOS
), DEST / "chibi-night-corridor.jpg")

for name, filename in [
    ("interview-room", "interview-room.png"),
    ("forensics-lab", "forensics-lab.png"),
    ("apartment", "apartment.png"),
    ("courthouse-exterior", "courthouse-exterior.png"),
    ("spirit-village", "spirit-village.png"),
    ("evidence-warehouse", "evidence-warehouse.png"),
    ("apartment-stairwell", "apartment-stairwell.png"),
    ("consultation-room", "consultation-room.png"),
]:
    image = Image.open(SOURCE / filename).convert("RGB")
    target_width = min(image.width, round(image.height * 4 / 3))
    target_height = min(image.height, round(image.width * 3 / 4))
    left = (image.width - target_width) // 2
    top = (image.height - target_height) // 2
    scene = image.crop((left, top, left + target_width, top + target_height))
    save_verified(scene.resize((768, 576), Image.Resampling.LANCZOS), DEST / f"chibi-{name}.jpg")

overlay = Image.open(SOURCE / "courtroom-foregrounds.webp").convert("RGBA")
for col, name in enumerate(("stage-defense-foreground", "stage-prosecution-foreground", "stage-witness-foreground")):
    x0, x1 = round(col * overlay.width / 3), round((col + 1) * overlay.width / 3)
    cell = overlay.crop((x0, 0, x1, overlay.height))
    bounds = cell.getchannel("A").getbbox()
    if not bounds:
        raise ValueError(f"Empty foreground: {name}")
    bench = cell.crop(bounds).resize((768, 176), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (768, 576))
    canvas.alpha_composite(bench, (0, 400))
    save_verified(canvas, DEST / f"chibi-{name}.png")
