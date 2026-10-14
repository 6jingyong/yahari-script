"""Install only the declared action sheets, without recutting legacy art."""
from io import BytesIO
import json
from pathlib import Path
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content-packs/courtroom-demo/art-source"
DEST = ROOT / "content-packs/courtroom-demo/assets"


def install() -> None:
    manifest = json.loads((SOURCE / "action-sheets.json").read_text(encoding="utf-8"))
    if manifest["layout"] != "4x2":
        raise ValueError("Only 4x2 action sheets are supported")
    for sheet in manifest["sheets"]:
        actions = sheet["actions"]
        if len(actions) != 8 or len(set(actions)) != 8:
            raise ValueError(f"Expected eight unique actions: {sheet['id']}")
        source_path = SOURCE / sheet["source"]
        output = DEST / sheet["file"]
        temporary = output.with_suffix(".tmp")
        if source_path.suffix.lower() == ".svg":
            data = source_path.read_bytes()
            text = data.decode("utf-8")
            width_match = re.search(r'<svg[^>]*\bwidth="([0-9.]+)"', text)
            height_match = re.search(r'<svg[^>]*\bheight="([0-9.]+)"', text)
            if not width_match or not height_match:
                raise ValueError(f"SVG action sheet needs numeric dimensions: {sheet['source']}")
            width, height = float(width_match.group(1)), float(height_match.group(1))
            if width < 512 or height < 256:
                raise ValueError(f"Action sheet is only a preview: {sheet['source']}")
            temporary.write_bytes(data)
            temporary.replace(output)
        else:
            with Image.open(source_path) as source:
                image = source.convert("RGBA")
            width, height = image.size
            if width < 512 or height < 256:
                raise ValueError(f"Action sheet is only a preview: {sheet['source']}")
            cells = []
            rows = sheet.get("sourceRows", [[0, round(height / 2)], [round(height / 2), height]])
            if (len(rows) != 2 or any(len(row) != 2 or not 0 <= row[0] < row[1] <= height for row in rows)
                    or rows[0][1] > rows[1][0]):
                raise ValueError(f"Invalid source row crops: {sheet['id']}")
            for index, action in enumerate(actions):
                x0 = round(index % 4 * width / 4)
                x1 = round((index % 4 + 1) * width / 4)
                y0, y1 = rows[index // 4]
                cell = image.crop((x0, y0, x1, y1))
                bounds = cell.getchannel("A").getbbox()
                if not bounds:
                    raise ValueError(f"Empty action cell: {sheet['id']}/{action}")
                cells.append(cell.crop(bounds))
            if sheet.get("framing") == "waist-up":
                # A common scale keeps head sizes stable across this actor's
                # gestures. Only layout and resampling: never repaint the art.
                scale = min(480 / max(cell.width for cell in cells),
                            360 / max(cell.height for cell in cells))
                image = Image.new("RGBA", (2048, 768))
                for index, cell in enumerate(cells):
                    cell = cell.resize((max(1, round(cell.width * scale)),
                                        max(1, round(cell.height * scale))), Image.Resampling.LANCZOS)
                    image.alpha_composite(cell, (index % 4 * 512 + (512 - cell.width) // 2,
                                                 index // 4 * 384 + 372 - cell.height))
            buffer = BytesIO()
            image.save(buffer, format="PNG", compress_level=6)
            data = buffer.getvalue()
            with Image.open(BytesIO(data)) as check:
                check.load()
            temporary.write_bytes(data)
            with Image.open(temporary) as check:
                check.load()
            temporary.replace(output)
        if sheet.get("portraitMode") == "first-action":
            if source_path.suffix.lower() == ".svg":
                raise ValueError("First-action portraits require a raster action sheet")
            if actions[0] != "normal":
                raise ValueError(f"Neutral portrait must be first: {sheet['id']}")
            portrait = image.crop((0, 0, 512, 384))
            portrait.save(SOURCE / sheet["portraitSource"], format="PNG", compress_level=6)
        elif "portraitSource" in sheet:
            with Image.open(SOURCE / sheet["portraitSource"]) as source:
                portrait = source.convert("RGBA")
        else:
            portrait = None
        if portrait is not None:
            if portrait.width < 256 or portrait.height < 192 or not portrait.getchannel("A").getbbox():
                raise ValueError(f"Invalid portrait: {sheet['portraitSource']}")
            portrait_output = DEST / sheet["portrait"]
            portrait_temporary = portrait_output.with_suffix(".tmp")
            portrait.save(portrait_temporary, format="PNG", compress_level=6)
            with Image.open(portrait_temporary) as check:
                check.load()
            portrait_temporary.replace(portrait_output)
        print(f"Installed {sheet['id']}: {len(actions)} actions")


if __name__ == "__main__":
    install()
