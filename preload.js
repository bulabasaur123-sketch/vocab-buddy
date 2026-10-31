'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vocabAPI', {
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
