import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const sourcePage='https://www.court-records.net/audio.htm';
const roles=[
  ['phoenix','成步堂龙一',['Phoenix - igiari.mp3','Phoenix - matta.mp3','Phoenix - kurae.mp3']],
  ['edgeworth','御剑怜侍',['Edgeworth - (Japanese) igiari.mp3','Edgeworth - (Japanese) matta.mp3','Edgeworth - (Japanese) kurae.mp3']],
  ['mia','绫里千寻',['Mia - igiari.mp3','Mia - matta.mp3','Mia - kurae.mp3']],
  ['apollo','王泥喜法介',['Odoroki - Igiari!.wav','Odoroki - Matta!.wav','Odoroki - Kurae!.wav']],
  ['franziska','狩魔冥',['Franziska - igiari.mp3']],
  ['von-karma','狩魔豪',['Karma - igiari.mp3']],
  ['godot','戈多',['Godo - igiari.mp3']],
  ['payne','亚内武文',['Payne - igiari.mp3']],
  ['kristoph','牙琉雾人',['Garyuu - Igiari!.wav']],
  ['klavier','牙琉响也',['Kyouya - Igiari!.wav']],
];
function duration(bytes,extension){
  if(extension==='wav'){
    if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Invalid WAV');
    let rate=0,size=0;for(let i=12;i+8<=bytes.length;){const id=bytes.toString('ascii',i,i+4),n=bytes.readUInt32LE(i+4);if(id==='fmt ')rate=bytes.readUInt32LE(i+16);if(id==='data')size=n;i+=8+n+(n%2);}
    if(!rate||!size)throw Error('WAV has no audio');return Math.ceil(size/rate*1000);
  }
  let offset=bytes.toString('ascii',0,3)==='ID3'?10+((bytes[6]&127)<<21)+((bytes[7]&127)<<14)+((bytes[8]&127)<<7)+(bytes[9]&127):0,seconds=0,frames=0;
  for(;offset+4<=bytes.length;){const h=bytes.readUInt32BE(offset),v=(h>>>19)&3,layer=(h>>>17)&3,rateIndex=(h>>>10)&3,b=(h>>>12)&15;
    if((h>>>21)!==2047||v===1||layer!==1||rateIndex===3||b===0||b===15){offset++;continue;}
    const rate=[44100,48000,32000][rateIndex]/(v===3?1:v===2?2:4),bitrate=(v===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[b];
    const length=Math.floor((v===3?144:72)*bitrate*1000/rate)+((h>>>9)&1);if(offset+length>bytes.length)break;
    seconds+=(v===3?1152:576)/rate;frames++;offset+=length;
  }
  if(frames<2)throw Error('Invalid MP3');return Math.ceil(seconds*1000);
}
await mkdir('content-packs/courtroom-demo/assets/voices',{recursive:true});const clips=[];
for(const [characterId,name,files] of roles)for(const [index,filename] of files.entries()){
  const call=['objection','hold-it','take-that'][index],phrase=['異議あり！','待った！','くらえ！'][index],callLabel=['异议','等一下','看招'][index],extension=filename.split('.').at(-1);
  const file=`voices/${characterId}-${call}-ja.${extension}`,path='content-packs/courtroom-demo/assets/'+file;
  const sourceUrl=new URL('sounds/'+encodeURIComponent(filename),sourcePage).href;
  let bytes;try{bytes=await readFile(path);}catch{for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(sourceUrl,{headers:{Connection:'close'},signal:AbortSignal.timeout(16000)});if(!response.ok)throw Error(`${filename}: HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>250000)throw Error('Unexpected clip size');break;}catch(error){console.log(`Retry ${characterId}/${call}: ${error.cause?.code??error.message}`);}}}
  if(!bytes){console.log(`Unavailable: ${characterId}/${call}`);continue;}
  const durationMs=duration(bytes,extension);if(durationMs>3000)throw Error('Unexpected long voice clip');await writeFile(path,bytes);
  clips.push({id:`voice-${characterId}-${call}-ja`,characterId,call,language:'ja',label:`${name} · ${callLabel}（${phrase}）`,phrase,file,mime:extension==='wav'?'audio/wav':'audio/mpeg',durationMs,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),sourceUrl});
  console.log(`${characterId}/${call}: ${durationMs} ms, ${bytes.length} bytes`);
}
await writeFile('content-packs/courtroom-demo/voice-clips.json',JSON.stringify({sourcePage,rightsHolder:'CAPCOM Co., Ltd.',license:'Game recordings; no redistribution or commercial license is granted by the source listing.',clips},null,2)+'\n');
console.log(`Saved ${clips.length} Japanese callouts and their provenance.`);
