import { createProjectFile, type ProjectManifest, type YahariProjectFile } from "../../packages/core/src/index.js";
import { buildScene, generatedManifest, type StoryOutline } from "../../packages/story-ai/src/generation.js";
import { courtroomDemoPack } from "../../content-packs/courtroom-demo/pack.js";
import { demoManifest } from "./fixture.js";

type Line = { speaker: string | null; text: string; pose?: string | null; reaction?: string | null };
type CaseScene = { title: string; summary: string; background: string; lines: Line[] };
type CaseChapter = { title: string; summary: string; scenes: CaseScene[] };
interface CaseStory {
  id: string;
  title: string;
  summary: string;
  cast: StoryOutline["cast"];
  chapters: CaseChapter[];
}

// Original short cases. Every scene is a real ScriptDocument, so examples use
// the same editor, validator, compiler, import, and rehearsal path as authored work.
const stories: CaseStory[] = [
  {
    id: "nine-oclock-shadow",
    title: "九点的影子",
    summary: "一场停电让目击证词看似不可能。庭审逐步确认，证人确实看见了人影，却把玻璃中的倒影当成了东门出口。",
    cast: [
      { id: "phoenix", name: "成步堂", characterId: "phoenix" },
      { id: "edgeworth", name: "御剑", characterId: "edgeworth" },
      { id: "maya", name: "真宵", characterId: "maya" },
      { id: "judge", name: "裁判长", characterId: "judge" },
      { id: "witness", name: "矢张（证人）", characterId: "witness" },
    ],
    chapters: [
      {
        title: "第一章 · 停电记录",
        summary: "辩方拿到维修记录，发现证人所说的九点与八点五十分的停电冲突。",
        scenes: [
          {
            title: "庭前的记录", background: "lobby",
            summary: "候审室。真宵把楼宇维修单交给成步堂；记录证明东侧走廊在证人目击前已断电。",
            lines: [
              { speaker: "maya", pose: "normal", text: "物业终于把维修单送来了。昨晚八点五十分，东侧走廊整段断电。" },
              { speaker: "phoenix", pose: "think", text: "证人却说九点整，亲眼看见被告从东门离开。" },
              { speaker: "maya", pose: "think", text: "还有一张图。东门对面是一整面深色玻璃，西侧的应急灯会照在上面。" },
              { speaker: "phoenix", text: "先别替证人下结论。他可能看见了什么，只是认错了方向。" },
            ],
          },
          {
            title: "九点的证词", background: "courtroom",
            summary: "审判中。矢张坚持看见红衣人经过东门；成步堂用停电记录逼出其观察位置。",
            lines: [
              { speaker: "judge", pose: "normal", text: "请证人说明昨晚九点的所见。" },
              { speaker: "witness", pose: "confident", text: "我站在值班台，看见一个穿红外套的人走向东门。我认得那件外套。" },
              { speaker: "edgeworth", pose: "normal", text: "被告当天就穿着红外套。证人的判断有依据。" },
              { speaker: "phoenix", pose: "think", text: "可是东侧走廊八点五十分就停电了。你从哪里看见外套的颜色？" },
              { speaker: "witness", reaction: "sweat", text: "值班台旁边还有应急灯。我看到的是玻璃上的人影……颜色是后来想起来的。" },
              { speaker: "judge", reaction: "confused", text: "也就是说，你没有直接看见东门前的人？" },
            ],
          },
        ],
      },
      {
        title: "第二章 · 镜中的方向",
        summary: "示意图解释了目击错位；庭审把“有人经过”与“被告从东门离开”分开判断。",
        scenes: [
          {
            title: "玻璃上的出口", background: "courtroom",
            summary: "成步堂让证人指出影像左右；玻璃反射使西侧经过的人看起来朝东门走。",
            lines: [
              { speaker: "phoenix", pose: "point", text: "请看平面图。你站在值班台时，东门就在这面玻璃的背后，对吗？" },
              { speaker: "witness", pose: "nervous", text: "对。玻璃很暗，像镜子。" },
              { speaker: "phoenix", text: "西侧应急灯照着你的身后。玻璃里的人影朝右走，真实的人却是朝左走。" },
              { speaker: "witness", reaction: "shocked", text: "等等……那个人其实可能走向西楼梯？" },
              { speaker: "edgeworth", reaction: "surprised", text: "即使如此，仍可能是被告。衣服与时间都吻合。" },
              { speaker: "phoenix", pose: "think", text: "可能性还在。但证人没看清脸，也没看见有人通过东门。" },
            ],
          },
          {
            title: "证词的边界", background: "courtroom",
            summary: "证人撤回离开东门的断言。检方保留其他证据；裁判长要求重新核查西楼梯记录。",
            lines: [
              { speaker: "judge", pose: "stern", text: "证人，你现在能够确认的事实是什么？" },
              { speaker: "witness", pose: "nervous", text: "九点左右，我在玻璃上看见一个人影。是谁、往哪边走，我都不能保证。" },
              { speaker: "maya", pose: "cheer", text: "至少被告从东门逃走这句话，不能再当作亲眼目击。" },
              { speaker: "edgeworth", pose: "bow", text: "检方接受更正，并会调取西楼梯的门禁记录。" },
              { speaker: "phoenix", pose: "normal", text: "这才是我们今天能证明的范围。" },
              { speaker: "judge", text: "本庭记录证词更正，择日继续调查。" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "missing-thirteen-seconds",
    title: "消失的十三秒",
    summary: "一段录音被用来证明“销毁名单”的指令。辩方发现录音缺失十三秒，证人承认剪辑，却也留下了尚待核实的原始文件。",
    cast: [
      { id: "phoenix", name: "成步堂", characterId: "phoenix" },
      { id: "edgeworth", name: "御剑", characterId: "edgeworth" },
      { id: "maya", name: "真宵", characterId: "maya" },
      { id: "judge", name: "裁判长", characterId: "judge" },
      { id: "witness", name: "矢张（证人）", characterId: "witness" },
    ],
    chapters: [
      {
        title: "第一章 · 录音里的命令",
        summary: "起诉依赖一段简短录音，辩方发现提交文件与录音笔计时不一致。",
        scenes: [
          {
            title: "交来的文件", background: "lobby",
            summary: "庭前。真宵发现提交音频长四十一秒，记者的采访记录却写着五十四秒。",
            lines: [
              { speaker: "maya", pose: "think", text: "检方交来的录音是四十一秒，采访记录里却写着五十四秒。" },
              { speaker: "phoenix", pose: "think", text: "十三秒去哪了？可能只是停顿，也可能改变整句话。" },
              { speaker: "maya", text: "记者说这是原件，但文件名多了一个“final”。" },
              { speaker: "phoenix", text: "别猜内容。先让他说明文件怎么来的，再申请核对录音笔。" },
            ],
          },
          {
            title: "四十一秒", background: "courtroom",
            summary: "矢张以录音指认被告要求销毁名单；辩方确认其提交的是导出文件。",
            lines: [
              { speaker: "judge", pose: "normal", text: "请说明这份录音如何取得。" },
              { speaker: "witness", pose: "confident", text: "我当面采访被告。他说，把那份名单烧了。声音很清楚。" },
              { speaker: "edgeworth", pose: "normal", text: "这句话与失踪的名单直接相关。" },
              { speaker: "phoenix", pose: "think", text: "提交的四十一秒文件，是录音笔里的原始文件吗？" },
              { speaker: "witness", pose: "nervous", text: "我导出过一次，但没改他说的话。" },
              { speaker: "phoenix", pose: "point", text: "采访记录标着五十四秒。请解释少掉的十三秒。" },
            ],
          },
        ],
      },
      {
        title: "第二章 · 剪辑的动机",
        summary: "证人承认剪掉中段以赶新闻，但原始语句究竟如何，仍须听原件。",
        scenes: [
          {
            title: "被删掉的停顿", background: "courtroom",
            summary: "记者承认剪去一段自认为无关的停顿；检方和辩方都要求保全录音笔。",
            lines: [
              { speaker: "witness", reaction: "sweat", text: "中间有电话铃，还有很长的停顿。我赶稿子，就剪掉了。" },
              { speaker: "phoenix", pose: "point", text: "你剪的是哪一句话之前，还是哪一句之后？" },
              { speaker: "witness", pose: "nervous", text: "我……不记得精确位置。剪辑工程文件在我的电脑上。" },
              { speaker: "edgeworth", reaction: "surprised", text: "检方收到时并不知道经过剪辑。我请求立即保全录音笔和工程文件。" },
              { speaker: "judge", pose: "stern", text: "准许。现有录音不能被称作未经处理的原件。" },
            ],
          },
          {
            title: "尚未听见的原句", background: "courtroom",
            summary: "法庭明确区分剪辑瑕疵与事实真相，在核验原件前暂缓依赖该句作判断。",
            lines: [
              { speaker: "phoenix", pose: "normal", text: "我不能声称被告没有说过那句话。但剪过的文件不足以证明完整语境。" },
              { speaker: "witness", pose: "nervous", text: "我以为只是在删空白，没想到会影响庭审。" },
              { speaker: "edgeworth", pose: "bow", text: "检方会提交原件，重新核对前后句，再决定是否继续引用。" },
              { speaker: "judge", text: "在原件核验前，本庭不以这段导出录音认定销毁名单的指令。" },
              { speaker: "maya", pose: "think", text: "十三秒里未必藏着答案，但至少不能让它凭空消失。" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "midnight-pass",
    title: "凌晨的通行证",
    summary: "一张门禁卡在两分钟内出现在相隔很远的两个位置。调查从“谁刷了卡”转向“门禁记录究竟证明了什么”，并逐步排除把卡片身份等同于持卡人的错误推断。",
    cast: [
      { id: "phoenix", name: "成步堂", characterId: "phoenix" },
      { id: "edgeworth", name: "御剑", characterId: "edgeworth" },
      { id: "maya", name: "真宵", characterId: "maya" },
      { id: "judge", name: "裁判长", characterId: "judge" },
      { id: "witness", name: "矢张（证人）", characterId: "witness" },
    ],
    chapters: [
      {
        title: "第一章 · 两次刷卡",
        summary: "律师事务所拿到门禁导出表，随后在警署资料室确认同一编号的卡片曾在两分钟内被两个读卡器记录。",
        scenes: [
          {
            title: "凌晨零点十七分", background: "office",
            summary: "事务所里，真宵整理门禁资料。成步堂发现被告的卡片在零点十七分进入仓库，但被告称当时仍在公司外。",
            lines: [
              { speaker: "maya", pose: "think", text: "门禁公司把原始导出表发来了。零点十七分，被告的卡号刷开了仓库东门。" },
              { speaker: "phoenix", pose: "think", text: "这只能证明那张卡被读卡器识别，不能直接证明拿卡的人是谁。" },
              { speaker: "maya", text: "还有一条。零点十九分，同一个卡号又出现在西楼的资料室。" },
              { speaker: "phoenix", reaction: "shocked", text: "两分钟？从仓库走到西楼最快也要六分钟。" },
              { speaker: "maya", pose: "cheer", text: "所以不是人跑得快，就是记录里还有我们没看到的东西。" },
            ],
          },
          {
            title: "复制卡记录", background: "police-records",
            summary: "警署资料室中，双方找到设备维护记录：该卡号在案发前一天被复制到一张测试卡，但测试卡是否归还尚不明确。",
            lines: [
              { speaker: "edgeworth", pose: "normal", text: "维护日志显示，案发前一天确实制作过一张临时测试卡，编号与被告的卡完全相同。" },
              { speaker: "phoenix", pose: "point", text: "也就是说，两处记录可以来自两张不同的实体卡。" },
              { speaker: "edgeworth", pose: "smug", text: "可以，但不能因此断定测试卡就是案发时被使用的那一张。" },
              { speaker: "maya", pose: "think", text: "归还栏是空的。负责维护的人是谁？" },
              { speaker: "edgeworth", pose: "bow", text: "证人负责当晚设备检查。法庭上让他说明。" },
            ],
          },
          {
            title: "会见室里的缺口", background: "detention-room",
            summary: "会见室中，负责维护的证人补充一个可核验细节：原卡和测试卡曾同时放在桌上，而他只确认原卡后来回到卡套。",
            lines: [
              { speaker: "phoenix", pose: "normal", text: "我不会替你补记忆。你只说能确定的：昨天有没有见过那张测试卡？" },
              { speaker: "witness", pose: "nervous", text: "我不是被告……不过我负责维护。我记得把原卡和测试卡一起放在桌上，后来只确认原卡回了卡套。" },
              { speaker: "maya", pose: "think", text: "所以测试卡什么时候离开桌面，你其实没看到。" },
              { speaker: "witness", reaction: "sweat", text: "对。我当时以为两张都收好了。" },
              { speaker: "phoenix", pose: "think", text: "这仍不能证明谁拿走了它，但足以解释为什么归还记录会是空白。" },
            ],
          },
        ],
      },
      {
        title: "第二章 · 卡片不是人",
        summary: "走廊目击与测试卡流转补上缺口；法庭最终把门禁数据的证明范围限定为“某张同编号卡被使用”。",
        scenes: [
          {
            title: "灯下的人影", background: "night-corridor",
            summary: "矢张回忆自己在西楼走廊见过一个人影，但无法确认面孔；其时间与第二次刷卡接近。",
            lines: [
              { speaker: "witness", pose: "nervous", text: "零点二十分左右，我在西楼走廊看到有人从资料室出来。" },
              { speaker: "phoenix", pose: "think", text: "你看清是谁了吗？" },
              { speaker: "witness", reaction: "sweat", text: "灯坏了一半。我只看见轮廓，手里像拿着一张白色卡片。" },
              { speaker: "maya", pose: "think", text: "那和测试卡的外观一致，但普通门禁卡也是白色。" },
              { speaker: "phoenix", text: "所以这条目击只能证明当时可能有人带着卡经过，身份仍然未知。" },
            ],
          },
          {
            title: "门禁记录的边界", background: "courtroom",
            summary: "庭审明确区分卡号、实体卡与持卡人。检方保留其他证据，但不再把两次刷卡直接解释为被告本人移动。",
            lines: [
              { speaker: "judge", pose: "stern", text: "证人，测试卡在维护结束后是否立即归还？" },
              { speaker: "witness", pose: "nervous", text: "我原本以为归还了，但记录没签字。我现在不能确定。" },
              { speaker: "edgeworth", reaction: "surprised", text: "检方接受：现有门禁数据无法单独区分原卡与测试卡。" },
              { speaker: "phoenix", pose: "point", text: "更不能仅凭卡号，把刷卡动作直接归到被告本人身上。" },
              { speaker: "judge", pose: "normal", text: "本庭记录这一限制。门禁数据证明同编号凭证被使用，持卡人身份仍需其他证据确认。" },
              { speaker: "maya", pose: "normal", text: "一张卡有编号，一个人有名字。两者不能因为数据库里连在一起，就自动变成同一件事。" },
            ],
          },
        ],
      },
    ],
  }
];

export const sampleStories = stories.map(({ id, title, summary, chapters }) => ({
  id, title, summary, chapters: chapters.length,
  scenes: chapters.reduce((count, chapter) => count + chapter.scenes.length, 0),
}));

/** Normalize old saved sample aliases without changing scene IDs or authored dialogue. */
export function normalizeSampleCast(manifest:ProjectManifest):ProjectManifest {
  if(!manifest.projectId.startsWith('sample-'))return manifest;
  const next=structuredClone(manifest);
  for(const cast of next.cast){
    if(cast.characterRef.packId!==courtroomDemoPack.id)continue;
    const actor=courtroomDemoPack.characters.find(person=>person.id===cast.characterRef.id);
    if(actor)cast.displayName=actor.name;
  }
  return next;
}

export function createSampleStory(id: string, prefix: string): YahariProjectFile {
  const story = stories.find(item => item.id === id);
  if (!story) throw new Error(`Unknown sample story: ${id}`);
  const outline: StoryOutline = {
    title: story.title, summary: story.summary, cast: story.cast,
    chapters: story.chapters.map(chapter => ({
      title: chapter.title, summary: chapter.summary,
      scenes: chapter.scenes.map(({ title, summary, background }) => ({ title, summary, background })),
    })),
  };
  const docs = story.chapters.flatMap((chapter, chapterIndex) =>
    chapter.scenes.map((scene, sceneIndex) =>
      buildScene({ lines: scene.lines }, outline, chapterIndex, sceneIndex, courtroomDemoPack, prefix)));
  return createProjectFile(generatedManifest(demoManifest, outline, docs, prefix), docs);
}
