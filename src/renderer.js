/**
 * Vocab Buddy — Renderer Controller
 * Modern Editorial Lexicon (Stage 3 Frontend Integration)
 */

'use strict';

// Global state
const state = {
  words: [],
  collections: [],
  allTags: [],
  activeView: 'lexicon', // 'lexicon' | 'review' | 'quiz'
  searchQuery: '',
  statusFilter: 'all', // 'all' | 'favorites' | 'due' | 'learning' | 'mastered'
  collectionFilter: 'all', // 'all' | collectionId
  tagFilter: null, // null | string
  deckQueue: [],
  deckIndex: 0,
  isFlipped: false,
  selectedWord: null,
  activeAudio: null,
  theme: 'paper', // 'paper' | 'dark'
  quiz: {
    deck: [],
    index: 0,
    score: 0,
    mode: 'definition',
    isAnswered: false,
    linkToSrs: true
  }
};

// DOM Elements
const el = {
  // Masthead & Nav
  navLexiconBtn: document.getElementById('nav-lexicon-btn'),
  navReviewBtn: document.getElementById('nav-review-btn'),
  navQuizBtn: document.getElementById('nav-quiz-btn'),
  navConnectionsBtn: document.getElementById('nav-connections-btn'),
  navCountLexicon: document.getElementById('nav-count-lexicon'),
  navCountDue: document.getElementById('nav-count-due'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  btnCadenceGuide: document.getElementById('btn-cadence-guide'),
  btnExport: document.getElementById('btn-export'),

  // Entry Strip
  entryForm: document.getElementById('entry-form'),
  inputWord: document.getElementById('input-word'),
  inputSource: document.getElementById('input-source'),
  btnSubmit: document.getElementById('btn-submit'),
  btnSpinner: document.querySelector('.btn-spinner'),
  btnText: document.querySelector('.btn-text'),
  entryFeedback: document.getElementById('entry-feedback'),

  // Views
  viewLexicon: document.getElementById('view-lexicon'),
  viewReview: document.getElementById('view-review'),
  viewQuiz: document.getElementById('view-quiz'),
  viewConnections: document.getElementById('view-connections'),

  // Lexicon View
  searchInput: document.getElementById('search-input'),
  filterStatus: document.getElementById('filter-status'),
  filterCollection: document.getElementById('filter-collection'),
  btnNewCollection: document.getElementById('btn-new-collection'),
  tagFilterBar: document.getElementById('tag-filter-bar'),
  tagFilterChips: document.getElementById('tag-filter-chips'),
  lexiconGrid: document.getElementById('lexicon-grid'),
  lexiconEmpty: document.getElementById('lexicon-empty'),

  // Deck View
  deckProgressText: document.getElementById('deck-progress-text'),
  deckProgressBar: document.getElementById('deck-progress-bar'),
  indexCard: document.getElementById('index-card'),
  cardFrontBox: document.getElementById('card-front-box'),
  cardFrontSource: document.getElementById('card-front-source'),
  cardFrontWord: document.getElementById('card-front-word'),
  cardFrontInflected: document.getElementById('card-front-inflected'),
  cardFrontPhonetic: document.getElementById('card-front-phonetic'),
  cardFrontAudio: document.getElementById('card-front-audio'),
  cardBackWord: document.getElementById('card-back-word'),
  cardBackInflected: document.getElementById('card-back-inflected'),
  cardBackPhonetic: document.getElementById('card-back-phonetic'),
  cardBackAudio: document.getElementById('card-back-audio'),
  cardBackEtymology: document.getElementById('card-back-etymology'),
  cardBackDefinitions: document.getElementById('card-back-definitions'),
  reviewActions: document.getElementById('review-actions'),
  deckComplete: document.getElementById('deck-complete'),
  completeSummary: document.getElementById('complete-summary'),
  btnReturnLexicon: document.getElementById('btn-return-lexicon'),

  // Colophon
  colophonTally: document.getElementById('colophon-tally'),

  // Detail Modal
  detailModal: document.getElementById('detail-modal'),
  modalWord: document.getElementById('modal-word'),
  modalInflected: document.getElementById('modal-inflected'),
  modalPhonetic: document.getElementById('modal-phonetic'),
  modalAudioBtn: document.getElementById('modal-audio-btn'),
  modalFavBtn: document.getElementById('modal-fav-btn'),
  modalSource: document.getElementById('modal-source'),
  modalClose: document.getElementById('modal-close'),
  modalEtymology: document.getElementById('modal-etymology'),
  modalMeanings: document.getElementById('modal-meanings'),
  modalCollectionsList: document.getElementById('modal-collections-list'),
  modalAddCollectionSelect: document.getElementById('modal-add-collection-select'),
  modalTagsList: document.getElementById('modal-tags-list'),
  modalTagForm: document.getElementById('modal-tag-form'),
  modalTagInput: document.getElementById('modal-tag-input'),
  modalSynonymsSection: document.getElementById('modal-synonyms-section'),
  modalSynonyms: document.getElementById('modal-synonyms'),
  modalBoxStamp: document.getElementById('modal-box-stamp'),
  modalScheduleStamp: document.getElementById('modal-schedule-stamp'),
  modalDeleteBtn: document.getElementById('modal-delete-btn'),

  // Cadence Guide Modal
  cadenceModal: document.getElementById('cadence-modal'),
  cadenceModalClose: document.getElementById('cadence-modal-close'),
  cadenceBtnDismiss: document.getElementById('cadence-btn-dismiss'),

  // Collection Modal
  collectionModal: document.getElementById('collection-modal'),
  collectionModalClose: document.getElementById('collection-modal-close'),
  collectionForm: document.getElementById('collection-form'),
  inputCollectionName: document.getElementById('input-collection-name'),
  inputCollectionDesc: document.getElementById('input-collection-desc'),
  collectionBtnCancel: document.getElementById('collection-btn-cancel'),

  // Quiz View
  quizModeSelect: document.getElementById('quiz-mode-select'),
  quizScopeSelect: document.getElementById('quiz-scope-select'),
  quizLimitSelect: document.getElementById('quiz-limit-select'),
  btnStartQuiz: document.getElementById('btn-start-quiz'),
  quizLinkSrs: document.getElementById('quiz-link-srs'),
  quizArena: document.getElementById('quiz-arena'),
  quizBadgeMode: document.getElementById('quiz-badge-mode'),
  quizProgressText: document.getElementById('quiz-progress-text'),
  quizScoreText: document.getElementById('quiz-score-text'),
  quizProgressBar: document.getElementById('quiz-progress-bar'),
  quizCard: document.getElementById('quiz-card'),
  quizCardContent: document.getElementById('quiz-card-content'),
  quizActions: document.getElementById('quiz-actions'),
  quizFeedbackBanner: document.getElementById('quiz-feedback-banner'),
  btnQuizNext: document.getElementById('btn-quiz-next'),
  quizComplete: document.getElementById('quiz-complete'),
  quizCompleteTitle: document.getElementById('quiz-complete-title'),
  quizCompleteScore: document.getElementById('quiz-complete-score'),
  quizCompleteSummary: document.getElementById('quiz-complete-summary'),
  btnQuizRestart: document.getElementById('btn-quiz-restart'),
  btnQuizToLexicon: document.getElementById('btn-quiz-to-lexicon'),
  quizEmptyNotice: document.getElementById('quiz-empty-notice'),
  quizEmptySub: document.getElementById('quiz-empty-sub')
};

// Box Cadence Helper
const BOX_CADENCE_LABELS = {
  1: 'Daily',
  2: '3 Days',
  3: 'Weekly',
  4: 'Fortnightly',
  5: 'Mastered'
};

function getBoxLabel(box) {
  return BOX_CADENCE_LABELS[box] || 'Daily';
}

// ==========================================================================
// Theme Management
// ==========================================================================
function initTheme() {
  const saved = localStorage.getItem('vocab_theme') || 'paper';
  setTheme(saved);
}

function setTheme(theme) {
  state.theme = theme;
  if (theme === 'dark') {
    document.body.classList.remove('theme-paper');
    document.body.classList.add('theme-dark');
  } else {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-paper');
  }
  localStorage.setItem('vocab_theme', theme);
}

el.btnThemeToggle.addEventListener('click', () => {
  setTheme(state.theme === 'dark' ? 'paper' : 'dark');
});

// ==========================================================================
// Audio Playback & State
// ==========================================================================
let currentAudioRequestId = 0;
let currentPlayingButton = null;

function hasAudioRecord(word) {
  if (!word) return false;
  return Boolean(word.audioLocalPath);
}

function updateAudioButtonState(button, hasAudio) {
  if (!button) return;
  button.disabled = false;
  button.dataset.audioState = hasAudio ? 'available' : 'find';
  button.title = hasAudio ? 'Listen to pronunciation' : 'Find pronunciation recording';
  button.setAttribute('aria-label',button.title);
}
function audioFeedback(button, message) {
  if (!button) return;
  let feedback = button.parentElement.querySelector('.audio-feedback');
  if (!feedback) {
    feedback = document.createElement('span'); feedback.className='audio-feedback';
    feedback.setAttribute('role','status'); feedback.setAttribute('aria-live','polite');
    button.parentElement.appendChild(feedback);
  }
  feedback.textContent=message;
}
async function playAudio(_audioUrl, wordText, buttonEl) {
  const requestId=++currentAudioRequestId;
  if (state.activeAudio) { try {state.activeAudio.pause();} catch {} state.activeAudio=null; }
  if (currentPlayingButton) {
    currentPlayingButton.classList.remove('playing'); currentPlayingButton.removeAttribute('aria-busy');
    audioFeedback(currentPlayingButton,'');
  }
  currentPlayingButton=buttonEl;
  if (buttonEl) { buttonEl.setAttribute('aria-busy','true'); buttonEl.dataset.audioState='loading'; }
  const finish = (failed=false) => {
    if (requestId !== currentAudioRequestId) return;
    if (buttonEl) {
      buttonEl.classList.remove('playing'); buttonEl.removeAttribute('aria-busy');
      buttonEl.dataset.audioState=failed?'unavailable':'available';
      buttonEl.title=failed?'Retry pronunciation':'Listen to pronunciation';
      buttonEl.setAttribute('aria-label',buttonEl.title);
      audioFeedback(buttonEl,failed?'Recording unavailable. Try again.':'');
    }
    state.activeAudio=null; currentPlayingButton=null;
  };
  try {
    let dataUrl=await window.vocabAPI.getAudioDataUrl(wordText);
    if (requestId !== currentAudioRequestId) return;
    if (!dataUrl) {
      const result=await window.vocabAPI.ensurePronunciation(wordText);
      if (requestId !== currentAudioRequestId) return;
      dataUrl=result.status === 'ready' ? result.dataUrl : null;
    }
    if (!dataUrl) { finish(true); return; }
    const clip=new Audio(dataUrl); state.activeAudio=clip;
    clip.onended=()=>finish(); clip.onerror=()=>finish(true);
    await clip.play();
    if (requestId !== currentAudioRequestId) {clip.pause();return;}
    if (buttonEl && state.activeAudio === clip) {
      buttonEl.removeAttribute('aria-busy'); buttonEl.classList.add('playing');
      buttonEl.dataset.audioState='playing';
    }
  } catch {finish(true);}
}

// ==========================================================================
// Data Layer Bridge
// ==========================================================================
async function fetchWords() {
  if (window.vocabAPI && window.vocabAPI.loadWords) {
    return window.vocabAPI.loadWords();
  }
  const raw = localStorage.getItem('vocab_fallback');
  return raw ? JSON.parse(raw) : [];
}

async function fetchCollections() {
  if (window.vocabAPI && window.vocabAPI.getCollections) {
    try {
      return await window.vocabAPI.getCollections();
    } catch (err) {
      console.error('Error fetching collections:', err);
    }
  }
  return [];
}

async function fetchTags() {
  if (window.vocabAPI && window.vocabAPI.getAllTags) {
    try {
      return await window.vocabAPI.getAllTags();
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  }
  return [];
}

async function fetchStats() {
  if (window.vocabAPI && window.vocabAPI.getReviewStats) {
    return window.vocabAPI.getReviewStats();
  }
  return { total: state.words.length, due: 0, mastered: 0, learning: state.words.length };
}

async function fetchDueQueue() {
  if (window.vocabAPI && window.vocabAPI.getDueWordsQueue) {
    return window.vocabAPI.getDueWordsQueue();
  }
  return state.words.slice(0, 10);
}

function populateCollectionSelects() {
  if (!el.filterCollection) return;
  const currentFilter = state.collectionFilter;

  // 1. Lexicon Collection Filter
  el.filterCollection.innerHTML = '<option value="all">All Shelves</option>';
  (state.collections || []).forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.id;
    opt.textContent = `${col.name} (${col.wordCount || 0})`;
    el.filterCollection.appendChild(opt);
  });
  el.filterCollection.value = currentFilter;

  // 2. Quiz Scope Dropdown
  if (el.quizScopeSelect) {
    const currentScope = el.quizScopeSelect.value || 'all';
    el.quizScopeSelect.innerHTML = `
      <option value="all">Entire Lexicon</option>
      <option value="favorites">⭐ Favorites Only</option>
    `;
    (state.collections || []).forEach(col => {
      const opt = document.createElement('option');
      opt.value = `col:${col.id}`;
      opt.textContent = `Shelf: ${col.name} (${col.wordCount || 0})`;
      el.quizScopeSelect.appendChild(opt);
    });
    el.quizScopeSelect.value = currentScope;
  }
}

