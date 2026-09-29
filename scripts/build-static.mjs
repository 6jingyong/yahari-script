import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
rmSync('out', {recursive:true,force:true});
mkdirSync('out/apps/editor',{recursive:true});
cpSync('dist','out/dist',{recursive:true});
cpSync('apps/editor/index.html','out/apps/editor/index.html');
cpSync('apps/editor/styles.css','out/apps/editor/styles.css');
writeFileSync('out/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./apps/editor/"><title>矢张剧本</title><a href="./apps/editor/">打开矢张剧本</a></html>');
writeFileSync('out/.nojekyll','');

const assetRoot='content-packs/courtroom-demo/assets';
const catalog=JSON.parse(readFileSync('content-packs/courtroom-demo/catalog.json','utf8'));
const runtimeFiles=new Set([...Object.values(catalog.resources).map(resource=>resource.file),'action-thumbnails.webp']);
mkdirSync(`out/${assetRoot}`,{recursive:true});
for(const file of runtimeFiles)cpSync(`${assetRoot}/${file}`,`out/${assetRoot}/${file}`);
writeFileSync('out/build-info.json',JSON.stringify({builtAt:new Date().toISOString(),characters:catalog.characters.length,actions:catalog.characters.reduce((n,c)=>n+c.poses.length+c.reactions.length,0),scenes:catalog.backgrounds.length,features:['webp-assets','rehearse-from-dialogue','replay-current-dialogue','model-connection-check']},null,2));
