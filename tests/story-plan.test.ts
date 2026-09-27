import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOutline, buildScene } from '../packages/story-ai/src/generation.js';
import { sceneContext, sceneSourceContext, validateSceneCast, validateSemanticReview, validateStoryPlan } from '../packages/story-ai/src/plan.js';
import { courtroomDemoPack as pack } from '../content-packs/courtroom-demo/pack.js';

const source='八点五十分，东侧走廊断电。吴保安说：九点我看见红衣人从东门离开。';
const outline=validateOutline({
  title:'九点的影子',summary:'停电让证词存疑。',
  cast:[{id:'lin',name:'林律师',characterId:'phoenix'},{id:'wu',name:'吴保安',characterId:'witness'}],
  chapters:[{title:'停电',summary:'检验证词。',scenes:[{title:'证词',summary:'证人陈述，辩方质疑。',background:'courtroom'}]}]
},pack);
const rawPlan={ledger:[
  {id:'outage',kind:'established',text:'东侧走廊八点五十分断电',sourceQuote:'八点五十分，东侧走廊断电。'},
  {id:'sighting',kind:'claim',text:'证人称看见红衣人从东门离开',sourceQuote:'吴保安说：九点我看见红衣人从东门离开。'},
  {id:'identity',kind:'unknown',text:'红衣人的身份仍未知'}
],contracts:[{chapter:1,scene:1,castIds:['lin','wu'],factIds:['outage','sighting','identity'],entry:['证人坚持东门目击'],requiredTurns:['证人作证','辩方提出停电'],exit:['目击方向与身份未证实'],forbiddenEstablishedClaims:['被告从东门逃离','被告无罪']}]};

test('a claim stays separate from an established fact and the scene contract survives validation',()=>{
  const plan=validateStoryPlan(rawPlan,outline,source,'faithful');
  assert.equal(plan.ledger[1].kind,'claim');
  assert.equal(plan.contracts[0].sceneId,'c1-s1');
  assert.deepEqual(plan.contracts[0].forbiddenEstablishedClaims,['被告从东门逃离','被告无罪']);
  const context=sceneContext(outline,plan,source,0);
  assert.equal(context.source,source);
  assert.deepEqual((context.ledger as any[]).map(f=>f.id),['outage','sighting','identity']);
});

test('unsupported provenance, invented faithful facts and broken references are rejected',()=>{
  const quote=structuredClone(rawPlan);quote.ledger[0].sourceQuote='不存在的停电记录';
  assert.throws(()=>validateStoryPlan(quote,outline,source,'faithful'),/逐字依据/);
  const invented=structuredClone(rawPlan);invented.ledger[2].kind='invented';
  assert.throws(()=>validateStoryPlan(invented,outline,source,'faithful'),/忠实改编/);
  assert.equal(validateStoryPlan(invented,outline,source,'expand').ledger[2].kind,'invented');
  const reference=structuredClone(rawPlan);reference.contracts[0].factIds.push('not-found');
  assert.throws(()=>validateStoryPlan(reference,outline,source,'faithful'),/未知或重复/);
});

test('long source packs relevant excerpts and scene cast rejects an unplanned speaker',()=>{
  const plan=validateStoryPlan(rawPlan,outline,source,'faithful');
  const long='无关背景。'.repeat(4000)+source+'后续文字。'.repeat(4000);
  const excerpt=sceneSourceContext(long,plan,plan.contracts[0]);
  assert.ok(excerpt.includes('八点五十分，东侧走廊断电。'));
  assert.ok(excerpt.length<=10000);
  const doc=buildScene({lines:[{speaker:'lin',text:'证词需要核对。'}]},outline,0,0,pack,'sample');
  validateSceneCast(doc,plan.contracts[0]);
  const limited=structuredClone(plan.contracts[0]);limited.castIds=['wu'];
  assert.throws(()=>validateSceneCast(doc,limited),/未允许人物/);
});

test('semantic warning can name an overclaim without becoming a hard fact gate',()=>{
  const findings=validateSemanticReview({findings:[{code:'evidence',line:0,message:'剪辑不能证明缺失片段的内容。',basis:'原件尚未核验'}]},2);
  assert.equal(findings[0].code,'evidence');
  assert.throws(()=>validateSemanticReview({findings:[{code:'evidence',line:3,message:'x',basis:'y'}]},2),/格式不正确/);
});

test('missing thirteen seconds stay unknown while the edited export is grounded',()=>{
  const recording='采访记录显示五十四秒。导出的录音只有四十一秒。叶律师说：缺少的十三秒内容还不知道。';
  const secondOutline=validateOutline({
    title:'消失的十三秒',summary:'核对录音来源。',
    cast:[{id:'ye',name:'叶律师',characterId:'phoenix'}],
    chapters:[{title:'核验',summary:'对比长度。',scenes:[{title:'时长差异',summary:'确认差异，等待原件。',background:'courtroom'}]}]
  },pack);
  const secondPlan=validateStoryPlan({ledger:[
    {id:'original-length',kind:'established',text:'采访记录为五十四秒',sourceQuote:'采访记录显示五十四秒。'},
    {id:'export-length',kind:'established',text:'导出录音为四十一秒',sourceQuote:'导出的录音只有四十一秒。'},
    {id:'missing-content',kind:'unknown',text:'缺失十三秒的具体内容未知'}
  ],contracts:[{chapter:1,scene:1,castIds:['ye'],factIds:['original-length','export-length','missing-content'],
    entry:['导出录音被用作证据'],requiredTurns:['对比时长'],exit:['暂不依赖导出文件，等待核验原件'],
    forbiddenEstablishedClaims:['缺失片段证明被告无罪']}]
  },secondOutline,recording,'faithful');
  assert.equal(secondPlan.ledger[2].kind,'unknown');
  assert.ok((sceneContext(secondOutline,secondPlan,recording,0).ledger as any[]).some(f=>f.id==='missing-content'));
  const overclaim=structuredClone(secondPlan);overclaim.ledger[2]={id:'missing-content',kind:'established',text:'缺失片段证明无罪',sourceQuote:'缺失十三秒证明无罪'};
  assert.throws(()=>validateStoryPlan(overclaim,secondOutline,recording,'faithful'),/逐字依据/);
});