function renderTagFilterChips() {
  if (!el.tagFilterBar) return;
  document.getElementById('active-tag').textContent = state.tagFilter ? `· #${state.tagFilter}` : '';
  const tags = state.allTags || [];
  if (tags.length === 0) {
    el.tagFilterBar.classList.add('hidden');
    return;
  }

  el.tagFilterBar.classList.remove('hidden');
  el.tagFilterChips.innerHTML = '';

  if (state.tagFilter) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'tag-chip active';
    clearBtn.textContent = `✕ #${state.tagFilter} (Clear)`;
    clearBtn.addEventListener('click', () => {
      state.tagFilter = null; state.page = 1;
      renderTagFilterChips();
      renderLexicon();
    });
    el.tagFilterChips.appendChild(clearBtn);
  }

  document.getElementById('active-tag').textContent = state.tagFilter ? `· #${state.tagFilter}` : '';
  const tagQuery = document.getElementById('tag-search').value.trim().toLowerCase();
  tags.filter(({tag}) => tag.includes(tagQuery)).slice(0, 50).forEach(({ tag, count }) => {
    if (tag === state.tagFilter) return; // already rendered as active filter
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip';
    chip.textContent = `#${tag} (${count})`;
    chip.addEventListener('click', () => {
      state.tagFilter = tag; state.page = 1;
      renderTagFilterChips();
      renderLexicon();
    });
    el.tagFilterChips.appendChild(chip);
  });
}

