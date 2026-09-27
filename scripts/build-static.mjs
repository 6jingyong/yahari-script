import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
rmSync('out', {recursive:true,force:true});
mkdirSync('out/apps/editor',{recursive:true});
cpSync('dist','out/dist',{recursive:true});
cpSync('apps/editor/index.html','out/apps/editor/index.html');
cpSync('apps/editor/styles.css','out/apps/editor/styles.css');
writeFileSync('out/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/apps/editor/"><title>矢张剧本</title><a href="/apps/editor/">打开矢张剧本</a></html>');

cpSync('content-packs/courtroom-demo/assets','out/content-packs/courtroom-demo/assets',{recursive:true});
