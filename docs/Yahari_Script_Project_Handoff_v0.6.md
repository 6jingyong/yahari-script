# Yahari Script（矢张剧本）项目交接文档 v0.6

> 本版是在当前已确认方向上继续收敛，目标是把“概念设计”推进到可以直接进入 MVP 工程实现的接口级定义。
>
> 当前项目正式名称：**Yahari Script / 矢张剧本**
>
> 核心定位：**Adapter-bound 的结构化富文本剧本编辑与演出编译框架**。
>
> 第一官方 Adapter：**Courtroom**（逆转裁判式法庭演出）。

---

## 0. v0.6 的核心结论

Yahari Script 不再把“通用剧本”理解成一种脱离演出目标、写完以后再决定怎么播放的文本格式。

正确模型是：

```text
创建项目
  ↓
选择 Adapter
  ↓
选择 / 配置 Content Pack
  ↓
建立 Cast
  ↓
在 Adapter 约束下创作 ScriptDocument
  ↓
Editor / AI / Validator 共用 Capability Registry
  ↓
Adapter Compiler
  ↓
Adapter-specific Performance Plan
  ↓
Renderer / Exporter
```

因此：

1. **Core 是通用的。**
2. **Project 不是完全通用的，而是 Adapter-bound。**
3. **ScriptDocument 的基础结构通用，但其中允许出现哪些 Typed Token，由当前项目绑定的 Adapter 与 Content Pack 决定。**
4. **作者不应能够轻易插入当前角色根本无法执行的动作。**
5. **编辑器、AI 辅助创作、编译器验证必须使用同一套 Capability Registry，避免三套规则互相漂移。**
6. **Typed Token 是富文本流中的结构化节点，不再使用“Pose 必须行首、Reaction 必须行中”这类位置规则。**
7. **具体演出语义由 Token 类型本身和 Adapter 解释，而不是由 Token 所在文本位置猜测。**

---

# 1. 产品边界

## 1.1 Yahari Script 是什么

Yahari Script 是：

- 一个结构化富文本剧本编辑器；
- 一个通用 ScriptDocument 数据模型；
- 一个 Adapter SDK；
- 一套角色 / 素材 / 能力描述体系；
- 一套 Script → Performance Plan 的编译机制；
- 一套供 Editor、AI、Validator 共用的能力查询接口。

它的重点不是：

```text
“让任何文本自动变成任何游戏”
```

而是：

```text
“在明确目标演出系统以后，
让作者用接近聊天软件的方式写剧本，
但底层始终保存为可验证、可编译、可迁移的结构化文档。”
```

---

## 1.2 Yahari Script 不是什么

当前阶段明确不做：

- 通用游戏引擎；
- 通用视觉小说引擎；
- 任意游戏逆向兼容层；
- 无约束 Markdown → 演出自动猜测器；
- 把所有 Adapter 私有语义硬塞进 Core；
- 通过文本位置推断动作类型；
- 为了“格式统一”强迫作者学习大量脚本语法。

---

# 2. 三层架构

建议正式固定为三层：

```text
Core
Adapter
Content Pack / Project
```

---

## 2.1 Core

Core 只负责真正跨 Adapter 通用的东西：

- Project 元数据基础结构；
- ScriptDocument；
- Block；
- Rich Text Node；
- Typed Token 容器；
- ID / Reference；
- Capability Query 接口；
- Diagnostic 基础结构；
- Compiler Pipeline 抽象接口；
- Undo / Redo 所需稳定文档操作语义；
- 序列化与版本迁移接口。

Core **不知道**：

- “拍桌”是什么；
- “异议”是什么；
- “证言”是什么；
- 某个角色有哪些立绘；
- Courtroom 怎样切镜头；
- 某个目标游戏怎样播放音效。

---

## 2.2 Adapter

Adapter 定义一种“演出语言”。

例如：

```text
courtroom
visual-novel
chat-drama
comic-panel
```

第一官方 Adapter：

```text
adapterId = "official.courtroom"
```

Adapter 负责：