async function refreshAll() {
  state.words = await fetchWords();
  state.collections = await fetchCollections();
  state.allTags = await fetchTags();
  const stats = await fetchStats();

  el.navCountLexicon.textContent = stats.total;
  el.navCountDue.textContent = stats.due;
  el.colophonTally.textContent = `${stats.total} entries in personal lexicon · ${stats.due} due for review · ${stats.mastered} mastered`;

  populateCollectionSelects();
  renderTagFilterChips();
  renderLexicon();
  renderShelves();
  if (typeof populateConnectionsWordSelect === 'function') populateConnectionsWordSelect();
  if (state.activeView === 'connections' && typeof renderConnectionsView === 'function') {
    renderConnectionsView();
  }
}

// ==========================================================================
// Collections Shelf Modal Controller
// ==========================================================================
function openCollectionModal() {
  if (!el.collectionModal) return;
  document.getElementById('collection-feedback').textContent = '';
  el.inputCollectionName.value = '';
  el.inputCollectionDesc.value = '';
  el.collectionModal.classList.remove('hidden');
  state.collectionTrigger = document.activeElement;
  el.inputCollectionName.focus();
}

function closeCollectionModal() {
  if (el.collectionModal) el.collectionModal.classList.add('hidden');
  queueMicrotask(() => state.collectionTrigger?.focus());
}

if (el.btnNewCollection) el.btnNewCollection.addEventListener('click', openCollectionModal);
if (el.collectionModalClose) el.collectionModalClose.addEventListener('click', closeCollectionModal);
if (el.collectionBtnCancel) el.collectionBtnCancel.addEventListener('click', closeCollectionModal);
if (el.collectionModal) {
  el.collectionModal.addEventListener('click', (e) => {
    if (e.target === el.collectionModal) closeCollectionModal();
  });
}

if (el.collectionForm) {
  el.collectionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el.inputCollectionName.value.trim();
    const description = el.inputCollectionDesc.value.trim();
    if (!name) return;

    try {
      if (window.vocabAPI && window.vocabAPI.createCollection) {
        const created = await window.vocabAPI.createCollection({ name, description });
        closeCollectionModal();
        state.collectionFilter = created.id; state.page=1;
        await refreshAll();
      }
    } catch (err) {
      document.getElementById('collection-feedback').textContent = /UNIQUE/.test(err.message) ? 'A shelf with this name already exists. Choose a different name.' : 'Could not create this shelf. Please try again.';
    }
  });
}

if (el.filterCollection) {
  el.filterCollection.addEventListener('change', (e) => {
    state.collectionFilter = e.target.value; state.page = 1;
    renderLexicon();
  });
}

// ==========================================================================
// Entry Strip: Adding Words
// ==========================================================================
el.entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawWord = el.inputWord.value.trim();
  const source = el.inputSource.value.trim();

  if (!rawWord) return;

  // Check duplicate
  const exists = state.words.find(w => w.word.toLowerCase() === rawWord.toLowerCase());
  if (exists) {
    showFeedback(`"${exists.displayWord}" is already recorded in your lexicon.`);
    closeCapture();
    announce(`“${exists.displayWord}” is already in your lexicon.`);
    openDetailModal(exists);
    el.inputWord.value = '';
    el.inputSource.value = '';
    return;
  }

  // Loading state
  setEntryLoading(true);
  hideFeedback();

  try {
    let enriched;
    if (window.vocabAPI && window.vocabAPI.lookupWord) {
      enriched = await window.vocabAPI.lookupWord(rawWord, source);
      await window.vocabAPI.addWord(enriched);
    } else {
      throw new Error('Desktop service is unavailable.');
    }

    el.inputWord.value = '';
    el.inputSource.value = '';
    await refreshAll();
    showFeedback(`Recorded "${enriched.displayWord}".`);
    const freshlySaved = state.words.find(w => w.word.toLowerCase() === enriched.word.toLowerCase()) || enriched;
    closeCapture(true);
    announce(`Saved “${freshlySaved.displayWord}”.`);
    openDetailModal(freshlySaved);
  } catch (err) {
    showFeedback(err.message || 'Lookup failed. Check word spelling.', true);
  } finally {
    setEntryLoading(false);
    if (!document.getElementById('add-word-modal').classList.contains('hidden')) el.inputWord.focus();
  }
});

function setEntryLoading(isLoading) {
  el.btnSubmit.disabled = isLoading;
  el.btnSpinner.classList.toggle('hidden', !isLoading);
  el.btnText.textContent = isLoading ? 'Looking up word…' : 'Save Word';
  el.btnSubmit.setAttribute('aria-busy', String(isLoading));
}

function showFeedback(msg, isError = false) {
  el.entryFeedback.textContent = msg;
  el.entryFeedback.className = `entry-feedback ${isError ? 'error' : ''}`;
  el.entryFeedback.classList.remove('hidden');
}

function hideFeedback() {
  el.entryFeedback.classList.add('hidden');
}

// ==========================================================================
// Lexicon View: Render Cards & Filter
// ==========================================================================
function renderLexicon() { renderDesktopLibrary(); }

function formatNextReview(dateStr) {
  if (!dateStr) return 'Due today';
  const target = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

el.searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value; state.page = 1;
  renderLexicon();
});

el.filterStatus.addEventListener('change', (e) => {
  state.statusFilter = e.target.value; state.page = 1;
  renderLexicon();
});

