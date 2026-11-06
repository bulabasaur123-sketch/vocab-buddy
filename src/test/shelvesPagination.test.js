'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('shelves paginate after search and recover when the final page is deleted', () => {
  function element() {
    const classes = new Set();
    return {
      value: '', children: [], textContent: '', disabled: false,
      classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }, contains(name) { return classes.has(name); } },
      replaceChildren() { this.children = []; },
      appendChild(child) { this.children.push(child); },
      querySelector() { return { addEventListener() {} }; }
    };
  }
  const ids = Object.fromEntries(['shelves-list', 'shelf-search', 'shelf-pagination', 'shelf-page-label', 'shelf-page-prev', 'shelf-page-next'].map(id => [id, element()]));
  const state = { collections: Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `Shelf ${i}`, description: i < 6 ? 'fiction' : 'poetry', wordCount: i })) };
  const context = vm.createContext({ state, document: { getElementById: id => ids[id], createElement: element }, escapeHtml: value => value });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../ui/desktop.js'), 'utf8'), context);
  const render = code => vm.runInContext(`${code || ''}; renderShelves();`, context);
  const rows = () => ids['shelves-list'].children;
  render();
  assert.equal(rows().length, 5);
  assert.equal(ids['shelf-page-prev'].disabled, true);
  assert.equal(ids['shelf-page-label'].textContent, 'Page 1 of 3');
  const allRows = [...rows()];
  render('shelfPage++');
  assert.equal(rows().length, 5);
  allRows.push(...rows());
  render('shelfPage++');
  assert.equal(rows().length, 2);
  assert.equal(ids['shelf-page-next'].disabled, true);
  allRows.push(...rows());
  assert.deepEqual(allRows.map(row => row.innerHTML.match(/class="shelf-title">([^<]+)/)[1]), state.collections.map(shelf => shelf.name));

  state.collections.splice(10);
  render();
  assert.equal(ids['shelf-page-label'].textContent, 'Page 2 of 2');
  assert.equal(rows().length, 5);
  ids['shelf-search'].value = 'fiction';
  render();
  assert.equal(ids['shelf-page-label'].textContent, 'Page 1 of 2');
  assert.equal(rows().length, 5);
  render('shelfPage++');
  assert.equal(rows().length, 1);
  ids['shelf-search'].value = 'poetry';
  render();
  assert.equal(rows().length, 4);
  assert.equal(ids['shelf-pagination'].classList.contains('hidden'), true);
  ids['shelf-search'].value = 'missing';
  render();
  assert.equal(rows()[0].textContent, 'No matching shelves.');
  state.collections = [];
  render();
  assert.equal(rows()[0].textContent, 'Create a shelf, then assign words from their detail panel.');
});