- 定义 Token Type；
- 定义 Token 参数 Schema；
- 定义 Capability 类型；
- 定义上下文规则；
- 定义 Adapter-specific Validator；
- 定义 Compiler；
- 定义 Performance Plan；
- 定义 Renderer / Exporter 接口；
- 定义 Editor 插入菜单的分类与显示方式；
- 定义 Adapter 的项目创建需求。

---

## 2.3 Content Pack

Content Pack 负责提供“这个 Adapter 下实际可用的内容”。

Courtroom 的 Content Pack 可以包含：

- 角色；
- 角色 Pose；
- Reaction；
- 背景；
- 法庭位置；
- 音效；
- BGM；
- UI 素材；
- 特殊 Cut-in；
- 角色特有动作；
- 资源映射。

因此：

```text
Adapter = 语言规则
Content Pack = 词汇和素材
Project = 使用某种语言、某套词汇写出的作品
```

不要把角色列表写死在 Adapter 中。

---

# 3. Project 必须 Adapter-bound

## 3.1 创建项目流程

新建项目时第一步必须选择 Adapter。

推荐流程：

```text
New Project
  ↓
Choose Adapter
  ↓
Choose Content Pack
  ↓
Create Cast / Project Profile
  ↓
Open Editor
```

禁止默认行为：

```text
先创建完全通用 ScriptDocument
写一堆内容
最后再选择 Adapter
```

因为这样无法在创作阶段保证 Token 有效性。

---

## 3.2 ProjectManifest

建议最小结构：

```ts
interface ProjectManifest {
  schemaVersion: string;

  projectId: string;
  title: string;

  adapter: {
    id: string;
    version: string;
  };

  contentPacks: Array<{
    id: string;
    version: string;
  }>;

  entryDocumentId: string;

  documents: Array<{
    id: string;
    path: string;
  }>;

  cast: CastMemberRef[];

  projectSettings?: Record<string, unknown>;
}
```

---

## 3.3 Cast

不要让 ScriptDocument 直接引用 Content Pack 中的“原始角色定义”。

项目应有自己的 Cast 层：

```ts
interface CastMemberRef {
  castId: string;
  characterRef: ResourceRef;

  displayName?: string;

  overrides?: Record<string, unknown>;
}
```

脚本中的 speaker 应引用：

```text
castId
```

而不是直接引用：

```text
characterAssetId
```

理由：

- 同一基础角色可以在不同项目中改名；
- 可以有服装 / 状态覆盖；
- 后续可以支持同一角色的不同阶段；
- ScriptDocument 不需要关心资源包内部结构。

---

# 4. ScriptDocument v0.6

## 4.1 总体结构

```ts
interface ScriptDocument {
  schemaVersion: string;

  documentId: string;
  title: string;

  blocks: ScriptBlock[];

  metadata?: Record<string, unknown>;
}
```

---

## 4.2 Block 只保留两种基础类型

当前 Core 建议只保留：

```text
DialogueBlock
CueBlock
```

避免一开始在 Core 中制造大量 Adapter-specific Block。

---

## 4.3 DialogueBlock

```ts
interface DialogueBlock {
  id: string;
  type: "dialogue";

  speaker: CastRef | null;

  content: RichNode[];

  metadata?: Record<string, unknown>;
}
```

其中：

```ts
interface CastRef {
  castId: string;
}
```

---

## 4.4 CueBlock

CueBlock 表示不属于某个角色“说出的文本”的结构化指令。

```ts
interface CueBlock {
  id: string;
  type: "cue";

  cue: TypedToken;

  metadata?: Record<string, unknown>;
}
```

例：

- Scene Change；
- BGM 切换；
- 全局 Flash；
- Evidence UI；
- Chapter Marker；
- Adapter 定义的非对白演出指令。

注意：

**不要因为某个 Token 看起来像动作，就一定放进 CueBlock。**

如果动作发生在一句对白过程中，并且需要和文字顺序绑定，则它仍然应作为 DialogueBlock 中的 inline Typed Token。

---

# 5. Rich Text Node

## 5.1 最小节点模型