// ==========================================================================
// Word Detail Modal
// ==========================================================================
function openDetailModal(word) {
  state.detailTrigger = document.activeElement;
  state.selectedWord = word;
  el.modalWord.textContent = word.displayWord;
  el.modalPhonetic.textContent = word.phonetic || '';
  el.modalSource.textContent = word.bookSource ? `Citation source: ${word.bookSource}` : '';
  el.modalEtymology.textContent = word.etymology || 'Etymology records not available.';

  // Favorite Button
  const isFav = Boolean(word.isFavorite);
  if (el.modalFavBtn) {
    el.modalFavBtn.classList.toggle('active', isFav);
    el.modalFavBtn.title = isFav ? 'Remove from favorites' : 'Mark as favorite';
    const svg = el.modalFavBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
  }

  // Meanings
  el.modalMeanings.innerHTML = '';
  if (word.meanings && word.meanings.length > 0) {
    word.meanings.forEach(m => {
      const group = document.createElement('div');
      group.className = 'def-row';
      const pos = m.partOfSpeech ? `<span class="pos-tag">[${escapeHtml(m.partOfSpeech)}]</span>` : '';
      group.innerHTML = `
        ${(m.definitions || []).map(d => `
          <div style="margin-bottom: 0.5rem;">
            ${pos} ${escapeHtml(d.definition)}
            ${d.example ? `<div class="def-example-quote">"${escapeHtml(d.example)}"</div>` : ''}
          </div>
        `).join('')}
      `;
      el.modalMeanings.appendChild(group);
    });
  } else {
    el.modalMeanings.innerHTML = '<p class="text-secondary">No definitions found.</p>';
  }

  // Collections Section
  renderModalCollections(word);

  // Tags Section
  renderModalTags(word);

  // Personal Associations Section
  if (typeof renderModalAssociations === 'function') {
    renderModalAssociations(word);
  }

  // Synonyms
  if (word.synonyms && word.synonyms.length > 0) {
    el.modalSynonymsSection.classList.remove('hidden');
    el.modalSynonyms.innerHTML = word.synonyms.map(s => `<span class="text-chip">${escapeHtml(s)}</span>`).join('');
  } else {
    el.modalSynonymsSection.classList.add('hidden');
  }

  // Inflected reading citation
  if (word.inflectedForm && word.inflectedForm.toLowerCase() !== word.word.toLowerCase()) {
    el.modalInflected.innerHTML = `Encountered in reading as: <em>${escapeHtml(word.inflectedForm)}</em>`;
    el.modalInflected.classList.remove('hidden');
  } else {
    el.modalInflected.classList.add('hidden');
    el.modalInflected.textContent = '';
  }

  const hasAudio = hasAudioRecord(word);
  updateAudioButtonState(el.modalAudioBtn, hasAudio);
  if (!hasAudio && window.vocabAPI && window.vocabAPI.getAudioDataUrl && word.word) {
    window.vocabAPI.getAudioDataUrl(word.word).then(dataUrl => {
      if (dataUrl && state.selectedWord === word) {
        updateAudioButtonState(el.modalAudioBtn, true);
      }
    }).catch(() => {});
  }

  const box = word.review?.box || 1;
  const boxLabel = word.review?.boxLabel || getBoxLabel(box);
  el.modalBoxStamp.textContent = `Box ${box} · ${boxLabel}`;
  el.modalScheduleStamp.textContent = formatNextReview(word.review?.nextReviewDate);

  el.detailModal.classList.remove('hidden');
  document.body.classList.add('detail-open');
  for (const row of el.lexiconGrid.children) row.classList.toggle('selected',row.dataset.wordId === word.id);
  el.modalFavBtn.setAttribute('aria-pressed', String(isFav));
  el.modalClose.focus();
}

function renderModalCollections(word) {
  if (!el.modalCollectionsList || !el.modalAddCollectionSelect) return;
  el.modalCollectionsList.innerHTML = '';
  const wordColIds = word.collections || [];

  if (wordColIds.length === 0) {
    el.modalCollectionsList.innerHTML = '<span class="text-secondary" style="font-size: 0.8rem;">Not assigned to any shelves.</span>';
  } else {
    wordColIds.forEach(cid => {
      const col = (state.collections || []).find(c => c.id === cid);
      if (!col) return;
      const chip = document.createElement('span');
      chip.className = 'badge-collection';
      chip.innerHTML = `${escapeHtml(col.name)} <button type="button" class="chip-remove-btn" data-col="${col.id}" title="Remove from shelf">&times;</button>`;
      chip.querySelector('.chip-remove-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.vocabAPI && window.vocabAPI.removeWordFromCollection) {
          await window.vocabAPI.removeWordFromCollection(word.id, col.id);
          word.collections = (word.collections || []).filter(id => id !== col.id);
          await refreshAll();
          renderModalCollections(word);
        }
      });
      el.modalCollectionsList.appendChild(chip);
    });
  }

  // Populate Add Dropdown
  el.modalAddCollectionSelect.innerHTML = '<option value="">+ Assign to Shelf...</option>';
  (state.collections || []).forEach(col => {
    if (!wordColIds.includes(col.id)) {
      const opt = document.createElement('option');
      opt.value = col.id;
      opt.textContent = col.name;
      el.modalAddCollectionSelect.appendChild(opt);
    }
  });
}

if (el.modalAddCollectionSelect) {
  el.modalAddCollectionSelect.addEventListener('change', async (e) => {
    const colId = e.target.value;
    if (!colId || !state.selectedWord) return;
    if (window.vocabAPI && window.vocabAPI.assignWordToCollection) {
      await window.vocabAPI.assignWordToCollection(state.selectedWord.id, colId);
      if (!state.selectedWord.collections) state.selectedWord.collections = [];
      state.selectedWord.collections.push(colId);
      await refreshAll();
      renderModalCollections(state.selectedWord);
    }
  });
}

function renderModalTags(word) {
  if (!el.modalTagsList) return;
  el.modalTagsList.innerHTML = '';
  const tags = word.tags || [];

  if (tags.length === 0) {
    el.modalTagsList.innerHTML = '<span class="text-secondary" style="font-size: 0.8rem;">No tags assigned yet.</span>';
  } else {
    tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'text-chip';
      chip.innerHTML = `#${escapeHtml(tag)} <button type="button" class="chip-remove-btn" data-tag="${escapeHtml(tag)}" title="Remove tag">&times;</button>`;
      chip.querySelector('.chip-remove-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const updated = tags.filter(t => t !== tag);
        if (window.vocabAPI && window.vocabAPI.setWordTags) {
          await window.vocabAPI.setWordTags(word.id, updated);
          word.tags = updated;
          await refreshAll();
          renderModalTags(word);
        }
      });
      el.modalTagsList.appendChild(chip);
    });
  }
}

if (el.modalTagForm) {
  el.modalTagForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newTag = el.modalTagInput.value.trim().replace(/^#+/, '').toLowerCase();
    if (!newTag || !state.selectedWord) return;

    const currentTags = state.selectedWord.tags || [];
    if (!currentTags.includes(newTag)) {
      const updated = [...currentTags, newTag];
      if (window.vocabAPI && window.vocabAPI.setWordTags) {
        await window.vocabAPI.setWordTags(state.selectedWord.id, updated);
        state.selectedWord.tags = updated;
        el.modalTagInput.value = '';
        await refreshAll();
        renderModalTags(state.selectedWord);
      }
    } else {
      el.modalTagInput.value = '';
    }
  });
}

