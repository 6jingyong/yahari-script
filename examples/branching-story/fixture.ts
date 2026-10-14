import { createProjectFile, type ScriptDocument, type DialogueBlock } from '../../packages/core/src/index.js';
import { demoManifest } from '../courtroom-demo-project/fixture.js';
import { courtroomDemoPack } from '../../content-packs/courtroom-demo/pack.js';

/** Sample cast is explicit; AI-generated works require the author's own binding step. */
export function createBranchSample(prefix = 'branch-demo') {
  const manifest = structuredClone(demoManifest);
  manifest.projectId = prefix; manifest.title = '雨停之前';
  manifest.cast = [{ castId: 'chen', displayName: '陈默', characterRef: { packId: courtroomDemoPack.id, id: 'phoenix' } }, { castId: 'lin', displayName: '林遥', characterRef: { packId: courtroomDemoPack.id, id: 'maya' } }, { castId: 'zhou', displayName: '周衡', characterRef: { packId: courtroomDemoPack.id, id: 'edgeworth' } }];
  const scenes: Array<[string, string, string, Array<[string | null, string]>]> = [
    ['opening', '雨夜的来信', '一封匿名信指向三年前消失的档案。', [[null, '档案室关门前，你收到一封没有署名的信。信上只有一句话：雨停之前，查清那一天。'], ['lin', '当年负责登记的人就在楼上。监控室也还亮着灯。'], ['chen', '时间有限，我们先从哪里开始？']]],
    ['monitor', '监控里的七分钟', '你在记录中找到时间差。', [['lin', '这段影像的时钟比门禁记录慢了七分钟。'], ['chen', '所以，报告上的时间可能根本不对应画面。'], [null, '你记下时间差，带着疑问回到档案室。']]],
    ['witness', '没有签字的登记表', '你听到登记人员的另一种说法。', [['zhou', '我只负责整理，最终的登记不是我签的。'], ['chen', '但报告写着，你亲自确认过交接。'], ['zhou', '那句话……是后来补上的。'], [null, '你记下这处矛盾，带着疑问回到档案室。']]],
    ['confront', '最后一次交接', '疑点让周衡重新面对当年的决定。', [['chen', '今天查到的疑点，足以说明那份报告还不能作为结论。'], ['zhou', '我知道。那天我听见有人争执，却没有写进报告。'], ['lin', '我们还可以找到新的证人。现在，你准备怎么做？']]],
    ['public', '结局 · 重新开卷', '你把疑点公开，申请重新调查。', [['chen', '先把我们确定的事情公开。缺少的部分交给新的调查。'], ['zhou', '这次，我会正式作证。'], [null, '雨停了。旧档案重新编号，封面上留下了新的日期。']]],
    ['private', '结局 · 留灯的人', '你先留住愿意说出真相的人。', [['chen', '我们先把你知道的经过完整记下来，然后一起找那位证人。'], ['lin', '我去联系他。你们等我。'], [null, '雨还在下。档案室的灯没有熄灭，有人终于开始写那份迟到的陈述。']]],
  ];
  const documents: ScriptDocument[] = scenes.map(([id, title, summary, lines]) => ({ schemaVersion: '0.7', documentId: `${prefix}-${id}`, title, summary,
    blocks: [{ id: `${id}-background`, type: 'cue', cue: { id: `${id}-background-token`, type: 'courtroom.background', params: { resource: courtroomDemoPack.backgrounds.find(b => b.id === 'lobby')!.resource } } },
      ...lines.map(([castId, text], index): DialogueBlock => ({ id: `${id}-line-${index}`, type: 'dialogue', speaker: castId ? { castId } : null, content: [{ type: 'text', text }] }))],
  }));
  const id = (suffix: string) => `${prefix}-${suffix}`;
  manifest.entryDocumentId = id('opening'); manifest.documents = documents.map(d => ({ id: d.documentId, path: `${d.documentId}.json` }));
  manifest.narrative = { summary: '一个雨夜，一封匿名信让三个人重新面对迟到了三年的证词。两次选择，两种结局。', chapters: [{ id: id('chapter-1'), title: '第一章 · 雨夜调查', summary: '选择你的调查方向。', documentIds: ['opening', 'monitor', 'witness'].map(id) }, { id: id('chapter-2'), title: '第二章 · 如何面对真相', summary: '让迟到的证词走向不同的明天。', documentIds: ['confront', 'public', 'private'].map(id) }] };
  manifest.flow = { version: 1, routes: [
    { documentId: id('opening'), exit: { type: 'choice', prompt: '先调查哪条线索？', options: [{ id: 'monitor', label: '查看监控记录', targetDocumentId: id('monitor') }, { id: 'witness', label: '询问当年的登记人员', targetDocumentId: id('witness') }] } },
    ...['monitor', 'witness'].map(suffix => ({ documentId: id(suffix), exit: { type: 'next' as const, targetDocumentId: id('confront') } })),
    { documentId: id('confront'), exit: { type: 'choice', prompt: '怎样让这份证词被听见？', options: [{ id: 'public', label: '公开疑点，申请重新调查', targetDocumentId: id('public') }, { id: 'private', label: '先私下记录，再寻找证人', targetDocumentId: id('private') }] } },
    { documentId: id('public'), exit: { type: 'ending', title: '重新开卷', description: '你为旧档案打开了一条公开调查的路。' } },
    { documentId: id('private'), exit: { type: 'ending', title: '留灯的人', description: '你为愿意说话的人留下了一盏灯。' } },
  ] };
  return createProjectFile(manifest, documents);
}
