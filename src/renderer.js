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
  return Boolean(word.audioUrl || word.audioLocalPath);
}

function updateAudioButtonState(button, hasAudio) {
  if (!button) return;
  if (hasAudio) {
    button.disabled = false;
    button.title = 'Listen to pronunciation';
  } else {
    button.disabled = true;
    button.title = 'No audio recording archived';
  }
}

async function playAudio(audioUrl, wordText, buttonEl) {
  // 1. Cancel and pause any active audio playback immediately
  if (state.activeAudio) {
    try {
      state.activeAudio.pause();
    } catch { /* ignore */ }
    state.activeAudio = null;
  }

  // 2. Clear playing state from previous button
  if (currentPlayingButton) {
    currentPlayingButton.classList.remove('playing');
    currentPlayingButton = null;
  }

  // 3. Increment request ID to supersede any in-flight requests
  const requestId = ++currentAudioRequestId;
  if (buttonEl) {
    currentPlayingButton = buttonEl;
    buttonEl.classList.add('playing');
  }

  const cleanup = () => {
    if (requestId === currentAudioRequestId) {
      if (buttonEl) buttonEl.classList.remove('playing');
      if (currentPlayingButton === buttonEl) currentPlayingButton = null;
      state.activeAudio = null;
    }
  };

  // 4. Try local cached lightweight audio from backend IPC
  let dataUrl = null;
  try {
    if (window.vocabAPI && window.vocabAPI.getAudioDataUrl && wordText) {
      dataUrl = await window.vocabAPI.getAudioDataUrl(wordText);
    }
  } catch (err) {
    console.debug('Local audio cache retrieval failed, checking remote URL:', err);
  }

  // If a newer audio request was made while awaiting IPC, abort!
  if (requestId !== currentAudioRequestId) {
    return;
  }

  // 5. If local cached audio found, play it
  if (dataUrl) {
    if (state.activeAudio) {
      try { state.activeAudio.pause(); } catch {}
      state.activeAudio = null;
    }
    const audio = new Audio(dataUrl);
    state.activeAudio = audio;
    audio.onended = cleanup;
    audio.onerror = cleanup;
    try {
      await audio.play();
    } catch {
      cleanup();
    }
    return;
  }

  // 6. Try remote audio URL
  if (audioUrl && audioUrl.startsWith('http')) {
    if (state.activeAudio) {
      try { state.activeAudio.pause(); } catch {}
      state.activeAudio = null;
    }
    const audio = new Audio(audioUrl);
    state.activeAudio = audio;
    audio.onended = cleanup;
    audio.onerror = cleanup;
    try {
      await audio.play();
    } catch {
      cleanup();
    }
    return;
  }

  // 7. No audio recording available
  cleanup();
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
      state.tagFilter = null;
      renderTagFilterChips();
      renderLexicon();
    });
    el.tagFilterChips.appendChild(clearBtn);
  }

  tags.forEach(({ tag, count }) => {
    if (tag === state.tagFilter) return; // already rendered as active filter
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip';
    chip.textContent = `#${tag} (${count})`;
    chip.addEventListener('click', () => {
      state.tagFilter = tag;
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
}

// ==========================================================================
// Collections Shelf Modal Controller
// ==========================================================================
function openCollectionModal() {
  if (!el.collectionModal) return;
  el.inputCollectionName.value = '';
  el.inputCollectionDesc.value = '';
  el.collectionModal.classList.remove('hidden');
  el.inputCollectionName.focus();
}

function closeCollectionModal() {
  if (el.collectionModal) el.collectionModal.classList.add('hidden');
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
        state.collectionFilter = created.id;
        await refreshAll();
      }
    } catch (err) {
      alert(err.message || 'Failed to create collection shelf.');
    }
  });
}

if (el.filterCollection) {
  el.filterCollection.addEventListener('change', (e) => {
    state.collectionFilter = e.target.value;
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
    openDetailModal(freshlySaved);
  } catch (err) {
    showFeedback(err.message || 'Lookup failed. Check word spelling.', true);
  } finally {
    setEntryLoading(false);
    el.inputWord.focus();
  }
});

