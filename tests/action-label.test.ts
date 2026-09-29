import assert from 'node:assert/strict';
import test from 'node:test';
import { actionLabel } from '../apps/editor/src/action-art.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import type { TypedToken } from '../packages/core/src/index.js';

test('all installed character action captions use content-pack labels', () => {
  for (const character of courtroomDemoPack.characters) {
    for (const [kind, actions] of [['pose',character.poses],['reaction',character.reactions]] as const) {
      for (const action of actions) {
        const token={id:'label-check',type:`courtroom.${kind}`,params:{[kind]:action.id}} as TypedToken;
        assert.equal(actionLabel(token,character),action.label,`${character.id}/${action.id}`);
      }
    }
  }
});

test('character vocabulary takes precedence without changing unknown or pacing labels', () => {
  const token={id:'label',type:'courtroom.pose',params:{pose:'normal'}} as TypedToken;
  assert.equal(actionLabel(token,{poses:[{id:'normal',label:'镇定'}],reactions:[]}), '镇定');
  assert.equal(actionLabel({...token,params:{pose:'missing'}}), 'missing');
  assert.equal(actionLabel({...token,type:'courtroom.wait',params:{durationMs:1000}}), '等待 1 秒');
});
