'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const MAX_AUDIO_BYTES = 102400;
const validWord = word => typeof word === 'string' && /^[a-z][a-z'-]{0,99}$/.test(word);
class AudioStorageService {
  constructor(audioDir, fetchImpl = globalThis.fetch) {
    this.audioDir = path.resolve(audioDir);
    this.fetchImpl = fetchImpl;
    this.pending = new Map();
    fs.mkdirSync(this.audioDir, { recursive: true, mode: 0o700 });
  }
  getLocalAudioPath(word) {
    if (!validWord(word)) return null;
    const file = path.join(this.audioDir, `${word}.mp3`);
    try {
      const stat = fs.lstatSync(file);
      return stat.isFile() && stat.size > 0 && stat.size <= MAX_AUDIO_BYTES ? file : null;
    } catch { return null; }
  }
  getAudioDataUrl(word) {
    const file = this.getLocalAudioPath(word);
    if (!file) return null;
    const bytes = fs.readFileSync(file);
    // Wikimedia may provide Ogg recordings: preserve the bytes and report their actual format.
    const mime = bytes.subarray(0, 4).toString() === 'OggS' ? 'audio/ogg' : bytes.subarray(0, 4).toString() === 'RIFF' ? 'audio/wav' : 'audio/mpeg';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  }
  async cacheAudio(word, remoteUrl, maxSizeBytes = MAX_AUDIO_BYTES) {
    if (!validWord(word) || !Number.isSafeInteger(maxSizeBytes) || maxSizeBytes <= 0 || maxSizeBytes > MAX_AUDIO_BYTES) return null;
    const cached = this.getLocalAudioPath(word);
    if (cached && fs.statSync(cached).size <= maxSizeBytes) return { localPath: path.basename(cached), sizeBytes: fs.statSync(cached).size };
    if (this.pending.has(word)) {
      const result = await this.pending.get(word);
      return result && result.sizeBytes <= maxSizeBytes ? result : null;
    }
    const task = this.download(word, remoteUrl, maxSizeBytes);
    this.pending.set(word, task);
    try { return await task; } finally { this.pending.delete(word); }
  }
  async download(word, remoteUrl, limit) {
    let temporary;
    try {
      const url = new URL(remoteUrl);
      // Audio sources are provider recordings, never arbitrary renderer-selected hosts.
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !['api.dictionaryapi.dev', 'upload.wikimedia.org'].includes(url.hostname) || !/\.(mp3|ogg|wav)$/i.test(url.pathname)) return null;
      const response = await this.fetchImpl(url.href, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok) { await response.body?.cancel(); return null; }
      const length = Number(response.headers.get('content-length'));
      if (length > limit) { await response.body?.cancel(); return null; }
      const chunks = []; let sizeBytes = 0;
      for await (const chunk of response.body) {
        sizeBytes += chunk.byteLength;
        if (sizeBytes > limit) return null;
        chunks.push(Buffer.from(chunk));
      }
      if (!sizeBytes) return null;
      temporary = path.join(this.audioDir, `${word}.${randomUUID()}.tmp`);
      fs.writeFileSync(temporary, Buffer.concat(chunks), { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, path.join(this.audioDir, `${word}.mp3`));
      return { localPath: `${word}.mp3`, sizeBytes };
    } catch { return null; }
    finally { if (temporary) { try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; } } }
  }
}
module.exports = { AudioStorageService, MAX_AUDIO_BYTES };