```ts
type RichNode =
  | TextNode
  | TokenNode;

interface TextNode {
  type: "text";
  text: string;
  marks?: TextMark[];
}

interface TokenNode {
  type: "token";
  token: TypedToken;
}
```

---

## 5.2 TextMark

Core 可以预留最基础文本标记：

```ts
type TextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" };
```

其他特殊文字效果不要提前硬编码进 Core。

例如：

- 抖动文字；
- 红色警告文字；
- 打字速度；
- 法庭式强调；

应优先由 Adapter Typed Token 或 Adapter extension 处理。

---

# 6. Typed Token

## 6.1 Token 是 Rich Text 中的一等节点

```ts
interface TypedToken {
  id: string;

  type: string;

  params: Record<string, unknown>;

  subject?: EntityRef;

  metadata?: Record<string, unknown>;
}
```

例如：

```json
{
  "id": "tok_001",
  "type": "courtroom.pose",
  "subject": {
    "kind": "cast",
    "id": "phoenix"
  },
  "params": {
    "pose": "point"
  }
}
```

---

## 6.2 不再使用位置猜测语义

以下旧式规则全部取消：

```text
Pose 只能在句首
Reaction 只能在句中
句末不能有 Reaction
一个句子只能有一个 Pose
```

Token 可以出现在任意富文本位置。

例如：

```text
[Pose:normal] 我认为——[Pose:point] 真正的犯人就是你！
```

其语义不是：

```text
“因为 point 在行中，所以它是 Reaction”
```

而是：

```text
type = courtroom.pose
params.pose = point
```

---

## 6.3 Token 在文本流中的顺序就是演出顺序

DialogueBlock：

```text
Text("我认为")
Token(Pose.point)
Text("真正的犯人就是你！")
Token(Reaction.sweat)
```

编译时生成：

```text
显示 “我认为”
执行 Pose.point
继续显示 “真正的犯人就是你！”
执行 Reaction.sweat
```

因此 RichNode 顺序本身就是最基本的时间轴。

MVP 不需要额外引入复杂 Timeline。

---

# 7. Token Type Definition

Token 的实例保存在 ScriptDocument 中。

Token 的“类型定义”由 Adapter 提供。

建议：

```ts
interface TokenTypeDefinition {
  type: string;

  label: string;
  description?: string;

  category: string;

  scope: "inline" | "block" | "both";

  paramsSchema: JsonSchema;

  subjectPolicy?: SubjectPolicy;

  capabilityQuery?: CapabilityQueryTemplate;

  editor?: {
    icon?: string;
    displayMode?: "chip" | "badge" | "compact";
    priority?: number;
  };
}
```

---

# 8. Subject

Typed Token 不应默认等于“当前 speaker”。

需要显式区分。

```ts
type EntityRef =
  | { kind: "cast"; id: string }
  | { kind: "resource"; id: string }
  | { kind: "project"; id: string }
  | { kind: "scene"; id: string };
```

但 Editor 可以提供默认值。

例如在 DialogueBlock 中插入：

```text
courtroom.pose
```

默认：

```text
subject = 当前 speaker
```

用户一般不需要手动选择。

但底层必须显式保存，以便：

- 动作作用于其他角色；
- 双角色演出；
- 旁观者 Reaction；
- 镜头切向非 speaker 角色；
- 后续复杂 Adapter。

---

# 9. Capability Registry

这是 v0.6 最重要的基础设施之一。

## 9.1 目的

同一份能力数据必须同时服务：

```text
Editor
AI Authoring
Validator
Compiler
```

否则会出现：

```text
编辑器允许
AI 会生成
编译器却报错
```

或者：

```text
编译器支持
编辑器却根本不给作者选择
```

---

## 9.2 Capability

建议抽象结构：

```ts
interface Capability {
  id: string;

  kind: string;

  subject: EntityRef;

  params?: Record<string, unknown>;

  source: ResourceRef;
}
```

Courtroom 示例：

```json
{
  "id": "cap_phoenix_pose_point",
  "kind": "courtroom.pose",
  "subject": {
    "kind": "cast",
    "id": "phoenix"
  },
  "params": {
    "pose": "point"
  }
}
```

