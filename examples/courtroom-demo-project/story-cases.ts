import { createProjectFile, type ProjectManifest, type ScriptDocument, type TypedToken, type YahariProjectFile } from "../../packages/core/src/index.js";
import { generatedManifest, type StoryOutline } from "../../packages/story-ai/src/outline.js";
import { buildCourtroomScene } from "../../packages/adapters/courtroom/src/story-generation.js";
import { courtroomDemoPack } from "../../content-packs/courtroom-demo/pack.js";
import { demoManifest } from "./fixture.js";

type Line = {
  speaker: string | null;
  text: string;
  pose?: string | null;
  reaction?: string | null;
  focus?: string;
  emphasis?: boolean;
  flash?: number;
  shake?: number;
  wait?: "input" | number;
  sfx?: "objection" | "hold-it" | "desk-slam" | "gavel" | "impact";
  bgm?: "trial" | "cross-examination" | "suspense" | "pursuit";
};
type CaseScene = { title: string; summary: string; background: string; lines: Line[] };
type CaseChapter = { title: string; summary: string; scenes: CaseScene[] };
interface CaseStory {
  id: string;
  title: string;
  summary: string;
  cast: StoryOutline["cast"];
  chapters: CaseChapter[];
}

const story: CaseStory = {
  id: "farewell-final-objection",
  title: "告别逆转 · 最后的异议",
  summary: "以《逆转裁判》1-4终盘人物关系为灵感重新编写的长篇 fan-demo。围绕旧案、湖上枪击与被掩埋的证据，成步堂、御剑、真宵、千寻、糸锯、夏美、灰根与矢张从不同方向逐步压缩狩魔豪的退路。台词为本项目原创，不复刻原作文本；此案例同时承担多人物、多场景与演出 Token 的压力测试。",
  cast: [
    { id: "phoenix", name: "成步堂", characterId: "phoenix" },
    { id: "edgeworth", name: "御剑", characterId: "edgeworth" },
    { id: "maya", name: "真宵", characterId: "maya" },
    { id: "mia", name: "千寻", characterId: "mia" },
    { id: "judge", name: "裁判长", characterId: "judge" },
    { id: "von-karma", name: "狩魔豪", characterId: "von-karma" },
    { id: "gumshoe", name: "糸锯圭介", characterId: "gumshoe" },
    { id: "lotta", name: "大泽木夏美", characterId: "lotta" },
    { id: "yogi", name: "灰根高太郎", characterId: "yogi" },
    { id: "witness", name: "矢张政志", characterId: "witness" },
  ],
  chapters: [
    {
      title: "第一章 · 湖面留下的误差",
      summary: "在重新开庭前，众人把湖上目击、门禁记录和旧案资料重新拆开，不再把任何人的推断当成既定事实。",
      scenes: [
        {
          title: "雾中的第二个影子",
          background: "lake-dock",
          summary: "葫芦湖夜间码头。夏美带来未提交的底片，糸锯确认时间戳比警方抄录早了几十秒；照片只能证明湖面曾有第二个影子，不能证明身份。",
          lines: [
            { speaker: "lotta", pose: "camera", text: "我把剩下的底片全翻出来了。别先高兴，照片糊得像隔着一锅汤。", focus: "lotta", bgm: "suspense" },
            { speaker: "gumshoe", pose: "salute", text: "时间戳在这里。警方摘要写的是零点十五分，但原片其实早了四十七秒。", focus: "gumshoe" },
            { speaker: "phoenix", pose: "think", text: "四十七秒足够改变两声枪响的先后，却不足以告诉我们第二个人是谁。" },
            { speaker: "maya", pose: "think", text: "这张边缘有一道细长的反光，好像还有一艘船？" },
            { speaker: "lotta", reaction: "shocked", text: "我当时只盯着正中央，真没注意那块。" },
            { speaker: "gumshoe", reaction: "nervous", text: "如果摘要漏了第二个移动目标，我得重新写报告……工资大概也要重新扣一次。" },
            { speaker: "phoenix", pose: "point", text: "先别给它名字。我们只记一件事：湖面上可能存在第二个移动目标。", emphasis: true },
            { speaker: "maya", pose: "cheer", text: "终于有一条不是狩魔检察官替我们写好的结论了。" },
            { speaker: null, text: "雾从湖面压向码头。没有人欢呼，因为新的空白同时意味着新的风险。", wait: 600 },
            { speaker: "phoenix", pose: "normal", text: "把原片封存。明天在法庭上，我们只说照片真正能证明的范围。" },
          ],
        },
        {
          title: "证物柜里的旧编号",
          background: "evidence-room",
          summary: "证物保管室。糸锯找到旧案封存物的编号错位；一件金属证物曾被重新登记，但经手签名缺失。",
          lines: [
            { speaker: "gumshoe", pose: "present-report", text: "旧案的箱号是D-6-17，可这张再登记单写成了D-6-71。两个箱子都真实存在。", bgm: "suspense" },
            { speaker: "phoenix", pose: "think", text: "抄错数字不稀奇，稀奇的是为什么有人为错号开过一次柜门。" },
            { speaker: "maya", pose: "think", text: "经手人那栏被空着了。" },
            { speaker: "gumshoe", reaction: "nervous", text: "按规程不该空。可十五年前的纸档里，确实就这一页没有签名。" },
            { speaker: "mia", pose: "normal", text: "不要从空白直接跳到凶手。先问：谁有权限让空白留下来？", focus: "mia" },
            { speaker: "phoenix", reaction: "shocked", text: "千寻姐……" },
            { speaker: "maya", reaction: "surprised", text: "姐姐能维持的时间不长，你快问重点。" },
            { speaker: "phoenix", pose: "point", text: "如果那件证物后来又出现在别的案件里，就会留下新的登记痕迹。" },
            { speaker: "gumshoe", pose: "determined", text: "我去查跨案转移记录。只查编号和日期，不碰推论。" },
            { speaker: "mia", pose: "point", text: "很好。把对手最擅长的东西还给他——精确。", emphasis: true },
            { speaker: null, text: "证物室的门重新上锁。真正危险的不是缺失的签名，而是有人曾经相信它永远不会被追问。", wait: "input" },
          ],
        },
      ],
    },
    {
      title: "第二章 · 证词一层层剥离",
      summary: "法庭重新开庭。夏美与灰根分别证明自己的观察边界，狩魔豪试图把所有模糊地带重新解释为对御剑不利的确定事实。",
      scenes: [
        {
          title: "照片不能替人作证",
          background: "courtroom",
          summary: "夏美重新说明原片时间和湖面反光。狩魔豪强调照片的直观印象，成步堂则迫使法庭区分“看到什么”和“认定是谁”。",
          lines: [
            { speaker: "judge", pose: "stern", text: "本庭继续审理。今天只接受能够说明来源的证据与证词。", bgm: "cross-examination" },
            { speaker: "von-karma", pose: "normal", text: "当然。模糊只属于准备不足的人。", focus: "von-karma" },
            { speaker: "phoenix", pose: "normal", text: "那么我们就从一张没有被摘要替代的原片开始。" },
            { speaker: "lotta", pose: "camera", text: "原片时间比报告里写的早四十七秒。我承认，之前我没核对底片背面的机器记录。" },
            { speaker: "von-karma", pose: "accuse", text: "四十七秒改变不了被告出现在湖上的事实。" },
            { speaker: "phoenix", pose: "point", text: "异议。我们现在讨论的不是被告是否去过湖边，而是两声枪响之间谁在移动。", emphasis: true, flash: 0.55, sfx: "objection" },
            { speaker: "judge", reaction: "confused", text: "照片上确实还有一处细长反光。" },
            { speaker: "lotta", reaction: "shocked", text: "它在连续两张底片上的位置变了。要么是水面反射，要么确实有东西在动。" },
            { speaker: "edgeworth", pose: "normal", text: "如果是第二艘小艇，就意味着我记忆里的距离关系可能从一开始就错了。" },
            { speaker: "von-karma", pose: "accuse", text: "被告的记忆没有证据价值。" },
            { speaker: "phoenix", pose: "desk", text: "所以我没有把它当证据。我只要求检方停止把一张照片解释成它没有拍到的身份。", shake: 0.5, sfx: "desk-slam" },
            { speaker: "judge", pose: "stern", text: "准许。照片暂时只能证明湖面存在无法识别的第二移动反光。" },
            { speaker: "von-karma", pose: "normal", text: "很好。辩方终于学会了用最慢的方式抵达一个无用结论。" },
            { speaker: "phoenix", pose: "think", text: "无用的结论不会让你急着替它下定义。" },
          ],
        },
        {
          title: "灰根的名字",
          background: "witness-stand",
          summary: "灰根不再扮演糊涂船屋管理员，而是承认自己与旧案的关系。他的证词仍有罪责问题，但打破了狩魔豪对旧案叙事的垄断。",
          lines: [
            { speaker: "yogi", pose: "normal", text: "十五年很长。长到一个人可以练习忘记自己的名字。", bgm: "suspense" },
            { speaker: "judge", reaction: "confused", text: "证人，请明确说明你的身份。" },
            { speaker: "yogi", pose: "stern", text: "灰根高太郎。旧法院的法警，也是那场电梯事故后被推到所有人面前的人。" },
            { speaker: "edgeworth", reaction: "damaged", text: "……" },
            { speaker: "von-karma", pose: "accuse", text: "一个承认欺骗警方多年的男人，没有资格要求本庭相信他的回忆。" },
            { speaker: "phoenix", pose: "point", text: "他的回忆可以被质疑，但他的身份可以被档案验证。两件事不要混在一起。" },
            { speaker: "yogi", pose: "stern", text: "我恨过御剑家，也做过不可原谅的事。可有人利用那份恨，把十五年前的真相藏在我身后。" },
            { speaker: "von-karma", pose: "normal", text: "含沙射影。" },
            { speaker: "yogi", reaction: "broken", text: "我只知道，那天之后，有人来找过我，告诉我只要闭嘴，世界就会接受一个方便的答案。" },
            { speaker: "phoenix", pose: "think", text: "你能确认来访者是谁吗？" },
            { speaker: "yogi", pose: "normal", text: "不能。隔着门，只听见声音。我不会再把猜测说成看见。" },
            { speaker: "judge", pose: "stern", text: "这点很重要。本庭记录：证人不能确认来访者身份。" },
            { speaker: "von-karma", pose: "accuse", text: "于是辩方又得到一片空白。" },
            { speaker: "phoenix", pose: "normal", text: "空白至少诚实。被填错的答案才会杀死一个案子。" },
          ],
        },
      ],
    },
    {
      title: "第三章 · 十五年前的封口",
      summary: "旧法院电梯厅与检察官办公室的资料把证物编号、伤势记录和狩魔豪的权限第一次连成可核验的时间链。",
      scenes: [
        {
          title: "电梯门关闭以前",
          background: "elevator-hall",
          summary: "千寻帮助众人按时间而非传闻重建旧案。御剑首次把童年记忆与客观记录分开陈述。",
          lines: [
            { speaker: "mia", pose: "normal", text: "从现在起，每个人只说自己能证明的那一格。不要急着拼完整幅图。", bgm: "suspense" },
            { speaker: "phoenix", pose: "think", text: "电梯停电、三个人受困、缺氧、争执，然后传出枪声。" },
            { speaker: "edgeworth", pose: "normal", text: "我记得自己扔出过一样东西，也记得父亲倒下。但中间有大片空白。" },
            { speaker: "mia", pose: "point", text: "那就把空白保留。童年创伤不是录像带。" },
            { speaker: "maya", pose: "think", text: "旧案照片里，电梯外的走廊有第四个人经过的时间记录吗？" },
            { speaker: "phoenix", pose: "point", text: "警卫巡逻表显示，枪响后两分钟有人以检察官权限进入封锁区域。" },
            { speaker: "edgeworth", reaction: "surprised", text: "检察官权限？" },
            { speaker: "mia", reaction: "concerned", text: "这仍然只是权限卡。和门禁卡一样，不能直接等同于某个人。" },
            { speaker: "phoenix", pose: "think", text: "但十五年前能在那个时间调用该级权限的人很少。" },
            { speaker: "edgeworth", pose: "normal", text: "狩魔豪就在那栋楼里。那天他刚被我父亲逼出职业生涯第一次处分。" },
            { speaker: "maya", reaction: "surprised", text: "动机、机会、权限……终于开始重叠了。" },
            { speaker: "mia", pose: "normal", text: "重叠不等于定罪。下一步是找能把权限与身体痕迹连接起来的东西。" },
            { speaker: null, text: "电梯门没有回答任何问题。但这一次，众人不再要求记忆替它回答。", wait: 900 },
          ],
        },
        {
          title: "检察官没有提交的病历",
          background: "prosecutor-office",
          summary: "糸锯找到跨案转移记录与一份缺页医疗索引。狩魔豪曾在旧案当夜接受取出金属异物的秘密治疗，却没有留下正常报销记录。",
          lines: [
            { speaker: "gumshoe", pose: "salute", text: "查到了！D-6-71后来被并入一批“无关金属物”，经手部门正好是检察系统。", bgm: "trial" },
            { speaker: "phoenix", pose: "think", text: "谁签的接收？" },
            { speaker: "gumshoe", reaction: "nervous", text: "还是没有人名。但批次授权码属于高级检察官办公室。" },
            { speaker: "edgeworth", pose: "normal", text: "那年拥有这个授权等级的人不超过三位。" },
            { speaker: "maya", pose: "think", text: "桌上的旧医疗索引又是什么？" },
            { speaker: "gumshoe", pose: "normal", text: "私人诊所的纸质索引。旧案当夜，有一名匿名患者接受肩部金属异物处理。" },
            { speaker: "phoenix", reaction: "shocked", text: "肩部……" },
            { speaker: "edgeworth", reaction: "damaged", text: "如果那枚异物来自电梯里的第二发子弹……" },
            { speaker: "mia", pose: "point", text: "别说如果。找对应的影像编号。" },
            { speaker: "gumshoe", pose: "salute", text: "影像编号被划掉了，但纸张压痕还在。我让鉴识组做侧光扫描。" },
            { speaker: "phoenix", pose: "desk", text: "这次我们不需要狩魔豪承认。只需要让每一份他以为互不相干的记录，在法庭上同时出现。", emphasis: true, shake: 0.45 },
            { speaker: "edgeworth", pose: "point", text: "然后由我来确认检察系统的授权规则。" },
            { speaker: "maya", pose: "cheer", text: "这才像真正的包围圈。" },
          ],
        },
      ],
    },
    {
      title: "第四章 · 所有人都把问题推回去",
      summary: "最终审理中，矢张的意外证词、糸锯的记录、御剑的权限说明、千寻对证据边界的提醒与成步堂的逻辑链最终把狩魔豪逼到必须解释自身伤势的位置。",
      scenes: [
        {
          title: "矢张闯进来的证词",
          background: "courtroom",
          summary: "矢张突然提交自己当晚捡到的一张停车凭条。它本身不能证明凶手，却让狩魔豪关于自己从未接近湖区的说法出现时间冲突。",
          lines: [
            { speaker: "judge", pose: "stern", text: "本庭已经给过辩方足够时间。若没有新的可核验证据——", bgm: "cross-examination" },
            { speaker: "witness", pose: "confident", text: "有！我有！而且这次不是爱情问题！", focus: "witness", sfx: "hold-it" },
            { speaker: "phoenix", reaction: "shocked", text: "矢张！？你为什么会在这里？" },
            { speaker: "witness", reaction: "sweat", text: "我昨晚去湖边找丢掉的画材，捡到一张停车凭条。后来看到新闻才觉得不对。" },
            { speaker: "von-karma", pose: "accuse", text: "来源不明的垃圾。" },
            { speaker: "gumshoe", pose: "salute", text: "凭条编号能在停车场服务器里找到，打印时间也能核对。" },
            { speaker: "edgeworth", pose: "point", text: "登记车辆属于检察系统公车池。使用权限记录在案发前被手工覆盖。" },
            { speaker: "von-karma", pose: "normal", text: "公车不是私人车辆。任何有权限的人都可能使用。" },
            { speaker: "phoenix", pose: "point", text: "完全正确。所以我们仍然不说驾驶者是谁。", emphasis: true },
            { speaker: "judge", reaction: "confused", text: "辩方似乎在替检方排除自己的推论？" },
            { speaker: "phoenix", pose: "normal", text: "因为真正的问题不是“车是谁开的”，而是为什么检方此前声称没有任何检察系统车辆接近湖区。" },
            { speaker: "gumshoe", reaction: "nervous", text: "那份“无车辆记录”的摘要，是上级直接要求我引用的。" },
            { speaker: "von-karma", pose: "accuse", text: "警员的工作疏失与本案无关。" },
            { speaker: "witness", pose: "nervous", text: "喂，我第一次带来有用东西，你们别又把我赶出去啊。" },
            { speaker: "maya", pose: "cheer", text: "放心，这次你至少把一扇门踢开了。" },
            { speaker: "phoenix", pose: "desk", text: "接下来，只剩门后那个人必须解释为什么所有记录都朝同一个方向缺了一块。", shake: 0.6, wait: "input", sfx: "desk-slam" },
          ],
        },
        {
          title: "最后的异议",
          background: "courtroom",
          summary: "众人各自只提供自己能证明的一段：糸锯提供记录，御剑说明权限，夏美限定照片，灰根承认自身罪责，千寻约束推理边界，成步堂最终要求狩魔豪解释旧案当夜的肩部伤势。",
          lines: [
            { speaker: "von-karma", pose: "normal", text: "你们堆了整整一天的碎片，没有一片写着我的名字。", bgm: "pursuit" },
            { speaker: "phoenix", pose: "think", text: "因为名字从来不是证据。我们有的是时间、权限、伤势和被人为切断的记录。" },
            { speaker: "lotta", pose: "camera", text: "我的照片只证明湖上有第二个移动影子。别再拿它替任何人认脸。" },
            { speaker: "yogi", pose: "stern", text: "我的证词只证明有人想让我继续沉默。我不会再替那个人编身份。" },
            { speaker: "gumshoe", pose: "salute", text: "我的记录证明旧案证物被检察系统重新登记，也证明湖区车辆摘要不完整。" },
            { speaker: "edgeworth", pose: "point", text: "而我证明那些授权码的等级。十五年前与今天，能够越过这些程序的人都极少。" },
            { speaker: "mia", pose: "normal", text: "没有任何一条单独足以定罪。重要的是，它们彼此独立，却在同一个缺口汇合。" },
            { speaker: "maya", pose: "think", text: "那个缺口，就是第二发子弹去了哪里。" },
            { speaker: "judge", pose: "stern", text: "狩魔检察官，本庭要求你回答：旧案当夜，你是否接受过肩部金属异物治疗？" },
            { speaker: "von-karma", pose: "accuse", text: "荒谬。医疗隐私不能被这种拼图游戏撕开。" },
            { speaker: "phoenix", pose: "point", text: "我们已经有诊所索引、时间、部位和被划掉的影像编号。现在只缺合法调取后的比对。", emphasis: true },
            { speaker: "edgeworth", reaction: "surprised", text: "如果影像中的金属物与旧案弹道一致……" },
            { speaker: "von-karma", pose: "accuse", text: "闭嘴，御剑。你没有资格质疑教你如何站在这里的人。" },
            { speaker: "edgeworth", reaction: "damaged", text: "正因为是你教的，我才知道检察官最不能做的事，就是害怕证据被验证。" },
            { speaker: "phoenix", pose: "desk", text: "异议！", flash: 1, shake: 0.9, emphasis: true, sfx: "objection" },
            { speaker: "phoenix", pose: "point", text: "你今天每一次反对，都不是在否定数据，而是在阻止数据彼此相遇。" },
            { speaker: "mia", pose: "point", text: "真正自信的证据，不怕交叉验证。" },
            { speaker: "gumshoe", reaction: "nervous", text: "鉴识组刚送到侧光结果。被划掉的影像编号还能读出来。" },
            { speaker: "judge", reaction: "surprised", text: "立即提交。" },
            { speaker: "gumshoe", pose: "salute", text: "编号对应的患者登记，使用的是检察系统内部结算码。授权人……狩魔豪。" },
            { speaker: "von-karma", reaction: "breakdown", text: "……你们以为这样就结束了？", flash: 0.7, sfx: "impact" },
            { speaker: "witness", reaction: "shocked", text: "哇，连我都听出来这次不妙了。" },
            { speaker: "lotta", reaction: "shocked", text: "相机开着呢。放心，我这次只拍，不替照片写结论。" },
            { speaker: "yogi", reaction: "broken", text: "十五年了。终于有人要求真正该解释的人解释。" },
            { speaker: "edgeworth", pose: "normal", text: "我不需要你替我决定十五年前我是什么人。只需要你回答你做过什么。" },
            { speaker: "maya", reaction: "sad", text: "所有人都被那一天困住太久了。" },
            { speaker: "phoenix", pose: "normal", text: "裁判长，我们申请调取完整医疗影像，并重新审查旧案证物链。在结果出来以前，任何把御剑描述为唯一可能枪手的结论都不成立。" },
            { speaker: "judge", pose: "stern", text: "准许。并命令保全全部相关记录。" },
            { speaker: "von-karma", reaction: "breakdown", text: "四十年的完美……竟被一群只会说“我不知道”的人逼到这里。", shake: 0.75 },
            { speaker: "mia", pose: "normal", text: "承认不知道，往往是真相开始出现的地方。" },
            { speaker: "judge", pose: "normal", text: "本庭休庭。下一次开庭，只讨论能够被验证的事实。", sfx: "gavel" },
            { speaker: null, text: "法槌落下。没有人宣布胜利，但围绕十五年的沉默第一次失去了控制叙事的人。", wait: "input" },
          ],
        },
      ],
    },
  ],
};

