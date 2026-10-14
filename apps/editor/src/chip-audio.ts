import type { CourtroomPreviewAudioCue, CourtroomAudioWaveform } from '../../../packages/adapters/courtroom/src/index.js';

export const CHIP_SAMPLE_RATE=12000;
const wave=(type:CourtroomAudioWaveform,phase:number)=>type==='square'?(phase<.5?1:-1):type==='triangle'?1-4*Math.abs(phase-.5):type==='sawtooth'?2*phase-1:Math.sin(phase*Math.PI*2);
/** Original pulse/triangle/noise voices, rendered as stepped 8-bit PCM. */
export function renderChipCue(cue:CourtroomPreviewAudioCue):Float32Array<ArrayBuffer> {
  const duration=Math.max(cue.loopMs??0,...cue.notes.map(n=>(n.offsetMs??0)+n.durationMs));
  const samples=new Float32Array(Math.ceil(duration*CHIP_SAMPLE_RATE/1000));
  cue.notes.forEach((note,index)=>{
    const offset=Math.round((note.offsetMs??0)*CHIP_SAMPLE_RATE/1000),length=Math.round(note.durationMs*CHIP_SAMPLE_RATE/1000),type=note.waveform??cue.waveform??'square';
    let seed=(0x7fff^(index*257)^Math.round(note.frequency))||1,previous=-1,noise=1;
    for(let i=0;i<length&&offset+i<samples.length;i++){
      const cycles=i*note.frequency/CHIP_SAMPLE_RATE,step=Math.floor(cycles);
      if(step!==previous){seed=(seed>>>1)|(((seed^(seed>>>1))&1)<<14);noise=(seed&1)?1:-1;previous=step;}
      const envelope=Math.min(1,i/Math.max(1,CHIP_SAMPLE_RATE*.004),(length-i)/Math.max(1,length*.3));
      // Headroom keeps quiet voices detailed before the playback gain stage.
      samples[offset+i]+=(type==='noise'?noise:wave(type,cycles%1))*(note.gain??.04)*8*envelope;
    }
  });
  for(let i=0;i<samples.length;i++)samples[i]=Math.round(Math.max(-1,Math.min(1,samples[i]))*127)/127;
  return samples;
}
export function chipWav(cue:CourtroomPreviewAudioCue):Uint8Array {
  const pcm=renderChipCue(cue),bytes=new Uint8Array(44+pcm.length+(pcm.length%2)),view=new DataView(bytes.buffer);
  const ascii=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
  ascii(0,'RIFF');view.setUint32(4,bytes.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,CHIP_SAMPLE_RATE,true);view.setUint32(28,CHIP_SAMPLE_RATE,true);view.setUint16(32,1,true);view.setUint16(34,8,true);ascii(36,'data');view.setUint32(40,pcm.length,true);
  pcm.forEach((sample,i)=>{bytes[44+i]=Math.round(sample*127)+128;});return bytes;
}
export function playChipCue(context:AudioContext,destination:AudioNode,cue:CourtroomPreviewAudioCue,offsetSeconds=0,onEnded?:()=>void):()=>void {
  const samples=renderChipCue(cue),buffer=context.createBuffer(1,samples.length,CHIP_SAMPLE_RATE);buffer.copyToChannel(samples,0);
  return playChipBuffer(context,destination,buffer,offsetSeconds,onEnded);
}
export function playChipBuffer(context:AudioContext,destination:AudioNode,buffer:AudioBuffer,offsetSeconds=0,onEnded?:()=>void):()=>void {
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=1/8;source.connect(gain);gain.connect(destination);
  let stopped=false;const cleanup=()=>{source.disconnect();gain.disconnect();onEnded?.();};source.onended=cleanup;source.start(context.currentTime+Math.max(0,offsetSeconds));
  return()=>{if(stopped)return;stopped=true;try{source.stop();}catch{/* A completed source is already stopped. */}cleanup();};
}