if (el.modalFavBtn) {
  el.modalFavBtn.addEventListener('click', async () => {
    if (!state.selectedWord) return;
    if (window.vocabAPI && window.vocabAPI.toggleFavorite) {
      const newState = await window.vocabAPI.toggleFavorite(state.selectedWord.id);
      state.selectedWord.isFavorite = newState;
      el.modalFavBtn.setAttribute('aria-pressed',String(newState));
      el.modalFavBtn.classList.toggle('active', Boolean(newState));
      const svg = el.modalFavBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', newState ? 'currentColor' : 'none');
      await refreshAll();
    }
  });
}

el.modalBoxStamp.addEventListener('click', () => {
  openCadenceModal(el.modalBoxStamp);
});

function closeDetailModal() {
  if (el.detailModal) el.detailModal.classList.add('hidden');
  document.body.classList.remove('detail-open');
  for (const row of el.lexiconGrid.children) row.classList.remove('selected');
  if (state.detailTrigger?.isConnected) state.detailTrigger.focus(); else if (state.activeView === 'lexicon') el.searchInput.focus();
}

el.modalClose.addEventListener('click', closeDetailModal);

el.detailModal.addEventListener('click', (e) => {
  if (e.target === el.detailModal) closeDetailModal();
});

el.modalAudioBtn.addEventListener('click', () => {
  if (state.selectedWord && !el.modalAudioBtn.disabled) {
    playAudio(state.selectedWord.audioUrl, state.selectedWord.word, el.modalAudioBtn);
  }
});

el.modalDeleteBtn.addEventListener('click', async () => {
  if (!state.selectedWord) return;
  const ok = confirm(`Remove "${state.selectedWord.displayWord}" from your lexicon?`);
  if (!ok) return;

  if (window.vocabAPI && window.vocabAPI.removeWord) {
    await window.vocabAPI.removeWord(state.selectedWord.id);
  }
  closeDetailModal();
  await refreshAll();
});

// ==========================================================================
// Review Deck Mode (Flashcards)
// ==========================================================================
async function startReviewSession() {
  const dueQueue = await fetchDueQueue();
  state.deckQueue = dueQueue;
  state.deckIndex = 0; state.reviewResults = [];
  state.isFlipped = false;

  if (state.deckQueue.length === 0) {
    el.indexCard.parentElement.classList.add('hidden');
    el.reviewActions.classList.add('hidden');
    el.deckComplete.classList.remove('hidden');
    el.completeSummary.textContent = 'All scheduled reviews are complete. No cards currently due for review.';
    return;
  }

  el.indexCard.parentElement.classList.remove('hidden');
  el.reviewActions.classList.remove('hidden');
  el.deckComplete.classList.add('hidden');
  el.indexCard.classList.remove('flipped');
  el.reviewActions.classList.add('hidden');
  el.indexCard.querySelector('.card-front').inert = false;
  el.indexCard.querySelector('.card-back').inert = true;

  showDeckCard();
}

function showDeckCard() {
  state.isFlipped = false;
  el.indexCard.classList.remove('flipped');
  el.reviewActions.classList.add('hidden');
  el.indexCard.querySelector('.card-front').inert = false;
  el.indexCard.querySelector('.card-back').inert = true;

  const current = state.deckQueue[state.deckIndex];
  if (!current) {
    // Session complete
    el.indexCard.parentElement.classList.add('hidden');
    el.reviewActions.classList.add('hidden');
    el.deckComplete.classList.remove('hidden');
    const again = state.reviewResults.filter(r => r === 'again').length;
    el.completeSummary.textContent = `Reviewed ${state.deckQueue.length} words. ${again} marked Again; ${state.deckQueue.length - again} retained. Your review schedule is saved.`;
    return;
  }

  const total = state.deckQueue.length;
  const step = state.deckIndex + 1;
  el.deckProgressText.textContent = `Card ${step} of ${total}`;
  el.deckProgressBar.style.width = `${Math.round((step / total) * 100)}%`;

  const box = current.review?.box || 1;
  const boxLabel = current.review?.boxLabel || getBoxLabel(box);

  // Front
  el.cardFrontBox.textContent = `Box ${box} · ${boxLabel}`;
  el.cardFrontBox.title = 'Click to view Leitner memory cadence guide';
  el.cardFrontSource.textContent = current.bookSource ? `Ref: ${current.bookSource}` : '';
  el.cardFrontWord.textContent = current.displayWord;
  el.cardFrontPhonetic.textContent = current.phonetic || '';

  // Inflected Form Citation
  const isInflected = current.inflectedForm && current.inflectedForm.toLowerCase() !== current.word.toLowerCase();
  if (isInflected) {
    el.cardFrontInflected.innerHTML = `Encountered as: <em>${escapeHtml(current.inflectedForm)}</em>`;
    el.cardFrontInflected.classList.remove('hidden');
    el.cardBackInflected.innerHTML = `Encountered as: <em>${escapeHtml(current.inflectedForm)}</em>`;
    el.cardBackInflected.classList.remove('hidden');
  } else {
    el.cardFrontInflected.classList.add('hidden');
    el.cardBackInflected.classList.add('hidden');
  }

  // Audio button state
  const hasAudio = hasAudioRecord(current);
  updateAudioButtonState(el.cardFrontAudio, hasAudio);
  updateAudioButtonState(el.cardBackAudio, hasAudio);
  if (!hasAudio && window.vocabAPI && window.vocabAPI.getAudioDataUrl && current.word) {
    window.vocabAPI.getAudioDataUrl(current.word).then(dataUrl => {
      if (dataUrl && state.deckQueue[state.deckIndex] === current) {
        updateAudioButtonState(el.cardFrontAudio, true);
        updateAudioButtonState(el.cardBackAudio, true);
      }
    }).catch(() => {});
  }

  // Back
  el.cardBackWord.textContent = current.displayWord;
  el.cardBackPhonetic.textContent = current.phonetic || '';
  el.cardBackEtymology.textContent = current.etymology || 'Origin notes not available.';

  // Back Definitions
  el.cardBackDefinitions.innerHTML = '';
  if (current.meanings && current.meanings.length > 0) {
    current.meanings.slice(0, 2).forEach(m => {
      const def = m.definitions?.[0];
      if (def) {
        const div = document.createElement('div');
        div.className = 'def-row';
        div.innerHTML = `
          <span class="pos-tag">[${escapeHtml(m.partOfSpeech || 'word')}]</span> ${escapeHtml(def.definition)}
          ${def.example ? `<div class="def-example-quote">"${escapeHtml(def.example)}"</div>` : ''}
        `;
        el.cardBackDefinitions.appendChild(div);
      }
    });
  }
}

el.cardFrontBox.addEventListener('click', (e) => {
  e.stopPropagation();
  openCadenceModal(el.cardFrontBox);
});

