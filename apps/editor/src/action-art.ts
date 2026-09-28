import type { TypedToken } from '../../../packages/core/src/index.js';

const icons:Record<string,[string,string]>={
 pose:['🧍','姿势'],reaction:['😮','表情'],wait:['⏳','等待'],focus:['🎥','镜头'],
 emphasis:['❗','强调'],flash:['✨','闪光'],shake:['💥','震动'],sfx:['🔊','音效'],bgm:['🎵','音乐'],background:['🏛️','背景'],
};
const names:Record<string,string>={normal:'平常',point:'指证',sweat:'冒汗',surprised:'惊讶',objection:'异议',trial:'法庭音乐',courtroom:'法庭',think:'思考',desk:'拍桌',shocked:'震惊',smile:'轻松',bow:'抱臂',smug:'从容',damaged:'崩溃',cheer:'加油',sad:'沮丧',stern:'严肃',confused:'困惑',nervous:'紧张',confident:'自信',fist:'握拳',laugh:'轻笑',science:'科学调查',mad:'恼火',wave:'挥手','thumbs-up':'鼓励','witness-stand':'证人席',lobby:'候审室','hold-it':'等一下','desk-slam':'拍桌',gavel:'法槌',impact:'冲击','cross-examination':'询问',suspense:'疑点',pursuit:'追击'};
export function actionLabel(token:TypedToken):string {
 const kind=token.type.split('.').at(-1)??'';
 const value=token.params.pose??token.params.reaction;
 if(typeof value==='string')return names[value]??value;
 if(kind==='wait')return token.params.mode==='input'?'等待点击':`等待 ${Number(token.params.durationMs??0)/1000} 秒`;
 if(kind==='emphasis')return '强调';
 if(kind==='flash')return Number(token.params.intensity??1)<0.7?'轻闪':'强闪';
 if(kind==='shake')return Number(token.params.intensity??1)<0.7?'轻震':'强震';
 const resource=token.params.resource as {id?:string}|undefined;
 if(resource?.id){const id=resource.id.split('/').at(-1)!;return names[id]??icons[kind]?.[1]??id;}
 return icons[kind]?.[1]??kind;
}
/** Shared action vocabulary: appearance is independent of the acting character. */
export function actionArt(token:TypedToken,_character?:string):HTMLElement {
 const art=document.createElement('span');art.className='action-art';art.setAttribute('aria-hidden','true');
 const kind=token.type.split('.').at(-1)??'';
 const pose=String(token.params.pose??token.params.reaction??'');
 const shared:Record<string,string>={normal:'🙂',point:'☝️',sweat:'😅',surprised:'😮',think:'🤔',desk:'✋',shocked:'😱',bow:'😐',smug:'😏',damaged:'😖',cheer:'🙌',sad:'😢',stern:'😠',confused:'❓',nervous:'😰',confident:'😎',fist:'✊',laugh:'😄',science:'🔬',mad:'😠',objection:'❗',wave:'👋','thumbs-up':'👍'};
 art.textContent=shared[pose]??(kind==='wait'&&token.params.mode==='input'?'👆':icons[kind]?.[0]??'🎬');
 return art;
}
