(() => {
  const key = 'kjv-read-verses';
  let records = {};
  let loaded = false;
  let available = true;
  const achievementKey = 'kjv-verse-achievements';
  const goals = [1, 10, 50, 100, 500, 1000];
  let achievements = {};
  let achievementsAvailable = true;

  function updateMilestones() {
    const count = Object.keys(records).length;
    const feedback = document.getElementById('verseAchievementFeedback');
    const newGoals = goals.filter(goal => available && achievementsAvailable && count >= goal && !Object.hasOwn(achievements, goal));
    if (newGoals.length) {
      const next = { ...achievements };
      newGoals.forEach(goal => { next[goal] = { at: new Date().toISOString(), read: false }; });
      try {
        localStorage.setItem(achievementKey, JSON.stringify(next));
        achievements = next;
        feedback.textContent = `Achievement unlocked: ${newGoals.map(goal => `${goal} verse${goal === 1 ? '' : 's'} read`).join('; ')}!`;
      } catch (error) {
        feedback.textContent = 'Reading progress is saved, but achievements could not be saved. They will be retried on the next update or reload.';
        console.error('Unable to save verse achievements:', error);
      }
    }
    document.getElementById('verseMilestoneTotal').textContent = available
      ? `${count} verses currently marked as read across the reader.`
      : 'Reading statistics unavailable.';
    const nextGoal = goals.find(goal => !Object.hasOwn(achievements, goal));
    document.getElementById('verseMilestoneNext').textContent = achievementsAvailable
      ? `${Object.keys(achievements).length} of ${goals.length} milestones earned. ${nextGoal ? `Next: ${count} / ${nextGoal} verses.` : 'All verse milestones earned!'}`
      : 'Saved achievements unavailable.';
    const list = document.getElementById('verseAchievementList');
    list.replaceChildren();
    Object.entries(achievements).reverse().forEach(([goal, achievement]) => {
      const item = document.createElement('li');
      item.textContent = `${achievement.read ? 'Read' : 'New'} achievement: ${goal} verse${goal === '1' ? '' : 's'} read - ${new Date(achievement.at).toLocaleDateString()}`;
      list.appendChild(item);
    });
    const unread = Object.values(achievements).filter(item => !item.read).length;
    document.getElementById('verseAchievementCount').textContent = `${unread} unread achievement notification${unread === 1 ? '' : 's'}`;
    document.getElementById('markVerseAchievementsRead').disabled = !achievementsAvailable || unread === 0;
  }

  function report(message, error) {
    document.getElementById('readingProgressFeedback').textContent = message;
    if (error) console.error('Reading progress:', error);
  }

  function load() {
    if (loaded) return;
    loaded = true;
    try {
      const saved = localStorage.getItem(achievementKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
            Object.entries(parsed).some(([goal, item]) => !goals.includes(Number(goal)) || !item ||
              typeof item.read !== 'boolean' || typeof item.at !== 'string' || !Number.isFinite(Date.parse(item.at)))) {
          throw new Error('Invalid saved achievements.');
        }
        achievements = parsed;
      }
    } catch (error) {
      achievementsAvailable = false;
      document.getElementById('verseAchievementFeedback').textContent = 'Could not load achievements. Reading marks remain available; check browser storage and reload.';
      console.error('Unable to load verse achievements:', error);
    }
    document.getElementById('markVerseAchievementsRead').addEventListener('click', () => {
      const next = Object.fromEntries(Object.entries(achievements).map(([goal, item]) => [goal, { ...item, read: true }]));
      try {
        localStorage.setItem(achievementKey, JSON.stringify(next));
        achievements = next;
        updateMilestones();
        document.getElementById('verseAchievementFeedback').textContent = 'Achievement notifications marked as read.';
      } catch (error) {
        document.getElementById('verseAchievementFeedback').textContent = 'Could not save notification status. Previous status is unchanged.';
        console.error('Unable to mark achievements read:', error);
      }
    });
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' ||
          Object.entries(parsed).some(([id, time]) =>
            !/^[a-z0-9-]+:\d+:\d+$/.test(id) || typeof time !== 'string' || !Number.isFinite(Date.parse(time)))) {
        throw new Error('Invalid saved verse records.');
      }
      records = parsed;
    } catch (error) {
      available = false;
      report('Could not load reading marks. Marking is disabled to protect your saved data. Check browser storage and reload.', error);
    }
  }

  window.KJVReadingProgress = {
    decorate(container, book, chapter) {
      load();
      const entries = [];
      container.querySelectorAll('p').forEach(row => {
        const number = row.querySelector('.verse-num')?.textContent.trim();
        if (!/^[1-9]\d*$/.test(number || '')) return;
        const id = `${book.id}:${chapter}:${number}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm btn-outline-success verse-read-toggle';
        button.disabled = !available;
        const render = () => {
          const read = Object.hasOwn(records, id);
          row.classList.toggle('verse-is-read', read);
          button.textContent = read ? 'Read - undo' : 'Mark as read';
          button.setAttribute('aria-pressed', String(read));
          button.setAttribute('aria-label', `${read ? 'Mark unread' : 'Mark as read'}: ${book.name} ${chapter}:${number}`);
        };
        entries.push(id);
        button.addEventListener('click', () => {
          const next = { ...records };
          const read = Object.hasOwn(records, id);
          if (read) delete next[id];
          else next[id] = new Date().toISOString();
          try {
            localStorage.setItem(key, JSON.stringify(next));
            records = next;
            render();
            updateSummary();
            report(`${book.name} ${chapter}:${number} marked ${read ? 'unread' : 'as read'}. Saved on this device.`);
            updateMilestones();
          } catch (error) {
            report('Could not save reading progress. Your previous reading marks are unchanged.', error);
          }
        });
        row.appendChild(button);
        render();
      });
      function updateSummary() {
        document.getElementById('chapterReadSummary').textContent = available
          ? `${entries.filter(id => Object.hasOwn(records, id)).length} of ${entries.length} verses read in this chapter.`
          : 'Reading marks unavailable.';
      }
      updateSummary();
      updateMilestones();
    }
  };
})();