function flipCard() {
  if (state.isFlipped || !state.deckQueue[state.deckIndex]) return;
  state.isFlipped = true;
  el.indexCard.classList.toggle('flipped', state.isFlipped);
  el.indexCard.querySelector('.card-front').inert = true;
  el.indexCard.querySelector('.card-back').inert = false;
  el.reviewActions.classList.remove('hidden');
  el.reviewActions.querySelector('button').focus();
}

el.indexCard.addEventListener('click', flipCard);

el.cardFrontAudio.addEventListener('click', (e) => {
  e.stopPropagation();
  const word = state.deckQueue[state.deckIndex];
  if (word && !el.cardFrontAudio.disabled) playAudio(word.audioUrl, word.word, el.cardFrontAudio);
});

el.cardBackAudio.addEventListener('click', (e) => {
  e.stopPropagation();
  const word = state.deckQueue[state.deckIndex];
  if (word && !el.cardBackAudio.disabled) playAudio(word.audioUrl, word.word, el.cardBackAudio);
});

// Rating Action Handlers
el.reviewActions.querySelectorAll('.btn-rate').forEach(btn => {
  btn.addEventListener('click', () => {
    const rating = btn.getAttribute('data-rating');
    submitRating(rating);
  });
});

async function submitRating(rating) {
  if (state.isSubmittingRating || !state.isFlipped) return;
  state.isSubmittingRating = true;
  try {
    const current = state.deckQueue[state.deckIndex];
    if (!current) return;

    if (window.vocabAPI && window.vocabAPI.reviewWord) {
      await window.vocabAPI.reviewWord(current.id, rating);
    }

    state.reviewResults.push(rating);
    state.deckIndex++;
    showDeckCard();
    await refreshAll();
  } catch {
    announce('Could not save the review. Keep this card open and try again.', true);
  } finally {
    state.isSubmittingRating = false;
  }
}

// ==========================================================================
// Active Retention Quiz Controller
// ==========================================================================
function initQuizView() {
  document.getElementById('quiz-setup').classList.remove('hidden');
  if (el.quizArena) el.quizArena.classList.add('hidden');
  if (el.quizComplete) el.quizComplete.classList.add('hidden');
  if (el.quizEmptyNotice) el.quizEmptyNotice.classList.add('hidden');
}

if (el.btnStartQuiz) el.btnStartQuiz.addEventListener('click', () => startQuizSession());
if (el.btnQuizRestart) el.btnQuizRestart.addEventListener('click', () => startQuizSession());
if (el.btnQuizToLexicon) el.btnQuizToLexicon.addEventListener('click', () => switchView('lexicon'));

async function startQuizSession() {
  if (state.quiz.isSubmitting || state.quiz.isGenerating) return;
  if (!el.quizArena.classList.contains('hidden') && !confirm('Start a new quiz? Answers already saved will keep their review updates.')) return;
  state.quiz.isGenerating = true;
  el.btnStartQuiz.disabled = true;
  const mode = el.quizModeSelect.value;
  const scopeVal = el.quizScopeSelect.value;
  const limit = parseInt(el.quizLimitSelect.value, 10) || 5;
  const linkToSrs = el.quizLinkSrs.checked;

  const filter = { limit };
  if (scopeVal.startsWith('col:')) {
    filter.collectionId = scopeVal.slice(4);
  } else if (scopeVal === 'favorites') {
    filter.favoritesOnly = true;
  }

  let questions = [];
  try {
    if (window.vocabAPI && window.vocabAPI.generateQuiz) {
      questions = await window.vocabAPI.generateQuiz(mode, filter);
    }
  } catch (err) {
    announce('Could not start the quiz. Try again.', true);
    state.quiz.isGenerating=false; el.btnStartQuiz.disabled=false; return;
  }

  state.quiz.isGenerating=false; el.btnStartQuiz.disabled=false;
  if (!questions || questions.length === 0) {
    el.quizArena.classList.add('hidden');
    el.quizComplete.classList.add('hidden');
    el.quizEmptyNotice.classList.remove('hidden');
    if (scopeVal === 'favorites') {
      el.quizEmptySub.textContent = 'You have not favorited enough words (with definitions or examples) to generate this quiz.';
    } else if (scopeVal.startsWith('col:')) {
      el.quizEmptySub.textContent = 'This collection does not have enough distinct words to generate 4-option quiz questions.';
    } else {
      el.quizEmptySub.textContent = 'You need at least 4 words recorded in your lexicon (with definitions and examples) to generate this quiz.';
    }
    return;
  }

  state.quiz = {
    deck: questions,
    index: 0,
    score: 0,
    mode,
    isAnswered: false,
    linkToSrs, results: [], isSubmitting: false
  };
  document.getElementById('quiz-setup').classList.add('hidden');

  el.quizEmptyNotice.classList.add('hidden');
  el.quizComplete.classList.add('hidden');
  el.quizArena.classList.remove('hidden');

  renderCurrentQuizQuestion();
}

function renderCurrentQuizQuestion() {
  const q = state.quiz.deck[state.quiz.index];
  if (!q) {
    showQuizComplete();
    return;
  }

  state.quiz.isAnswered = false;
  el.btnQuizNext.disabled=true;
  el.quizActions.classList.add('hidden');

  const total = state.quiz.deck.length;
  const step = state.quiz.index + 1;
  el.quizProgressText.textContent = `Question ${step} of ${total}`;
  el.quizProgressBar.style.width = `${Math.round((step / total) * 100)}%`;
  el.quizScoreText.textContent = `${state.quiz.score} / ${state.quiz.index}`;

  const modeLabels = {
    definition: 'Definition Match',
    cloze: 'Sentence Completion',
    missing_letters: 'Missing Letters'
  };
  el.quizBadgeMode.textContent = modeLabels[q.mode] || 'Quiz';

  el.quizCardContent.innerHTML = '';

  if (q.mode === 'definition') {
    renderDefinitionQuestion(q);
  } else if (q.mode === 'cloze') {
    renderClozeQuestion(q);
  } else if (q.mode === 'missing_letters') {
    renderMissingLettersQuestion(q);
  }
}

function renderDefinitionQuestion(q) {
  const targetWord = state.words.find(w => w.id === q.wordId);
  const hasAudio = hasAudioRecord(targetWord);

  const container = document.createElement('div');
  container.className = 'quiz-card-body';

  container.innerHTML = `
    <div class="quiz-prompt-header">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem;">
        <h2 class="quiz-target-word">${escapeHtml(q.prompt)}</h2>
        <button type="button" aria-label="Play pronunciation" class="btn-icon-audio btn-quiz-audio"  title="${hasAudio ? 'Listen' : 'No audio'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>
      <div class="phonetic-row">
        ${q.partOfSpeech ? `<span class="pos-stamp">${escapeHtml(q.partOfSpeech)}</span>` : ''}
        ${q.phonetic ? `<span class="pos-divider" aria-hidden="true">·</span><span class="phonetic-mono">${escapeHtml(q.phonetic)}</span>` : ''}
      </div>
      <p class="quiz-question-sub">Select the definition that correctly matches this word:</p>
    </div>

    <div class="quiz-options-list">
      ${q.options.map((opt, idx) => `
        <button type="button" class="quiz-option-btn" data-index="${idx}">
          <span class="quiz-option-key">${idx + 1}</span>
          <span class="quiz-option-text">${escapeHtml(opt)}</span>
        </button>
      `).join('')}
    </div>
  `;

  const audioBtn = container.querySelector('.btn-quiz-audio');
  if (audioBtn && targetWord) {
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playAudio(targetWord.audioUrl, targetWord.word, audioBtn);
    });
  }

  container.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedIndex = parseInt(btn.getAttribute('data-index'), 10);
      handleOptionSelected(q, selectedIndex);
    });
  });

  el.quizCardContent.appendChild(container);
}

