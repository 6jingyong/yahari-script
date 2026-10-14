// Reads an authorized OpenRouter key from stdin; never persists it.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createProjectFile, decodeProjectFile } from '../dist/packages/core/src/index.js';
import { validateOutline, generatedManifest } from '../dist/packages/story-ai/src/outline.js';
import { buildCourtroomScene, courtroomAdapter } from '../dist/packages/adapters/courtroom/src/index.js';
import { courtroomDemoPack as pack } from '../dist/content-packs/courtroom-demo/pack.js';
import { demoManifest } from '../dist/examples/courtroom-demo-project/fixture.js';

let apiKey = readFileSync(0, 'utf8').trim();
if (!apiKey) throw new Error('Provide an authorized key on stdin.');
const output = resolve('examples/openrouter-scripts'); mkdirSync(output, {recursive:true});
const catalog = {adapters:[courtroomAdapter.manifest],contentPacks:[pack]};
const briefs = [
  {id:'bookshop',names:['青禾','小满'],backgrounds:['office','lobby'],brief:'温暖日常喜剧。两人在旧书店争论一本没有结尾的书，最后发现空白页是留给读者续写的。'},
  {id:'last-train',names:['林舟','顾宁'],backgrounds:['night-corridor','lake-dock'],brief:'轻悬疑。末班车后，一封写着明天日期的信让两人误以为有人能预知未来，最后查清是周年纪念惊喜。线索要能支撑结论。'},
  {id:'rehearsal',names:['阿遥','小夏'],backgrounds:['lobby','office'],brief:'后台喜剧。演出前十分钟道具消失，两人决定把寻找道具的过程演成开场，失物意外成为包袱。'},
];
const reports = [];
for (const brief of briefs) {
  const target = resolve(output, `${brief.id}.yahari-project.json`);
  if (existsSync(target)) { reports.push(JSON.parse(readFileSync(resolve(output,`${brief.id}.generation.json`),'utf8'))); continue; }
  const actors = [pack.characters.find(c=>c.id==='phoenix'),pack.characters.find(c=>c.id==='maya')];
  const cast = actors.map((actor,i)=>({id:i?'b':'a',name:brief.names[i],characterId:actor.id}));
  const system = `你是原创中文小剧场编剧。只输出完整合法 JSON，最后必须闭合所有括号。格式 {"title":"作品名","summary":"摘要","scenes":[{"title":"场景名","summary":"摘要","lines":[{"speaker":"a","text":"台词","pose":null,"reaction":null}]}]}。正好两场，每场6句，台词自然，有推进与结尾，最多600汉字。角色 a=${cast[0].name}，b=${cast[1].name}。speaker 只允许字符串 a 或 b。pose/reaction 均填 null。不要角色映射、不要代码围栏。`;
  let payload, value;
  for (let attempt=0; attempt<2; attempt++) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(180000),
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({model:'cohere/north-mini-code:free',messages:[{role:'system',content:system},{role:'user',content:brief.brief}],response_format:{type:'json_object'},max_tokens:5000,stream:false}),
    });
    if (!response.ok) throw new Error(`Free model request returned HTTP ${response.status}; no paid fallback.`);
    payload = await response.json();
    const choice = payload.choices?.[0];
    if (choice?.finish_reason==='length') throw new Error('Free model output was truncated.');
    try {
      value = JSON.parse(choice.message.content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
      if (Array.isArray(value.scenes)) value.chapters=value.scenes.map(scene=>({title:scene.title,summary:scene.summary,scenes:[scene]}));
      if (!Array.isArray(value.chapters) || value.chapters.flatMap(c=>c.scenes ?? []).length!==2) throw new Error('Expected two scenes.');
      break;
    } catch {
      writeFileSync(resolve(output,`${brief.id}.failed-attempt-${attempt+1}.json`),JSON.stringify({model:payload.model,usage:payload.usage,content:choice?.message?.content},null,2));
      if (attempt===1) throw new Error('Free model did not return the requested complete two-scene JSON.');
    }
  }
  let sceneNumber=0;
  const outline = validateOutline({...value,cast,chapters:value.chapters.map(chapter=>({...chapter,scenes:chapter.scenes.map(scene=>({...scene,background:brief.backgrounds[sceneNumber++]}))}))}, pack);
  const prefix = `openrouter-${brief.id}`;
  const documents = outline.chapters.flatMap((chapter,i)=>chapter.scenes.map((_,j)=>buildCourtroomScene(value.chapters[i].scenes[j],outline,i,j,pack,prefix)));
  const manifest = generatedManifest(demoManifest,outline,documents,prefix);
  const project = createProjectFile(manifest,documents,{generator:'OpenRouter free model sample',exportedAt:new Date().toISOString()});
  const decoded = decodeProjectFile(project,catalog);
  if (!decoded.ok || decoded.kind!=='project' || decoded.availability!=='ready') throw new Error('Generated project failed import validation.');
  const context = {manifest,contentPacks:[pack]};
  for (const document of documents) {
    if (courtroomAdapter.validate(document,context).some(d=>d.severity==='error')) throw new Error('Generated dialogue failed semantic validation.');
    courtroomAdapter.compile(document,context);
  }
  const report = {id:brief.id,title:project.manifest.title,requestedModel:'cohere/north-mini-code:free',actualModel:payload.model,usage:payload.usage,generatedAt:new Date().toISOString(),scenes:documents.length,dialogues:documents.reduce((n,d)=>n+d.blocks.filter(b=>b.type==='dialogue').length,0),brief:brief.brief};
  writeFileSync(target,JSON.stringify(project,null,2));
  writeFileSync(resolve(output,`${brief.id}.generation.json`),JSON.stringify(report,null,2));
  reports.push(report);
  process.stdout.write(JSON.stringify({id:report.id,title:report.title,model:report.actualModel,tokens:report.usage?.total_tokens,cost:report.usage?.cost,scenes:report.scenes,dialogues:report.dialogues})+'\n');
}
apiKey = '';
writeFileSync(resolve(output,'generation-report.json'),JSON.stringify(reports,null,2));
