'use strict';
class LibraryStore {
  constructor(storage) { this.storage = storage; }
  toggleFavorite(id) { return this.storage.toggleFavorite(id); }
  getFavorites() { return this.storage.getFavorites(); }
  createCollection(...args) { return this.storage.createCollection(...args); }
  getCollections() { return this.storage.getCollections(); }
  deleteCollection(id) { return this.storage.deleteCollection(id); }
  assignWordToCollection(...args) { return this.storage.assignWordToCollection(...args); }
  removeWordFromCollection(...args) { return this.storage.removeWordFromCollection(...args); }
  getWordsInCollection(id) { return this.storage.getWordsInCollection(id); }
  setWordTags(...args) { return this.storage.setWordTags(...args); }
  getWordTags(id) { return this.storage.getWordTags(id); }
  getAllTags() { return this.storage.getAllTags(); }
  getWordsByTag(tag) { return this.storage.getWordsByTag(tag); }
  submitQuiz(...args) { return this.storage.submitQuiz(...args); }
  getWords() { return this.storage.loadWords(); }
  replace(words) { this.storage.saveWords(words); return this.getWords(); }
  addWord(word) { this.storage.addWord(word); return this.getWords(); }
  removeWord(id) { this.storage.removeWord(id); return this.getWords(); }
  reviewWord(id, rating, now = new Date()) { this.storage.reviewWord(id, rating, now); return this.getWords(); }
  getReviewStats(now) { return this.storage.getReviewStats(now); }
  getDueWordsQueue(now) { return this.storage.getDueWordsQueue(now); }
}
module.exports = { LibraryStore };
