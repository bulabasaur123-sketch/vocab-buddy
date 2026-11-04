"""Real Electron + preload + IPC + JSON-store checks with hermetic HTTP fixtures.

Run: python3 -m unittest discover -s e2e -p verify.py -v
Install requirements in an isolated environment first. Electron uses its bundled
Chromium; no Playwright browser download is required by this suite.
"""
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import tempfile
import time
import unittest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def wait_for(page, expression, timeout=5):
    """Poll through CDP evaluation without unsafe-eval or headless animation frames."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if page.evaluate("() => Boolean(" + expression + ")"):
            return
        time.sleep(0.02)
    raise AssertionError("Timed out waiting for " + expression)


def word(name="serendipity", due=True):
    return dict(id=name + "_fixture", word=name, displayWord=name.capitalize(),
                phonetic="/fixture/", audioUrl="", etymology="From Serendip; Horace Walpole.",
                meanings=[dict(partOfSpeech="noun", definitions=[dict(definition="Fortunate discovery", example="By chance.")])],
                synonyms=["chance"], antonyms=[], bookSource="Dune",
                createdAt="2026-01-01T00:00:00.000Z",
                review=dict(box=1, boxLabel="Daily", nextReviewDate="2000-01-01T00:00:00.000Z" if due else "2099-01-01T00:00:00.000Z",
                            reviewCount=0, streak=0, lastRating=None, lastReviewedAt=None, intervalDays=1),
                isFavorite=False, collections=[], tags=[])


class ElectronVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = tempfile.TemporaryDirectory(prefix="vocab-e2e-")
        cls.log = open(Path(cls.data.name) / "electron.log", "w+")
        cls.addClassCleanup(cls.log.close)
        cls.addClassCleanup(cls.data.cleanup)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        executable = ROOT / "node_modules/electron/dist/electron"
        cls.process = subprocess.Popen([
            str(executable), str(ROOT / "e2e/electronHarness.cjs"),
            "--no-sandbox", "--disable-gpu", "--ozone-platform=headless",
            "--remote-debugging-address=127.0.0.1", f"--remote-debugging-port={port}",
        ], cwd=ROOT, env={**os.environ, "VOCAB_E2E_DATA_DIR": cls.data.name},
            stdout=cls.log, stderr=subprocess.STDOUT)
        cls.addClassCleanup(cls.stop_process)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        deadline = time.monotonic() + 20
        while True:
            try:
                cls.browser = cls.playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{port}", timeout=1000)
                break
            except Exception:
                if cls.process.poll() is not None or time.monotonic() > deadline:
                    cls.log.seek(0)
                    raise RuntimeError("Electron failed to start: " + cls.log.read())
                time.sleep(0.2)
        cls.context = cls.browser.contexts[0]
        cls.context.route("https://**/*", lambda route: route.abort())
        deadline = time.monotonic() + 10
        while not cls.context.pages:
            if time.monotonic() > deadline:
                raise RuntimeError("Electron window was not created")
            time.sleep(0.1)
        cls.page = cls.context.pages[0]
        cls.page.set_default_timeout(2000)
        wait_for(cls.page, "typeof window.vocabAPI?.loadWords === 'function'")

    @classmethod
    def stop_process(cls):
        if cls.process.poll() is None:
            cls.process.terminate()
            try:
                cls.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.process.kill()
                cls.process.wait()

    def setUp(self):
        self.page.set_viewport_size(dict(width=1200, height=800))
        self.errors = []
        self.page.on("pageerror", self.capture_error)
        self.addCleanup(lambda: self.page.remove_listener("pageerror", self.capture_error))
        self.reset([word()])

    def capture_error(self, error):
        self.errors.append(str(error))

    def reset(self, words):
        self.page.evaluate("words => window.vocabAPI.importData(words)", words)
        self.page.reload(wait_until="networkidle")
        expect(self.page.locator("#nav-count-lexicon")).to_have_text(str(len(words)))

    def test_bridge_and_storage_roundtrip(self):
        self.assertTrue(self.page.evaluate("typeof require === 'undefined' && typeof process === 'undefined'"))
        self.assertEqual(len(self.page.evaluate("Object.keys(window.vocabAPI)")), 23)
        from contextlib import closing
        with closing(sqlite3.connect(Path(self.data.name) / "vocab_buddy.db")) as database:
            self.assertEqual(database.execute("PRAGMA user_version").fetchone()[0], 3)
            rows = database.execute("SELECT word, meanings_json FROM words").fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], word()["word"])
        self.assertEqual(json.loads(rows[0][1]), word()["meanings"])
        self.assertFalse(self.errors)

    def test_lookup_add_duplicate_missing_delete(self):
        self.page.evaluate("openCapture()")
        self.page.locator("#input-word").fill("Ephemeral")
        self.page.locator("#input-source").fill("Dune Chapter 3")
        self.page.locator("#entry-form").evaluate("form => form.requestSubmit()")
        expect(self.page.locator("#modal-word")).to_have_text("Ephemeral")
        expect(self.page.locator("#modal-etymology")).to_contain_text("Horace Walpole")
        expect(self.page.locator("#nav-count-lexicon")).to_have_text("2")
        self.page.locator("#modal-close").dispatch_event("click")
        self.page.evaluate("openCapture()")
        self.page.locator("#input-word").fill("EPHEMERAL")
        self.page.locator("#entry-form").evaluate("form => form.requestSubmit()")
        expect(self.page.locator("#app-status")).to_contain_text("already in your lexicon")
        self.page.locator("#modal-close").dispatch_event("click")
        self.page.evaluate("openCapture()")
        self.page.locator("#input-word").fill("missingword")
        self.page.locator("#entry-form").evaluate("form => form.requestSubmit()")
        expect(self.page.locator("#entry-feedback")).to_contain_text("Word not found")
        self.page.locator("#add-word-close").dispatch_event("click")
        self.page.locator(".lexicon-card").filter(has_text="Ephemeral").dispatch_event("click")
        expect(self.page.locator("#modal-word")).to_have_text("Ephemeral")
        # Native confirm dialogs are unavailable on the headless Ozone backend.
        self.page.evaluate("() => { window.__originalConfirm = window.confirm; window.confirm = () => true; }")
        self.page.locator("#modal-delete-btn").dispatch_event("click")
        expect(self.page.locator("#nav-count-lexicon")).to_have_text("1")
        self.page.evaluate("() => { window.confirm = window.__originalConfirm; }")
        self.assertFalse(self.errors)

    def test_filters_search_theme_and_export(self):
        self.page.locator("#search-input").fill("Dune")
        expect(self.page.locator(".lexicon-card")).to_have_count(1)
        self.page.locator("#search-input").fill("no-such-word")
        expect(self.page.locator("#lexicon-empty")).to_be_visible()
        self.page.locator("#search-input").fill("")
        self.page.locator("#filter-status").select_option("mastered")
        expect(self.page.locator("#lexicon-empty")).to_be_visible()
        self.page.locator("#filter-status").select_option("due")
        expect(self.page.locator(".lexicon-card")).to_have_count(1)
        self.page.locator("#btn-theme-toggle").dispatch_event("click")
        self.assertTrue(self.page.evaluate("document.body.classList.contains(localStorage.vocab_theme === 'dark' ? 'theme-dark' : 'theme-paper')"))
        with self.page.expect_download() as download:
            # Functional export check avoids Electron headless compositor's
            # animation-frame actionability timeout after theme transitions.
            self.page.locator("#btn-export").dispatch_event("click")
        self.assertEqual(json.loads(Path(download.value.path()).read_text()), [word()])
        self.assertFalse(self.errors)

    def test_untrusted_content_is_rendered_as_text(self):
        malicious = word()
        payload = '<img src=x onerror="window.__injected=true">'
        for field in ["displayWord", "phonetic", "etymology", "bookSource"]:
            malicious[field] = payload
        malicious["meanings"][0]["partOfSpeech"] = payload
        malicious["meanings"][0]["definitions"][0]["definition"] = payload
        malicious["meanings"][0]["definitions"][0]["example"] = payload
        malicious["synonyms"] = [payload]
        self.reset([malicious])
        self.page.locator(".lexicon-card").dispatch_event("click")
        expect(self.page.locator("#modal-etymology")).to_have_text(payload)
        self.assertEqual(self.page.locator("img").count(), 0)
        self.assertIsNone(self.page.evaluate("window.__injected"))
        self.assertFalse(self.errors)

    def test_review_navigation_displays_deck(self):
        self.page.locator("#nav-review-btn").dispatch_event("click")
        expect(self.page.locator("#view-review")).to_be_visible()
        self.page.locator("#index-card").dispatch_event("click")
        self.page.locator("#index-card").focus()
        self.page.keyboard.press("3")
        expect(self.page.locator("#deck-complete")).to_be_visible()
        saved = self.page.evaluate("window.vocabAPI.loadWords()")
        self.assertEqual(saved[0]["review"]["box"], 2)

    def test_empty_due_queue_does_not_reschedule_future_cards(self):
        self.reset([word(due=False)])
        self.page.locator("#nav-review-btn").dispatch_event("click")
        wait_for(self.page, "state.activeView === 'review'")
        self.assertEqual(self.page.evaluate("state.deckQueue.length"), 0)

    def test_fast_rating_events_do_not_double_grade_or_skip_cards(self):
        self.reset([word(), word("ephemeral")])
        self.page.locator("#nav-review-btn").dispatch_event("click")
        wait_for(self.page, "state.deckQueue.length === 2")
        saved = self.page.evaluate("""async () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space'}));
            window.dispatchEvent(new KeyboardEvent('keydown', {key: '3'}));
            window.dispatchEvent(new KeyboardEvent('keydown', {key: '3'}));
            return window.vocabAPI.loadWords();
        }""")
        self.assertEqual(saved[0]["review"]["reviewCount"], 1)
        self.assertEqual(saved[1]["review"]["reviewCount"], 0)

    def test_typing_source_does_not_trigger_review_shortcuts(self):
        self.page.locator("#nav-review-btn").dispatch_event("click")
        wait_for(self.page, "state.deckQueue.length === 1")
        self.page.evaluate("openCapture()")
        self.page.locator("#input-source").fill("Chapter")
        self.page.locator("#input-source").press("Space")
        self.assertFalse(self.page.evaluate("state.isFlipped"))
        expect(self.page.locator("#input-source")).to_have_value("Chapter ")

    def test_phone_width_has_no_horizontal_overflow(self):
        previous = self.page.viewport_size
        try:
            self.page.set_viewport_size(dict(width=390, height=844))
            self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)
        finally:
            self.page.set_viewport_size(previous or dict(width=1200, height=800))

    def test_feat002_root_lookup_search_and_cadence(self):
        for query, root in [("stymied", "stymie"), ("eking", "eke")]:
            self.reset([])
            self.page.evaluate("openCapture()")
            self.page.locator("#input-word").fill(query)
            self.page.locator("#entry-form").evaluate("form => form.requestSubmit()")
            expect(self.page.locator("#modal-word")).to_have_text(root.capitalize())
            expect(self.page.locator("#modal-inflected")).to_contain_text(query)
            expect(self.page.locator("#modal-box-stamp")).to_have_text("Box 1 · Daily")
            self.page.locator("#modal-close").dispatch_event("click")
            self.page.locator("#search-input").fill(query)
            expect(self.page.locator(".lexicon-card")).to_have_count(1)
            expect(self.page.locator(".card-inflected-cite")).to_contain_text(query)
            cached = self.page.evaluate("name => window.vocabAPI.getAudioDataUrl(name)", root)
            self.assertTrue(cached.startswith("data:audio/wav;base64,"))
            self.page.locator(".btn-stamp-trigger").first.dispatch_event("click")
            expect(self.page.locator("#cadence-modal")).to_be_visible()
            self.page.locator("#cadence-btn-dismiss").dispatch_event("click")
            expect(self.page.locator("#cadence-modal")).to_be_hidden()

    def test_feat002_cached_audio_allowed_by_csp(self):
        result = self.page.evaluate("""async () => {
            await window.vocabAPI.lookupWord('stymie');
            const data = await window.vocabAPI.getAudioDataUrl('stymie');
            const violations = [];
            document.addEventListener('securitypolicyviolation', e => violations.push(e.violatedDirective));
            const audio = new Audio(data);
            const status = await audio.play().then(() => 'playing', e => e.name);
            await new Promise(resolve => setTimeout(resolve, 50));
            audio.pause();
            return { status, violations };
        }""")
        self.assertNotIn("media-src", result["violations"], result)
        self.assertEqual(result["status"], "playing")

    def test_feat002_missing_audio_can_be_requested(self):
        self.reset([word("unrecorded")])
        button = self.page.locator(".btn-card-audio")
        expect(button).to_be_enabled()
        self.assertIn("recording", (button.get_attribute("title") or "").lower())

    def test_feat002_rapid_audio_requests_cancel_previous_playback(self):
        result = self.page.evaluate("""async () => {
            await window.vocabAPI.lookupWord('stymie');
            const OriginalAudio = window.Audio;
            const clips = [];
            window.Audio = class {
                constructor(url) { this.url = url; this.paused = false; clips.push(this); }
                play() { return Promise.resolve(); }
                pause() { this.paused = true; }
            };
            try {
                await Promise.all([playAudio('', 'stymie', null), playAudio('', 'stymie', null)]);
                return { playing: clips.filter(a => !a.paused).length };
            } finally { window.Audio = OriginalAudio; state.activeAudio = null; }
        }""")
        self.assertEqual(result["playing"], 1, result)

    def test_feat002_cadence_dialog_takes_keyboard_focus(self):
        self.page.locator("#btn-cadence-guide").dispatch_event("click")
        expect(self.page.locator("#cadence-modal")).to_be_visible()
        self.assertTrue(self.page.evaluate("document.querySelector('#cadence-modal').contains(document.activeElement)"))


    def quiz_words(self, count=6):
        entries = []
        for index in range(count):
            entry = word("term" + chr(97 + index // 26) + chr(97 + index % 26))
            entry["meanings"][0]["definitions"][0] = dict(
                definition="Distinct definition " + str(index), example="A " + entry["word"] + " appears.")
            entries.append(entry)
        return entries

    def test_feat004_organization_and_markup(self):
        self.reset(self.quiz_words())
        self.page.locator(".btn-card-fav").first.dispatch_event("click")
        wait_for(self.page, "state.words[0].isFavorite === true")
        self.page.locator("#filter-favorites").check()
        expect(self.page.locator(".lexicon-card")).to_have_count(1)
        self.page.locator("#btn-new-collection").dispatch_event("click")
        payload = '<img src=x onerror="window.__injected=true">'
        self.page.locator("#input-collection-name").fill(payload)
        self.page.locator("#collection-form").evaluate("form => form.requestSubmit()")
        wait_for(self.page, "state.collections.length > 0 && state.collectionFilter !== 'all'")
        collection = self.page.evaluate("state.collections.find(c => c.id === state.collectionFilter)")
        try:
            self.page.locator("#filter-collection").select_option("all")
            self.page.locator(".lexicon-card").first.dispatch_event("click")
            self.page.locator("#modal-add-collection-select").select_option(collection["id"])
            expect(self.page.locator("#modal-collections-list")).to_contain_text(payload)
            self.page.locator("#modal-tag-input").fill("#Archaic")
            self.page.locator("#modal-tag-form").evaluate("form => form.requestSubmit()")
            wait_for(self.page, "state.words[0].tags.includes('archaic')")
            expect(self.page.locator("#modal-tags-list")).to_contain_text("#archaic")
            self.assertEqual(self.page.locator("img").count(), 0)
            self.assertIsNone(self.page.evaluate("window.__injected"))
            self.page.locator("#modal-close").dispatch_event("click")
            self.page.reload()
            wait_for(self.page, "state.words[0]?.tags.includes('archaic')")
            loaded = self.page.evaluate("window.vocabAPI.loadWords()")
            self.assertTrue(loaded[0]["isFavorite"])
            self.assertIn(collection["id"], loaded[0]["collections"])
        finally:
            self.page.evaluate("id => window.vocabAPI.deleteCollection(id)", collection["id"])
        self.assertFalse(self.errors)

    def test_feat004_quiz_modes_complete_and_srs(self):
        for mode in ["definition", "cloze", "missing_letters"]:
            with self.subTest(mode=mode):
                self.reset(self.quiz_words())
                self.page.locator("#nav-quiz-btn").dispatch_event("click")
                expect(self.page.locator("#view-quiz")).to_be_visible()
                self.page.locator("#quiz-mode-select").select_option(mode)
                self.page.locator("#quiz-link-srs").check()
                self.page.locator("#btn-start-quiz").dispatch_event("click")
                expect(self.page.locator("#quiz-arena")).to_be_visible()
                for index in range(5):
                    q = self.page.evaluate("state.quiz.deck[state.quiz.index]")
                    if mode == "missing_letters":
                        self.page.locator("#input-missing-letters").fill(q["solution"])
                        self.page.locator("#missing-letters-form").evaluate("form => form.requestSubmit()")
                    else:
                        self.page.locator(".quiz-option-btn").nth(q["correctAnswerIndex"]).dispatch_event("click")
                    wait_for(self.page, "!document.querySelector('#quiz-actions').classList.contains('hidden')")
                    self.page.locator("#btn-quiz-next").dispatch_event("click")
                expect(self.page.locator("#quiz-complete-score")).to_contain_text("5 / 5 (100%)")
                saved = self.page.evaluate("window.vocabAPI.loadWords()")
                self.assertEqual(sum(w["review"]["reviewCount"] for w in saved), 5)
                self.assertEqual(sum(w["review"]["box"] == 2 for w in saved), 5)
        self.assertFalse(self.errors)

    def test_feat004_favorites_scope_fills_requested_deck(self):
        entries = self.quiz_words(100)
        for entry in entries[:5]:
            entry["isFavorite"] = True
        self.reset(entries)
        self.page.locator("#nav-quiz-btn").dispatch_event("click")
        self.page.locator("#quiz-mode-select").select_option("definition")
        self.page.locator("#quiz-scope-select").select_option("favorites")
        self.page.evaluate("startQuizSession()")
        self.assertEqual(self.page.evaluate("document.querySelector('#quiz-empty-notice').classList.contains('hidden') && state.quiz.deck.length"), 5,
                         "Five eligible favorites must produce five questions independently of nonfavorite sampling")

    def test_feat004_shelf_scope_and_unlinked_feedback(self):
        entries = self.quiz_words()
        self.reset(entries)
        collection = self.page.evaluate("window.vocabAPI.createCollection({name:'Scoped quiz'})")
        try:
            self.page.evaluate("async args => { for (const id of args.ids) await window.vocabAPI.assignWordToCollection(id, args.col); await refreshAll(); }",
                               dict(ids=[w["id"] for w in entries[:5]], col=collection["id"]))
            self.page.locator("#nav-quiz-btn").dispatch_event("click")
            self.page.locator("#quiz-scope-select").select_option("col:" + collection["id"])
            # Ozone's hidden compositor can stall pointer actionability; exercise the
            # same checkbox change through the DOM while keeping real IPC below.
            self.page.locator("#quiz-link-srs").evaluate("e => {e.checked=false;e.dispatchEvent(new Event('change'));}")
            self.page.evaluate("startQuizSession()")
            ids = self.page.evaluate("state.quiz.deck.map(q => q.wordId)")
            self.assertEqual(set(ids), {w["id"] for w in entries[:5]})
            q = self.page.evaluate("state.quiz.deck[0]")
            self.page.locator(".quiz-option-btn").nth((q["correctAnswerIndex"] + 1) % 4).dispatch_event("click")
            wait_for(self.page, "!document.querySelector('#quiz-actions').classList.contains('hidden')")
            self.assertTrue(all(w["review"]["reviewCount"] == 0 for w in self.page.evaluate("window.vocabAPI.loadWords()")))
        finally:
            self.page.evaluate("id => window.vocabAPI.deleteCollection(id)", collection["id"])


    def test_desktop_library_pagination_search_sort_and_combined_filters(self):
        entries = [word(f'term{i:04d}') for i in range(1000)]
        entries[0]['isFavorite'] = True
        entries[0]['bookSource'] = 'A singular citation'
        self.reset(entries)
        expect(self.page.locator('#lexicon-grid')).to_have_class('lexicon-grid list-view')
        expect(self.page.locator('.lexicon-card')).to_have_count(50)
        expect(self.page.locator('#page-label')).to_have_text('Page 1 of 20')
        self.page.locator('#page-next').dispatch_event('click')
        expect(self.page.locator('.card-title-serif').first).to_have_text('Term0050')
        self.page.locator('#search-input').fill('singular citation')
        expect(self.page.locator('.lexicon-card')).to_have_count(1)
        self.page.locator('#filter-favorites').evaluate("e => {e.checked=true;e.dispatchEvent(new Event('change'));}")
        self.page.locator('#filter-status').select_option('due')
        expect(self.page.locator('.lexicon-card')).to_have_count(1)
        self.page.locator('#filter-status').select_option('mastered')
        expect(self.page.locator('#lexicon-empty-heading')).to_have_text('No matching words.')
        self.page.locator('#btn-clear-filters').dispatch_event('click')
        expect(self.page.locator('.lexicon-card')).to_have_count(50)
        self.page.locator('#view-grid-btn').dispatch_event('click')
        self.assertFalse(self.page.evaluate("document.querySelector('#lexicon-grid').classList.contains('list-view')"))
        self.page.locator('#view-list-btn').dispatch_event('click')
        self.assertFalse(self.errors)

    def test_desktop_capture_keyboard_and_focus(self):
        expect(self.page.locator('#add-word-modal')).to_be_hidden()
        self.page.locator('#btn-add-word').focus()
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#input-word')).to_be_focused()
        self.page.keyboard.press('Shift+Tab')
        self.page.keyboard.press('Shift+Tab')
        self.assertTrue(self.page.evaluate("document.querySelector('#add-word-modal').contains(document.activeElement)"))
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#add-word-modal')).to_be_hidden()
        expect(self.page.locator('#btn-add-word')).to_be_focused()
        self.page.keyboard.press('/')
        expect(self.page.locator('#search-input')).to_be_focused()

    def test_desktop_review_requires_reveal(self):
        self.page.locator('#nav-review-btn').dispatch_event('click')
        expect(self.page.locator('#btn-reveal')).to_be_visible()
        expect(self.page.locator('#review-actions')).to_be_hidden()
        self.page.evaluate("submitRating('good')")
        saved = self.page.evaluate('window.vocabAPI.loadWords()')
        self.assertEqual(saved[0]['review']['reviewCount'],0)
        self.page.locator('#btn-reveal').dispatch_event('click')
        expect(self.page.locator('#review-actions')).to_be_visible()
        self.page.locator('[data-rating="good"]').dispatch_event('click')
        expect(self.page.locator('#complete-summary')).to_contain_text('Your review schedule is saved.')

    def test_desktop_quiz_duplicate_next_and_incorrect_summary(self):
        self.reset(self.quiz_words())
        self.page.locator('#nav-quiz-btn').dispatch_event('click')
        self.page.locator('#quiz-link-srs').evaluate("e => {e.checked=false;e.dispatchEvent(new Event('change'));}")
        self.page.evaluate('startQuizSession()')
        expect(self.page.locator('#quiz-setup')).to_be_hidden()
        self.page.evaluate("""() => {
          const q=state.quiz.deck[0];
          handleOptionSelected(q,(q.correctAnswerIndex+1)%4);
          handleOptionSelected(q,(q.correctAnswerIndex+1)%4);
        }""")
        wait_for(self.page, 'state.quiz.results.length === 1')
        self.page.evaluate("() => {document.querySelector('#btn-quiz-next').click();document.querySelector('#btn-quiz-next').click();}")
        self.assertEqual(self.page.evaluate('state.quiz.index'),1)
        for i in range(4):
            self.page.evaluate('async () => {const q=state.quiz.deck[state.quiz.index];await handleOptionSelected(q,q.correctAnswerIndex);}')
            self.page.locator('#btn-quiz-next').dispatch_event('click')
        expect(self.page.locator('#quiz-complete-score')).to_contain_text('4 / 5 (80%)')
        expect(self.page.locator('#quiz-complete-summary')).to_contain_text('was not changed')
        expect(self.page.locator('#quiz-mistakes p')).to_have_count(1)
        self.assertTrue(all(w['review']['reviewCount']==0 for w in self.page.evaluate('window.vocabAPI.loadWords()')))

    def test_desktop_shelves_settings_and_long_text_layouts(self):
        self.page.locator('#nav-shelves-btn').dispatch_event('click')
        expect(self.page.locator('#view-shelves')).to_be_visible()
        self.page.locator('#btn-create-shelf').dispatch_event('click')
        self.page.locator('#input-collection-name').fill('Reading notes')
        self.page.locator('#collection-form').evaluate('form => form.requestSubmit()')
        expect(self.page.locator('.shelf-open')).to_contain_text('Reading notes')
        self.page.locator('.shelf-open').dispatch_event('click')
        expect(self.page.locator('#filter-collection')).not_to_have_value('all')
        self.page.locator('#nav-settings-btn').dispatch_event('click')
        self.page.locator('#reading-size').select_option('large')
        self.assertTrue(self.page.evaluate("document.body.classList.contains('large-reading')"))
        self.page.reload(wait_until='networkidle')
        self.assertTrue(self.page.evaluate("document.body.classList.contains('large-reading')"))
        # Exercise long unbroken words, wrapping definitions, and a narrow detail panel.
        entry=word('pneumonoultramicroscopicsilicovolcanoconiosis')
        entry['meanings'][0]['definitions'][0]['definition']='A lengthy definition. ' * 50
        self.reset([entry])
        for width in [1440,1024,768,390]:
            self.page.set_viewport_size(dict(width=width,height=900))
            self.page.locator('.word-open').dispatch_event('click')
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            self.page.keyboard.press('Escape')
        self.page.set_viewport_size(dict(width=1200,height=800))
        self.page.evaluate("desktopPrefs.set('reading_size','normal')")
        for c in self.page.evaluate('window.vocabAPI.getCollections()'):
            self.page.evaluate('id=>window.vocabAPI.deleteCollection(id)',c['id'])
        self.assertFalse(self.errors)


    def test_pronunciation_settings_repairs_only_audio_metadata(self):
        entry=word('audiofallback')
        entry['audioUrl']='https://api.dictionaryapi.dev/unavailable.mp3'
        self.reset([entry])
        before=self.page.evaluate('window.vocabAPI.loadWords()')[0]
        self.page.locator('#nav-settings-btn').dispatch_event('click')
        self.page.locator('#btn-repair-audio').dispatch_event('click')
        expect(self.page.locator('#repair-audio-status')).to_contain_text('1 recordings added')
        after=self.page.evaluate('window.vocabAPI.loadWords()')[0]
        for key,value in before.items():
            if key not in ['audioUrl','audioLocalPath','audioSizeBytes']:
                self.assertEqual(after[key],value,key)
        self.assertEqual(after['audioLocalPath'],'audiofallback.mp3')
        self.assertTrue(self.page.evaluate("window.vocabAPI.getAudioDataUrl('audiofallback')").startswith('data:audio/wav;base64,'))
        self.assertFalse(self.errors)

    def test_pronunciation_failure_feedback_and_retry_remain_quiet(self):
        self.reset([word('audiounavailable')])
        button=self.page.locator('.btn-card-audio')
        expect(button).to_be_enabled()
        button.dispatch_event('click')
        expect(self.page.locator('.audio-feedback')).to_have_text('Recording unavailable. Try again.')
        expect(button).to_have_attribute('data-audio-state','unavailable')
        expect(button).to_be_enabled()
        button.dispatch_event('click')
        expect(self.page.locator('.audio-feedback')).to_have_text('Recording unavailable. Try again.')
        self.assertFalse(self.errors)

    def test_pronunciation_playback_error_is_announced(self):
        self.page.evaluate("window.vocabAPI.lookupWord('stymie')")
        result=self.page.evaluate("""async () => {
          const original=window.Audio;
          window.Audio=class {play(){return Promise.reject(new Error('decode failed'));}pause(){}};
          const button=document.querySelector('.btn-card-audio');
          try {await playAudio('', 'stymie', button);return {message:button.parentElement.querySelector('.audio-feedback').textContent,busy:button.hasAttribute('aria-busy')};}
          finally {window.Audio=original;}
        }""")
        self.assertEqual(result,dict(message='Recording unavailable. Try again.',busy=False))
        self.assertFalse(self.errors)


if __name__ == "__main__":
    unittest.main(verbosity=2)
