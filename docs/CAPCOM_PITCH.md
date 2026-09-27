# Yahari Script — note for CAPCOM

> Independent technical prototype. Not affiliated with or endorsed by CAPCOM.

## English

Yahari Script is an open-source structured script authoring and performance-compilation framework.

The project began by asking a narrow question: can a writer describe a story naturally, while software keeps dialogue, character state, stage direction, camera focus, assets, validation, and runtime presentation synchronized?

Its current Courtroom adapter uses an Ace Attorney-like presentation model as a demanding reference implementation. The goal is not to reproduce an Ace Attorney game engine. The goal is to separate **story structure** from **presentation rules**, so the same structured script can be validated, edited, generated with AI, and compiled through different adapters.

### What is already implemented

- Work → chapter → scene hierarchy instead of a flat dialogue list.
- Rich dialogue with typed, character-aware action tokens.
- Adapter-bound capabilities: each character only exposes actions the selected presentation adapter can perform.
- Deterministic compilation from authored script to a runtime performance plan.
- Story-to-script generation with explicit character detection and mandatory human binding before generation.
- Fact ledgers and scene contracts intended to reduce hallucinated continuity when AI expands prose into scenes.
- Portable project import/export and browser-first mobile editing.
- Asset preloading and rehearsal playback.

### Why this may be relevant to CAPCOM

The architecture could support internal or community-facing tooling for narrative-heavy titles without tying authoring UX directly to one runtime implementation.

Possible directions include:

1. A modern authoring tool for courtroom-style scenes.
2. AI-assisted conversion of prose/design notes into structured first-pass scripts, with human approval at character and scene boundaries.
3. A reusable adapter layer for different generations of presentation systems.
4. Automated validation of unsupported character actions, missing assets, continuity, and scene contracts.
5. Community creation workflows where the executable/presentation layer remains controlled while authored story data stays portable.

The repository currently uses some Ace Attorney visual assets only as a prototype demonstration. They are explicitly separated from the core architecture, attributed in a third-party asset manifest, and can be removed or replaced on request.

If CAPCOM has interest in the authoring/compiler concept, the project is intentionally open to feedback, redesign, asset replacement, licensing discussion, or an official adapter maintained under CAPCOM's preferred constraints.

## 日本語

Yahari Script（矢張スクリプト）は、構造化されたシナリオ執筆と演出コンパイルを分離するオープンソースの技術プロトタイプです。

現在の Courtroom Adapter は、逆転裁判のような法廷演出を厳しい参照例として利用していますが、目的はゲームエンジンの複製ではありません。文章・会話・人物状態・演出指示・カメラ・素材・検証を構造化し、同じシナリオデータを異なる Adapter へコンパイルできる仕組みを検証しています。

現在は、章／シーン階層、人物ごとの実行可能アクション、構造化トークン、演出プランへの決定的コンパイル、AI による物語からシナリオへの変換、人物の手動バインド、事実台帳、インポート／エクスポート、ブラウザ上のリハーサル再生などを実装しています。

CAPCOM の権利物である画像はコア実装から分離しており、出典を明記した試作素材として扱っています。権利者から要請があれば削除・置換できる構造です。

この考え方が公式のシナリオ制作ツール、内部制作支援、あるいはコミュニティ向け創作環境に応用可能であれば、仕様変更・素材置換・ライセンス条件を含め、CAPCOM の方針に合わせて再設計できます。
