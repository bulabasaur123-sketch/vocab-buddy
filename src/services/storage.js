'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { validateWords } = require('../db/wordSchema');
const { starterWords } = require('../db/seed');
class StorageService {
  constructor(storageDir, autoSeed = true) {
    this.filePath = path.join(storageDir, 'vocab_library.json');
    this.autoSeed = autoSeed;
    fs.mkdirSync(storageDir, { recursive: true, mode: 0o700 });
    this.loadWords();
  }
  loadWords() {
    let text;
    try { text = fs.readFileSync(this.filePath, 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const words = this.autoSeed ? starterWords() : [];
      this.saveWords(words);
      return words;
    }
    try {
      const payload = JSON.parse(text);
      if (payload.version !== '1.0' || !Number.isFinite(Date.parse(payload.updatedAt))) throw new TypeError('Invalid library payload');
      return validateWords(payload.words);
    } catch (error) {
      // Preserve the original bytes before recovering an invalid library.
      this.recoveryPath = `${this.filePath}.corrupt-${randomUUID()}`;
      fs.renameSync(this.filePath, this.recoveryPath);
      const words = this.autoSeed ? starterWords() : [];
      this.saveWords(words);
      return words;
    }
  }
  saveWords(words) {
    validateWords(words);
    const payload = JSON.stringify({ version: '1.0', updatedAt: new Date().toISOString(), words }, null, 2);
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, payload, { flag: 'wx', mode: 0o600, flush: true });
      fs.renameSync(temporary, this.filePath);
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return true;
  }
  exportData() { return this.loadWords(); }
  // Import is a validated replacement, matching saveWords; it never silently merges.
  importData(words) { return this.saveWords(words); }
}
module.exports = { StorageService };
