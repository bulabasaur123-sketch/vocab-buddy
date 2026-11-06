#!/usr/bin/env node
'use strict';
const path = require('node:path');
const os = require('node:os');
const { TextDecoder } = require('node:util');
const { initialReview } = require('./spacedRepetition');
const MAX_MESSAGE_BYTES = 64 * 1024;
const failure = (code, message) => ({ status: 'error', code, message });
function text(value, name, limit, required = false) {
  if (typeof value !== 'string' || value.length > limit) throw new TypeError(`${name} must be text of at most ${limit} characters`);
  const clean = value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  if (required && !clean) throw new TypeError(`${name} is required`);
  return clean;
}
function validateCapture(value) {
  if (!value || Array.isArray(value) || value.version !== 1) throw new TypeError('Capture version must be 1');
  const result = { version: 1, id: text(value.id, 'id', 128, true), word: text(value.word, 'word', 100, true).toLowerCase(),
    sentenceExcerpt: text(value.sentenceExcerpt, 'sentenceExcerpt', 300), sourceTitle: text(value.sourceTitle, 'sourceTitle', 200),
    sourceUrl: text(value.sourceUrl, 'sourceUrl', 500), capturedAt: value.capturedAt };
  if (result.sourceUrl) {
    const url = new URL(result.sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new TypeError('sourceUrl must be an HTTP(S) URL without credentials');
  }
  if (typeof value.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value.capturedAt) || !Number.isFinite(Date.parse(value.capturedAt))) throw new TypeError('capturedAt must be an ISO UTC timestamp');
  if (value.notes !== undefined) result.notes = text(value.notes, 'notes', 2000);
  if (value.shelfId != null) result.shelfId = text(value.shelfId, 'shelfId', 128, true);
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || value.tags.length > 20) throw new TypeError('tags must be an array of at most 20 tags');
    result.tags = value.tags.map(tag => text(tag, 'tag', 50, true));
  }
  return result;
}
function createCaptureHandler(storage, dictionary = require('./dictionary')) {
  return async value => {
    let payload;
    try { payload = validateCapture(value); }
    catch (error) { return failure('INVALID_PAYLOAD', error.message); }
    let enriched;
    try {
      if (!storage.getCaptureWord(payload.id) && !storage.getWordByHeadword(payload.word)) {
        try { enriched = await dictionary.lookupWord(payload.word); }
        catch { return failure('ENRICHMENT_FAILED', 'Dictionary lookup failed. Check the word and connection, then retry.'); }
        enriched = { ...enriched, bookSource: payload.sourceTitle, review: initialReview() };
      }
      const { word, isDuplicate } = storage.saveCapture(payload, enriched);
      return { status: 'success', wordId: word.id, word: word.word, displayWord: word.displayWord, isDuplicate,
        ...(isDuplicate ? { existingBox: word.review.box } : {}), message: isDuplicate ? 'Added reading context to existing word.' : 'Saved to Wordloom.' };
    } catch (error) {
      return failure(error instanceof TypeError ? 'INVALID_PAYLOAD' : 'DB_UNAVAILABLE', error instanceof TypeError ? error.message : 'Library unavailable. Check the database location and retry.');
    }
  };
}
function encodeMessage(value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  if (body.length > MAX_MESSAGE_BYTES) throw new RangeError('Response exceeds message limit');
  const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
  return Buffer.concat([header, body]);
}
// Async iteration applies backpressure and keeps ingestion in wire order.
async function runBridge(input, output, handler) {
  let buffer = Buffer.alloc(0); let length = null;
  const write = value => new Promise((resolve, reject) => output.write(encodeMessage(value), error => error ? reject(error) : resolve()));
  try {
    for await (const chunk of input) {
      buffer = Buffer.concat([buffer, chunk]);
      while (true) {
        if (length === null) {
          if (buffer.length < 4) break;
          length = buffer.readUInt32LE(0); buffer = buffer.subarray(4);
          if (!length || length > MAX_MESSAGE_BYTES) {
            await write(failure('INVALID_PAYLOAD', `Message length must be 1–${MAX_MESSAGE_BYTES} bytes`));
            input.destroy(); return;
          }
        }
        if (buffer.length < length) break;
        const body = buffer.subarray(0, length); buffer = buffer.subarray(length); length = null;
        let payload;
        try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
        catch { await write(failure('INVALID_PAYLOAD', 'Message must contain UTF-8 JSON')); continue; }
        await write(await handler(payload));
      }
    }
    if (length !== null || buffer.length) await write(failure('INVALID_PAYLOAD', 'Incomplete message at end of input'));
  } finally { if (!input.destroyed) input.destroy(); }
}
function defaultStorageDir() {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'wordloom');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'wordloom');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'wordloom');
}
async function main() {
  let storage;
  try {
    // Lazy initialization permits framed DB_UNAVAILABLE replies even on open failure.
    const handler = async payload => {
      try { storage ??= new (require('./storage').StorageService)(process.env.WORDLOOM_STORAGE_DIR || defaultStorageDir(), false); }
      catch { return failure('DB_UNAVAILABLE', 'Cannot open Wordloom library. Check WORDLOOM_STORAGE_DIR and permissions.'); }
      return createCaptureHandler(storage)(payload);
    };
    await runBridge(process.stdin, process.stdout, handler);
  } finally { storage?.close(); }
}
if (require.main === module) main().catch(error => { process.stderr.write(`Wordloom bridge: ${error.message}\n`); process.exitCode = 1; });
module.exports = { MAX_MESSAGE_BYTES, validateCapture, createCaptureHandler, encodeMessage, runBridge, defaultStorageDir };