function renderClozeQuestion(q) {
  const container = document.createElement('div');
  container.className = 'quiz-card-body';

  const formattedSentence = escapeHtml(q.promptSentence).replace(/_______/g, '<mark>_______</mark>');

  container.innerHTML = `
    <div class="quiz-prompt-header">
      <div class="quiz-sentence-prompt">"${formattedSentence}"</div>
      <p class="quiz-question-sub">Select the vocabulary slip that completes this reading excerpt:</p>
    </div>

    <div class="quiz-options-list">
      ${q.options.map((opt, idx) => `
        <button type="button" class="quiz-option-btn" data-index="${idx}">
          <span class="quiz-option-key">${idx + 1}</span>
          <span class="quiz-option-text" style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 500;">${escapeHtml(opt)}</span>
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedIndex = parseInt(btn.getAttribute('data-index'), 10);
      handleOptionSelected(q, selectedIndex);
    });
  });

  el.quizCardContent.appendChild(container);
}

function renderMissingLettersQuestion(q) {
  const targetWord = state.words.find(w => w.id === q.wordId);
  const hasAudio = hasAudioRecord(targetWord);

  const container = document.createElement('div');
  container.className = 'missing-letters-area';

  container.innerHTML = `
    <div class="missing-letters-masked">${escapeHtml(q.maskedWord)}</div>
    <div class="phonetic-row" style="justify-content: center; margin-bottom: 0.5rem;">
      <span class="phonetic-mono">${escapeHtml(q.phonetic || '')}</span>
      <button type="button" aria-label="Play pronunciation" class="btn-icon-audio btn-quiz-audio"  title="${hasAudio ? 'Listen' : 'No audio'}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>
    </div>
    <p class="missing-letters-definition">"${escapeHtml(q.definition)}"</p>

    <form class="missing-letters-form" id="missing-letters-form">
      <label for="input-missing-letters" class="sr-only">Full word</label><input type="text" class="entry-input missing-letters-input" id="input-missing-letters" placeholder="Type full word..." autocomplete="off">
      <button type="submit" class="btn-record">Verify</button>
    </form>
  `;

  const audioBtn = container.querySelector('.btn-quiz-audio');
  if (audioBtn && targetWord) {
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playAudio(targetWord.audioUrl, targetWord.word, audioBtn);
    });
  }

  const form = container.querySelector('#missing-letters-form');
  const input = container.querySelector('#input-missing-letters');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.quiz.isAnswered) return;
    const typed = input.value.trim().toLowerCase();
    const isCorrect = typed === q.solution.toLowerCase();
    handleMissingLettersResult(q, isCorrect, input);
  });

  el.quizCardContent.appendChild(container);
  input.focus();
}

async function handleOptionSelected(q, selectedIndex) {
  if (state.quiz.isAnswered) return;
  state.quiz.isAnswered = true;

  const isCorrect = selectedIndex === q.correctAnswerIndex;
  const buttons = el.quizCardContent.querySelectorAll('.quiz-option-btn');

  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === q.correctAnswerIndex) {
      btn.classList.add('correct');
    } else if (idx === selectedIndex) {
      btn.classList.add('wrong');
    }
  });

  if (isCorrect) {
    state.quiz.score++;
    showQuizFeedback(true, '✓ Correct recall.');
  } else {
    showQuizFeedback(false, `✗ Incorrect. Correct: "${q.options[q.correctAnswerIndex]}"`);
  }

  await saveQuizAnswer(q, isCorrect, q.options[selectedIndex]);
}

async function handleMissingLettersResult(q, isCorrect, inputEl) {
  if (state.quiz.isAnswered) return;
  state.quiz.isAnswered = true;
  inputEl.disabled = true;
  if (isCorrect) state.quiz.score++;
  showQuizFeedback(isCorrect, isCorrect ? 'Correct recall.' : `The word was “${q.solution}”.`);
  await saveQuizAnswer(q, isCorrect, inputEl.value);
}

async function saveQuizAnswer(q, success, givenAnswer) {
  state.quiz.isSubmitting = true;
  let saved = false;
  try {
    await window.vocabAPI.submitQuiz(q.wordId, success, state.quiz.linkToSrs);
    saved = true;
  } catch {
    announce('The answer could not be saved. Its review schedule may be unchanged. You can continue the quiz.', true);
  } finally {
    state.quiz.results.push({wordId:q.wordId, success, givenAnswer, correct:q.mode === 'missing_letters' ? q.solution : q.options[q.correctAnswerIndex], saved});
    state.quiz.isSubmitting = false;
    el.btnQuizNext.disabled=false;
    el.quizActions.classList.remove('hidden');
    el.btnQuizNext.focus();
  }
}

function showQuizFeedback(isCorrect, message) {
  el.quizFeedbackBanner.textContent = message;
  el.quizFeedbackBanner.className = `quiz-feedback-banner ${isCorrect ? 'correct' : 'wrong'}`;
}

el.btnQuizNext.addEventListener('click', () => {
  if (!state.quiz.isAnswered || state.quiz.isSubmitting) return;
  state.quiz.isAnswered = false;
  state.quiz.index++;
  if (state.quiz.index < state.quiz.deck.length) {
    renderCurrentQuizQuestion();
  } else {
    showQuizComplete();
  }
});

async function showQuizComplete() {
  el.quizArena.classList.add('hidden');
  el.quizComplete.classList.remove('hidden');

  const total = state.quiz.deck.length;
  const score = state.quiz.score;
  const pct = Math.round((score / total) * 100);

  el.quizCompleteScore.textContent = `Score: ${score} / ${total} (${pct}%)`;

  const saved = state.quiz.results.filter(r => r.saved).length;
  el.quizCompleteSummary.textContent = state.quiz.linkToSrs
    ? `${saved} of ${total} review updates saved. Incorrect answers are due for review today.`
    : 'Practice complete. Your review schedule was not changed.';
  const mistakes = document.getElementById('quiz-mistakes'); mistakes.replaceChildren();
  for (const answer of state.quiz.results.filter(r => !r.success)) {
    const item = document.createElement('p');
    const word = state.words.find(w => w.id === answer.wordId);
    item.textContent = `${word?.displayWord || 'Word'} — Your answer: ${answer.givenAnswer || '(blank)'}. Correct answer: ${answer.correct}`;
    mistakes.appendChild(item);
  }
  // Refresh stats in background
  await refreshAll();
}

