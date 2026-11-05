'use strict';

const desktopPrefs = {
  get(key, fallback) { try { return localStorage.getItem(`vocab_${key}`) || fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`vocab_${key}`, value); } catch { /* Preferences are optional. */ } }
};
function announce(message, error = false) {
  const status = document.getElementById('app-status');
  status.textContent = message;
  status.classList.toggle('error', error);
  status.classList.toggle('hidden', !message);
}
let dialogTrigger = null;
function openCapture() {
  dialogTrigger = document.activeElement;
  document.getElementById('add-word-modal').classList.remove('hidden');
  el.inputWord.focus();
}
function closeCapture(force = false) {
  if (el.btnSubmit.disabled && !force) { announce('Please wait while the word is saved.'); return; }
  document.getElementById('add-word-modal').classList.add('hidden');
  queueMicrotask(() => { if (dialogTrigger?.isConnected) dialogTrigger.focus(); });
}
function resetBrowse() {
  state.searchQuery = ''; state.statusFilter = 'all'; state.collectionFilter = 'all'; state.tagFilter = null;
  document.getElementById('filter-favorites').checked = false;
  el.searchInput.value = ''; el.filterStatus.value = 'all'; el.filterCollection.value = 'all';
  state.page = 1; renderTagFilterChips(); renderLexicon();
}
function renderDesktopLibrary() {
  const query = state.searchQuery.trim().toLowerCase();
  const now = Date.now();
  const favorites = document.getElementById('filter-favorites').checked;
  const words = state.words.filter(w => {
    const searchable = [w.word, w.displayWord, w.inflectedForm, w.bookSource, ...(w.tags || []),
      ...(w.meanings || []).flatMap(m => m.definitions.map(d => d.definition))];
    if (query && !searchable.some(value => String(value || '').toLowerCase().includes(query))) return false;
    if (favorites && !w.isFavorite) return false;
    if (state.statusFilter === 'favorites' && !w.isFavorite) return false;
    if (state.statusFilter === 'due' && Date.parse(w.review.nextReviewDate) > now) return false;
    if (state.statusFilter === 'learning' && w.review.box === 5) return false;
    if (state.statusFilter === 'mastered' && w.review.box !== 5) return false;
    return (state.collectionFilter === 'all' || w.collections.includes(state.collectionFilter)) && (!state.tagFilter || w.tags.includes(state.tagFilter));
  });
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  words.sort((a,b) => (state.sort === 'newest' ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
    : state.sort === 'review' ? Date.parse(a.review.nextReviewDate) - Date.parse(b.review.nextReviewDate) : 0) || collator.compare(a.word,b.word) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(words.length / 50));
  state.page = Math.min(pages, Math.max(1, state.page || 1));
  document.getElementById('page-label').textContent = `Page ${state.page} of ${pages}`;
  document.getElementById('page-prev').disabled = state.page === 1;
  document.getElementById('page-next').disabled = state.page === pages;
  document.getElementById('result-count').textContent = `${words.length.toLocaleString()} ${words.length === 1 ? 'word' : 'words'}${words.length !== state.words.length ? ` of ${state.words.length.toLocaleString()}` : ''}`;
  document.getElementById('lexicon-empty-heading').textContent = state.words.length ? 'No matching words.' : 'Your lexicon starts here.';
  document.getElementById('lexicon-empty-sub').textContent = state.words.length ? 'Try a different search or clear your filters.' : 'Add a word to keep its meaning, pronunciation, and source.';
  el.lexiconEmpty.classList.toggle('hidden', words.length > 0);
  el.lexiconGrid.classList.toggle('hidden', words.length === 0);
  el.lexiconGrid.classList.toggle('list-view', state.layout !== 'grid');
  el.lexiconGrid.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const word of words.slice((state.page - 1) * 50, state.page * 50)) {
    const meaning = word.meanings[0];
    const card = document.createElement('article'); card.className = 'lexicon-card'; card.dataset.wordId = word.id;
    card.classList.toggle('selected', state.selectedWord?.id === word.id && !el.detailModal.classList.contains('hidden'));
    const pos = meaning?.partOfSpeech || '';
    const def = meaning?.definitions[0]?.definition || 'No definition recorded.';
    card.innerHTML = `<div class="word-main"><button class="word-open" type="button"><span class="card-title-serif">${escapeHtml(word.displayWord)}</span><span class="word-pos">${escapeHtml(pos)}</span></button>
      <p class="card-definition">${escapeHtml(def)}</p><p class="card-source-cite">${escapeHtml(word.bookSource || 'No source recorded')}</p>
      ${word.inflectedForm ? `<p class="card-inflected-cite">Encountered as: <em>${escapeHtml(word.inflectedForm)}</em></p>` : ''}</div>
      <div class="word-actions"><button type="button" class="btn-card-fav btn-icon-fav ${word.isFavorite ? 'active' : ''}" aria-label="Favorite ${escapeHtml(word.word)}" aria-pressed="${word.isFavorite}">${word.isFavorite ? '★' : '☆'}</button>
      <button type="button" class="btn-card-audio btn-icon-audio" aria-label="Play pronunciation for ${escapeHtml(word.word)}" title="${hasAudioRecord(word) ? 'Listen to pronunciation' : 'Find pronunciation recording'}"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M16 8a6 6 0 0 1 0 8"/></svg></button>
      <div class="word-cadence"><button type="button" class="btn-stamp-trigger box-stamp ${word.review.box >= 5 ? 'mastered' : ''}" aria-label="Review schedule for ${escapeHtml(word.word)}">Box ${word.review.box} · ${escapeHtml(word.review.boxLabel)}</button><span class="word-due">${formatNextReview(word.review.nextReviewDate)}</span></div></div>`;
    card.addEventListener('click', event => { if (!event.target.closest('.word-actions')) openDetailModal(word); });
    card.querySelector('.btn-card-fav').addEventListener('click', async () => {
      try { await window.vocabAPI.toggleFavorite(word.id); await refreshAll(); }
      catch { announce('Could not update this favorite. Try again.', true); }
    });
    card.querySelector('.btn-stamp-trigger').addEventListener('click', event => openCadenceModal(event.currentTarget));
    const audio = card.querySelector('.btn-card-audio');
    updateAudioButtonState(audio,hasAudioRecord(word));
    audio.addEventListener('click', () => playAudio(word.audioUrl, word.word, audio));
    if (!hasAudioRecord(word)) window.vocabAPI?.getAudioDataUrl?.(word.word).then(data => { if (data) updateAudioButtonState(audio,true); }).catch(() => {});
    fragment.appendChild(card);
  }
  el.lexiconGrid.appendChild(fragment);
  for (const name of ['list','grid']) document.getElementById(`view-${name}-btn`).setAttribute('aria-pressed', String(state.layout === name));
}
function renderShelves() {
  const list = document.getElementById('shelves-list'); list.replaceChildren();
  const query = document.getElementById('shelf-search').value.trim().toLowerCase();
  const shelves = state.collections.filter(c => `${c.name} ${c.description || ''}`.toLowerCase().includes(query));
  if (!shelves.length) { const empty = document.createElement('p'); empty.className = 'empty-notice'; empty.textContent = state.collections.length ? 'No matching shelves.' : 'Create a shelf, then assign words from their detail panel.'; list.appendChild(empty); }
  for (const shelf of shelves) {
    const item = document.createElement('article'); item.className = 'shelf-row';
    item.innerHTML = `<button class="shelf-open" type="button"><span class="shelf-title">${escapeHtml(shelf.name)}</span><p>${escapeHtml(shelf.description || 'A collection of words')}</p></button><span>${shelf.wordCount} ${shelf.wordCount === 1 ? 'word' : 'words'}</span><button class="btn-subtle shelf-delete" type="button" aria-label="Delete shelf ${escapeHtml(shelf.name)}">Delete shelf</button>`;
    item.querySelector('.shelf-open').addEventListener('click', () => { resetBrowse(); state.collectionFilter = shelf.id; el.filterCollection.value = shelf.id; switchView('lexicon'); });
    item.querySelector('.shelf-delete').addEventListener('click', async () => {
      if (!confirm(`Delete “${shelf.name}”? Its words will stay in your Lexicon.`)) return;
      try { await window.vocabAPI.deleteCollection(shelf.id); if (state.collectionFilter === shelf.id) state.collectionFilter = 'all'; await refreshAll(); announce('Shelf deleted. Your words are still in the Lexicon.'); }
      catch { announce('Could not delete this shelf. Try again.',true); }
    });
    list.appendChild(item);
  }
}
function toggleFullScreen() {
  const isDocFs = Boolean(document.fullscreenElement);
  const isMapFs = document.body.classList.contains('map-fullscreen');

  if (state.activeView === 'connections' && connectionsState.viewMode === 'graph') {
    if (isDocFs || isMapFs) {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      document.body.classList.remove('map-fullscreen');
      updateFullScreenUI();
    } else {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      document.body.classList.add('map-fullscreen');
      updateFullScreenUI();
    }
  } else {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }
}

