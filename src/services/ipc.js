'use strict';
const { QuizEngine } = require('./quizEngine');
const path = require('node:path');
const { AudioStorageService } = require('./audioStorage');
function createBackendServices(userData, fetchImpl = globalThis.fetch) {
  const audio = new AudioStorageService(path.join(userData, 'audio'), fetchImpl);
  return { audio, dictionary: require('./dictionary').createDictionaryService(fetchImpl, audio) };
}
function registerHandlers(ipcMain, store, dictionary, trustedFrame, audio = null) {
  const handlers = {
    'vocab:favorite:toggle': id => store.toggleFavorite(id),
    'vocab:collections:list': () => store.getCollections(),
    'vocab:collections:create': ({ name, description, colorAccent }) => store.createCollection(name, description, colorAccent),
    'vocab:collections:delete': id => store.deleteCollection(id),
    'vocab:collections:assign': (wordId, colId) => store.assignWordToCollection(wordId, colId),
    'vocab:collections:unassign': (wordId, colId) => store.removeWordFromCollection(wordId, colId),
    'vocab:tags:list': () => store.getAllTags(),
    'vocab:tags:set': (id, tags) => store.setWordTags(id, tags),
    'vocab:quiz:generate': (mode, filter) => new QuizEngine(store.storage ?? store).generateQuiz(mode, filter),
    'vocab:quiz:submit': (id, success, linkToSrs) => store.submitQuiz(id, success, linkToSrs),
    'vocab:audio': word => audio?.getAudioDataUrl(word) || null,
    'vocab:load': () => store.getWords(),
    'vocab:save': words => store.replace(words) && true,
    'vocab:export': () => store.getWords(),
    'vocab:import': words => store.replace(words) && true,
    'vocab:lookup': (word, book) => dictionary.lookupWord(word, book),
    'vocab:add': word => store.addWord(word),
    'vocab:remove': id => store.removeWord(id),
    'vocab:review': (id, rating) => store.reviewWord(id, rating),
    'vocab:stats': () => store.getReviewStats(),
    'vocab:due': () => store.getDueWordsQueue()
  };
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!trustedFrame(event.senderFrame)) throw new Error('Untrusted IPC sender');
      return handler(...args);
    });
  }
}
module.exports = { registerHandlers, createBackendServices };
