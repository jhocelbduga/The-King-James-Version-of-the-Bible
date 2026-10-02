// Global state
let currentBook;
let currentChapter = 1;

// Render book navigation
function renderNavigation() {
// Populate OT, Apocrypha, NT lists
}

// Select a book
function selectBook(book, chapter = 1) {
currentBook = book;
currentChapter = chapter;

// Update UI
// Populate chapter dropdown
// Render chapter
}

// Render chapter verses
function renderChapterText() {
// Display verses
// Update Prev/Next button states
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
renderNavigation();
selectBook(kjvBooks[0], 1);

document.getElementById('chapterSelect')
.addEventListener('change', (e) => {
currentChapter = parseInt(e.target.value, 10);
renderChapterText();
});

document.getElementById('prevChapterBtn')
.addEventListener('click', () => {
if (currentChapter > 1) {
currentChapter--;
renderChapterText();
}
});

document.getElementById('nextChapterBtn')
.addEventListener('click', () => {
if (currentChapter < currentBook.chapters) {
currentChapter++;
renderChapterText();
}
});
});