---

## 9.3 Registry API

建议 Core 暴露：

```ts
interface CapabilityRegistry {
  query(query: CapabilityQuery): Capability[];

  supports(query: CapabilityQuery): boolean;

  explain(query: CapabilityQuery): CapabilityDiagnostic;
}
```

最小 Query：

```ts
interface CapabilityQuery {
  kind: string;

  subject?: EntityRef;

  params?: Record<string, unknown>;

  context?: EditorContext;
}
```

---

## 9.4 角色能力来自 Content Pack，而不是 Editor 手写

角色定义：

```ts
interface CharacterDefinition {
  id: string;
  name: string;

  capabilities: CapabilityDefinition[];

  assets?: ResourceRef[];
}
```

角色没有：

```text
courtroom.pose / point
```

则编辑器在该角色说话时默认不显示 “point”。

这就是：

```text
“不让作者插入角色根本无法执行的动作”
```

的真正实现方式。

---

# 10. EditorContext

过滤不能只看 speaker。

建议统一：

```ts
interface EditorContext {
  projectId: string;
  documentId: string;

  blockId?: string;

  adapterId: string;
  adapterVersion: string;

  speaker?: CastRef | null;

  selection?: {
    from: number;
    to: number;
  };

  previousBlockId?: string;
  nextBlockId?: string;

  adapterState?: Record<string, unknown>;
}
```

Adapter 可以根据 context 决定：

- 某 Token 是否可用；
- 默认 subject；
- 推荐参数；
- 排序；
- 是否只是隐藏还是禁止。

---

# 11. Token Picker

## 11.1 编辑体验目标

作者的主观体验应该接近：

```text
QQ / 微信 / Discord 输入框
```

而不是：

```text
IDE
```

也不是：

```text
写 XML
```

---

## 11.2 主要交互

推荐支持：

- 直接输入文字；
- Enter 新建 DialogueBlock；
- 点击 speaker avatar 切换说话者；
- `/` 打开 Token Picker；
- `@` 可选用于角色 / subject；
- 快捷键插入最近动作；
- Token 以不可误编辑的 Chip 显示；
- 点击 Chip 修改参数；
- Backspace 可一次删除整个 Chip；
- 左右方向键可以跨过 Chip；
- Undo / Redo 把 Token 当原子操作。

---

## 11.3 Picker 动态过滤

当前 speaker = Phoenix：

```text
/pose
```

Picker 只显示 Phoenix 支持的 pose。

当前 speaker = Judge：

```text
/pose
```

显示 Judge 自己的 pose。

如果某动作不是当前 speaker 的能力，但 Adapter 允许显式指定其他 subject：

```text
/pose @maya
```

则可以继续查询 Maya 的能力。

---

## 11.4 不自动删除已经失效的 Token

例如：

1. 原 speaker = Phoenix；
2. 插入 `Pose.point`；
3. 用户把 speaker 改为 Judge。

此时如果 Judge 不支持 point：

**不要自动删除 Token。**

正确行为：

```text
Token 保留
  +
显示 invalid 状态
  +
Diagnostic 提示
  +
提供 Replace / Retarget / Remove
```

否则编辑器会破坏作者数据。

---

# 12. Editor 与 Adapter 的职责边界

Editor 负责：

- 富文本输入；
- Token Chip；
- Block 编辑；
- Selection；
- Project / Cast UI；
- 调 Adapter API 获取候选；
- 展示 Diagnostic。

Adapter 负责：

- Token 类型；
- Token 参数；
- Token 是否适用于当前 context；
- Token 候选；
- Capability 查询模板；
- Adapter-specific validation；
- 编译。

Editor **不得**出现：

```ts
if (adapter === "courtroom") {
  ...
}
```

这种大量特判。

---

# 13. Adapter SDK

建议 v0.6 固定最小接口：

