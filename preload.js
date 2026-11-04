'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vocabAPI', {
  toggleFavorite: id => ipcRenderer.invoke('vocab:favorite:toggle', id),
  getCollections: () => ipcRenderer.invoke('vocab:collections:list'),
  createCollection: collection => ipcRenderer.invoke('vocab:collections:create', collection),
  deleteCollection: id => ipcRenderer.invoke('vocab:collections:delete', id),
  assignWordToCollection: (wordId, colId) => ipcRenderer.invoke('vocab:collections:assign', wordId, colId),
  removeWordFromCollection: (wordId, colId) => ipcRenderer.invoke('vocab:collections:unassign', wordId, colId),
  getAllTags: () => ipcRenderer.invoke('vocab:tags:list'),
  setWordTags: (id, tags) => ipcRenderer.invoke('vocab:tags:set', id, tags),
  generateQuiz: (mode, filter) => ipcRenderer.invoke('vocab:quiz:generate', mode, filter),
  submitQuiz: (id, success, linkToSrs) => ipcRenderer.invoke('vocab:quiz:submit', id, success, linkToSrs),
  ensurePronunciation: word => ipcRenderer.invoke('vocab:audio:ensure', word),
  repairPronunciations: () => ipcRenderer.invoke('vocab:audio:repair'),
  getAudioDataUrl: word => ipcRenderer.invoke('vocab:audio', word),
  loadWords: () => ipcRenderer.invoke('vocab:load'),
  saveWords: words => ipcRenderer.invoke('vocab:save', words),
  exportData: () => ipcRenderer.invoke('vocab:export'),
  importData: words => ipcRenderer.invoke('vocab:import', words),
  lookupWord: (word, bookSource = '') => ipcRenderer.invoke('vocab:lookup', word, bookSource),
  addWord: word => ipcRenderer.invoke('vocab:add', word),
  removeWord: id => ipcRenderer.invoke('vocab:remove', id),
  reviewWord: (id, rating) => ipcRenderer.invoke('vocab:review', id, rating),
  getReviewStats: () => ipcRenderer.invoke('vocab:stats'),
  getDueWordsQueue: () => ipcRenderer.invoke('vocab:due')
});
