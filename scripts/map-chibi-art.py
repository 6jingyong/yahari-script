"""Bind the chibi render pass to existing stable Courtroom resource IDs."""
import hashlib
import json
from pathlib import Path

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

render_sizes = {
    "chibi-phoenix-neutral.png": (256, 192),
    "chibi-phoenix-gesture.png": (256, 192),
    "chibi-phoenix-reaction.png": (256, 192),
    "chibi-maya-neutral.png": (256, 192),
    "chibi-maya-gesture.png": (256, 192),
    "chibi-maya-reaction.png": (160, 120),
    "chibi-edgeworth-neutral.png": (160, 120),
    "chibi-edgeworth-gesture.png": (160, 120),
    "chibi-edgeworth-reaction.png": (160, 120),
}

for character in catalog["characters"]:
    station = character["stage"]["background"].split("/")[1]
    if station in {"defense", "prosecution", "witness"}:
        character["stage"]["foreground"] = f"stage/{station}/foreground"
    for action in (*character["poses"], *character["reactions"]):
        action_id = action["id"]
        variant = "gesture" if action_id in gestures else "reaction" if action_id in reactions else "neutral"
        filename = f"chibi-{character['id']}-{variant}.png"
        width, height = render_sizes.get(filename, (512, 384))
        catalog["resources"][action["asset"]] = {
            "file": filename,
            "frame": [0, 0, width, height],
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
    catalog["resources"][key] = {"file": filename}

catalog["version"] = "0.3.0"
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
        "note": "Each character has neutral, gesture, reaction artwork. Related legacy action IDs may share one of these three pictures until dedicated poses are drawn.",
    },
    "assets": [
        {"file": name, "source": "generated:chibi-atlas", "sha256": hashlib.sha256((ASSETS / name).read_bytes()).hexdigest()}
        for name in files
    ],
}
(ASSETS / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n")
for path in ASSETS.iterdir():
    if path.name not in files and path.name != "sources.json":
        path.unlink()
print(f"Mapped {len(catalog['characters'])} characters, {len(catalog['backgrounds'])} scenes, {len(files)} images")
