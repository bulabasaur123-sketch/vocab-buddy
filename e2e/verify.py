"""Real Electron + preload + IPC + JSON-store checks with hermetic HTTP fixtures.

Run: python3 -m unittest discover -s e2e -p verify.py -v
Install requirements in an isolated environment first. Electron uses its bundled
Chromium; no Playwright browser download is required by this suite.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import unittest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def word(name="serendipity", due=True):
    return dict(id=name + "_fixture", word=name, displayWord=name.capitalize(),
                phonetic="/fixture/", audioUrl="", etymology="From Serendip; Horace Walpole.",
                meanings=[dict(partOfSpeech="noun", definitions=[dict(definition="Fortunate discovery", example="By chance.")])],
                synonyms=["chance"], antonyms=[], bookSource="Dune",
                createdAt="2026-01-01T00:00:00.000Z",
                review=dict(box=1, boxLabel="Daily", nextReviewDate="2000-01-01T00:00:00.000Z" if due else "2099-01-01T00:00:00.000Z",
                            reviewCount=0, streak=0, lastRating=None, lastReviewedAt=None, intervalDays=1))


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
        cls.page.wait_for_function("typeof window.vocabAPI?.loadWords === 'function'")

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
        self.assertEqual(len(self.page.evaluate("Object.keys(window.vocabAPI)")), 11)
        payload = json.loads((Path(self.data.name) / "vocab_library.json").read_text())
        self.assertEqual(payload["version"], "1.0")
        self.assertEqual(payload["words"], [word()])
        self.assertFalse(self.errors)

    def test_lookup_add_duplicate_missing_delete(self):
        self.page.locator("#input-word").fill("Ephemeral")
        self.page.locator("#input-source").fill("Dune Chapter 3")
        self.page.locator("#entry-form").evaluate("form => form.requestSubmit()")
        expect(self.page.locator("#modal-word")).to_have_text("Ephemeral")
        expect(self.page.locator("#modal-etymology")).to_contain_text("Horace Walpole")
        expect(self.page.locator("#nav-count-lexicon")).to_have_text("2")
        self.page.locator("#modal-close").dispatch_event("click")
        self.page.locator("#input-word").fill("EPHEMERAL")
        self.page.locator("#entry-form").evaluate("form => form.requestSubmit()")
        expect(self.page.locator("#entry-feedback")).to_contain_text("already recorded")
        self.page.locator("#modal-close").dispatch_event("click")
        self.page.locator("#input-word").fill("missingword")
        self.page.locator("#entry-form").evaluate("form => form.requestSubmit()")
        expect(self.page.locator("#entry-feedback")).to_contain_text("Word not found")
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
        self.page.wait_for_function("state.activeView === 'review'")
        self.assertEqual(self.page.evaluate("state.deckQueue.length"), 0)

    def test_fast_rating_events_do_not_double_grade_or_skip_cards(self):
        self.reset([word(), word("ephemeral")])
        self.page.locator("#nav-review-btn").dispatch_event("click")
        self.page.wait_for_function("state.deckQueue.length === 2")
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
        self.page.wait_for_function("state.deckQueue.length === 1")
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

    def test_feat002_missing_audio_is_disabled(self):
        self.reset([word("unrecorded")])
        button = self.page.locator(".btn-card-audio")
        expect(button).to_be_disabled()
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