```ts
interface YahariAdapter {
  manifest: AdapterManifest;

  tokenTypes: TokenTypeDefinition[];

  createProjectProfile(
    input: AdapterProjectInitInput
  ): AdapterProjectProfile;

  buildCapabilityRegistry(
    project: ProjectContext
  ): CapabilityRegistry;

  getTokenCandidates(
    context: EditorContext,
    query?: TokenPickerQuery
  ): TokenCandidate[];

  validate(
    document: ScriptDocument,
    context: ProjectContext
  ): Diagnostic[];

  compile(
    document: ScriptDocument,
    context: ProjectContext
  ): PerformancePlan;
}
```

---

# 14. AdapterManifest

```ts
interface AdapterManifest {
  id: string;
  version: string;

  name: string;
  description?: string;

  coreCompatibility: string;

  tokenNamespaces: string[];

  projectProfileSchema?: JsonSchema;

  performancePlanType: string;
}
```

Courtroom：

```json
{
  "id": "official.courtroom",
  "version": "0.1.0",
  "name": "Courtroom",
  "coreCompatibility": ">=0.6 <0.7",
  "tokenNamespaces": [
    "courtroom"
  ],
  "performancePlanType": "courtroom.performance-plan.v1"
}
```

---

# 15. Courtroom Adapter：MVP Token 分类

第一阶段不要试图复制完整逆转裁判系统。

只做足够验证架构的集合。

建议最小分类：

```text
Character
  pose
  reaction

Presentation
  wait
  emphasis
  flash
  shake

Audio
  sfx
  bgm

Scene
  background
  focus
```

---

## 15.1 courtroom.pose

```ts
type = "courtroom.pose"
```

参数：

```ts
{
  pose: string
}
```

默认 subject：

```text
current speaker
```

---

## 15.2 courtroom.reaction

```ts
type = "courtroom.reaction"
```

参数：

```ts
{
  reaction: string
}
```

Reaction 和 Pose 在 Core 层没有本质区别。

两者之所以分开，仅因为 Courtroom Adapter 的语义和素材组织不同。

---

## 15.3 courtroom.wait

```ts
type = "courtroom.wait"
```

参数：

```ts
{
  mode: "time" | "input",
  durationMs?: number
}
```

---

## 15.4 courtroom.sfx

```ts
type = "courtroom.sfx"
```

参数：

```ts
{
  sound: ResourceRef
}
```

---

## 15.5 courtroom.bgm

通常更适合作为 CueBlock：

```ts
type = "courtroom.bgm"
```

但 `scope = both` 也可以允许在 DialogueBlock 途中切 BGM。

---

## 15.6 courtroom.focus

```ts
type = "courtroom.focus"
```

subject：

```text
cast member
```

表示镜头 / 演出焦点切换。

不要把 `focus` 等同于 `speaker`。

---

# 16. Courtroom Character Definition

建议 Content Pack：

```ts
interface CourtroomCharacter {
  id: string;
  name: string;

  portraits: {
    base: ResourceRef;
  };

  poses: Array<{
    id: string;
    label: string;
    asset: ResourceRef;
  }>;

  reactions: Array<{
    id: string;
    label: string;
    asset: ResourceRef;
  }>;

  metadata?: Record<string, unknown>;
}
```

加载时由 Adapter 转换为 Capability：

```text
poses[]
  → courtroom.pose capabilities

reactions[]
  → courtroom.reaction capabilities
```

---

# 17. 编译链

建议固定：

```text
ScriptDocument
  ↓
Normalize
  ↓
Core Validation
  ↓
Adapter Validation
  ↓
Lowering
  ↓
Adapter IR / Performance Plan
  ↓
Renderer / Exporter
```

---

## 17.1 Normalize

Normalize 只做无损规范化：

- 合并相邻 TextNode；
- 删除空 TextNode；
- 规范 ID；
- 填充明确可推断的默认值；
- 不改变作者语义。

---

## 17.2 Core Validation

Core 检查：

- Block ID 唯一；
- Token ID 唯一；
- RichNode 结构合法；
- Project reference 存在；
- Cast reference 存在；
- Token 基础结构合法。

Core 不检查：

```text
Phoenix 有没有 point pose
```