// ==========================================================================
// Keyboard Navigation
// ==========================================================================
window.addEventListener('keydown', (e) => {
  // Always handle Escape for open dialogs regardless of focused field
  if (e.key === 'Escape') {
    if (el.collectionModal && !el.collectionModal.classList.contains('hidden')) {
      e.preventDefault();
      closeCollectionModal();
      return;
    }

    if (el.cadenceModal && !el.cadenceModal.classList.contains('hidden')) {
      e.preventDefault();
      closeCadenceModal();
      return;
    }

    if (el.detailModal && !el.detailModal.classList.contains('hidden')) {
      e.preventDefault();
      closeDetailModal();
      return;
    }
  }

  // If an input or editable field is active, do not intercept typing
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
    return;
  }

  // Review Deck keyboard handling
  if (state.activeView === 'review' && !el.indexCard.parentElement.classList.contains('hidden')) {
    if (!state.isFlipped && (e.code === 'Space' || e.key === 'Enter' && e.target === el.indexCard)) {
      e.preventDefault();
      flipCard();
    } else if (state.isFlipped) {
      if (e.key === '1') submitRating('again');
      if (e.key === '2') submitRating('hard');
      if (e.key === '3') submitRating('good');
      if (e.key === '4') submitRating('easy');
    }
  }

  // Active Quiz keyboard handling
  if (state.activeView === 'quiz' && !el.quizArena.classList.contains('hidden')) {
    if (!state.quiz.isAnswered && (state.quiz.mode === 'definition' || state.quiz.mode === 'cloze')) {
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        const currentQ = state.quiz.deck[state.quiz.index];
        if (currentQ && currentQ.options && currentQ.options[index] !== undefined) {
          handleOptionSelected(currentQ, index);
        }
      }
    } else if (state.quiz.isAnswered) {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        el.btnQuizNext.click();
      }
    }
  }
});

// ==========================================================================
// Cadence Guide Modal Controller & Focus Management
// ==========================================================================
let cadenceReturnFocusElement = null;

function openCadenceModal(triggerEl = null) {
  if (!el.cadenceModal) return;
  cadenceReturnFocusElement = triggerEl || document.activeElement;
  el.cadenceModal.classList.remove('hidden');

  // Immediately move keyboard focus into the dialog
  const focusTarget = el.cadenceBtnDismiss || el.cadenceModalClose || el.cadenceModal.querySelector('button');
  if (focusTarget) {
    focusTarget.focus();
  }
}

function closeCadenceModal() {
  if (!el.cadenceModal || el.cadenceModal.classList.contains('hidden')) return;
  el.cadenceModal.classList.add('hidden');

  // Restore keyboard focus to the triggering element
  if (cadenceReturnFocusElement && typeof cadenceReturnFocusElement.focus === 'function' && document.contains(cadenceReturnFocusElement)) {
    try {
      const target = cadenceReturnFocusElement;
      queueMicrotask(() => target.focus());
    } catch { /* ignore */ }
  }
  cadenceReturnFocusElement = null;
}

// Trap keyboard focus inside Cadence modal when open
if (el.cadenceModal) {
  el.cadenceModal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusable = el.cadenceModal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !el.cadenceModal.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !el.cadenceModal.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  el.cadenceModal.addEventListener('click', (e) => {
    if (e.target === el.cadenceModal) closeCadenceModal();
  });
}

if (el.btnCadenceGuide) el.btnCadenceGuide.addEventListener('click', () => openCadenceModal(el.btnCadenceGuide));
if (el.cadenceModalClose) el.cadenceModalClose.addEventListener('click', closeCadenceModal);
if (el.cadenceBtnDismiss) el.cadenceBtnDismiss.addEventListener('click', closeCadenceModal);

// ==========================================================================
// View Switching
// ==========================================================================
el.navLexiconBtn.addEventListener('click', () => switchView('lexicon'));
el.navReviewBtn.addEventListener('click', () => switchView('review'));
if (el.navQuizBtn) el.navQuizBtn.addEventListener('click', () => switchView('quiz'));
if (el.navConnectionsBtn) el.navConnectionsBtn.addEventListener('click', () => switchView('connections'));
el.btnReturnLexicon.addEventListener('click', () => switchView('lexicon'));

function switchView(viewName) {
  if ((state.quiz.isSubmitting || state.isSubmittingRating) && viewName !== state.activeView) { announce('Please wait while your answer is saved.'); return; }
  closeDetailModal();
  if (viewName !== 'connections' && document.body.classList.contains('map-fullscreen')) {
    document.body.classList.remove('map-fullscreen');
    if (typeof updateFullScreenUI === 'function') updateFullScreenUI();
  }
  state.activeView = viewName;
  document.body.dataset.view = viewName;
  if (viewName === 'connections' && document.fullscreenElement && connectionsState.viewMode === 'graph') {
    document.body.classList.add('map-fullscreen');
    if (typeof updateFullScreenUI === 'function') updateFullScreenUI();
  }
  for (const name of ['lexicon','review','quiz','connections','shelves','settings']) {
    const button = document.getElementById(`nav-${name}-btn`);
    if (!button) continue;
    button.classList.toggle('active', name === viewName);
    if (name === viewName) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    const panel = document.getElementById(`view-${name}`);
    if (panel) {
      panel.classList.toggle('active',name === viewName); panel.classList.toggle('hidden',name !== viewName);
    }
  }
  document.querySelector('.sidebar').classList.remove('menu-open'); document.getElementById('nav-menu').setAttribute('aria-expanded','false');
  if (viewName === 'lexicon') renderLexicon();
  if (viewName === 'review') {
    if (state.deckQueue.length && state.deckIndex < state.deckQueue.length) showDeckCard();
    else startReviewSession();
  }
  if (viewName === 'quiz') {
    if (state.quiz.deck.length && state.quiz.index < state.quiz.deck.length) { el.quizArena.classList.remove('hidden'); document.getElementById('quiz-setup').classList.add('hidden'); }
    else initQuizView();
  }
  if (viewName === 'connections' && typeof renderConnectionsView === 'function') {
    renderConnectionsView();
  }
  if (viewName === 'shelves') renderShelves();
}

// ==========================================================================
// Export Backup
// ==========================================================================
el.btnExport.addEventListener('click', async () => {
  let exportData;
  if (window.vocabAPI && window.vocabAPI.exportData) {
    exportData = await window.vocabAPI.exportData();
  } else {
    exportData = state.words;
  }
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vocab-lexicon-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupDesktop();
  if (typeof initConnectionsView === 'function') initConnectionsView();
  announce('Loading your lexicon…');
  refreshAll().then(() => announce('')).catch(() => announce('Could not load your library. Reopen the application to retry.', true));
});
