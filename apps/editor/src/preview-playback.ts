import type { CourtroomInstruction } from '../../../packages/adapters/courtroom/src/index.js';

export const DEFAULT_CHARACTER_MS = 35;
export interface PlaybackSnapshot {
  position:number; partialText:string; page:number; count:number; complete:boolean; waiting:boolean; loading:boolean;
}
export interface PlaybackClock { schedule(callback:()=>void, delay:number):()=>void }
/** Each speaker instruction marks a dialogue block, including repeated speakers. */
export function paragraphRanges(instructions:readonly CourtroomInstruction[]):Array<{start:number;end:number}> {
  if(!instructions.length)return [];
  const starts=instructions.flatMap((c,i)=>c.op==='speaker'?[i]:[]);
  if(!starts.length)return [{start:0,end:instructions.length}];
  starts[0]=0; // Leading scene cues play before the first line.
  return starts.map((start,i)=>({start,end:starts[i+1]??instructions.length}));
}
export class PreviewPlayback {
  readonly pages;
  private state:PlaybackSnapshot;
  private cancel:(()=>void)|undefined;
  private disposed=false;
  private generation=0;
  private letters:string[]=[];
  private letter=0;
  private preparedPosition=-1;
  constructor(private instructions:readonly CourtroomInstruction[],private clock:PlaybackClock,private notify:(state:PlaybackSnapshot)=>void,private characterMs=DEFAULT_CHARACTER_MS, private prepare?:(position:number)=>Promise<void>|void){
    this.pages=paragraphRanges(instructions);
    this.state={position:0,partialText:'',page:0,count:this.pages.length,complete:!this.pages.length,waiting:false,loading:false};
  }
  get snapshot():PlaybackSnapshot{return {...this.state};}
  start(page=0):void {
    if(this.disposed)return;
    this.stopTimer();
    page=Number.isFinite(page)?Math.max(0,Math.min(Math.max(0,this.pages.length-1),Math.trunc(page))):0;
    this.state={position:this.pages[page]?.start??0,partialText:'',page,count:this.pages.length,complete:!this.pages.length,waiting:false,loading:false};
    this.preparedPosition=-1;this.letters=[];this.letter=0;this.advance();
  }
  next():void {
    if(this.disposed)return;
    if(this.state.loading)return;
    if(this.state.waiting){this.state.waiting=false;this.advance();return;}
    if(!this.state.complete){
      this.stopTimer();this.state.position=this.pages[this.state.page].end;
      this.state.partialText='';this.letters=[];this.letter=0;this.preparedPosition=-1;this.finish();return;
    }
    if(this.state.page+1<this.pages.length)this.start(this.state.page+1);
  }
  back():void {if(this.state.page>0)this.start(this.state.page-1);}
  dispose():void {this.disposed=true;this.stopTimer();}
  private stopTimer():void {this.generation++;this.cancel?.();this.cancel=undefined;}
  private later(delay:number):void {
    const generation=this.generation;
    this.cancel=this.clock.schedule(()=>{if(!this.disposed&&generation===this.generation){this.cancel=undefined;this.advance();}},delay);
  }
  private ready(resume:()=>void):boolean {
    if(this.preparedPosition===this.state.position)return true;
    this.preparedPosition=this.state.position;
    const pending=this.prepare?.(this.state.position);
    if(!pending)return true;
    const generation=this.generation;
    this.state.loading=true;this.notify(this.snapshot);
    const settled=()=>{
      if(this.disposed||generation!==this.generation)return;
      this.state.loading=false;resume();
    };
    void pending.then(settled,settled);
    return false;
  }
  private finish():void {
    if(!this.ready(()=>this.finish()))return;
    this.state.complete=true;this.notify(this.snapshot);
  }
  private advance():void {
    const end=this.pages[this.state.page]?.end??0;
    while(this.state.position<end){
      const command=this.instructions[this.state.position];
      if(command.op==='showText'){
        if(!this.ready(()=>this.advance()))return;
        if(!this.letters.length){this.letters=Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(command.text),x=>x.segment);this.letter=0;}
        if(this.letter<this.letters.length){
          this.state.partialText+=this.letters[this.letter++];this.notify(this.snapshot);this.later(this.characterMs);return;
        }
        this.state.partialText='';this.letters=[];this.letter=0;this.state.position++;continue;
      }
      if(command.op==='wait'&&!this.ready(()=>this.advance()))return;
      this.state.position++;
      if(command.op==='wait'){
        if(command.mode==='input'){
          // A final wait is the normal paragraph boundary, not an extra click.
          if(this.state.position===end)continue;
          this.state.waiting=true;this.notify(this.snapshot);return;
        }
        const delay=Number.isFinite(command.durationMs)?Math.max(0,command.durationMs??0):0;
        if(delay>0){this.notify(this.snapshot);this.later(delay);return;}
      }
    }
    this.finish();
  }
}