---

## 17.3 Adapter Validation

Adapter 检查：

- Token type 是否存在；
- params 是否符合 Schema；
- subject 是否合法；
- 当前 subject 是否具有能力；
- Token 是否允许当前 scope；
- Adapter-specific context 是否成立。

---

# 18. Diagnostic

统一格式：

```ts
interface Diagnostic {
  id: string;

  severity:
    | "info"
    | "warning"
    | "error";

  code: string;
  message: string;

  location?: {
    documentId: string;
    blockId?: string;
    tokenId?: string;
  };

  fixes?: QuickFix[];
}
```

示例：

```json
{
  "severity": "error",
  "code": "courtroom.capability.missing",
  "message": "当前角色不支持 Pose: point",
  "location": {
    "documentId": "doc_01",
    "blockId": "blk_12",
    "tokenId": "tok_33"
  }
}
```

---

# 19. Quick Fix

建议第一版即支持：

```text
Replace
Retarget
Remove
```

例如：

```text
Judge 不支持 point
```

Quick Fix：

```text
Replace → Judge.normal
Retarget → Phoenix
Remove
```

这比仅显示红色错误更符合创作工具。

---

# 20. Performance Plan

Core 不定义统一演出 IR。

每个 Adapter 有自己的 Performance Plan。

Courtroom：

```ts
interface CourtroomPerformancePlan {
  type: "courtroom.performance-plan.v1";

  scenes: CourtroomScenePlan[];
}
```

其中对白可以被 Lowering 为：

```ts
type CourtroomInstruction =
  | {
      op: "showText";
      text: string;
    }
  | {
      op: "pose";
      castId: string;
      pose: string;
    }
  | {
      op: "reaction";
      castId: string;
      reaction: string;
    }
  | {
      op: "focus";
      castId: string;
    }
  | {
      op: "sfx";
      resource: ResourceRef;
    }
  | {
      op: "wait";
      mode: "time" | "input";
      durationMs?: number;
    };
```

例如 Script：

```text
Phoenix:
[normal] 我认为——[point] 真正的犯人就是你！
```

Lowering：

```text
pose Phoenix normal
showText "我认为——"
pose Phoenix point
showText "真正的犯人就是你！"
```

这证明：

```text
富文本顺序
```

已经足够表达 MVP 的演出时序。

---

# 21. AI Authoring

AI 不应直接自由生成任意 Token 字符串。

正确流程：

```text
AI 获取 EditorContext
  ↓
AI 查询 Capability Registry
  ↓
获得当前合法候选
  ↓
AI 选择 TokenCandidate
  ↓
Core 写入结构化 Token
```

因此 AI 工具接口应该类似：

```ts
getAvailableActions(context)
insertToken(candidateId)
replaceToken(tokenId, candidateId)
```

而不是：

```text
“请直接生成 <pose=point>”
```

---

# 22. 为什么 Capability Registry 是 AI 时代的关键

Yahari Script 的核心价值不只是“富文本剧本”。

更重要的是：

```text
把一个目标演出系统可执行的动作空间，
显式建模成机器可查询的能力空间。
```

这样 AI 才能知道：

- 这个角色能做什么；
- 当前上下文能做什么；
- 什么动作只是理论存在但当前资源缺失；
- 哪些动作能编译；
- 哪些动作应被推荐。

因此：

```text
Capability Registry
```

同时是：

- 编辑器 UX 基础；
- AI Tool Schema；
- 静态类型系统；
- 编译前检查系统。

---

# 23. TokenCandidate

建议 Editor 和 AI 不直接操作裸 Capability。

Adapter 应返回更高层的 TokenCandidate：

```ts
interface TokenCandidate {
  id: string;

  tokenType: string;

  label: string;

  description?: string;

  subject?: EntityRef;

  params: Record<string, unknown>;

  category: string;

  enabled: boolean;

  disabledReason?: string;

  score?: number;

  preview?: ResourceRef;
}
```

这样 Adapter 可以：

- 合并 Capability；
- 计算默认参数；
- 排序；
- 加预览；
- 提供禁用原因。

