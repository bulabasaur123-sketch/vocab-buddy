'use strict';
class PronunciationService {
  constructor(storage, dictionary, audio) {
    this.storage = storage; this.dictionary = dictionary; this.audio = audio;
    this.pending = new Map(); this.repairPending = null;
  }
  ensure(word) {
    if (typeof word !== 'string' || !/^[a-z][a-z'-]{0,99}$/.test(word)) return Promise.reject(new TypeError('Invalid pronunciation word'));
    if (this.pending.has(word)) return this.pending.get(word);
    const request = this.resolve(word).finally(() => this.pending.delete(word));
    this.pending.set(word, request); return request;
  }
  async resolve(word) {
    const record = this.storage.getWordByHeadword(word);
    if (!record) throw new Error('Word not found');
    const local = this.audio.getLocalAudioPath(word);
    if (local) {
      const cached = await this.audio.cacheAudio(word, record.audioUrl);
      if (!this.storage.updatePronunciation(record.id, { audioUrl: record.audioUrl, audioLocalPath: cached.localPath, audioSizeBytes: cached.sizeBytes })) return {status:'unavailable'};
      return {status:'ready',dataUrl:this.audio.getAudioDataUrl(word)};
    }
    const tried = new Set();
    const tryUrl = async url => {
      if (!url || tried.has(url)) return null;
      tried.add(url);
      const cached = await this.audio.cacheAudio(word,url);
      if (!cached) return null;
      if (!this.storage.updatePronunciation(record.id,{audioUrl:url,audioLocalPath:cached.localPath,audioSizeBytes:cached.sizeBytes})) return {status:'unavailable'};
      return {status:'ready',dataUrl:this.audio.getAudioDataUrl(word)};
    };
    const saved = await tryUrl(record.audioUrl);
    if (saved) return saved;
    const candidates = await this.dictionary.findPronunciations(word);
    for (const url of candidates) { const result = await tryUrl(url); if (result) return result; }
    return {status:'unavailable'};
  }
  repair() {
    if (this.repairPending) return this.repairPending;
    this.repairPending = this.repairWords().finally(() => { this.repairPending=null; });
    return this.repairPending;
  }
  async repairWords() {
    const records = this.storage.getWords();
    const result = {checked:records.length,repaired:0,available:0,unavailable:0};
    let next=0;
    await Promise.all(Array.from({length:Math.min(2,records.length)}, async () => {
      while (next < records.length) {
        const record=records[next++];
        const hadCache=Boolean(this.audio.getLocalAudioPath(record.word));
        try { const answer=await this.ensure(record.word); if (answer.status === 'ready') result[hadCache?'available':'repaired']++; else result.unavailable++; }
        catch { result.unavailable++; }
      }
    }));
    return result;
  }
}
module.exports = { PronunciationService };
