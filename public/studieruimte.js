(() => {
    const token = localStorage.getItem('token');
    if (!token) window.location.replace('/');

    const $ = (selector) => document.querySelector(selector);
    const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    const isEnglish = () => window.LifeBuddyI18n?.getLanguage() === 'en';
    const tr = (nl, en) => isEnglish() ? en : nl;
    const numberText = (number, nlOne, nlMany, enOne, enMany) => `${number} ${tr(number === 1 ? nlOne : nlMany, number === 1 ? enOne : enMany)}`;

    let wordLists = [];
    let currentList = null;
    let currentEntries = [];
    let currentProgress = null;
    let importMode = 'tab';
    let importedCsvText = '';
    let currentSession = null;
    let currentQuestion = null;
    let pendingQuestion = null;
    let currentResult = null;
    let retryWrongAfterSession = true;
    let lastPracticeOptions = null;

    async function apiFetch(endpoint, options = {}) {
        const response = await fetch(endpoint, {
            ...options,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}`, ...(options.headers || {}) }
        });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.replace('/');
            return null;
        }
        return response;
    }

    async function apiJson(endpoint, options = {}) {
        const response = await apiFetch(endpoint, options);
        if (!response) throw new Error(tr('Je sessie is verlopen.', 'Your session has expired.'));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || tr('Er ging iets mis.', 'Something went wrong.'));
        return data;
    }

    function showToast(message, type = '') {
        const toast = $('#studyToast');
        toast.innerHTML = `<div class="study-toast ${type}"><i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${escapeHtml(message)}</span></div>`;
        window.clearTimeout(showToast.timeout);
        showToast.timeout = window.setTimeout(() => { toast.innerHTML = ''; }, 3600);
    }

    function openModal(id) { $(`#${id}`).hidden = false; }
    function closeModal(id) { $(`#${id}`).hidden = true; }
    function openOverview() { $('#studyOverview').hidden = false; $('#studyDetail').hidden = true; currentList = null; currentEntries = []; currentProgress = null; }

    async function loadWordLists() {
        wordLists = await apiJson('/api/word-lists');
        renderWordLists();
    }

    function renderWordLists() {
        const totals = wordLists.reduce((total, list) => ({
            words: total.words + Number(list.entry_count || 0),
            practiced: total.practiced + Number(list.practiced_count || 0),
            difficult: total.difficult + Number(list.difficult_count || 0)
        }), { words: 0, practiced: 0, difficult: 0 });
        $('#statLists').textContent = wordLists.length;
        $('#statWords').textContent = totals.words;
        $('#statPracticed').textContent = totals.practiced;
        $('#statDifficult').textContent = totals.difficult;
        $('#listCount').textContent = numberText(wordLists.length, 'lijst', 'lijsten', 'list', 'lists');
        const grid = $('#wordListGrid');
        if (!wordLists.length) {
            grid.innerHTML = `<div class="study-empty"><i class="fa-solid fa-book-open"></i><h2>${tr('Nog geen woordenlijsten', 'No word lists yet')}</h2><p>${tr('Maak een lijst of importeer woorden uit Excel om te beginnen.', 'Create a list or import words from Excel to get started.')}</p><button class="secondary-action" type="button" data-open-new-list><i class="fa-solid fa-plus"></i> ${tr('Nieuwe lijst', 'New list')}</button></div>`;
            return;
        }
        grid.innerHTML = wordLists.map((list) => {
            const entries = Number(list.entry_count || 0), practiced = Number(list.practiced_count || 0), difficult = Number(list.difficult_count || 0);
            const progress = entries ? Math.round((practiced / entries) * 100) : 0;
            return `<article class="word-list-card"><button class="word-list-open" type="button" data-open-list="${escapeHtml(list.id)}"><span class="word-list-icon"><i class="fa-solid fa-book-bookmark"></i></span><span class="word-list-card-copy"><strong>${escapeHtml(list.title)}</strong><small>${escapeHtml(list.description || tr('Geen beschrijving toegevoegd.', 'No description added.'))}</small></span><i class="fa-solid fa-arrow-right word-list-arrow"></i></button><div class="word-list-meta"><span>${numberText(entries, 'woord', 'woorden', 'word', 'words')}</span><span>${tr('Geoefend', 'Practiced')} ${progress}%</span></div><div class="word-list-progress"><span style="width:${progress}%"></span></div>${difficult ? `<span class="word-list-difficult"><i class="fa-solid fa-bolt"></i> ${numberText(difficult, 'lastig woord', 'lastige woorden', 'difficult word', 'difficult words')}</span>` : ''}</article>`;
        }).join('');
    }

    async function openWordList(listId) {
        try {
            const [detail, progress] = await Promise.all([
                apiJson(`/api/word-lists/${encodeURIComponent(listId)}`),
                apiJson(`/api/word-lists/${encodeURIComponent(listId)}/progress`)
            ]);
            currentList = detail.list;
            currentEntries = detail.entries || [];
            currentProgress = progress;
            $('#studyOverview').hidden = true;
            $('#studyDetail').hidden = false;
            renderDetail();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) { showToast(error.message, 'error'); }
    }

    function renderDetail() {
        if (!currentList) return;
        $('#detailTitle').textContent = currentList.title;
        $('#detailDescription').textContent = currentList.description || (currentEntries.length ? '' : tr('Voeg termen toe of importeer ze om te beginnen.', 'Add terms or import them to get started.'));
        const languages = [currentList.term_language, currentList.definition_language].filter(Boolean).join(' → ');
        $('#detailLanguages').textContent = languages || tr('WOORDENLIJST', 'WORD LIST');
        $('#entryCount').textContent = numberText(currentEntries.length, 'woord', 'woorden', 'word', 'words');
        renderProgress();
        renderEntryTable();
    }

    function renderProgress() {
        const summary = currentProgress?.summary || { total: 0, practiced: 0, unpracticed: 0, difficult: 0, mastered: 0 };
        $('#detailProgress').innerHTML = [
            [summary.practiced, tr('Geoefend', 'Practiced'), 'fa-chart-line', 'violet'],
            [summary.mastered, tr('Beheerst', 'Mastered'), 'fa-star', 'green'],
            [summary.difficult, tr('Nog lastig', 'Still difficult'), 'fa-bolt', 'amber'],
            [summary.unpracticed, tr('Nog nieuw', 'Not practiced'), 'fa-seedling', 'blue']
        ].map(([value, label, icon, color]) => `<article class="detail-progress-card ${color}"><i class="fa-solid ${icon}"></i><strong>${value}</strong><span>${label}</span></article>`).join('');
    }

    function renderEntryTable() {
        const body = $('#entryTableBody');
        if (!currentEntries.length) {
            body.innerHTML = `<tr><td colspan="4"><div class="table-study-empty"><i class="fa-solid fa-language"></i><span>${tr('Deze lijst is nog leeg. Voeg een term toe of importeer woorden.', 'This list is empty. Add a term or import words.')}</span></div></td></tr>`;
            return;
        }
        body.innerHTML = currentEntries.map((entry) => {
            const correct = Number(entry.correct_count || 0), wrong = Number(entry.wrong_count || 0), attempts = correct + wrong;
            const rate = attempts ? Math.round((correct / attempts) * 100) : 0;
            const status = !attempts ? tr('Nieuw', 'New') : wrong > correct ? tr('Lastig', 'Difficult') : tr('Geoefend', 'Practiced');
            return `<tr><td><strong>${escapeHtml(entry.term)}</strong><span class="entry-status entry-status-sm ${!attempts ? 'new' : wrong > correct ? 'difficult' : 'practiced'}">${status}</span></td><td>${escapeHtml(entry.definition)}</td><td><div class="entry-progress"><div><span class="entry-status ${!attempts ? 'new' : wrong > correct ? 'difficult' : 'practiced'}">${status}</span><small>${attempts ? `${correct}/${attempts} ${tr('goed', 'correct')}` : tr('Nog niet geoefend', 'Not practiced yet')}</small></div><span class="entry-mini-progress"><i style="width:${rate}%"></i></span></div></td><td><div class="entry-actions"><button type="button" data-edit-entry="${escapeHtml(entry.id)}" aria-label="${tr('Term bewerken', 'Edit term')}"><i class="fa-solid fa-pen"></i></button><button type="button" data-delete-entry="${escapeHtml(entry.id)}" aria-label="${tr('Term verwijderen', 'Delete term')}"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>`;
        }).join('');
    }

    function prepareListModal(list = null) {
        $('#listForm').reset();
        $('#listId').value = list?.id || '';
        $('#listModalTitle').textContent = list ? tr('Woordenlijst bewerken', 'Edit word list') : tr('Nieuwe woordenlijst', 'New word list');
        if (list) {
            $('#listTitle').value = list.title;
            $('#listDescription').value = list.description || '';
            $('#termLanguage').value = list.term_language || '';
            $('#definitionLanguage').value = list.definition_language || '';
        }
        openModal('listModal');
        window.setTimeout(() => $('#listTitle').focus(), 20);
    }

    async function saveList(event) {
        event.preventDefault();
        const id = $('#listId').value;
        const body = {
            title: $('#listTitle').value.trim(), description: $('#listDescription').value.trim(),
            termLanguage: $('#termLanguage').value, definitionLanguage: $('#definitionLanguage').value
        };
        try {
            const data = await apiJson(id ? `/api/word-lists/${id}` : '/api/word-lists', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
            closeModal('listModal');
            await loadWordLists();
            showToast(id ? tr('Woordenlijst bijgewerkt.', 'Word list updated.') : tr('Woordenlijst aangemaakt.', 'Word list created.'), 'success');
            await openWordList(data.list.id);
        } catch (error) { showToast(error.message, 'error'); }
    }

    function prepareEntryModal(entry = null) {
        if (!currentList) return;
        $('#entryForm').reset();
        $('#entryId').value = entry?.id || '';
        $('#entryModalTitle').textContent = entry ? tr('Term bewerken', 'Edit term') : tr('Term toevoegen', 'Add term');
        if (entry) { $('#entryTerm').value = entry.term; $('#entryDefinition').value = entry.definition; }
        openModal('entryModal');
        window.setTimeout(() => $('#entryTerm').focus(), 20);
    }

    async function saveEntry(event) {
        event.preventDefault();
        const entryId = $('#entryId').value;
        const body = { term: $('#entryTerm').value.trim(), definition: $('#entryDefinition').value.trim() };
        try {
            await apiJson(`/api/word-lists/${currentList.id}/entries${entryId ? `/${entryId}` : ''}`, { method: entryId ? 'PUT' : 'POST', body: JSON.stringify(body) });
            closeModal('entryModal');
            await loadWordLists();
            await openWordList(currentList.id);
            showToast(entryId ? tr('Term bijgewerkt.', 'Term updated.') : tr('Term toegevoegd.', 'Term added.'), 'success');
        } catch (error) { showToast(error.message, 'error'); }
    }

    function parseDelimited(text, delimiter) {
        const rows = [], row = [];
        let cell = '', quoted = false;
        for (let index = 0; index < text.length; index++) {
            const character = text[index];
            if (character === '"') {
                if (quoted && text[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted;
            } else if (!quoted && character === delimiter) { row.push(cell.trim()); cell = ''; }
            else if (!quoted && (character === '\n' || character === '\r')) {
                if (character === '\r' && text[index + 1] === '\n') index++;
                row.push(cell.trim()); cell = '';
                if (row.some(Boolean)) rows.push(row.splice(0));
            } else cell += character;
        }
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        return rows;
    }

    function importEntriesFromText(text, mode) {
        const rawText = String(text || '').replace(/^\uFEFF/, '').trim();
        if (!rawText) return [];
        let rows;
        if (mode === 'equals') {
            rows = rawText.split(/\r?\n/).map((line) => {
                const equalsIndex = line.indexOf('=');
                return equalsIndex === -1 ? [] : [line.slice(0, equalsIndex).trim(), line.slice(equalsIndex + 1).trim()];
            });
        } else {
            const firstLine = rawText.split(/\r?\n/).find(Boolean) || '';
            const delimiter = mode === 'tab' ? '\t' : (firstLine.split(';').length > firstLine.split(',').length ? ';' : ',');
            rows = parseDelimited(rawText, delimiter);
        }
        const values = rows.map((row) => ({ term: String(row[0] || '').trim(), definition: String(row.slice(1).join(' ').trim()) })).filter((entry) => entry.term && entry.definition);
        const first = values[0];
        if (first && /^(term|woord|word)$/i.test(first.term) && /^(definitie|definition|vertaling|translation)$/i.test(first.definition)) values.shift();
        const unique = new Map();
        values.forEach((entry) => unique.set(entry.term.toLocaleLowerCase('nl-NL'), entry));
        return [...unique.values()];
    }

    function renderImportPreview() {
        const source = importMode === 'csv' ? importedCsvText : $('#importTextArea').value;
        const entries = importEntriesFromText(source, importMode);
        const preview = $('#importPreview');
        if (!entries.length) { preview.hidden = true; preview.innerHTML = ''; return entries; }
        preview.hidden = false;
        preview.innerHTML = `<strong>${numberText(entries.length, 'term klaar voor import', 'termen klaar voor import', 'term ready to import', 'terms ready to import')}</strong><div>${entries.slice(0, 4).map((entry) => `<span>${escapeHtml(entry.term)} <i>→</i> ${escapeHtml(entry.definition)}</span>`).join('')}</div>${entries.length > 4 ? `<small>+ ${entries.length - 4} ${tr('meer', 'more')}</small>` : ''}`;
        return entries;
    }

    function openImport() {
        $('#importForm').reset();
        importedCsvText = ''; importMode = 'tab';
        $('#importTitle').value = currentList ? `${currentList.title} ${tr('– import', '– import')}` : '';
        $('#importFileName').textContent = tr('Nog geen bestand gekozen.', 'No file chosen yet.');
        document.querySelectorAll('[data-import-mode]').forEach((button) => button.classList.toggle('active', button.dataset.importMode === 'tab'));
        $('#pasteImportArea').hidden = false; $('#csvImportArea').hidden = true; $('#importPreview').hidden = true;
        openModal('importModal');
    }

    async function importWords(event) {
        event.preventDefault();
        const entries = renderImportPreview();
        if (!entries.length) return showToast(tr('Plak of upload minimaal één geldige term.', 'Paste or upload at least one valid term.'), 'error');
        try {
            const data = await apiJson('/api/word-lists/import', {
                method: 'POST',
                body: JSON.stringify({ title: $('#importTitle').value.trim(), entries, termLanguage: $('#importTermLanguage').value, definitionLanguage: $('#importDefinitionLanguage').value })
            });
            closeModal('importModal');
            await loadWordLists();
            await openWordList(data.list.id);
            showToast(`${data.imported} ${tr('termen geïmporteerd.', 'terms imported.')}`, 'success');
        } catch (error) { showToast(error.message, 'error'); }
    }

    // Same rule as the server: up to 20 words everything is asked, above that half of the words.
    const autoPracticeCount = (wordCount) => (wordCount <= 20 ? wordCount : Math.ceil(wordCount / 2));
    function practicePoolSize() {
        const mode = $('#practiceSelection').value;
        const wrong = (entry) => Number(entry.wrong_count || 0), correct = (entry) => Number(entry.correct_count || 0);
        if (mode === 'difficult') return currentEntries.filter((entry) => wrong(entry) > correct(entry)).length;
        if (mode === 'unpracticed') return currentEntries.filter((entry) => wrong(entry) + correct(entry) === 0).length;
        if (mode === 'selected') return document.querySelectorAll('#specificWordPicker input:checked').length;
        return currentEntries.length;
    }
    function updatePracticeCountHint() {
        const pool = practicePoolSize(), choice = $('#practiceCount').value;
        const questions = choice === 'auto' ? autoPracticeCount(pool) : choice === 'all' ? pool : Math.min(Number(choice), pool);
        $('#practiceCountHint').textContent = pool
            ? tr(`Je krijgt ${questions} van ${pool} ${pool === 1 ? 'woord' : 'woorden'}. Tot 20 woorden toets je alles, daarboven de helft.`, `You get ${questions} of ${pool} ${pool === 1 ? 'word' : 'words'}. Up to 20 words everything is asked, above that half.`)
            : tr('Deze selectie bevat geen woorden.', 'This selection has no words.');
    }

    function renderSpecificWordPicker() {
        const picker = $('#specificWordPicker');
        picker.innerHTML = currentEntries.map((entry) => `<label><input type="checkbox" value="${escapeHtml(entry.id)}"><span>${escapeHtml(entry.term)}<small>${escapeHtml(entry.definition)}</small></span></label>`).join('');
    }

    function openPracticeSetup() {
        if (!currentEntries.length) return showToast(tr('Voeg eerst minstens één term toe.', 'Add at least one term first.'), 'error');
        $('#practiceSetupForm').reset();
        $('#practiceCount').value = 'auto'; updatePracticeCountHint();
        $('#specificWordPicker').hidden = true;
        renderSpecificWordPicker();
        openModal('practiceSetupModal');
    }

    function methodLabel(method) {
        return ({ test: tr('Toets', 'Test'), multiple_choice: tr('Meerkeuze', 'Multiple choice'), flashcards: tr('Flashcards', 'Flashcards'), spelling: tr('Spelling', 'Spelling'), mixed: tr('Gemixt', 'Mixed') })[method] || tr('Oefenen', 'Practice');
    }

    async function startPractice(options) {
        try {
            const data = await apiJson(`/api/word-lists/${currentList.id}/practice/start`, { method: 'POST', body: JSON.stringify(options) });
            currentSession = data.session; currentQuestion = data.question; pendingQuestion = null; lastPracticeOptions = options;
            closeModal('practiceSetupModal'); openModal('practiceModal'); renderPracticeQuestion();
        } catch (error) { showToast(error.message, 'error'); }
    }

    function renderPracticeQuestion() {
        if (!currentQuestion || !currentSession) return;
        $('#practiceMethodLabel').textContent = methodLabel(currentSession.method);
        $('#practiceProgressText').textContent = `${currentQuestion.position} / ${currentSession.total}`;
        $('#practiceProgressFill').style.width = `${Math.round(((currentQuestion.position - 1) / currentSession.total) * 100)}%`;
        $('#practiceFeedback').hidden = true; $('#practiceFeedback').innerHTML = '';
        const question = currentQuestion;
        $('#practiceQuestion').innerHTML = `<span>${question.direction === 'definition_term' ? tr('Wat is de term?', 'What is the term?') : tr('Wat betekent dit?', 'What does this mean?')}</span><strong>${escapeHtml(question.prompt)}</strong>`;
        const interaction = $('#practiceInteraction');
        if (question.method === 'multiple_choice') {
            interaction.innerHTML = `<div class="multiple-choice-grid">${question.options.map((option) => `<button type="button" data-practice-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}</div>`;
        } else if (question.method === 'flashcards') {
            interaction.innerHTML = `<div class="flashcard-controls"><button class="secondary-action" type="button" id="revealFlashcard"><i class="fa-solid fa-eye"></i> ${tr('Toon antwoord', 'Show answer')}</button></div>`;
        } else if (question.method === 'spelling') {
            interaction.innerHTML = `<div class="spelling-preview" id="spellingPreview"><span>${tr('Kijk goed…', 'Look carefully…')}</span><strong>${escapeHtml(question.spellingPreview)}</strong></div>`;
            window.setTimeout(() => {
                if (currentQuestion?.entryId !== question.entryId) return;
                interaction.innerHTML = practiceInputMarkup(tr('Typ het woord exact over', 'Type the word exactly'));
                $('#practiceAnswer')?.focus();
            }, 1350);
        } else {
            interaction.innerHTML = `${practiceInputMarkup(tr('Typ je antwoord', 'Type your answer'))}<button class="practice-hint" type="button" id="showHint"><i class="fa-regular fa-lightbulb"></i> ${tr('Hint', 'Hint')}</button><p class="hint-value" id="hintValue" hidden>${escapeHtml(question.hint)}</p>`;
            $('#practiceAnswer')?.focus();
        }
    }

    function practiceInputMarkup(placeholder) {
        return `<form class="practice-answer-form" id="practiceAnswerForm"><input id="practiceAnswer" type="text" autocomplete="off" placeholder="${escapeHtml(placeholder)}" required><button class="primary-button" type="submit">${tr('Controleer', 'Check')} <i class="fa-solid fa-arrow-right"></i></button></form>`;
    }

    async function submitPractice({ answer = '', known } = {}) {
        if (!currentSession || !currentQuestion) return;
        try {
            document.querySelectorAll('#practiceInteraction button, #practiceInteraction input').forEach((element) => { element.disabled = true; });
            const data = await apiJson(`/api/word-lists/${currentList.id}/practice/submit`, {
                method: 'POST', body: JSON.stringify({ sessionId: currentSession.id, entryId: currentQuestion.entryId, answer, known })
            });
            const feedback = $('#practiceFeedback');
            feedback.hidden = false;
            feedback.className = `practice-feedback ${data.correct ? 'correct' : 'wrong'}`;
            feedback.innerHTML = `<div><i class="fa-solid ${data.correct ? 'fa-circle-check' : 'fa-circle-xmark'}"></i><strong>${data.correct ? tr('Goed gedaan!', 'Well done!') : tr('Nog niet helemaal.', 'Not quite yet.')}</strong><span>${data.correct ? tr('Dit antwoord is opgeslagen als goed.', 'This answer was saved as correct.') : `${tr('Correct antwoord:', 'Correct answer:')} <b>${escapeHtml(data.expectedAnswer)}</b>`}</span></div><button class="primary-button" type="button" id="practiceContinue">${data.completed ? tr('Bekijk resultaat', 'View result') : tr('Volgende', 'Next')} <i class="fa-solid fa-arrow-right"></i></button>`;
            if (data.completed) { currentResult = data.result; pendingQuestion = null; } else pendingQuestion = data.nextQuestion;
        } catch (error) { showToast(error.message, 'error'); renderPracticeQuestion(); }
    }

    function revealFlashcard() {
        if (!currentQuestion) return;
        $('#practiceInteraction').innerHTML = `<div class="flashcard-answer"><span>${tr('Antwoord', 'Answer')}</span><strong>${escapeHtml(currentQuestion.reveal)}</strong></div><div class="flashcard-rating"><button type="button" data-flashcard-known="false"><i class="fa-solid fa-rotate-left"></i> ${tr('Nog niet', 'Not yet')}</button><button type="button" data-flashcard-known="true"><i class="fa-solid fa-check"></i> ${tr('Weet ik', 'I know it')}</button></div>`;
    }

    async function deleteEntry(entryId) {
        const entry = currentEntries.find((item) => item.id === entryId);
        if (!entry || !window.confirm(`${tr('Verwijder', 'Delete')} “${entry.term}”?`)) return;
        try {
            await apiJson(`/api/word-lists/${currentList.id}/entries/${entryId}`, { method: 'DELETE' });
            await loadWordLists(); await openWordList(currentList.id);
            showToast(tr('Term verwijderd.', 'Term deleted.'), 'success');
        } catch (error) { showToast(error.message, 'error'); }
    }

    async function deleteCurrentList() {
        if (!currentList || !window.confirm(`${tr('Verwijder woordenlijst', 'Delete word list')} “${currentList.title}”?`)) return;
        try {
            await apiJson(`/api/word-lists/${currentList.id}`, { method: 'DELETE' });
            await loadWordLists(); openOverview();
            showToast(tr('Woordenlijst verwijderd.', 'Word list deleted.'), 'success');
        } catch (error) { showToast(error.message, 'error'); }
    }

    function finishSession() {
        closeModal('practiceModal');
        if (!currentResult) return;
        const result = currentResult;
        $('#resultScore').textContent = `${result.score}%`;
        $('#resultCopy').textContent = result.score >= 80 ? tr('Sterk werk — deze lijst begint echt te zitten.', 'Strong work — this list is starting to stick.') : tr('Elke oefening helpt. Pak de lastige woorden nog een keer mee.', 'Every practice helps. Give the difficult words another go.');
        $('#resultBreakdown').innerHTML = `<span><i class="fa-solid fa-check"></i> ${result.correct} ${tr('goed', 'correct')}</span><span><i class="fa-solid fa-xmark"></i> ${result.wrong} ${tr('fout', 'wrong')}</span><span><i class="fa-solid fa-layer-group"></i> ${result.total} ${tr('totaal', 'total')}</span>`;
        $('#retryWrongButton').hidden = !(retryWrongAfterSession && result.wrongEntryIds.length);
        openModal('resultModal');
        loadWordLists().catch(() => {});
        openWordList(currentList.id).catch(() => {});
    }

    function retryWrong() {
        if (!currentResult?.wrongEntryIds.length) return;
        closeModal('resultModal');
        startPractice({ ...lastPracticeOptions, selection: { mode: 'selected', entryIds: currentResult.wrongEntryIds, count: 'all' } });
    }

    function closePractice() {
        closeModal('practiceModal');
        currentSession = null; currentQuestion = null; pendingQuestion = null;
    }

    function bindEvents() {
        $('#openNewList').addEventListener('click', () => prepareListModal());
        $('#backToLists').addEventListener('click', openOverview);
        $('#editList').addEventListener('click', () => prepareListModal(currentList));
        $('#deleteList').addEventListener('click', deleteCurrentList);
        $('#openEntry').addEventListener('click', () => prepareEntryModal());
        $('#openImport').addEventListener('click', openImport);
        $('#openPractice').addEventListener('click', openPracticeSetup);
        $('#listForm').addEventListener('submit', saveList);
        $('#entryForm').addEventListener('submit', saveEntry);
        $('#importForm').addEventListener('submit', importWords);
        $('#importTextArea').addEventListener('input', renderImportPreview);
        $('#importFile').addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) return showToast(tr('CSV-bestand is te groot (maximaal 2 MB).', 'CSV file is too large (maximum 2 MB).'), 'error');
            importedCsvText = await file.text();
            $('#importFileName').textContent = file.name;
            renderImportPreview();
        });
        document.querySelectorAll('[data-import-mode]').forEach((button) => button.addEventListener('click', () => {
            importMode = button.dataset.importMode;
            document.querySelectorAll('[data-import-mode]').forEach((item) => item.classList.toggle('active', item === button));
            $('#pasteImportArea').hidden = importMode === 'csv'; $('#csvImportArea').hidden = importMode !== 'csv';
            $('#importTextArea').placeholder = importMode === 'equals' ? 'huis = house / home\nschool = school' : 'huis[TAB]house\nschool[TAB]school';
            renderImportPreview();
        }));
        $('#practiceSelection').addEventListener('change', (event) => { $('#specificWordPicker').hidden = event.target.value !== 'selected'; updatePracticeCountHint(); });
        $('#practiceCount').addEventListener('change', updatePracticeCountHint);
        $('#specificWordPicker').addEventListener('change', updatePracticeCountHint);
        $('#practiceSetupForm').addEventListener('submit', (event) => {
            event.preventDefault();
            const selectionMode = $('#practiceSelection').value;
            const selectedIds = [...document.querySelectorAll('#specificWordPicker input:checked')].map((input) => input.value);
            if (selectionMode === 'selected' && !selectedIds.length) return showToast(tr('Kies minstens één woord.', 'Choose at least one word.'), 'error');
            const method = document.querySelector('input[name="practiceMethod"]:checked').value;
            retryWrongAfterSession = $('#retryWrong').checked;
            startPractice({ method, direction: method === 'mixed' ? 'mixed' : $('#practiceDirection').value, selection: { mode: selectionMode, entryIds: selectedIds, count: $('#practiceCount').value } });
        });
        document.addEventListener('click', (event) => {
            const close = event.target.closest('[data-close-modal]'); if (close) return closeModal(close.dataset.closeModal);
            if (event.target.closest('[data-close-practice]')) return closePractice();
            if (event.target.closest('[data-open-new-list]')) return prepareListModal();
            const listButton = event.target.closest('[data-open-list]'); if (listButton) return openWordList(listButton.dataset.openList);
            const editButton = event.target.closest('[data-edit-entry]'); if (editButton) return prepareEntryModal(currentEntries.find((entry) => entry.id === editButton.dataset.editEntry));
            const deleteButton = event.target.closest('[data-delete-entry]'); if (deleteButton) return deleteEntry(deleteButton.dataset.deleteEntry);
            const option = event.target.closest('[data-practice-option]'); if (option) return submitPractice({ answer: option.dataset.practiceOption });
            if (event.target.closest('#showHint')) return $('#hintValue').hidden = false;
            if (event.target.closest('#revealFlashcard')) return revealFlashcard();
            const known = event.target.closest('[data-flashcard-known]'); if (known) return submitPractice({ known: known.dataset.flashcardKnown === 'true' });
            if (event.target.closest('#practiceContinue')) return currentResult ? finishSession() : (currentQuestion = pendingQuestion, pendingQuestion = null, renderPracticeQuestion());
            if (event.target.closest('#retryWrongButton')) return retryWrong();
        });
        document.addEventListener('submit', (event) => {
            if (event.target.id !== 'practiceAnswerForm') return;
            event.preventDefault(); submitPractice({ answer: $('#practiceAnswer').value.trim() });
        });
        document.addEventListener('lifebuddy-languagechange', () => {
            renderWordLists(); if (currentList) renderDetail(); if (currentQuestion) renderPracticeQuestion();
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindEvents();
        try { await loadWordLists(); } catch (error) { showToast(error.message, 'error'); }
    });
})();
