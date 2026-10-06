import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./reading-progress.js', import.meta.url), 'utf8');
function harness(stored = null, savedAchievements = null) {
  let failSave = false;
  const fields = {};
  const document = {
    getElementById(id) {
      return fields[id] ||= {
        listeners: {}, children: [],
        addEventListener(type, callback) { this.listeners[type] = callback; },
        replaceChildren() { this.children = []; },
        appendChild(item) { this.children.push(item); }
      };
    },
    createElement() {
      return {
        attributes: {}, listeners: {},
        setAttribute(key, value) { this.attributes[key] = value; },
        addEventListener(type, callback) { this.listeners[type] = callback; }
      };
    }
  };
  const window = {};
  vm.runInNewContext(source, {
    window, document, console: { error() {} },
    localStorage: {
      getItem: key => key === 'kjv-read-verses' ? stored : savedAchievements,
      setItem(key, value) {
        if (failSave) throw new Error('Storage unavailable');
        if (key === 'kjv-read-verses') stored = value;
        else {
          assert.equal(key, 'kjv-verse-achievements');
          savedAchievements = value;
        }
      }
    }
  });
  function chapter(book = 'genesis', chapter = 1) {
    const rows = [1, 2].map(number => ({
      classes: new Set(),
      querySelector: () => ({ textContent: String(number) }),
      classList: { toggle() {} },
      appendChild(button) { this.button = button; }
    }));
    for (const row of rows) row.classList.toggle = (name, enabled) =>
      enabled ? row.classes.add(name) : row.classes.delete(name);
    window.KJVReadingProgress.decorate({ querySelectorAll: () => rows }, { id: book, name: book }, chapter);
    return rows;
  }
  return { chapter, fields, saved: () => stored, achievements: () => savedAchievements, fail: () => { failSave = true; } };
}

test('verse completion persists, highlights, counts and can be undone', () => {
  const app = harness();
  const rows = app.chapter();
  rows[0].button.listeners.click();
  assert.equal(rows[0].button.attributes['aria-pressed'], 'true');
  assert.ok(rows[0].classes.has('verse-is-read'));
  assert.match(app.fields.chapterReadSummary.textContent, /1 of 2/);
  assert.ok(JSON.parse(app.saved())['genesis:1:1']);
  rows[0].button.listeners.click();
  assert.equal(rows[0].button.attributes['aria-pressed'], 'false');
  assert.deepEqual(JSON.parse(app.saved()), {});
  assert.match(app.fields.chapterReadSummary.textContent, /0 of 2/);
});

test('saved marks survive reload and stay isolated by book, chapter and verse', () => {
  const app = harness();
  app.chapter()[0].button.listeners.click();
  const reloaded = harness(app.saved());
  assert.equal(reloaded.chapter()[0].button.attributes['aria-pressed'], 'true');
  assert.equal(reloaded.chapter('genesis', 2)[0].button.attributes['aria-pressed'], 'false');
  assert.equal(reloaded.chapter('john')[0].button.attributes['aria-pressed'], 'false');
});

test('failed saves preserve previous marks and report failure', () => {
  const app = harness();
  const row = app.chapter()[0];
  row.button.listeners.click();
  const saved = app.saved();
  app.fail();
  row.button.listeners.click();
  assert.equal(app.saved(), saved);
  assert.equal(row.button.attributes['aria-pressed'], 'true');
  assert.match(app.fields.readingProgressFeedback.textContent, /Could not save/);
});

test('corrupt records cannot be silently overwritten', () => {
  for (const stored of ['{', 'null', '[]', '{"genesis:1:1":"invalid"}']) {
    const app = harness(stored);
    assert.equal(app.chapter()[0].button.disabled, true);
    assert.equal(app.saved(), stored);
    assert.match(app.fields.readingProgressFeedback.textContent, /Could not load/);
  }
});

test('milestones award once, remain after undo, and notification reads persist', () => {
  const app = harness();
  const row = app.chapter()[0];
  row.button.listeners.click();
  assert.match(app.fields.verseAchievementFeedback.textContent, /Achievement unlocked/);
  assert.equal(Object.keys(JSON.parse(app.achievements())).length, 1);
  const earned = app.achievements();
  row.button.listeners.click();
  row.button.listeners.click();
  assert.equal(app.achievements(), earned);
  app.fields.markVerseAchievementsRead.listeners.click();
  assert.equal(JSON.parse(app.achievements())['1'].read, true);
  const reloaded = harness(app.saved(), app.achievements());
  reloaded.chapter();
  assert.match(reloaded.fields.verseAchievementCount.textContent, /0 unread/);
  assert.equal(reloaded.fields.verseAchievementFeedback.textContent, undefined);
});

test('exact verse thresholds award only eligible goals, including historical progress', () => {
  for (const [count, expected] of [[9, [1]], [10, [1, 10]], [49, [1, 10]], [50, [1, 10, 50]], [1000, [1, 10, 50, 100, 500, 1000]]]) {
    const records = Object.fromEntries(Array.from({ length: count }, (_, index) =>
      [`genesis:1:${index + 1}`, '2026-10-06T00:00:00Z']));
    const app = harness(JSON.stringify(records));
    app.chapter();
    assert.deepEqual(Object.keys(JSON.parse(app.achievements())).map(Number), expected);
  }
});
