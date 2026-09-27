import type { ProjectManifest, ScriptDocument } from '../../../packages/core/src/index.js';

export interface OutlineViewInput {
  manifest: ProjectManifest;
  documents: ScriptDocument[];
  activeDocumentId: string;
  folded: Map<string, boolean>;
  onSelect(documentId: string): void;
}

export function renderOutlineTree(target: HTMLElement, input: OutlineViewInput): void {
  const {manifest, documents, activeDocumentId, folded, onSelect}=input;
  target.replaceChildren();

  const work=document.createElement('details');
  work.className='work-tree';
  const workKey=`work:${manifest.projectId}`;
  work.open=folded.get(workKey)??true;
  work.addEventListener('toggle',()=>folded.set(workKey,work.open));

  const workHeading=document.createElement('summary');
  const workLabel=document.createElement('span');
  workLabel.className='tree-label';
  workLabel.textContent='作品';
  const workTitle=document.createElement('strong');
  workTitle.textContent=manifest.title;
  const workCount=document.createElement('span');
  workCount.className='tree-count';
  workCount.textContent=`${documents.length} 场`;
  workHeading.append(workLabel,workTitle,workCount);
  const summary=document.createElement('small');
  summary.textContent=manifest.narrative?.summary || '暂无作品摘要';
  workHeading.append(summary);
  work.append(workHeading);

  const chapters=[...(manifest.narrative?.chapters ?? [])];
  const assigned=new Set(chapters.flatMap(c=>c.documentIds));
  const loose=documents.filter(d=>!assigned.has(d.documentId));
  if(loose.length) chapters.push({id:'unassigned',title:'未分章',summary:'',documentIds:loose.map(d=>d.documentId)});

  for(const chapter of chapters){
    const section=document.createElement('details');
    section.className='chapter-tree';
    section.open=folded.get(chapter.id)??true;
    section.addEventListener('toggle',()=>folded.set(chapter.id,section.open));
    const heading=document.createElement('summary');
    heading.textContent=`${chapter.title} · ${chapter.documentIds.length} 场`;
    const note=document.createElement('small');
    note.textContent=chapter.summary;
    heading.append(note);
    section.append(heading);

    for(const id of chapter.documentIds){
      const scene=documents.find(d=>d.documentId===id);
      if(!scene)continue;
      const item=document.createElement('button');
      item.type='button';
      item.className=`scene-leaf${id===activeDocumentId?' is-selected':''}`;
      if(id===activeDocumentId)item.setAttribute('aria-current','location');
      const title=document.createElement('strong');
      title.textContent=scene.title;
      const desc=document.createElement('small');
      desc.textContent=scene.summary||'暂无场景摘要';
      item.append(title,desc);
      item.onclick=()=>onSelect(id);
      section.append(item);
    }
    work.append(section);
  }
  target.append(work);
}