---

# 24. 推荐与禁止是两回事

Picker 应区分：

```text
recommended
available
unavailable
```

不要简单把所有不推荐动作直接隐藏。

例如：

- 当前 speaker 的动作 → recommended；
- 其他角色合法动作 → available；
- 资源不存在 / 规则禁止 → unavailable。

默认 UI 可以只展开 recommended。

搜索时再显示 available。

---

# 25. Content Pack 与 Adapter Version

ProjectManifest 必须记录精确版本。

原因：

Content Pack 更新后可能：

- 删除 pose；
- 改资源 ID；
- 改能力；
- 改 Token 参数；
- 改默认映射。

因此打开旧项目时必须能够：

```text
检测版本差异
  ↓
运行 migration
  ↓
重新 validation
```

不要默默使用最新 Pack。

---

# 26. Migration

建议预留：

```ts
interface Migration {
  from: string;
  to: string;

  migrateProject(...): ...
  migrateDocument(...): ...
}
```

MVP 可以暂时只支持：

```text
版本完全匹配
```

但数据结构中现在就保存 version。

---

# 27. 推荐目录结构

```text
yahari-script/
├─ apps/
│  └─ editor/
│
├─ packages/
│  ├─ core/
│  │  ├─ document/
│  │  ├─ project/
│  │  ├─ capability/
│  │  ├─ diagnostics/
│  │  └─ adapter-api/
│  │
│  ├─ editor-core/
│  │  ├─ commands/
│  │  ├─ selection/
│  │  ├─ token-picker/
│  │  └─ diagnostics/
│  │
│  └─ adapters/
│     └─ courtroom/
│        ├─ manifest/
│        ├─ token-types/
│        ├─ capabilities/
│        ├─ validator/
│        ├─ compiler/
│        └─ renderer/
│
├─ content-packs/
│  └─ courtroom-demo/
│     ├─ characters/
│     ├─ backgrounds/
│     ├─ audio/
│     └─ pack.json
│
└─ examples/
   └─ courtroom-demo-project/
```

---

# 28. MVP 不应该先做 Renderer

第一阶段开发顺序应改成：

```text
1. Core types
2. Adapter API
3. Demo Courtroom Adapter
4. Demo Content Pack
5. Capability Registry
6. Rich Script Editor
7. Token Picker
8. Validation
9. Compile → JSON Performance Plan
10. 最小 Renderer
```

理由：

如果先做 Renderer，很容易再次把 Courtroom 的特殊逻辑反向污染 Core。

第一阶段真正应该验证的是：

```text
同一个 ScriptDocument
是否能够在编辑时被约束，
并稳定编译成确定的 Performance Plan。
```

而不是画面有多像逆转裁判。

---

# 29. MVP 验收用例

建议固定一个极小 Demo。

Cast：

```text
Phoenix
Judge
```

Phoenix：

```text
pose:
  normal
  point

reaction:
  sweat
```

Judge：

```text
pose:
  normal

reaction:
  surprised
```

---

## 29.1 编辑器测试

Phoenix 对白：

```text
[normal] 我认为——[point] 真正的犯人就是你！[sweat]
```

要求：

- 3 个 Token 都可从 Picker 插入；
- Token 可位于任意文本位置；
- Token 为 Chip；
- 编译成功。

---

## 29.2 Capability 过滤测试

Judge 对白打开 Pose Picker：

```text
只推荐：
normal
```

不应推荐：

```text
point
```

---

## 29.3 Invalid 保留测试

把上一段 Phoenix 对白 speaker 改为 Judge。

要求：

```text
point
sweat
```

保留，但标红 / 标 invalid。

不得自动删除。

---

## 29.4 Compiler 测试

输入：

```text
Phoenix:
[normal] 我认为——[point] 真正的犯人就是你！
```

输出稳定：

```json
[
  {
    "op": "pose",
    "castId": "phoenix",
    "pose": "normal"
  },
  {
    "op": "showText",
    "text": "我认为——"
  },
  {
    "op": "pose",
    "castId": "phoenix",
    "pose": "point"
  },
  {
    "op": "showText",
    "text": "真正的犯人就是你！"
  }
]
```

