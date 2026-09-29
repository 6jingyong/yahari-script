# Runtime art pipeline — 2026-09-29

All 24 characters use generated eight-pose raster action sheets. The final nine vector placeholders were replaced for Apollo, Klavier, Ema, Trucy, Larry, von Karma, Lotta, Yogi and Mia. Resource IDs and action IDs remain stable.

Original PNGs and dedicated portraits remain in art-source. Browser runtime uses WebP derivatives with unchanged dimensions and alpha, quality 88. Rebuild in order: build-chibi-art.py → map-chibi-art.py → build-action-thumbnails.py → build-web-assets.py → npm run check → node scripts/build-static.mjs. Do not run atlas builders concurrently. Static output includes only active runtime resources. Intermediate PNG/JPEG/SVG derivatives are regenerated from art-source when needed and are not kept in the working tree.

Generated artwork was visually reviewed as sheets. Automated checks validate hashes, bounds and populated cells; these do not establish animation quality. These are still representative poses, not lip-synced animations.

## Historical art notes

# Q 版素材第一轮

现有资源 ID 和剧本动作保持兼容。24 名角色有常态、强调动作、情绪反应的基础透明立绘；23 个场景使用同组环境插画风格；辩护席、检方席和证人席有独立透明前景。24 名角色现已全部拥有独立 8 状态动作页；旧基础立绘保留作兼容资源；正式动作使用独立八姿态动作页。狩魔冥和春美是可选角色，没有加入原有案例的默认出场阵容。

源图在 `art-source/`。独立动作图、可选的独立头像及 4×2 格顺序由 `action-sheets.json` 声明；动作页可以是 PNG，也可以是带明确宽高的仓库原创 SVG。新增或修改动作图时运行 `python scripts/install_action_sheets.py`，再运行 `python scripts/map-chibi-art.py` 更新资源帧与哈希，最后执行 `npm run check`。修改场景源图时运行 `python scripts/build-chibi-art.py` 重建 768×576 场景图，再更新哈希。正式演出以 `catalog.json` 中的稳定 Resource ID 为准，新增动作先在角色能力中声明，再绑定资源，不直接靠文件名推断能力。

生成提示词概述：透明底、统一二头身的法庭角色表情图；暖木色与青绿色阴影的法庭和调查场景；法庭席位的透明前景。新增的讯问室、科学鉴定室、公寓客厅、雨后法院正门、灵媒村中庭和旧仓库为无人物、无文字的 4:3 环境图，保留下方角色立绘空间。春美的八状态透明动作页包含平常、思考、指向、反驳、祈祷、开心、紧张与震惊。角色头像使用 512×384 的独立透明画布，场景和前景为 768×576。生成方式为内置 imagegen，切图仅做裁剪、缩放和透明画布布局。

第二轮新增雨夜公寓楼梯间和法院会谈室两个独立场景，源图分别为 `art-source/apartment-stairwell.png` 和 `art-source/consultation-room.png`，沿现有 4:3 场景流程缩放到 768×576。编辑器动作图标改用 `assets/action-thumbnails.png`（24 角色 × 8 动作、64×64 格），从正式演出资源构建：`python scripts/build-action-thumbnails.py`。它只供目录与动作选择器使用，演出仍读取完整动作页；新增角色或动作后必须重建缩略图并更新素材哈希。

第三轮新增戈多和美柳千奈美。两人的透明 4×2 动作页各有八种独立姿态，头像单独由常态格制作；戈多默认检方席、美柳千奈美默认证人席，不进入原案例默认阵容。源图及头像见 `art-source/godot-*` 与 `art-source/dahlia-*`，构建索引由 `action-sheets.json` 声明。动作标签与完整图集只在角色被选中后参与演出，缩略图图集覆盖 18×8 格。

第四轮新增希月心音、夕神迅、牙琉雾人、亚内武文、华宫雾绪、绫芽，共 6 人、48 个独立姿态；当前共 24 人、192 个动作。心音和雾人默认辩护席，夕神迅和亚内默认检方席，雾绪和绫芽默认证人席；均为可选角色，不改变原案例阵容。每张透明 4×2 图集保留内置 imagegen 源图，首格常态经裁剪、等比缩放、透明画布布局形成独立 512×384 头像。动作顺序见 action-sheets.json。缩略图更新为 1536×512（24×8 格）。生成提示统一要求：二头半身 Q 版、完整人物、透明背景、每人八种不同动作、无文字和背景；角色特色动作包含耳机聆听、手刀异议、推眼镜、擦汗、翻阅笔记、祈祷。
