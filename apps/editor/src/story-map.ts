import { orderedSceneIds, sceneExit, type YahariProjectFile } from '../../../packages/core/src/index.js';

export interface StoryMapNode { id:string; row:number; column:number; reachable:boolean; chapterId:string }
export interface StoryMapEdge { from:string; to:string; label:string; loop:boolean }
export interface StoryMapLayout { nodes:StoryMapNode[]; edges:StoryMapEdge[]; rows:number; columns:number }

/** Collapse cycles before assigning rows, so loops cannot scramble or stall the map. */
export function layoutStoryMap(project:YahariProjectFile):StoryMapLayout {
  const order=orderedSceneIds(project.manifest),ids=new Set(order),index=new Map(order.map((id,i)=>[id,i]));
  const edges:StoryMapEdge[]=order.flatMap(id=>{
    const exit=sceneExit(project.manifest,id);
    return exit.type==='choice'?exit.options.map(o=>({from:id,to:o.targetDocumentId,label:o.label,loop:false})):exit.type==='next'?[{from:id,to:exit.targetDocumentId,label:'',loop:false}]:[];
  }).filter(e=>ids.has(e.to));
  const outgoing=new Map(order.map(id=>[id,[] as string[]])),incoming=new Map(order.map(id=>[id,[] as string[]]));
  for(const e of edges){outgoing.get(e.from)!.push(e.to);incoming.get(e.to)!.push(e.from);}
  const visited=new Set<string>(),finish:string[]=[];
  for(const id of order){
    const stack:Array<[string,boolean]>=[[id,false]];
    while(stack.length){const [id,done]=stack.pop()!;if(done){finish.push(id);continue;}if(visited.has(id))continue;visited.add(id);stack.push([id,true]);for(const target of outgoing.get(id)!)if(!visited.has(target))stack.push([target,false]);}
  }
  const components:string[][]=[],componentOf=new Map<string,number>();
  for(const id of finish.reverse()){
    if(componentOf.has(id))continue;const group:string[]=[],stack=[id],number=components.length;
    while(stack.length){const next=stack.pop()!;if(componentOf.has(next))continue;componentOf.set(next,number);group.push(next);stack.push(...incoming.get(next)!);}
    group.sort((a,b)=>index.get(a)!-index.get(b)!);components.push(group);
  }
  const next=components.map(()=>new Set<number>()),degree=components.map(()=>0),depth=components.map(()=>0);
  for(const e of edges){const from=componentOf.get(e.from)!,to=componentOf.get(e.to)!;if(from!==to&&!next[from].has(to)){next[from].add(to);degree[to]++;}}
  const queue=components.map((_,i)=>i).filter(i=>!degree[i]);
  for(let cursor=0;cursor<queue.length;cursor++){
    const group=queue[cursor];for(const target of next[group]){depth[target]=Math.max(depth[target],depth[group]+components[group].length);if(--degree[target]===0)queue.push(target);}
  }
  const reachable=new Set<string>(),stack=[project.manifest.entryDocumentId];
  while(stack.length){const id=stack.pop()!;if(!ids.has(id)||reachable.has(id))continue;reachable.add(id);stack.push(...outgoing.get(id)!);}
  const nodes:StoryMapNode[]=order.map(id=>{
    const group=componentOf.get(id)!;
    return {id,row:depth[group]+components[group].indexOf(id),column:0,reachable:reachable.has(id),chapterId:project.manifest.narrative?.chapters.find(c=>c.documentIds.includes(id))?.id??''};
  });
  const byRow=new Map<number,StoryMapNode[]>();
  for(const n of nodes){const row=byRow.get(n.row)??[];row.push(n);byRow.set(n.row,row);}
  const columns=Math.max(1,...[...byRow.values()].map(row=>row.length));
  for(const row of byRow.values())row.forEach((n,i)=>{n.column=(columns-row.length)/2+i;});
  for(const edge of edges)edge.loop=nodes.find(n=>n.id===edge.to)!.row<=nodes.find(n=>n.id===edge.from)!.row;
  return {nodes,edges,rows:Math.max(0,...nodes.map(n=>n.row+1)),columns};
}