function updateFullScreenUI() {
  const isFs = Boolean(document.fullscreenElement);
  document.body.classList.toggle('is-fullscreen', isFs);

  if ((!isFs || connectionsState.viewMode !== 'graph') && document.body.classList.contains('map-fullscreen')) {
    document.body.classList.remove('map-fullscreen');
  } else if (isFs && state.activeView === 'connections' && connectionsState.viewMode === 'graph') {
    document.body.classList.add('map-fullscreen');
  }

  const isMapActive = document.body.classList.contains('map-fullscreen') || (isFs && state.activeView === 'connections' && connectionsState.viewMode === 'graph');

  const label = document.getElementById('fullscreen-btn-label');
  if (label) label.textContent = isFs ? 'Exit full screen' : 'Enter full screen';
  const fsBtn = document.getElementById('btn-fullscreen-toggle');
  if (fsBtn) fsBtn.setAttribute('aria-pressed', String(isFs));

  const mapFsBtn = document.getElementById('map-btn-fullscreen');
  if (mapFsBtn) {
    mapFsBtn.setAttribute('aria-pressed', String(isMapActive));
    mapFsBtn.classList.toggle('active', isMapActive);
    mapFsBtn.textContent = isMapActive ? '⛶ Exit Full' : '⛶ Full Screen';
    mapFsBtn.title = isMapActive ? 'Exit full screen (F11 or Esc)' : 'Toggle full screen (F11)';
  }

  if (state.activeView === 'connections') {
    setTimeout(() => {
      if (typeof resizeConnectionsCanvas === 'function') resizeConnectionsCanvas();
      if (typeof drawConnectionsCanvas === 'function') drawConnectionsCanvas();
    }, 60);
  }
}