function effectToken(id:string,type:string,params:Record<string,unknown>,subject?:TypedToken["subject"]):TypedToken {
  return {id,type,params,...(subject?{subject}:{})};
}

function decorateScene(document:ScriptDocument, scene:CaseScene):ScriptDocument {
  const next=structuredClone(document);
  const dialogue=next.blocks.filter(block=>block.type==="dialogue");
  scene.lines.forEach((line,index)=>{
    const block=dialogue[index];
    if(!block||block.type!=="dialogue")return;
    const textIndex=block.content.findIndex(node=>node.type==="text");
    if(textIndex<0)return;
    const before=[];
    const after=[];
    if(line.bgm)before.push({type:"token" as const,token:effectToken(`${block.id}-bgm`,"courtroom.bgm",{resource:{packId:courtroomDemoPack.id,id:`audio/bgm/${line.bgm}`}})});
    if(line.sfx)before.push({type:"token" as const,token:effectToken(`${block.id}-sfx`,"courtroom.sfx",{resource:{packId:courtroomDemoPack.id,id:`audio/sfx/${line.sfx}`}})});
    if(line.focus)before.push({type:"token" as const,token:effectToken(`${block.id}-focus`,"courtroom.focus",{}, {kind:"cast",id:line.focus})});
    if(line.emphasis)before.push({type:"token" as const,token:effectToken(`${block.id}-emphasis`,"courtroom.emphasis",{mode:"strong"})});
    if(line.flash!==undefined)after.push({type:"token" as const,token:effectToken(`${block.id}-flash`,"courtroom.flash",{intensity:line.flash})});
    if(line.shake!==undefined)after.push({type:"token" as const,token:effectToken(`${block.id}-shake`,"courtroom.shake",{intensity:line.shake,durationMs:420})});
    if(line.wait!==undefined)after.push({type:"token" as const,token:effectToken(`${block.id}-wait`,"courtroom.wait",typeof line.wait==="number"?{mode:"time",durationMs:line.wait}:{mode:"input"})});
    block.content.splice(textIndex,0,...before);
    block.content.push(...after);
  });
  return next;
}

