'use strict';
function registerHandlers(ipcMain, store, dictionary, trustedFrame) {
  const handlers = {
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
module.exports = { registerHandlers };
