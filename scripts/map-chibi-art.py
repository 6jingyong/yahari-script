"""Bind generated chibi art to stable Courtroom resource IDs.

The three lead characters use explicit 4x2 action atlases. Other characters
keep the neutral/gesture/reaction fallback until their richer sheets arrive.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "content-packs/courtroom-demo"
ASSETS = PACK / "assets"
CATALOG = PACK / "catalog.json"
catalog = json.loads(CATALOG.read_text())

gestures = {
    "point", "desk", "cheer", "fist", "science", "smug", "bow", "stern",
    "confident", "accuse", "salute", "camera", "grin", "smile", "laugh",
}
reactions = {
    "sweat", "shocked", "damaged", "mad", "surprised", "sad", "nervous",
    "breakdown", "broken", "confused", "concerned",
}

ACTION_ATLASES = {
    "phoenix": {
        "file": "chibi-phoenix-actions.png",
        "frames": {
            "normal": [3, 5, 33, 64], "point": [43, 3, 43, 66],
            "objection": [87, 2, 46, 67], "desk": [134, 12, 47, 55],
            "think": [1, 68, 37, 66], "shocked": [41, 70, 46, 63],
            "sweat": [95, 69, 35, 65], "smile": [137, 69, 43, 65],
        },
        "portrait": "chibi-phoenix-neutral.png",
    },
    "maya": {
        "file": "chibi-maya-actions.png",
        "frames": {
            "normal": [4, 1, 36, 68], "wave": [46, 3, 42, 66],
            "cheer": [89, 4, 47, 65], "point": [136, 4, 45, 65],
            "think": [7, 67, 36, 67], "surprised": [46, 69, 46, 65],
            "sad": [96, 68, 37, 66], "thumbs-up": [136, 68, 44, 66],
        },
        "portrait": "chibi-maya-neutral.png",
    },
    "edgeworth": {
        "file": "chibi-edgeworth-actions.png",
        "frames": {
            "normal": [3, 6, 34, 65], "bow": [43, 3, 36, 68],
            "point": [92, 4, 43, 67], "objection": [137, 6, 44, 64],
            "desk": [1, 76, 51, 55], "smug": [50, 69, 37, 64],
            "surprised": [87, 71, 45, 62], "damaged": [137, 71, 41, 62],
        },
        "portrait": "chibi-edgeworth-neutral.png",
    },
}

def full_frame(filename: str) -> list[int]:
    with Image.open(ASSETS / filename) as image:
        return [0, 0, image.width, image.height]

for character in catalog["characters"]:
    station = character["stage"]["background"].split("/")[1]
    if station in {"defense", "prosecution", "witness"}:
        character["stage"]["foreground"] = f"stage/{station}/foreground"

    atlas = ACTION_ATLASES.get(character["id"])
    if atlas:
        portrait_ref = f"character/{character['id']}/portrait"
        character["portrait"] = portrait_ref
        catalog["resources"][portrait_ref] = {
            "file": atlas["portrait"],
            "frame": full_frame(atlas["portrait"]),
        }

    for action in (*character["poses"], *character["reactions"]):
        action_id = action["id"]
        if atlas and action_id in atlas["frames"]:
            catalog["resources"][action["asset"]] = {
                "file": atlas["file"],
                "frame": atlas["frames"][action_id],
            }
            continue
        variant = "gesture" if action_id in gestures else "reaction" if action_id in reactions else "neutral"
        filename = f"chibi-{character['id']}-{variant}.png"
        catalog["resources"][action["asset"]] = {
            "file": filename,
            "frame": full_frame(filename),
        }

scene_files = {entry["id"]: f"chibi-{entry['id']}.jpg" for entry in catalog["backgrounds"]}
scene_files.update({
    "stage/defense/background": "chibi-stage-defense.jpg",
    "stage/prosecution/background": "chibi-stage-prosecution.jpg",
    "stage/witness/background": "chibi-witness-stand.jpg",
    "stage/judge/background": "chibi-courtroom.jpg",
    "stage/defense/foreground": "chibi-stage-defense-foreground.png",
    "stage/prosecution/foreground": "chibi-stage-prosecution-foreground.png",
    "stage/witness/foreground": "chibi-stage-witness-foreground.png",
})
for scene in catalog["backgrounds"]:
    if scene["id"] == "witness-stand":
        scene["foreground"] = "stage/witness/foreground"
for resource_id, filename in scene_files.items():
    key = resource_id if resource_id.startswith("stage/") else f"background/{resource_id}"
    catalog["resources"][key] = {"file": filename, "frame": full_frame(filename)}

catalog["version"] = "0.4.0"
CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")

files = sorted({item["file"] for item in catalog["resources"].values() if "file" in item})
sources = {
    "retrieved": "2026-09-28",
    "credit": "AI-generated chibi illustration produced for the Yahari Script prototype",
    "licenseNote": "Generated depictions of Ace Attorney characters remain subject to CAPCOM's underlying character rights. Original game artwork is no longer bundled in this pack.",
    "generation": {
        "mode": "built-in image generation",
        "sourceAtlases": "content-packs/courtroom-demo/art-source/",
        "recipe": "scripts/build-chibi-art.py",
        "mapping": "scripts/map-chibi-art.py",
        "note": "Phoenix, Maya, and Edgeworth expose eight distinct actions from dedicated 4x2 atlases; the remaining cast still uses three representative states.",
    },
    "assets": [
        {"file": name, "source": "generated:chibi-atlas", "sha256": hashlib.sha256((ASSETS / name).read_bytes()).hexdigest()}
        for name in files
    ],
}
(ASSETS / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n")

for path in ASSETS.iterdir():
    if path.is_file() and path.name not in files and path.name != "sources.json":
        path.unlink()
