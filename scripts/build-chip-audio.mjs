import {readFileSync,writeFileSync} from 'node:fs';

// Original motifs for narrative roles, preserving previously published resource IDs.
const midi=n=>Math.round(440*2**((n-69)/12)*100)/100;
const tone=(pitch,durationMs,offsetMs=0,gain=.04,waveform='square')=>({frequency:midi(pitch),durationMs,offsetMs,gain,waveform});
const hit=(durationMs,offsetMs=0,gain=.035,frequency=1800)=>({frequency,durationMs,offsetMs,gain,waveform:'noise'});
const effect=(id,label,category,description,notes)=>({id,label,category,description,resource:`audio/sfx/${id}`,previewAudio:{waveform:'square',notes}});
const sfx=[
  effect('objection','异议！','courtroom','打断证言、指出决定性矛盾。',[tone(52,80),tone(59,80,65),tone(64,150,130,.05),hit(50,125,.018)]),
  effect('hold-it','等一下！','courtroom','追问一个尚未解释的细节。',[tone(72,65),tone(65,110,65)]),
  effect('take-that','看招！','courtroom','提交证据并给出结论。',[tone(60,55),tone(67,55,55),tone(76,160,110)]),
  effect('impact','冲击','dialogue','对话重音或突如其来的转折。',[hit(95),tone(40,140,10,.04,'triangle')]),
  effect('gavel','法槌','courtroom','法官敲槌，收回发言权。',[hit(48,0,.06,700),tone(36,100,12,.045,'triangle')]),
  effect('evidence-presented','出示证物','evidence','证物进入画面或提交法庭。',[tone(67,65),tone(71,65,65),tone(79,120,130)]),
  effect('dramatic-sting','戏剧转折','dialogue','揭露出乎意料的事实。',[tone(56,90),tone(55,90,85),tone(48,170,170),hit(60,165,.02)]),
  effect('positive','正确','transition','推理成立或行动成功。',[tone(72,70),tone(76,70,70),tone(79,130,140)]),
  effect('negative','错误','transition','行动失败或推理不成立。',[tone(60,100),tone(54,170,95)]),
  effect('realization','恍然','dialogue','人物突然想通一个细节。',[tone(79,55),tone(84,160,60,.03,'triangle')]),
  effect('cursor','移动光标','ui','移动选项或切换证物。',[tone(84,28,0,.026)]),
  effect('confirm','确认选择','ui','确认菜单或选项。',[tone(76,38),tone(84,60,38)]),
  effect('cancel','返回取消','ui','关闭菜单或取消选择。',[tone(79,42),tone(72,55,42)]),
  effect('page-turn','翻页','ui','翻阅档案或切换记录页。',[hit(45,0,.022,3200),hit(28,50,.012,2200)]),
  effect('text-low','对白 · 低音','dialogue','默认文字音，随对白逐字播放；也可绑定人物或单独设置本句。',[tone(48,24,0,.025)]),
  effect('text-high','对白 · 高音','dialogue','较高声线的文字音，可绑定人物或单独设置本句。',[tone(72,24,0,.023)]),
  effect('surprise','惊讶','dialogue','人物受到惊吓或骤然反应。',[tone(81,50),tone(75,100,45),hit(40,0,.015)]),
  effect('thinking','思索','dialogue','停顿、斟酌或陷入思考。',[tone(62,70,0,.025,'triangle'),tone(65,100,120,.025,'triangle')]),
  effect('testimony-start','证言开始','courtroom','证人开始陈述一段证言。',[tone(60,75),tone(67,75,75),tone(63,75,150),tone(72,170,225)]),
  effect('cross-examination-start','询问开始','courtroom','进入质证或追问阶段。',[tone(67,60),tone(70,60,60),tone(74,60,120),tone(79,140,180)]),
  effect('court-murmur','法庭骚动','courtroom','旁听席躁动或众人议论。',[hit(95,0,.025,800),hit(85,100,.02,1100),hit(110,180,.02,650)]),
  effect('record-open','打开法庭记录','evidence','打开资料或检索证物。',[tone(64,45),tone(71,80,45)]),
  effect('clue-found','发现线索','evidence','找到新证物或重要记录。',[tone(69,60),tone(76,60,60),tone(81,140,120,.03,'triangle')]),
  effect('contradiction','矛盾锁定','evidence','两项事实发生明确冲突。',[tone(58,60),tone(64,60,60),tone(70,110,120),hit(65,120,.02)]),
  effect('evidence-error','证据不符','evidence','证据与当前主张不匹配。',[tone(66,80),tone(60,110,80)]),
  effect('scene-transition','场景切换','transition','段落结束、转入另一场景。',[tone(72,50),tone(67,50,50),tone(60,110,100,.025,'triangle')]),
  effect('verdict-not-guilty','无罪判决','transition','法庭宣布无罪或完成正向结局。',[tone(60,80),tone(64,80,80),tone(67,80,160),tone(72,240,240)]),
  effect('verdict-guilty','有罪判决','transition','法庭宣布有罪或到达沉重结局。',[tone(55,100),tone(51,100,100),tone(48,260,200,.04,'triangle')]),
  effect('chapter-complete','章节完成','transition','章节收束，为下一章留出停顿。',[tone(67,85),tone(72,85,85),tone(76,160,170,.025,'triangle')]),
  effect('save','记录保存','ui','完成一项记录或保存。',[tone(79,50),tone(86,85,55,.025,'triangle')]),
  effect('desk-slam','拍桌','courtroom','拍击桌面，强调当前论点。',[hit(70,0,.05,600),tone(38,120,8,.045,'triangle')]),
  effect('truth-reveal','真相揭示','evidence','关键证据揭示新的事实。',[tone(64,75),tone(71,75,75),tone(76,160,150)]),
  effect('whip','鞭击','courtroom','快速打断发言或突然施压。',[hit(24,0,.055,3500),hit(70,24,.025,900)]),
  effect('camera','拍照','evidence','记录现场或拍摄证物。',[hit(18,0,.03,2700),hit(42,25,.022,1200)]),
  effect('magic','魔术','dialogue','轻快的奇遇或出人意料的展示。',[tone(79,50,0,.028,'triangle'),tone(84,50,60,.025,'triangle'),tone(88,130,120,.025,'triangle')]),
];
const music=(id,label,category,description,pattern,bass,loopMs=2400,waveform='square')=>{
  const step=loopMs/16;
  return{id,label,category,description,resource:`audio/bgm/${id}`,previewAudio:{waveform,loopMs,notes:[
    ...pattern.map((pitch,i)=>tone(pitch,step*.66,i*step,.022,waveform)),
    ...Array.from({length:8},(_,i)=>tone(bass[i%bass.length],step*1.45,i*step*2,.028,'triangle')),
    ...Array.from({length:8},(_,i)=>hit(Math.min(55,step*.3),i*step*2+step,.008,i%2?2500:1000)),
  ]}};
};
const bgm=[
  music('trial','开庭','courtroom','正式开庭与法庭上的基础对话。',[60,67,63,65,60,67,68,65,62,69,65,67,63,70,67,65],[36,39,38,43]),
  music('cross-examination','询问','testimony','平稳地逐条核对证词。',[65,68,67,72,65,70,68,67,63,67,65,70,63,68,67,65],[41,44,39,43],2000),
  music('suspense','疑点','emotion','危险未明、气氛逐渐收紧。',[57,58,64,58,57,63,58,64,55,56,62,56,55,61,56,62],[33,34,31,32],3000,'triangle'),
  music('pursuit','追击','pursuit','矛盾确认后连续推进论证。',[69,72,76,74,69,77,76,72,67,71,74,76,72,79,77,76],[45,41,43,40],1600),
  music('investigation','调查','investigation','搜集线索与普通调查对话。',[62,69,65,67,64,71,67,69,65,72,69,67,64,69,67,62],[38,41,40,45],2400,'triangle'),
  music('resolution','收束','ending','事件暂告段落，情绪回到平静。',[60,64,67,72,71,67,65,64,62,65,69,74,72,69,67,60],[36,40,38,43],3200,'triangle'),
  music('lobby','候审室','courtroom','开庭前的等待与人物交流。',[64,67,71,69,64,72,71,67,62,65,69,67,60,64,67,64],[40,45,38,43],3200,'triangle'),
  music('testimony','证言','testimony','证人陈述事实，保留推理空间。',[60,63,67,65,60,68,67,63,58,62,65,63,58,67,65,62],[36,39,34,38],2800),
  music('cross-examination-fast','询问 · 加速','testimony','证词出现破绽，追问明显加快。',[65,72,68,75,67,74,70,77,65,73,68,76,67,75,70,79],[41,44,43,46],1600),
  music('logic','逻辑推演','pursuit','把时间、证物与证词串成推理链。',[60,67,62,69,63,70,65,72,62,69,64,71,65,72,67,74],[36,38,39,41]),
  music('objection-theme','异议 · 反击','pursuit','扭转局势，提出新的论证。',[67,72,76,74,67,79,77,76,65,70,74,72,65,77,76,72],[43,40,41,38],1800),
  music('truth','真相揭示','pursuit','关键事实公开，给读者理解的时间。',[63,70,67,75,74,70,68,67,65,72,69,77,75,72,70,63],[39,43,41,46]),
  music('investigation-core','调查 · 核心','investigation','调查接近关键人物或核心证据。',[62,65,69,72,71,69,67,65,64,67,71,74,72,71,69,67],[38,41,40,43],2000),
  music('detention','拘留会面','investigation','较为低落、克制的会面。',[57,60,64,62,57,65,64,60,55,59,62,60,55,64,62,59],[33,36,31,35],3600,'triangle'),
  music('reminiscence','追忆','emotion','回忆过去与讲述人物心事。',[60,67,64,72,71,67,65,64,57,64,60,69,67,64,62,60],[36,40,33,38],4000,'triangle'),
  music('victory','胜诉','ending','解决案件后的轻快收尾。',[72,76,79,84,83,79,77,76,74,77,81,86,84,81,79,72],[36,40,41,43]),
];
const path='content-packs/courtroom-demo/catalog.json',catalog=JSON.parse(readFileSync(path,'utf8'));catalog.audio={sfx,bgm};writeFileSync(path,JSON.stringify(catalog,null,2)+'\n');
console.log(`Original 8Bit catalog: ${sfx.length} effects, ${bgm.length} music loops.`);
