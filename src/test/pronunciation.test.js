'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { StorageService } = require('../services/storage');
const { AudioStorageService } = require('../services/audioStorage');
const { PronunciationService } = require('../services/pronunciation');
const { createDictionaryService } = require('../services/dictionary');
const { registerHandlers } = require('../services/ipc');
const { LibraryStore } = require('../store/libraryStore');
const { starterWords } = require('../db/seed');
const good='https://upload.wikimedia.org/test.ogg';
const bad='https://api.dictionaryapi.dev/dead.mp3';
const bytes=Buffer.from('OggSfixture-recording');
function fixture(t, fetchImpl) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pronunciation-'));
  const storage=new StorageService(dir,false);
  t.after(()=>{storage.close();fs.rmSync(dir,{recursive:true,force:true});});
  const word={...starterWords()[0],audioUrl:bad};storage.addWord(word);
  const audio=new AudioStorageService(path.join(dir,'audio'),fetchImpl);
  const dictionary={findPronunciations:async()=>[bad,good]};
  return {storage,word,audio,dictionary,service:new PronunciationService(storage,dictionary,audio)};
}
test('rejects HTTP 200 error pages and invalid audio bytes, validates existing files',async t=>{
  const {audio}=fixture(t,async()=>new Response('<html>error</html>',{headers:{'content-type':'text/html'}}));
  assert.equal(await audio.cacheAudio('word',good),null);
  audio.fetchImpl=async()=>new Response('not an audio recording',{headers:{'content-type':'audio/mpeg'}});
  assert.equal(await audio.cacheAudio('word',good),null);
  fs.writeFileSync(path.join(audio.audioDir,'word.mp3'),'<html>error</html>');
  assert.equal(audio.getAudioDataUrl('word'),null);
  audio.fetchImpl=async()=>new Response(bytes,{headers:{'content-type':'audio/ogg'}});
  assert.ok(await audio.cacheAudio('word',good));
  assert.match(audio.getAudioDataUrl('word'),/^data:audio\/ogg;base64,/);
});
test('dead saved URL falls back, persists only audio metadata, remains offline available',async t=>{
  const calls=[];
  const {storage,word,audio,service}=fixture(t,async url=>{calls.push(url);return url===good?new Response(bytes):new Response('',{status:502});});
  storage.toggleFavorite(word.id);const col=storage.createCollection('Books');storage.assignWordToCollection(word.id,col.id);storage.setWordTags(word.id,['literary']);storage.reviewWord(word.id,'good');
  const before=storage.selectOne(word.id);
  const result=await service.ensure(word.word);assert.equal(result.status,'ready');assert.deepEqual(calls,[bad,good]);
  const after=storage.selectOne(word.id);
  for(const key of Object.keys(before).filter(k=>!['audioUrl','audioLocalPath','audioSizeBytes'].includes(k))) assert.deepEqual(after[key],before[key],key);
  assert.equal(after.audioUrl,good);assert.equal(after.audioLocalPath,`${word.word}.mp3`);
  audio.fetchImpl=async()=>{throw new Error('offline');};
  assert.equal((await service.ensure(word.word)).status,'ready');
});
test('unavailable recordings preserve records and simultaneous ensures coalesce',async t=>{
  let requests=0;
  const {storage,word,service}=fixture(t,async()=>{requests++;await new Promise(r=>setTimeout(r,5));return new Response('',{status:502});});
  const before=storage.selectOne(word.id);
  const [a,b]=await Promise.all([service.ensure(word.word),service.ensure(word.word)]);
  assert.deepEqual(a,{status:'unavailable'});assert.deepEqual(b,a);assert.equal(requests,2);
  assert.deepEqual(storage.selectOne(word.id),before);
  await assert.rejects(service.ensure('../private'),/Invalid/);
  await assert.rejects(service.ensure('missing'),/not found/);
});
test('late repairs never recreate a deleted word or overwrite a replacement ID',async t=>{
  let release;const barrier=new Promise(r=>{release=r;});
  const {storage,word,service}=fixture(t,async url=>{if(url===bad)return new Response('',{status:502});await barrier;return new Response(bytes);});
  const pending=service.ensure(word.word);
  await new Promise(r=>setImmediate(r));storage.removeWord(word.id);storage.addWord({...word,id:'replacement'});release();
  assert.equal((await pending).status,'unavailable');assert.equal(storage.getWords().length,1);assert.equal(storage.selectOne('replacement').audioLocalPath,undefined);
});
test('Settings repair reports outcomes, skips cached network work and shares concurrent runs',async t=>{
  const {storage,word,audio,service}=fixture(t,async url=>url===good?new Response(bytes):new Response('',{status:502}));
  storage.addWord({...word,id:'second',word:'taciturn',displayWord:'Taciturn'});
  await audio.cacheAudio(word.word,good);
  const [a,b]=await Promise.all([service.repair(),service.repair()]);
  assert.deepEqual(a,{checked:2,repaired:1,available:1,unavailable:0});assert.deepEqual(b,a);
});
test('new lookups try alternative dialects and reserve Wikimedia fallbacks',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'audio-candidates-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const calls=[];
  const audio=new AudioStorageService(dir,async url=>{calls.push(url);return url===good?new Response(bytes):new Response('',{status:502});});
  const dictionary=createDictionaryService(async url=>url.includes('wiktionary')
    ?Response.json({parse:{text:{'*':`<h2>English</h2><audio src="${good}"></audio>`}}})
    :Response.json([{phonetics:Array.from({length:6},(_,i)=>({audio:`https://api.dictionaryapi.dev/word-${i}.mp3`})),meanings:[]}]),audio);
  const record=await dictionary.lookupWord('word');assert.equal(record.audioUrl,good);assert.equal(record.audioLocalPath,'word.mp3');assert.equal(calls.length,4);
});
test('new pronunciation IPC guards every request and exposes a bounded repair result',async t=>{
  const {storage,audio,dictionary,word}=fixture(t,async()=>new Response(bytes));
  const handlers=new Map();registerHandlers({handle:(name,handler)=>handlers.set(name,handler)},new LibraryStore(storage),dictionary,frame=>frame==='trusted',audio);
  for(const name of ['vocab:audio:ensure','vocab:audio:repair']) assert.throws(()=>handlers.get(name)({senderFrame:'remote'},word.word),/Untrusted/);
  assert.equal((await handlers.get('vocab:audio:ensure')({senderFrame:'trusted'},word.word)).status,'ready');
  assert.equal((await handlers.get('vocab:audio:repair')({senderFrame:'trusted'})).available,1);
});