function setupDesktop() {
  state.page = 1; state.sort = desktopPrefs.get('sort','alpha'); state.layout = desktopPrefs.get('layout','list');
  document.getElementById('sort-words').value = state.sort;
  document.getElementById('btn-repair-audio').addEventListener('click', async event => {
    const button=event.currentTarget, feedback=document.getElementById('repair-audio-status');
    button.disabled=true; button.setAttribute('aria-busy','true');
    feedback.textContent='Checking saved pronunciations… You can keep using your lexicon.';
    try {
      const result=await window.vocabAPI.repairPronunciations();
      feedback.textContent=`${result.repaired} recordings added; ${result.available} already available; ${result.unavailable} still unavailable. Checked ${result.checked} words.`;
      await refreshAll();
    } catch { feedback.textContent='Pronunciations could not be checked. Your words are safe. Try again.'; }
    finally {button.disabled=false;button.removeAttribute('aria-busy');}
  });
  const size = document.getElementById('reading-size'); size.value = desktopPrefs.get('reading_size','normal'); document.body.classList.toggle('large-reading',size.value === 'large');
  size.addEventListener('change', () => { desktopPrefs.set('reading_size',size.value); document.body.classList.toggle('large-reading',size.value === 'large'); });
  const fsBtn = document.getElementById('btn-fullscreen-toggle');
  if (fsBtn) fsBtn.addEventListener('click', toggleFullScreen);
  document.addEventListener('fullscreenchange', updateFullScreenUI);
  document.getElementById('btn-add-word').addEventListener('click', openCapture);
  document.getElementById('add-word-close').addEventListener('click',closeCapture);
  document.getElementById('btn-create-shelf').addEventListener('click',openCollectionModal);
  for (const view of ['connections','shelves','settings']) {
    const btn = document.getElementById(`nav-${view}-btn`);
    if (btn) btn.addEventListener('click', () => switchView(view));
  }
  document.getElementById('brand-home').addEventListener('click', e => { e.preventDefault(); switchView('lexicon'); });
  document.getElementById('nav-menu').addEventListener('click', e => { const open = e.currentTarget.getAttribute('aria-expanded') !== 'true'; e.currentTarget.setAttribute('aria-expanded',String(open)); document.querySelector('.sidebar').classList.toggle('menu-open',open); });
  document.getElementById('sort-words').addEventListener('change', e => { state.sort = e.target.value; desktopPrefs.set('sort',state.sort); state.page=1; renderLexicon(); });
  document.getElementById('filter-favorites').addEventListener('change', () => { state.page=1; renderLexicon(); });
  document.getElementById('btn-clear-filters').addEventListener('click',resetBrowse);
  for (const layout of ['list','grid']) document.getElementById(`view-${layout}-btn`).addEventListener('click', () => { state.layout=layout; desktopPrefs.set('layout',layout); renderLexicon(); });
  for (const [id,step] of [['page-prev',-1],['page-next',1]]) document.getElementById(id).addEventListener('click', () => { state.page += step; renderLexicon(); document.getElementById('result-count').scrollIntoView({block:'nearest'}); });
  document.getElementById('shelf-search').addEventListener('input',renderShelves);
  document.getElementById('tag-search').addEventListener('input',renderTagFilterChips);
  const dialogs = [...document.querySelectorAll('.modal-scrim:not(#detail-modal)')];
  const syncInert = () => {
    const modal = dialogs.some(d => !d.classList.contains('hidden'));
    const narrow = !matchMedia('(min-width: 1180px)').matches && !el.detailModal.classList.contains('hidden');
    for (const surface of document.querySelectorAll('.sidebar, main, .colophon')) surface.inert = modal || narrow;
    el.detailModal.inert = modal;
    el.detailModal.setAttribute('role',narrow ? 'dialog' : 'region');
    if (narrow) el.detailModal.setAttribute('aria-modal','true'); else el.detailModal.removeAttribute('aria-modal');
  };
  matchMedia('(min-width: 1180px)').addEventListener('change',syncInert);
  new MutationObserver(syncInert).observe(document.querySelector('.site-wrapper'), {subtree:true,attributes:true,attributeFilter:['class']});
  for (const d of dialogs) d.addEventListener('click', e => { if (e.target === d && d.id === 'add-word-modal') closeCapture(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullScreen();
      return;
    }
    const modal = dialogs.find(d => !d.classList.contains('hidden'));
    const narrowDetail = !matchMedia('(min-width: 1180px)').matches && !el.detailModal.classList.contains('hidden') ? el.detailModal : null;
    const active = modal || narrowDetail;
    if (active && e.key === 'Tab') {
      const controls = [...active.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(x=>x.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if (e.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) { e.preventDefault();last?.focus(); }
      if (!e.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) { e.preventDefault();first?.focus(); }
    }
    if (modal && e.key === 'Escape') {
      e.preventDefault();e.stopImmediatePropagation();
      if (modal.id === 'add-word-modal') closeCapture(); else if (modal.id === 'collection-modal') closeCollectionModal(); else closeCadenceModal();
      return;
    }
    if (el.detailModal && !el.detailModal.classList.contains('hidden') && e.key === 'Escape') {
      e.preventDefault();e.stopImmediatePropagation();
      closeDetailModal();
      return;
    }
    if (document.body.classList.contains('map-fullscreen') && e.key === 'Escape') {
      e.preventDefault();
      toggleFullScreen();
      return;
    }
    if (active || ['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
    if (state.activeView === 'lexicon' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 'n') {e.preventDefault();openCapture();} if (e.key === '/') {e.preventDefault();el.searchInput.focus();}
    }
  },true);
  document.getElementById('btn-quiz-exit').addEventListener('click', () => {
    if (state.quiz.isSubmitting) { announce('Please wait while your answer is saved.'); return; }
    if (!confirm('End this quiz? Answers already submitted will keep their review updates.')) return;
    initQuizView(); state.quiz.deck=[]; state.quiz.isAnswered=false;
  });
  for (const btn of document.querySelectorAll('.btn-icon-audio')) btn.setAttribute('aria-label',btn.title || 'Play pronunciation');
  document.querySelectorAll('svg').forEach(svg=>svg.setAttribute('aria-hidden','true'));
  document.getElementById('btn-reveal').addEventListener('click', e => { e.stopPropagation();flipCard(); });
  window.addEventListener('unhandledrejection', () => announce('This action could not be completed. Some changes may not have been saved. Try again.',true));
}
