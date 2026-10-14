# Character rights and generated demo art

Yahari Script is an independent, unofficial authoring and performance-compilation project.
The Courtroom demo now uses generated chibi character illustrations, scene backgrounds,
and transparent courtroom foregrounds. The previous game sprite files and vector
stand-ins are no longer bundled in the active content pack. The source atlases,
cutting recipe, resource mapping, and file hashes are retained under
`content-packs/courtroom-demo/`.

Ace Attorney, its characters, names, logos, and related intellectual property
belong to CAPCOM Co., Ltd. and/or their respective rights holders. Generated
depictions of those characters do not confer ownership or a separate license
to the underlying characters. This unofficial demo is neither endorsed nor
sponsored by CAPCOM. The repository's code license does not grant rights to
third-party characters or trademarks.

General effects, typewriter blips and music remain original procedural 8Bit
audio generated from note/timing metadata. No original game music is bundled.

The demo additionally includes 17 short Japanese character callouts obtained
from [Court Records' audio directory](https://www.court-records.net/audio.htm),
covering Phoenix, Edgeworth, Mia, Apollo, Franziska, Manfred von Karma, Godot,
Kristoph and Klavier. These are game recordings whose rights belong to CAPCOM
and/or the respective rights holders. Public availability of the files does
not grant a reuse or commercial license; the code license does not cover them.
Each source URL, file size, duration and SHA-256 is recorded in
`content-packs/courtroom-demo/voice-clips.json`. Original downloaded bytes are
retained under `assets/voices/`; the generated runtime embeds those bytes so
the player can play them offline. See [action sounds](docs/ACTION_SOUNDS.md).
