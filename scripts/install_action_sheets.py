"""Install only the declared action sheets, without recutting legacy art."""
from io import BytesIO
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content-packs/courtroom-demo/art-source"
DEST = ROOT / "content-packs/courtroom-demo/assets"


def install() -> None:
    manifest = json.loads((SOURCE / "action-sheets.json").read_text())
    if manifest["layout"] != "4x2":
        raise ValueError("Only 4x2 action sheets are supported")
    for sheet in manifest["sheets"]:
        actions = sheet["actions"]
        if len(actions) != 8 or len(set(actions)) != 8:
            raise ValueError(f"Expected eight unique actions: {sheet['id']}")
        with Image.open(SOURCE / sheet["source"]) as source:
            image = source.convert("RGBA")
        width, height = image.size
        if width < 512 or height < 256:
            raise ValueError(f"Action sheet is only a preview: {sheet['source']}")
        for index, action in enumerate(actions):
            x0 = round(index % 4 * width / 4)
            x1 = round((index % 4 + 1) * width / 4)
            y0 = round(index // 4 * height / 2)
            y1 = round((index // 4 + 1) * height / 2)
            if not image.crop((x0, y0, x1, y1)).getchannel("A").getbbox():
                raise ValueError(f"Empty action cell: {sheet['id']}/{action}")
        buffer = BytesIO()
        image.save(buffer, format="PNG", compress_level=6)
        data = buffer.getvalue()
        with Image.open(BytesIO(data)) as check:
            check.load()
        output = DEST / sheet["file"]
        temporary = output.with_suffix(".tmp")
        temporary.write_bytes(data)
        with Image.open(temporary) as check:
            check.load()
        temporary.replace(output)
        if "portraitSource" in sheet:
            with Image.open(SOURCE / sheet["portraitSource"]) as source:
                portrait = source.convert("RGBA")
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