---

# 30. 一个关键设计原则：Document 保存“意图”，Plan 保存“执行”

ScriptDocument：

```text
Phoenix 执行 point
```

Performance Plan：

```text
加载 phoenix_point.webp
切换角色 sprite
播放指定帧 / transition
```

前者属于作者意图。

后者属于 Adapter 的执行细节。

因此 ScriptDocument 不保存：

- 文件路径；
- DOM selector；
- Canvas 坐标；
- sprite sheet 帧号；
- Three.js object name；
- 目标游戏函数名。

这些只能进入：

```text
Content Pack
Adapter Compiler
Renderer
```

---

# 31. 第二个关键原则：Editor 不等于 Compiler 前端

Editor 可以很“软”：

- 推荐；
- 自动完成；
- 预览；
- 隐藏高级项；
- 允许暂时 invalid。

Compiler 必须很“硬”：

- 确定；
- 可重复；
- 有明确错误；
- 不猜测作者意图。

因此：

```text
Editor 可以容忍半成品
Compiler 不可以悄悄猜
```

---

# 32. 第三个关键原则：Adapter 是类型系统，不只是插件

如果把 Adapter 只理解成：

```text
Renderer plugin
```

则设计会再次滑回：

```text
先写通用剧本
最后适配
```

正确理解是：

```text
Adapter 决定当前 Project 的可表达空间。
```

它类似：

- 编程语言的类型系统；
- 游戏引擎的 component schema；
- IDE 的 language server；
- 编译器 backend 的组合。

所以 Adapter 从 **项目创建时** 就已经参与，而不是导出时才加载。

---

# 33. v0.6 后下一步工程任务

按优先级：

### P0

1. 固定上述 TypeScript Core interface。
2. 写 `official.courtroom` manifest。
3. 写 Demo Content Pack。
4. 实现 Capability Registry。
5. 实现 `getTokenCandidates()`。
6. 实现纯函数 `validateDocument()`。
7. 实现纯函数 `compileCourtroom()`。

### P1

8. 做最小 Rich Text Editor。
9. Token Chip。
10. `/` Picker。
11. speaker selector。
12. inline diagnostics。
13. JSON Performance Plan preview。

### P2

14. 最小 Renderer。
15. 资源预览。
16. Quick Fix。
17. AI authoring tool API。

---

# 34. 暂不引入的复杂度

直到 MVP 验证之前，不引入：

- Timeline editor；
- 多轨动画；
- ECS；
- 行为树；
- 复杂 Scene Graph；
- 任意嵌套 Block；
- 通用宏系统；
- 条件分支；
- 变量系统；
- 自定义脚本语言；
- 插件市场；
- 联机协作；
- 完整逆转裁判逻辑。

这些不是永远不要，而是当前会模糊 Yahari Script 最重要的架构验证。

---

# 35. v0.6 架构一句话总结

```text
Yahari Script Core
负责保存结构化创作意图；

Adapter
定义当前项目能说什么“演出语言”；

Content Pack
定义当前角色和素材实际会哪些“词汇”；

Capability Registry
把这些能力暴露给 Editor、AI 和 Validator；

Compiler
把作者意图确定性地降级为 Adapter-specific Performance Plan。
```

如果这条链成立，Yahari Script 的基础架构就成立。

---

# 36. 当前正式基线

后续实现默认以以下决定为准：

```text
Project:
  Adapter-bound

Editor:
  chat-like rich text

Document:
  DialogueBlock + CueBlock

Inline:
  TextNode + TokenNode

Token:
  typed
  explicit semantics
  no position-based meaning

Character actions:
  Content Pack capabilities

Candidate filtering:
  current EditorContext + Capability Registry

Shared rules:
  Editor = AI = Validator

Compilation:
  ScriptDocument
    → Adapter validation
    → Adapter-specific Performance Plan

First Adapter:
  official.courtroom
```

这应作为下一阶段代码和 UI 原型的唯一架构基线。
