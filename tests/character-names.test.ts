import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCastDisplayName } from '../content-packs/courtroom-demo/cast.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { builtinAssetEntries } from '../apps/editor/src/builtin-assets.js';

const cast = (id:string, displayName?:string, packId=courtroomDemoPack.id) =>
  ({castId:'existing-cast',characterRef:{packId,id},...(displayName?{displayName}:{})});

test('known legacy builtin labels display the complete early fan name, preserving binding',()=>{
  for(const [id,oldName,name] of [
    ['phoenix','成步堂','成步堂龙一'],['edgeworth','御剑','御剑怜侍'],
    ['maya','真宵','绫里真宵'],['pearl','春美','绫里春美'],
    ['iris','绫芽','叶樱院绫美'],['iris','绫美','叶樱院绫美'],
    ['witness','矢张（证人）','矢张政志'],['trucy','美贯','成步堂美贯'],
  ]){
    const old=cast(id,oldName),before=structuredClone(old);
    assert.equal(demoCastDisplayName(old),name);
    assert.equal(demoCastDisplayName(cast(id)),name);
    assert.deepEqual(old,before);
    assert.ok(builtinAssetEntries.find(entry=>entry.entityId===id)?.aliases?.includes(oldName));
  }
});

test('custom aliases and characters in other packs retain authored names',()=>{
  assert.equal(demoCastDisplayName(cast('phoenix','林律师'),'成步堂龙一'),'林律师');
  assert.equal(demoCastDisplayName(cast('iris','我的修女'),'叶樱院绫美'),'我的修女');
  assert.equal(demoCastDisplayName(cast('pearl','春美','local.original'),'原创角色'),'春美');
  assert.equal(demoCastDisplayName(cast('pearl',undefined,'local.original'),'原创角色'),'原创角色');
});
