'use strict';
class LibraryStore {
  constructor(storage) { this.storage = storage; }
  getWords() { return this.storage.loadWords(); }
  replace(words) { this.storage.saveWords(words); return this.getWords(); }
  addWord(word) { this.storage.addWord(word); return this.getWords(); }
  removeWord(id) { this.storage.removeWord(id); return this.getWords(); }
  reviewWord(id, rating, now = new Date()) { this.storage.reviewWord(id, rating, now); return this.getWords(); }
  getReviewStats(now) { return this.storage.getReviewStats(now); }
  getDueWordsQueue(now) { return this.storage.getDueWordsQueue(now); }
}
module.exports = { LibraryStore };