function setEntryLoading(isLoading) {
  el.btnSubmit.disabled = isLoading;
  el.btnSpinner.classList.toggle('hidden', !isLoading);
  el.btnText.classList.toggle('hidden', isLoading);
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
function renderLexicon() {
  const query = state.searchQuery.toLowerCase().trim();
  const filter = state.statusFilter;
  const colFilter = state.collectionFilter;
  const tagFilter = state.tagFilter;
  const now = new Date();

  const filtered = state.words.filter(w => {
    if (query) {
      const matchWord = (w.word || '').toLowerCase().includes(query);
      const matchDisplay = (w.displayWord || '').toLowerCase().includes(query);
      const matchInflected = (w.inflectedForm || '').toLowerCase().includes(query);
      const matchSource = (w.bookSource || '').toLowerCase().includes(query);
      const matchDef = (w.meanings || []).some(m =>
        (m.definitions || []).some(d => (d.definition || '').toLowerCase().includes(query))
      );
      const matchTags = (w.tags || []).some(t => t.toLowerCase().includes(query));
      if (!matchWord && !matchDisplay && !matchInflected && !matchSource && !matchDef && !matchTags) return false;
    }

    // Status filter
    if (filter === 'favorites') {
      if (!w.isFavorite) return false;
    } else {
      const box = w.review?.box || 1;
      const isDue = w.review?.nextReviewDate ? new Date(w.review.nextReviewDate) <= now : true;
      if (filter === 'due' && !isDue) return false;
      if (filter === 'learning' && box >= 5) return false;
      if (filter === 'mastered' && box < 5) return false;
    }

    // Collection filter
    if (colFilter !== 'all') {
      if (!Array.isArray(w.collections) || !w.collections.includes(colFilter)) return false;
    }

    // Tag filter
    if (tagFilter) {
      if (!Array.isArray(w.tags) || !w.tags.includes(tagFilter)) return false;
    }

    return true;
  });

  el.lexiconGrid.innerHTML = '';

  if (filtered.length === 0) {
    el.lexiconEmpty.classList.remove('hidden');
    el.lexiconGrid.classList.add('hidden');
    return;
  }

  el.lexiconEmpty.classList.add('hidden');
  el.lexiconGrid.classList.remove('hidden');

  filtered.forEach(word => {
    const card = document.createElement('article');
    card.className = 'lexicon-card';

    const firstMeaning = word.meanings?.[0] || { partOfSpeech: 'word', definitions: [{ definition: '' }] };
    const pos = firstMeaning.partOfSpeech || '';
    const def = firstMeaning.definitions?.[0]?.definition || '';
    const example = firstMeaning.definitions?.[0]?.example || '';
    const box = word.review?.box || 1;
    const boxLabel = word.review?.boxLabel || getBoxLabel(box);
    const isMastered = box >= 5;
    const isInflected = word.inflectedForm && word.inflectedForm.toLowerCase() !== word.word.toLowerCase();
    const hasAudio = hasAudioRecord(word);
    const isFav = Boolean(word.isFavorite);

    card.innerHTML = `
      <div class="card-mast">
        <h3 class="card-title-serif">${escapeHtml(word.displayWord)}</h3>
        <div class="card-mast-actions">
          <button type="button" class="btn-icon-fav btn-card-fav ${isFav ? 'active' : ''}" title="${isFav ? 'Remove from favorites' : 'Mark as favorite'}" aria-label="Favorite">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          <button type="button" class="box-stamp btn-stamp-trigger ${isMastered ? 'mastered' : ''}" title="View Leitner cadence guide">Box ${box} · ${escapeHtml(boxLabel)}</button>
        </div>
      </div>

      <div class="phonetic-row">
        ${pos ? `<span class="pos-stamp">${escapeHtml(pos)}</span>` : ''}
        ${pos && word.phonetic ? `<span class="pos-divider" aria-hidden="true">·</span>` : ''}
        <span class="phonetic-mono">${escapeHtml(word.phonetic || '')}</span>
        <button type="button" class="btn-icon-audio btn-card-audio" ${hasAudio ? '' : 'disabled'} title="${hasAudio ? 'Listen to pronunciation' : 'No audio recording archived'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      ${isInflected ? `<p class="card-inflected-cite">Encountered as: <em>${escapeHtml(word.inflectedForm)}</em></p>` : ''}

      <p class="card-definition">${escapeHtml(def)}</p>

      ${example ? `<div class="card-quote-preview">"${escapeHtml(example)}"</div>` : ''}

      ${((word.collections && word.collections.length > 0) || (word.tags && word.tags.length > 0)) ? `
        <div class="card-taxonomies">
          ${(word.collections || []).map(cid => {
            const col = (state.collections || []).find(c => c.id === cid);
            return col ? `<span class="badge-collection">${escapeHtml(col.name)}</span>` : '';
          }).join('')}
          ${(word.tags || []).map(t => `<span class="badge-tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}
        </div>
      ` : ''}

      <div class="card-foot">
        <span class="card-source-cite">${word.bookSource ? `Ref: ${escapeHtml(word.bookSource)}` : ''}</span>
        <span>${formatNextReview(word.review?.nextReviewDate)}</span>
      </div>
    `;

    // Favorite toggle button
    const favBtn = card.querySelector('.btn-card-fav');
    if (favBtn) {
      favBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.vocabAPI && window.vocabAPI.toggleFavorite) {
          try {
            await window.vocabAPI.toggleFavorite(word.id);
            await refreshAll();
          } catch (err) {
            console.error('Error toggling favorite:', err);
          }
        }
      });
    }

    // Tag badge click toggles tag filter
    card.querySelectorAll('.badge-tag').forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = tagEl.getAttribute('data-tag');
        state.tagFilter = state.tagFilter === tag ? null : tag;
        renderTagFilterChips();
        renderLexicon();
      });
    });

    // Box cadence stamp trigger
    const stampBtn = card.querySelector('.btn-stamp-trigger');
    if (stampBtn) {
      stampBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCadenceModal(stampBtn);
      });
    }

    // Audio button click
    const audioBtn = card.querySelector('.btn-card-audio');
    if (!hasAudio && window.vocabAPI && window.vocabAPI.getAudioDataUrl && word.word) {
      window.vocabAPI.getAudioDataUrl(word.word).then(dataUrl => {
        if (dataUrl) updateAudioButtonState(audioBtn, true);
      }).catch(() => {});
    }
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!audioBtn.disabled) {
        playAudio(word.audioUrl, word.word, audioBtn);
      }
    });

    // Card click opens modal
    card.addEventListener('click', () => {
      openDetailModal(word);
    });

    el.lexiconGrid.appendChild(card);
  });
}

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
  state.searchQuery = e.target.value;
  renderLexicon();
});

el.filterStatus.addEventListener('change', (e) => {
  state.statusFilter = e.target.value;
  renderLexicon();
});

// ==========================================================================
// Word Detail Modal
// ==========================================================================
function openDetailModal(word) {
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
  state.deckIndex = 0;
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

  showDeckCard();
}

function showDeckCard() {
  state.isFlipped = false;
  el.indexCard.classList.remove('flipped');

  const current = state.deckQueue[state.deckIndex];
  if (!current) {
    // Session complete
    el.indexCard.parentElement.classList.add('hidden');
    el.reviewActions.classList.add('hidden');
    el.deckComplete.classList.remove('hidden');
    el.completeSummary.textContent = `Completed review of ${state.deckQueue.length} vocabulary slips today.`;
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
  state.isFlipped = !state.isFlipped;
  el.indexCard.classList.toggle('flipped', state.isFlipped);
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
  if (state.isSubmittingRating) return;
  state.isSubmittingRating = true;
  try {
    const current = state.deckQueue[state.deckIndex];
    if (!current) return;

    if (window.vocabAPI && window.vocabAPI.reviewWord) {
      await window.vocabAPI.reviewWord(current.id, rating);
    }

    state.deckIndex++;
    showDeckCard();
    await refreshAll();
  } finally {
    state.isSubmittingRating = false;
  }
}

// ==========================================================================
// Active Retention Quiz Controller
// ==========================================================================
function initQuizView() {
  if (el.quizArena) el.quizArena.classList.add('hidden');
  if (el.quizComplete) el.quizComplete.classList.add('hidden');
  if (el.quizEmptyNotice) el.quizEmptyNotice.classList.add('hidden');
}

if (el.btnStartQuiz) el.btnStartQuiz.addEventListener('click', () => startQuizSession());
if (el.btnQuizRestart) el.btnQuizRestart.addEventListener('click', () => startQuizSession());
if (el.btnQuizToLexicon) el.btnQuizToLexicon.addEventListener('click', () => switchView('lexicon'));

async function startQuizSession() {
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
    console.error('Quiz generation error:', err);
  }

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
    linkToSrs
  };

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
        <button type="button" class="btn-icon-audio btn-quiz-audio" ${hasAudio ? '' : 'disabled'} title="${hasAudio ? 'Listen' : 'No audio'}">
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
      <button type="button" class="btn-icon-audio btn-quiz-audio" ${hasAudio ? '' : 'disabled'} title="${hasAudio ? 'Listen' : 'No audio'}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>
    </div>
    <p class="missing-letters-definition">"${escapeHtml(q.definition)}"</p>

    <form class="missing-letters-form" id="missing-letters-form">
      <input type="text" class="entry-input missing-letters-input" id="input-missing-letters" placeholder="Type full word..." autocomplete="off">
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
    const targetWord = state.words.find(w => w.id === q.wordId);
    if (targetWord && hasAudioRecord(targetWord)) {
      playAudio(targetWord.audioUrl, targetWord.word, null);
    }
  } else {
    showQuizFeedback(false, `✗ Incorrect. Correct: "${escapeHtml(q.options[q.correctAnswerIndex])}"`);
  }

  // Update SRS cadence if enabled
  if (window.vocabAPI && window.vocabAPI.submitQuiz) {
    try {
      await window.vocabAPI.submitQuiz(q.wordId, isCorrect, state.quiz.linkToSrs);
    } catch (err) {
      console.error('Error submitting quiz result:', err);
    }
  }

  el.quizActions.classList.remove('hidden');
  el.btnQuizNext.focus();
}

async function handleMissingLettersResult(q, isCorrect, inputEl) {
  state.quiz.isAnswered = true;
  inputEl.disabled = true;

  if (isCorrect) {
    state.quiz.score++;
    showQuizFeedback(true, `✓ Exact match: "${escapeHtml(q.solution)}"`);
    const targetWord = state.words.find(w => w.id === q.wordId);
    if (targetWord && hasAudioRecord(targetWord)) {
      playAudio(targetWord.audioUrl, targetWord.word, null);
    }
  } else {
    showQuizFeedback(false, `✗ Word was: "${escapeHtml(q.solution)}"`);
  }

  if (window.vocabAPI && window.vocabAPI.submitQuiz) {
    try {
      await window.vocabAPI.submitQuiz(q.wordId, isCorrect, state.quiz.linkToSrs);
    } catch (err) {
      console.error('Error submitting quiz result:', err);
    }
  }

  el.quizActions.classList.remove('hidden');
  el.btnQuizNext.focus();
}

function showQuizFeedback(isCorrect, message) {
  el.quizFeedbackBanner.textContent = message;
  el.quizFeedbackBanner.className = `quiz-feedback-banner ${isCorrect ? 'correct' : 'wrong'}`;
}

el.btnQuizNext.addEventListener('click', () => {
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

  let summary = '';
  if (pct === 100) {
    summary = 'Flawless recall. All tested vocabulary slips consolidated in memory.';
  } else if (pct >= 70) {
    summary = 'Strong retention across tested entries. Scheduled cadences adjusted.';
  } else {
    summary = 'Several words need reinforcement. They have been scheduled for review in your Review Deck.';
  }
  el.quizCompleteSummary.textContent = summary;

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
    if (e.code === 'Space') {
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
      cadenceReturnFocusElement.focus();
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
el.btnReturnLexicon.addEventListener('click', () => switchView('lexicon'));

function switchView(viewName) {
  state.activeView = viewName;

  el.navLexiconBtn.classList.toggle('active', viewName === 'lexicon');
  el.navReviewBtn.classList.toggle('active', viewName === 'review');
  if (el.navQuizBtn) el.navQuizBtn.classList.toggle('active', viewName === 'quiz');

  el.viewLexicon.classList.toggle('active', viewName === 'lexicon');
  el.viewLexicon.classList.toggle('hidden', viewName !== 'lexicon');

  el.viewReview.classList.toggle('active', viewName === 'review');
  el.viewReview.classList.toggle('hidden', viewName !== 'review');

  if (el.viewQuiz) {
    el.viewQuiz.classList.toggle('active', viewName === 'quiz');
    el.viewQuiz.classList.toggle('hidden', viewName !== 'quiz');
  }

  if (viewName === 'lexicon') {
    renderLexicon();
  } else if (viewName === 'review') {
    startReviewSession();
  } else if (viewName === 'quiz') {
    initQuizView();
  }
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
  refreshAll();
});