export const sampleStories = [{
  id: story.id,
  title: story.title,
  summary: story.summary,
  chapters: story.chapters.length,
  scenes: story.chapters.reduce((count,chapter)=>count+chapter.scenes.length,0),
}];

export function normalizeSampleCast(manifest:ProjectManifest):ProjectManifest {
  if(!manifest.projectId.startsWith("sample-"))return manifest;
  const next=structuredClone(manifest);
  for(const cast of next.cast){
    if(cast.characterRef.packId!==courtroomDemoPack.id)continue;
    const actor=courtroomDemoPack.characters.find(person=>person.id===cast.characterRef.id);
    if(actor)cast.displayName=actor.name;
  }
  return next;
}

export function createSampleStory(id:string,prefix:string):YahariProjectFile {
  if(id!==story.id)throw new Error(`Unknown sample story: ${id}`);
  const outline:StoryOutline={
    title:story.title,summary:story.summary,cast:story.cast,
    chapters:story.chapters.map(chapter=>({
      title:chapter.title,summary:chapter.summary,
      scenes:chapter.scenes.map(({title,summary,background})=>({title,summary,background})),
    })),
  };
  const docs=story.chapters.flatMap((chapter,chapterIndex)=>
    chapter.scenes.map((scene,sceneIndex)=>
      decorateScene(buildCourtroomScene({lines:scene.lines},outline,chapterIndex,sceneIndex,courtroomDemoPack,prefix),scene)));
  return createProjectFile(generatedManifest(demoManifest,outline,docs,prefix),docs);
}