interface MapHooks { select(id:string):void; thumbnail(id:string):string|undefined }
const WIDTH=210,HEIGHT=120,COLUMN=254,ROW=176,LEFT=64,TOP=24;
export function installStoryMap(host:HTMLElement,hooks:MapHooks) {
  const viewport=document.createElement('div');viewport.className='story-map-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','剧情路线图，可滚动浏览');
  const surface=document.createElement('div');surface.className='story-map-surface';const canvas=document.createElement('div');canvas.className='story-map-canvas';surface.append(canvas);viewport.append(surface);host.append(viewport);
  let project:YahariProjectFile,layout:StoryMapLayout,selected='',zoom=1,query='',chapter:string|null=null;
  const points=new Map<string,{x:number;y:number}>();
  function size(){surface.style.width=`${(LEFT+layout.columns*COLUMN+48)*zoom}px`;surface.style.height=`${(TOP+layout.rows*ROW+48)*zoom}px`;canvas.style.transform=`scale(${zoom})`;canvas.style.left=`max(0px, calc((100% - ${(LEFT+layout.columns*COLUMN+48)*zoom}px) / 2))`;}
  function focus(id=selected){
    const p=points.get(id);if(!p)return;const offset=Math.max(0,(viewport.clientWidth-(LEFT+layout.columns*COLUMN+48)*zoom)/2);viewport.scrollTo({left:Math.max(0,offset+(p.x+WIDTH/2)*zoom-viewport.clientWidth/2),top:Math.max(0,p.y*zoom-100),behavior:'instant'});
  }
  function applyFilter(){
    let matches=0;
    const match=(id:string)=>{const doc=project.documents.find(d=>d.documentId===id)!,data=layout.nodes.find(n=>n.id===id)!;return (!query||`${doc.title} ${doc.summary??''}`.toLowerCase().includes(query.toLowerCase()))&&(chapter===null||data.chapterId===chapter);};
    canvas.querySelectorAll<HTMLElement>('.story-map-node').forEach(button=>{
      button.classList.toggle('is-filtered',!match(button.dataset.scene!));
      if(!button.classList.contains('is-filtered'))matches++;
    });
    return matches;
  }
  function render(next:YahariProjectFile,id:string){
    const scroll={left:viewport.scrollLeft,top:viewport.scrollTop};project=next;selected=id;layout=layoutStoryMap(next);points.clear();canvas.replaceChildren();
    const width=LEFT+layout.columns*COLUMN+48,height=TOP+layout.rows*ROW+48;
    canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
    for(let row=0;row<layout.rows;row++){const guide=document.createElement('div');guide.className='story-map-row';guide.style.top=`${TOP+row*ROW}px`;guide.textContent=String(row+1).padStart(2,'0');canvas.append(guide);}
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('story-map-lines');svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.setAttribute('aria-hidden','true');canvas.append(svg);
    const related=new Set<string>([id]);
    for(const direction of ['from','to'] as const){const pending=[id],seen=new Set<string>();while(pending.length){const current=pending.pop()!;if(seen.has(current))continue;seen.add(current);for(const edge of layout.edges)if(edge[direction]===current){const target=edge[direction==='from'?'to':'from'];related.add(target);pending.push(target);}}}
    for(const data of layout.nodes)points.set(data.id,{x:LEFT+data.column*COLUMN,y:TOP+data.row*ROW});
    for(const edge of layout.edges){
      if(layout.edges.find(e=>e.from===edge.from&&e.to===edge.to)!==edge)continue;
      const source=points.get(edge.from)!,target=points.get(edge.to)!,sx=source.x+WIDTH/2,sy=source.y+HEIGHT,tx=target.x+WIDTH/2,ty=target.y;
      const path=document.createElementNS('http://www.w3.org/2000/svg','path'),active=related.has(edge.from)&&related.has(edge.to);
      path.setAttribute('d',edge.loop?`M ${sx+WIDTH/2} ${sy-HEIGHT/2} C ${Math.max(sx,tx)+160} ${sy-HEIGHT/2}, ${Math.max(sx,tx)+160} ${ty+HEIGHT/2}, ${tx+WIDTH/2} ${ty+HEIGHT/2}`:`M ${sx} ${sy} C ${sx} ${sy+44}, ${tx} ${ty-44}, ${tx} ${ty}`);
      path.setAttribute('stroke',active?'#ae97f7':'#4b485c');path.setAttribute('fill','none');path.setAttribute('stroke-width',active?'2.5':'1.5');if(edge.loop)path.setAttribute('stroke-dasharray','5 5');svg.append(path);
      if(edge.label&&layout.edges.find(e=>e.from===edge.from&&e.to===edge.to)===edge){const labels=layout.edges.filter(e=>e.from===edge.from&&e.to===edge.to).map(e=>e.label).filter(Boolean).join(' / ');const label=document.createElement('button');label.type='button';label.className='story-map-edge-label';label.textContent=labels;label.title=`${labels} → ${project.documents.find(d=>d.documentId===edge.to)!.title}`;label.style.left=`${tx-76}px`;label.style.top=`${edge.loop?sy-10:ty-44}px`;label.onclick=()=>hooks.select(edge.to);canvas.append(label);}
    }
    for(const data of layout.nodes){
      const doc=project.documents.find(d=>d.documentId===data.id)!,exit=sceneExit(project.manifest,data.id),p=points.get(data.id)!;
      const button=document.createElement('button');button.type='button';button.className='story-map-node';button.dataset.scene=data.id;button.style.left=`${p.x}px`;button.style.top=`${p.y}px`;button.style.setProperty('--scene-color','#ae97f7');button.setAttribute('aria-pressed',String(id===data.id));
      button.classList.toggle('is-ending',exit.type==='ending');button.classList.toggle('is-unreachable',!data.reachable);button.classList.toggle('is-related',related.has(data.id));button.title=doc.summary??doc.title;
      const thumb=hooks.thumbnail(data.id);if(thumb){const image=document.createElement('img');image.src=thumb;image.alt='';image.loading='lazy';button.append(image);}
      const body=document.createElement('div');body.className='story-map-node-body';
      const tag=document.createElement('span');tag.className='story-map-node-tag';tag.textContent=data.id===project.manifest.entryDocumentId?'故事开头':exit.type==='choice'?`${exit.options.length} 个选择`:exit.type==='ending'?'结局':'场景';
      tag.hidden=data.id!==project.manifest.entryDocumentId&&exit.type==='next';
      const title=document.createElement('strong');title.textContent=doc.title;const info=document.createElement('small');info.textContent=project.manifest.narrative?.chapters.find(c=>c.id===data.chapterId)?.title||'未分章';body.append(tag,title,info);button.append(body);
      button.onclick=()=>hooks.select(data.id);button.ondblclick=()=>hooks.select(data.id);canvas.append(button);
    }
    size();applyFilter();viewport.scrollLeft=scroll.left;viewport.scrollTop=scroll.top;
  }
  let drag:{x:number;y:number;left:number;top:number}|null=null;
  viewport.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0||(event.target as HTMLElement).closest('button'))return;drag={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-panning');});
  viewport.addEventListener('pointermove',event=>{if(drag){viewport.scrollLeft=drag.left-event.clientX+drag.x;viewport.scrollTop=drag.top-event.clientY+drag.y;}});
  const stop=()=>{drag=null;viewport.classList.remove('is-panning');};viewport.addEventListener('pointerup',stop);viewport.addEventListener('pointercancel',stop);
  new ResizeObserver(()=>{if(project&&viewport.clientWidth&&viewport.clientHeight)focus();}).observe(viewport);
  function scale(value:number){zoom=Math.max(.5,Math.min(1.5,value));if(project)render(project,selected);}
  return {render,focus,firstMatch(){return canvas.querySelector<HTMLElement>('.story-map-node:not(.is-filtered)')?.dataset.scene;},zoom(delta:number){scale(zoom+delta);},fit(){scale(Math.max(.9,Math.min(1,viewport.clientWidth/(LEFT+layout.columns*COLUMN+48),viewport.clientHeight/(TOP+layout.rows*ROW+48))));viewport.scrollTop=0;viewport.scrollLeft=0;if((LEFT+layout.columns*COLUMN+48)*zoom>viewport.clientWidth)focus(selected);},filter(value:string){query=value;return applyFilter();},chapter(id:string|null,reveal=true){chapter=id;applyFilter();const first=layout.nodes.find(n=>id===null||n.chapterId===id);if(first&&reveal)focus(first.id);}};
}
