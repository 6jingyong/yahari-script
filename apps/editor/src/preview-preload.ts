export interface PreloadProgress { completed:number; total:number; failed:number }
/** Bounded parallel preparation; progress counts decoded/processed assets, not guessed bytes. */
export async function preloadAssets(urls:readonly string[], load:(url:string)=>Promise<boolean>, update:(progress:PreloadProgress)=>void, stopped:()=>boolean=()=>false):Promise<PreloadProgress> {
  const unique=[...new Set(urls)];
  const progress={completed:0,total:unique.length,failed:0};let cursor=0;
  update({...progress});
  await Promise.all(Array.from({length:Math.min(4,unique.length)},async()=>{
    while(!stopped()&&cursor<unique.length){
      const url=unique[cursor++];let ok=false;
      try {ok=await load(url);} catch { /* Count failures without stopping other assets. */ }
      if(stopped())return;
      progress.completed++;if(!ok)progress.failed++;
      update({...progress});
    }
  }));
  return {...progress};
}
