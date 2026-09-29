import { generatedManifest, outlinePrompt, validateDetectedOutline, validateOutline, type StoryOutline } from '../../../packages/story-ai/src/outline.js';
import { requestJson, type ModelConfig } from '../../../packages/story-ai/src/model.js';
import { planPrompt, reviewPrompt, sceneContext, validateSceneCast, validateSemanticReview, validateStoryPlan, type AdaptationMode, type SemanticFinding, type StoryPlan } from '../../../packages/story-ai/src/plan.js';
import { createProjectFile, type ScriptDocument, type YahariProjectFile, type ProjectManifest } from '../../../packages/core/src/index.js';
import { courtroomDemoPack as pack } from '../../../content-packs/courtroom-demo/pack.js';
import { buildCourtroomScene, courtroomAdapter, courtroomScenePrompt } from '../../../packages/adapters/courtroom/src/index.js';

const DRAFT_KEY='yahari:story-draft:v3';
const OLD_DRAFT_KEYS=['yahari:story-draft:v2','yahari:story-draft:v1'];
type ReviewState={findings:SemanticFinding[]|null;error?:string};

export function installStoryDialog(base:ProjectManifest,apply:(project:YahariProjectFile)=>boolean):()=>void {
  const dialog=document.createElement('dialog');
  dialog.className='project-dialog story-dialog';
  dialog.setAttribute('aria-label','故事转剧本');
  dialog.innerHTML=`<div class="story-body">
    <div class="story-heading"><h2>故事转剧本</h2><button type="button" id="story-close" class="small-button">返回写作</button></div>
    <p>先识别人物和目录大纲。请逐一将故事人物绑定到演出形象，再建立场景契约并生成台词。</p>
    <details class="model-settings" open><summary>连接模型</summary><div class="story-grid">
      <label>模型来源<select id="story-provider" data-lock><option value="router">OpenRouter API</option><option value="chatgpt">ChatGPT 账户额度</option></select></label>
      <label>模型 ID<input id="story-model" data-lock placeholder="填写 OpenRouter 模型 ID" autocomplete="off"></label>
      <label class="wide" id="story-key-row">OpenRouter API Key<input id="story-key" data-lock type="password" autocomplete="off" placeholder="仅本次页面会话使用"></label>
    </div><label class="story-check"><input id="story-json" data-lock type="checkbox" checked> 请求 JSON 模式（模型不支持时可关闭）</label>
    <p class="project-note" id="story-provider-note">OpenRouter 模式直接使用你的 OpenRouter API；密钥只留在页面内存，不保存到草稿或作品。</p>
    <button id="story-test" data-lock class="small-button">测试当前通道（一次简短请求）</button><button id="story-clear-key" data-lock class="small-button">清除 OpenRouter Key</button></details>
    <label>改编方式<select id="story-mode" data-lock><option value="faithful">忠实改编：不新增关键事实</option><option value="expand">允许扩写：标记新增事实</option><option value="original">原创续写：可补充设定</option></select></label>
    <label class="field-label" for="story-input">故事原文</label><textarea id="story-input" data-lock rows="7" maxlength="60000" placeholder="粘贴故事、梗概或事件经过…"></textarea>
    <div class="story-actions"><button id="story-outline" data-lock class="create-button">1. 识别人物与生成大纲</button><button id="story-cancel" class="secondary-button" disabled>取消请求</button></div>
    <p id="story-status" role="status" aria-live="polite">故事与生成草稿保存在本机；当前作品不会自动覆盖。</p>
    <p id="story-elapsed" role="status" hidden></p>
    <section id="story-review" hidden><h3>检查人物、大纲与场景契约</h3>
      <p class="project-note">场景摘要供阅读；入口、转折、出口和事实边界约束台词。修改目录大纲需重建契约；修改某场契约仅清除该场及后续生成草稿。</p>
      <div id="story-fields"></div>
      <label class="story-check"><input id="story-audit" type="checkbox" checked> 生成后逐场检查连续性（每场增加一次模型请求）</label>
      <div class="story-actions"><button id="story-plan" data-lock class="secondary-button">重建事实与场景契约</button><button id="story-generate" data-lock class="create-button">3. 生成全部场景 / 继续</button><button id="story-review-pending" data-lock class="secondary-button">检查未检查的场景</button><button id="story-apply" data-lock class="secondary-button">4. 导入为新作品</button></div>
    </section>
    <div id="story-results"></div>
  </div>`;
  document.body.append(dialog);
  const el=<T extends HTMLElement>(id:string)=>dialog.querySelector<T>('#'+id)!;
  let outline:StoryOutline|null=null,plan:StoryPlan|null=null,docs:ScriptDocument[]=[],reviews:ReviewState[]=[];
  let source='',prefix='',mode:AdaptationMode='faithful',controller:AbortController|null=null,bindingsConfirmed=false;
  const total=()=>outline?.chapters.reduce((n,c)=>n+c.scenes.length,0)??0;
  const complete=()=>!!outline&&!!plan&&docs.length===total();
  const status=(message:string)=>{el('story-status').textContent=message;};
  const errorText=(e:unknown)=>e instanceof Error?e.message:'生成失败。';
  function save(){
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify({outline,plan,docs,reviews,source,prefix,mode,bindingsConfirmed,input:el<HTMLTextAreaElement>('story-input').value}));}
    catch{status('本机空间不足，生成草稿未保存，请及时导入并导出。');}
  }
  function config():ModelConfig {
    const provider=el<HTMLSelectElement>('story-provider').value;
    if(provider==='chatgpt') return {provider:'chatgpt-account',model:el<HTMLInputElement>('story-model').value,
      jsonMode:el<HTMLInputElement>('story-json').checked,accountEndpoint:'/api/chatgpt/responses'};
    return {provider:'openrouter',baseUrl:'https://openrouter.ai/api/v1',model:el<HTMLInputElement>('story-model').value,
      apiKey:el<HTMLInputElement>('story-key').value,jsonMode:el<HTMLInputElement>('story-json').checked};
  }
  function syncProvider(){
    const chatgpt=el<HTMLSelectElement>('story-provider').value==='chatgpt';
    el('story-key-row').hidden=chatgpt;
    el<HTMLButtonElement>('story-clear-key').hidden=chatgpt;
    const model=el<HTMLInputElement>('story-model');
    model.placeholder=chatgpt?'可留空，由账户通道选择默认模型':'填写 OpenRouter 模型 ID';
    el('story-provider-note').textContent=chatgpt
      ?'ChatGPT 账户额度模式不使用 OpenAI API Key。当前前端会调用同源账户推理桥；若部署环境尚未提供该能力，会明确提示并可切回 OpenRouter。'
      :'OpenRouter 模式直接使用你的 OpenRouter API；密钥只留在页面内存，不保存到草稿或作品。';
  }
  function busy(on:boolean){
    dialog.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|HTMLButtonElement>('[data-lock]').forEach(node=>node.disabled=on);
    el<HTMLButtonElement>('story-cancel').disabled=!on;
    el<HTMLButtonElement>('story-plan').disabled=on||!outline||!bindingsConfirmed;
    el<HTMLButtonElement>('story-generate').disabled=on||!plan||!bindingsConfirmed;
    el<HTMLButtonElement>('story-review-pending').disabled=on||!plan||!docs.length||!bindingsConfirmed;
    el<HTMLButtonElement>('story-apply').disabled=on||!complete()||!bindingsConfirmed;
    el('story-fields').querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select').forEach(node=>node.disabled=on);
    const bind=dialog.querySelector<HTMLButtonElement>('#story-bind');if(bind)bind.disabled=on||!outline||bindingsConfirmed;
  }
  function resultView(){
    const target=el('story-results');target.replaceChildren();
    for(let i=0;i<docs.length;i++){
      const doc=docs[i],review=reviews[i];
      const details=document.createElement('details'),heading=document.createElement('summary');
      const count=doc.blocks.filter(b=>b.type==='dialogue').length;
      heading.textContent=doc.title+' · '+count+' 句 · '+(!review||review.findings===null?'待检查':review.findings.length?review.findings.length+' 条疑点':'检查通过');
      details.append(heading);
      if(review?.error){const p=document.createElement('p');p.className='story-warning';p.textContent='连续性检查未完成：'+review.error;details.append(p);}
      for(const finding of review?.findings??[]){
        const p=document.createElement('p');p.className='story-warning';
        p.textContent='第 '+(finding.line+1)+' 句 · '+finding.message+'（依据：'+finding.basis+'）';details.append(p);
      }
      for(const block of doc.blocks){
        if(block.type!=='dialogue')continue;
        const p=document.createElement('p');
        p.textContent=(outline?.cast.find(c=>c.id===block.speaker?.castId)?.name??'旁白')+'：'+block.content.map(n=>n.type==='text'?n.text:'［动作］').join('');
        details.append(p);
      }
      const actions=document.createElement('div');actions.className='story-actions';
      const retry=document.createElement('button');retry.className='small-button';retry.textContent='重生成本场';
      retry.disabled=!!controller||!plan||!bindingsConfirmed;retry.onclick=()=>void run(()=>generateAt(i,true));
      const check=document.createElement('button');check.className='small-button';check.textContent='重新检查';
      check.disabled=!!controller||!plan||!bindingsConfirmed;check.onclick=()=>void run(()=>reviewAt(i));
      actions.append(retry,check);details.append(actions);target.append(details);
    }
    busy(!!controller);
  }
  function invalidateAll(){
    plan=null;docs=[];reviews=[];
    el('story-fields').querySelectorAll('.plan-details').forEach(node=>node.remove());
    status('目录大纲已修改；请重建事实与场景契约。');save();resultView();
  }
  function invalidateFrom(index:number){
    docs=docs.slice(0,index);reviews=reviews.slice(0,index);
    status('场景契约已修改；第 '+(index+1)+' 场及后续需要重新生成。');save();resultView();
  }
  function field(parent:HTMLElement,label:string,value:string,set:(value:string)=>void,multiline=false){
    const wrapper=document.createElement('label');wrapper.textContent=label;
    const input=document.createElement(multiline?'textarea':'input');input.value=value;
    input.addEventListener('input',()=>set(input.value));wrapper.append(input);parent.append(wrapper);
  }
  function listField(parent:HTMLElement,label:string,items:string[],set:(items:string[])=>void){
    field(parent,label,items.join('\n'),value=>set(value.split('\n').map(s=>s.trim()).filter(Boolean)),true);
  }
  function renderOutline(){
    const target=el('story-fields');target.replaceChildren();el('story-review').hidden=!outline;
    if(!outline)return;
    const o=outline;
    field(target,'作品名',o.title,v=>{o.title=v;invalidateAll()});
    field(target,'作品摘要',o.summary,v=>{o.summary=v;invalidateAll()},true);
    const cast=document.createElement('details'),cs=document.createElement('summary');
    cs.textContent='2. 确认人物绑定 · '+o.cast.length+' 人'+(bindingsConfirmed?'（已确认）':'（待确认）');cast.append(cs);cast.open=!bindingsConfirmed;
    for(const c of o.cast){
      const row=document.createElement('div');row.className='story-grid';
      field(row,'故事人物',c.name,v=>{c.name=v;invalidateAll()});
      const label=document.createElement('label');label.textContent='演出形象';
      const select=document.createElement('select');
      select.add(new Option('请选择演出形象',''));
      for(const actor of pack.characters)select.add(new Option(actor.name,actor.id));
      select.value=c.characterId;select.onchange=()=>{c.characterId=select.value;bindingsConfirmed=false;invalidateAll();renderOutline()};
      label.append(select);row.append(label);cast.append(row);
    }
    const bind=document.createElement('button');bind.id='story-bind';bind.type='button';bind.className='create-button';bind.textContent='确认人物绑定并建立契约';
    bind.onclick=()=>void run(async()=>{
      if(!outline)return;
      if(outline.cast.some(c=>!c.characterId))throw new Error('请先为每位故事人物选择演出形象。');
      outline=validateOutline(outline,pack);
      bindingsConfirmed=true;save();await makePlan();
    });
    cast.append(bind);
    target.append(cast);
    if(plan){
      const ledger=document.createElement('details');ledger.className='plan-details';
      const h=document.createElement('summary');h.textContent='事实账本 · '+plan.ledger.length+' 条';ledger.append(h);
      for(const fact of plan.ledger){
        const p=document.createElement('p');p.className='story-fact';
        p.textContent=fact.id+' · '+fact.kind+' · '+fact.text+(fact.sourceQuote?'〔原文：'+fact.sourceQuote+'〕':'');
        ledger.append(p);
      }
      target.append(ledger);
    }
    let flat=0;
    o.chapters.forEach((chapter,ci)=>{
      const section=document.createElement('details');section.open=true;
      const summary=document.createElement('summary');summary.textContent='第 '+(ci+1)+' 章 · '+chapter.scenes.length+' 场';section.append(summary);
      field(section,'章名',chapter.title,v=>{chapter.title=v;invalidateAll()});
      field(section,'章摘要',chapter.summary,v=>{chapter.summary=v;invalidateAll()},true);
      chapter.scenes.forEach((scene,si)=>{
        const index=flat++;
        const sd=document.createElement('details'),sh=document.createElement('summary');
        sh.textContent=(ci+1)+'.'+(si+1)+' '+scene.title;sd.append(sh);
        field(sd,'场景名',scene.title,v=>{scene.title=v;sh.textContent=(ci+1)+'.'+(si+1)+' '+v;invalidateAll()});
        field(sd,'场景摘要',scene.summary,v=>{scene.summary=v;invalidateAll()},true);
        const label=document.createElement('label');label.textContent='初始背景';
        const select=document.createElement('select');
        for(const background of pack.backgrounds)select.add(new Option(background.label,background.id));
        select.value=scene.background;select.onchange=()=>{scene.background=select.value;invalidateAll()};
        label.append(select);sd.append(label);
        const contract=plan?.contracts[index];
        if(contract){
          const c=document.createElement('details');c.className='plan-details';
          const cs=document.createElement('summary');cs.textContent='场景契约 · 入口 / 转折 / 出口';c.append(cs);
          listField(c,'在场人物 ID（每行一个）',contract.castIds,v=>{contract.castIds=v;invalidateFrom(index)});
          listField(c,'引用的事实 ID（每行一个）',contract.factIds,v=>{contract.factIds=v;invalidateFrom(index)});
          listField(c,'入口状态',contract.entry,v=>{contract.entry=v;invalidateFrom(index)});
          listField(c,'必要转折',contract.requiredTurns,v=>{contract.requiredTurns=v;invalidateFrom(index)});
          listField(c,'出口状态',contract.exit,v=>{contract.exit=v;invalidateFrom(index)});
          listField(c,'不能当作既定事实的主张',contract.forbiddenEstablishedClaims,v=>{contract.forbiddenEstablishedClaims=v;invalidateFrom(index)});
          sd.append(c);
        }
        section.append(sd);
      });
      target.append(section);
    });
    resultView();
  }
  async function call(system:string,user:string){
    const active=controller!;
    const timer=window.setTimeout(()=>active.abort(),180000);
    try{return await requestJson(config(),system,user,active.signal)}finally{clearTimeout(timer)}
  }
  async function run(task:()=>Promise<void>){
    if(controller)return;controller=new AbortController();busy(true);
    const began=Date.now();const elapsed=el('story-elapsed');elapsed.hidden=false;
    const tick=()=>{elapsed.textContent='本次操作已等待 '+Math.floor((Date.now()-began)/1000)+' 秒 · 每次请求最多等待180秒，可随时取消';};
    tick();const ticker=window.setInterval(tick,1000);
    try{await task()}catch(e){status(errorText(e))}
    finally{clearInterval(ticker);elapsed.hidden=true;controller=null;busy(false);resultView();save()}
  }
  async function makePlan(){
    if(!outline)throw new Error('请先生成大纲。');
    if(!bindingsConfirmed)throw new Error('请先确认每位人物的演出形象。');
    if(el<HTMLTextAreaElement>('story-input').value.trim()!==source)throw new Error('故事已修改，请先重新生成大纲。');
    status('正在建立事实账本与逐场契约…');
    const next=validateStoryPlan(await call(planPrompt(outline,mode),JSON.stringify({story:source,outline})),outline,source,mode);
    const old=plan;
    plan=next;
    const changed=old?next.contracts.findIndex((contract,i)=>{
      const previous=old.contracts[i];
      if(JSON.stringify(contract)!==JSON.stringify(previous))return true;
      const facts=(p:StoryPlan,c:typeof contract)=>p.ledger.filter(f=>c.factIds.includes(f.id));
      return JSON.stringify(facts(next,contract))!==JSON.stringify(facts(old,previous));
    }):0;
    if(changed>=0)docs=docs.slice(0,changed);
    reviews=docs.map(()=>({findings:null}));
    renderOutline();status('契约已建立：'+next.ledger.length+' 条事实、'+next.contracts.length+' 场。可先修改，再生成台词。');save();
  }
  async function reviewAt(index:number){
    if(!plan||!docs[index])throw new Error('此场还没有剧本。');
    const doc=docs[index],contract=plan.contracts[index];
    const lines=doc.blocks.filter(b=>b.type==='dialogue').map(b=>({
      speaker:b.speaker?.castId??null,text:b.content.filter(n=>n.type==='text').map(n=>n.text).join('')}));
    status('正在检查第 '+(index+1)+' 场连续性…');
    const findings=validateSemanticReview(await call(reviewPrompt(),JSON.stringify({
      contract,ledger:plan.ledger.filter(f=>contract.factIds.includes(f.id)),
      previousExit:plan.contracts[index-1]?.exit??[],
      previousSceneEnding:docs[index-1]?.blocks.filter(b=>b.type==='dialogue').slice(-4).map(b=>({
        speaker:b.speaker?.castId??null,text:b.content.filter(n=>n.type==='text').map(n=>n.text).join('')
      }))??[],lines
    })),lines.length);
    reviews[index]={findings};save();resultView();
    status('第 '+(index+1)+' 场检查完成：'+findings.length+' 条疑点。');
  }
  async function generateAt(index:number,replacing=false){
    if(!outline||!plan||!bindingsConfirmed)throw new Error('请先确认人物绑定并建立场景契约。');
    validateOutline(outline,pack);
    if(el<HTMLTextAreaElement>('story-input').value.trim()!==source)throw new Error('故事已修改，请先重新生成大纲。');
    plan=validateStoryPlan(plan,outline,source,mode);
    const contract=plan.contracts[index],chapterIndex=contract.chapter-1,sceneIndex=contract.scene-1;
    status('正在生成 '+(index+1)+'/'+total()+'：'+outline.chapters[chapterIndex].scenes[sceneIndex].title);
    const value=await call(courtroomScenePrompt(outline,pack,contract.castIds),JSON.stringify(sceneContext(outline,plan,source,index,docs[index-1])));
    const doc=buildCourtroomScene(value,outline,chapterIndex,sceneIndex,pack,prefix);
    validateSceneCast(doc,contract);
    const manifest={...base,cast:outline.cast.map(x=>({castId:x.id,displayName:x.name,characterRef:{packId:pack.id,id:x.characterId}}))};
    const context={manifest,contentPacks:[pack]};
    const errors=courtroomAdapter.validate(doc,context).filter(d=>d.severity==='error');
    if(errors.length)throw new Error('场景检查未通过：'+errors[0].message+'。可重试当前场景。');
    courtroomAdapter.compile(doc,context);
    docs[index]=doc;reviews[index]={findings:null};
    if(replacing)for(let later=index+1;later<docs.length;later++)reviews[later]={findings:null};
    save();resultView();
    if(el<HTMLInputElement>('story-audit').checked){
      try{await reviewAt(index)}
      catch(e){reviews[index]={findings:null,error:errorText(e)};save();resultView();if(controller?.signal.aborted)throw e;}
    }
  }
  el('story-test').onclick=()=>void run(async()=>{
    status('正在测试连接；不会发送故事原文…');
    const result=await call('Return only a JSON object with ok set to true.','Connection test.');
    if(!result||typeof result!=='object'||(result as {ok?:unknown}).ok!==true)throw new Error('接口已响应，但模型未返回约定JSON；请检查模型和JSON模式。');
    status('连接成功，模型可返回JSON。可开始识别故事人物。');
  });
  el('story-outline').onclick=()=>void run(async()=>{
    const input=el<HTMLTextAreaElement>('story-input').value.trim();
    if(!input)throw new Error('请先填写故事。');
    mode=el<HTMLSelectElement>('story-mode').value as AdaptationMode;
    status('正在拆分章节与场景…');
    outline=validateDetectedOutline(await call(outlinePrompt(pack,mode),input),pack);
    source=input;prefix='story-'+crypto.randomUUID();plan=null;docs=[];reviews=[];bindingsConfirmed=false;
    renderOutline();save();status('已识别 '+outline.cast.length+' 位人物。请逐一选择演出形象，再确认绑定。');
  });
  el('story-plan').onclick=()=>void run(makePlan);
  el('story-generate').onclick=()=>void run(async()=>{
    if(!plan)return;
    for(let index=docs.length;index<total();index++){
      if(controller!.signal.aborted)throw new Error('已取消；已完成场景仍保留。');
      await generateAt(index);
    }
    status('全部 '+docs.length+' 场已完成。可展开检查疑点，再导入作品。');
  });
  el('story-review-pending').onclick=()=>void run(async()=>{
    for(let index=0;index<docs.length;index++){
      if(controller!.signal.aborted)throw new Error('检查已取消。');
      if(!reviews[index]||reviews[index].findings===null)await reviewAt(index);
    }
  });
  el('story-apply').onclick=()=>{
    if(!outline||!plan||!complete()||!bindingsConfirmed||controller)return;
    try{
      if(el<HTMLTextAreaElement>('story-input').value.trim()!==source)throw new Error('故事已修改，请重新生成大纲。');
      validateOutline(outline,pack);validateStoryPlan(plan,outline,source,mode);
      if(apply(createProjectFile(generatedManifest(base,outline,docs,prefix),docs)))dialog.close();
    }catch(e){status(errorText(e))}
  };
  el('story-cancel').onclick=()=>controller?.abort();
  el('story-close').onclick=()=>{controller?.abort();save();dialog.close()};
  dialog.addEventListener('cancel',()=>{controller?.abort();save()});
  el('story-clear-key').onclick=()=>{el<HTMLInputElement>('story-key').value='';status('OpenRouter Key 已清除。')};
  el('story-provider').onchange=()=>{syncProvider();};
  el('story-mode').addEventListener('change',()=>{
    mode=el<HTMLSelectElement>('story-mode').value as AdaptationMode;
    if(outline)invalidateAll();else save();
  });
  el('story-input').addEventListener('input',save);
  try{
    const raw=JSON.parse(localStorage.getItem(DRAFT_KEY)??OLD_DRAFT_KEYS.map(key=>localStorage.getItem(key)).find(Boolean)??'null');
    if(raw&&typeof raw.input==='string')el<HTMLTextAreaElement>('story-input').value=raw.input;
    if(raw?.mode==='expand'||raw?.mode==='original')mode=raw.mode;
    el<HTMLSelectElement>('story-mode').value=mode;
    if(raw?.outline){
      outline=validateOutline(raw.outline,pack,true);
      bindingsConfirmed=raw.bindingsConfirmed===true;
      source=typeof raw.source==='string'?raw.source:'';
      prefix=typeof raw.prefix==='string'?raw.prefix:'story-'+crypto.randomUUID();
      if(raw.plan)plan=validateStoryPlan(raw.plan,outline,source,mode);
      if(Array.isArray(raw.docs)){
        let i=0;
        for(let c=0;c<outline.chapters.length;c++)for(let s=0;s<outline.chapters[c].scenes.length;s++,i++){
          const d=raw.docs[i];if(!d)continue;
          if(i!==docs.length)throw new Error('Non-contiguous draft');
          const lines=d.blocks?.filter((b:any)=>b.type==='dialogue').map((b:any)=>({
            speaker:b.speaker?.castId??null,text:b.content.filter((n:any)=>n.type==='text').map((n:any)=>n.text).join(''),
            pose:b.content.find((n:any)=>n.type==='token'&&n.token.type==='courtroom.pose')?.token.params.pose??null,
            reaction:b.content.find((n:any)=>n.type==='token'&&n.token.type==='courtroom.reaction')?.token.params.reaction??null
          }));
          const doc=buildCourtroomScene({lines},outline,c,s,pack,prefix);
          if(plan)validateSceneCast(doc,plan.contracts[i]);
          docs.push(doc);
        }
      }
      reviews=docs.map((doc,i)=>{
        try{
          const rawReview=raw.reviews?.[i];
          if(!rawReview||!Array.isArray(rawReview.findings))return {findings:null};
          return {findings:validateSemanticReview(rawReview,doc.blocks.filter(b=>b.type==='dialogue').length)};
        }catch{return {findings:null}}
      });
      renderOutline();
      status(bindingsConfirmed?(plan?'已恢复生成草稿。':'已恢复大纲；可重建事实与场景契约。'):'已恢复草稿；请检查并确认每位人物的绑定。');
    }
  }catch{outline=null;plan=null;docs=[];reviews=[];status('旧生成草稿无法完整恢复；原始存储未删除，可重新生成。')}
  syncProvider();
  busy(false);
  return ()=>dialog.showModal();
}
