/*
 * LifeBuddy AI Buddy — one shared widget for every page.
 * Injects its own markup, talks to /api/chat/stream (local Ollama), and stays out of the way:
 * a small launcher opens a chat panel without leaving the current page.
 * Other scripts can listen for the "buddy:reply-complete" event on document.
 */
(function () {
    'use strict';
    const token = localStorage.getItem('token');
    if (!token || document.getElementById('buddyWidget')) return;

    const COLORS = ['violet', 'aqua', 'rose', 'gold'];
    const ACCESSORIES = { star: '✨', book: '📚', leaf: '🌿', crown: '👑' };
    const SUGGESTIONS = [
        { label: 'Plan mijn week', prompt: 'Help me mijn studieweek te plannen. Vraag eerst wat ik moet doen en wanneer mijn deadlines zijn.' },
        { label: 'Leg iets uit', prompt: 'Leg een lastig onderwerp voor me uit. Vraag welk onderwerp en op welk niveau.' },
        { label: 'Hoe begin ik?', prompt: 'Ik kan niet beginnen met leren. Geef me een klein eerste stapje.' }
    ];

    function userId() {
        try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).id || 'guest'; } catch { return 'guest'; }
    }
    const prefsKey = `lifebuddy-buddy-${userId()}`;
    let prefs = { name: 'Buddy', color: 'violet', accessory: 'star', hidden: false };
    try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(prefsKey) || '{}') }; } catch { /* default companion */ }
    const savePrefs = () => { try { localStorage.setItem(prefsKey, JSON.stringify(prefs)); } catch { /* storage unavailable */ } };

    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Small, safe markdown subset: **bold**, `code`, "- " and "1. " lists, "#" headings, paragraphs. Input is escaped first.
    function inline(text) {
        return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }
    function renderMarkdown(source) {
        const lines = String(source).replace(/\r/g, '').split('\n');
        const out = [];
        let list = null;
        let paragraph = [];
        const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = []; } };
        const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.tag}>`); list = null; } };
        for (const raw of lines) {
            const line = raw.trimEnd();
            let match;
            if (!line.trim()) { flushParagraph(); flushList(); continue; }
            if ((match = line.match(/^\s*[-*•]\s+(.*)$/))) { flushParagraph(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(match[1]); continue; }
            if ((match = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushParagraph(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(match[1]); continue; }
            if ((match = line.match(/^#{1,4}\s+(.*)$/))) { flushParagraph(); flushList(); out.push(`<p><strong>${inline(match[1])}</strong></p>`); continue; }
            flushList();
            paragraph.push(line);
        }
        flushParagraph(); flushList();
        return out.join('');
    }

    // ---------- markup ----------
    const root = document.createElement('div');
    root.id = 'buddyRoot';
    root.innerHTML = `
        <div class="buddy-widget" id="buddyWidget">
            <section class="bd-panel" id="buddyPanel" role="dialog" aria-modal="false" aria-labelledby="bdTitle" hidden>
                <header class="bd-header">
                    <div class="bd-title"><span class="bd-kicker">Studiemaatje</span><h2 id="bdTitle">Buddy</h2></div>
                    <div class="bd-header-actions">
                        <button type="button" class="bd-icon" id="bdCustomize" aria-label="Pas je maatje aan" aria-expanded="false" aria-controls="bdCustomizer" title="Aanpassen"><i class="fa-solid fa-sliders" aria-hidden="true"></i></button>
                        <button type="button" class="bd-icon" id="bdClose" aria-label="Sluit chat" title="Sluiten"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                    </div>
                </header>
                <section class="bd-customizer" id="bdCustomizer" aria-label="Maatje aanpassen" hidden>
                    <label for="bdName">Naam</label><input id="bdName" type="text" maxlength="18" placeholder="Buddy" autocomplete="off">
                    <span id="bdColorLabel">Kleur</span>
                    <div class="bd-choices" role="group" aria-labelledby="bdColorLabel">
                        <button type="button" data-bd-color="violet" aria-label="Paars"></button><button type="button" data-bd-color="aqua" aria-label="Blauw"></button><button type="button" data-bd-color="rose" aria-label="Roze"></button><button type="button" data-bd-color="gold" aria-label="Goud"></button>
                    </div>
                    <span id="bdAccLabel">Accessoire</span>
                    <div class="bd-choices bd-acc" role="group" aria-labelledby="bdAccLabel">
                        <button type="button" data-bd-acc="star" aria-label="Ster">✨</button><button type="button" data-bd-acc="book" aria-label="Boeken">📚</button><button type="button" data-bd-acc="leaf" aria-label="Blad">🌿</button><button type="button" data-bd-acc="crown" aria-label="Kroon">👑</button>
                    </div>
                    <button type="button" class="bd-text-button" id="bdHide">Verberg maatje op deze pagina's</button>
                </section>
                <div class="bd-log" id="bdLog" role="log" aria-live="polite" aria-relevant="additions text" tabindex="0" aria-label="Gesprek"></div>
                <button type="button" class="bd-jump" id="bdJump" hidden>Naar laatste bericht <i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
                <form class="bd-composer" id="bdForm">
                    <label class="bd-sr" for="bdInput">Bericht aan je maatje</label>
                    <textarea id="bdInput" rows="1" maxlength="6000" placeholder="Stel een vraag…" enterkeyhint="send"></textarea>
                    <button type="submit" class="bd-send" id="bdSend" aria-label="Verstuur"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
                </form>
            </section>
            <div class="buddy-dock">
                <button class="buddy-launcher buddy-violet" id="buddyLauncher" type="button" aria-expanded="false" aria-controls="buddyPanel" aria-label="Open chat met Buddy">
                    <span class="buddy-accessory" id="buddyAccessory" aria-hidden="true">✨</span><span class="buddy-ear buddy-ear-left"></span><span class="buddy-ear buddy-ear-right"></span><span class="buddy-face"><i></i><i></i><b></b></span>
                </button>
            </div>
        </div>
        <button class="buddy-restore" id="buddyRestore" type="button" hidden aria-label="Toon je maatje"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i></button>`;
    document.body.appendChild(root);
    const $ = (selector) => root.querySelector(selector);
    const widget = $('#buddyWidget'), panel = $('#buddyPanel'), launcher = $('#buddyLauncher'), log = $('#bdLog'), input = $('#bdInput'), form = $('#bdForm'), send = $('#bdSend'), jump = $('#bdJump');

    // ---------- state ----------
    let history = [];
    let historyLoaded = false;
    let busy = false;
    let controller = null;
    let stickToBottom = true;
    let lastMessage = '';

    const nameOf = () => prefs.name || 'Buddy';
    function applyPrefs() {
        const color = COLORS.includes(prefs.color) ? prefs.color : 'violet';
        launcher.className = `buddy-launcher buddy-${color}`;
        launcher.setAttribute('aria-label', `Open chat met ${nameOf()}`);
        $('#bdTitle').textContent = nameOf();
        $('#bdName').value = nameOf();
        $('#buddyAccessory').textContent = ACCESSORIES[prefs.accessory] || ACCESSORIES.star;
        root.querySelectorAll('[data-bd-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bdColor === color)));
        root.querySelectorAll('[data-bd-acc]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bdAcc === prefs.accessory)));
        widget.hidden = Boolean(prefs.hidden);
        $('#buddyRestore').hidden = !prefs.hidden;
    }

    // ---------- rendering ----------
    function messageHtml(role, html, extra = '') {
        const who = role === 'user' ? 'Jij' : nameOf();
        return `<div class="bd-msg bd-${role === 'user' ? 'user' : 'assistant'}${extra}"><span class="bd-who">${escapeHtml(who)}</span><div class="bd-bubble">${html}</div></div>`;
    }
    function renderHistory() {
        panel.classList.toggle('is-empty', !history.length);
        if (!history.length) {
            log.innerHTML = `<div class="bd-empty"><p>Hoi! Ik help je met plannen, uitleggen en op gang komen. Waar wil je mee beginnen?</p><div class="bd-chips">${SUGGESTIONS.map((s, i) => `<button type="button" class="bd-chip" data-bd-suggestion="${i}">${escapeHtml(s.label)}</button>`).join('')}</div></div>`;
            return;
        }
        log.innerHTML = history.map((m) => messageHtml(m.role, m.role === 'user' ? `<p>${escapeHtml(m.message).replace(/\n/g, '<br>')}</p>` : renderMarkdown(m.message))).join('');
        scrollToLatest(true);
    }
    function scrollToLatest(force) {
        if (!force && !stickToBottom) return;
        requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; jump.hidden = true; });
    }
    log.addEventListener('scroll', () => {
        stickToBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
        jump.hidden = stickToBottom || !busy;
    });
    jump.addEventListener('click', () => { stickToBottom = true; scrollToLatest(true); });

    async function api(path, options = {}) {
        const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
        if (response.status === 401 || response.status === 403) { localStorage.removeItem('token'); window.location.replace('/'); throw new Error('unauthorized'); }
        return response;
    }
    async function loadHistory() {
        if (historyLoaded) return;
        try {
            const response = await api('/api/chat/history');
            if (response.ok) { history = (await response.json()).history || []; historyLoaded = true; renderHistory(); }
        } catch { /* panel shows the empty state; sending still works */ }
    }

    // ---------- sending ----------
    function setBusy(value) {
        busy = value;
        send.innerHTML = value ? '<i class="fa-solid fa-stop" aria-hidden="true"></i>' : '<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>';
        send.setAttribute('aria-label', value ? 'Stop met antwoorden' : 'Verstuur');
        send.classList.toggle('is-stop', value);
        log.setAttribute('aria-busy', String(value));
    }
    function showError(message, retryable) {
        log.querySelector('.bd-live')?.remove();
        log.insertAdjacentHTML('beforeend', `<div class="bd-msg bd-assistant bd-error" role="alert"><span class="bd-who">${escapeHtml(nameOf())}</span><div class="bd-bubble"><p>${escapeHtml(message).replace(/`([^`]+)`/g, '<code>$1</code>')}</p>${retryable ? '<button type="button" class="bd-text-button" data-bd-retry>Opnieuw proberen</button>' : ''}</div></div>`);
        scrollToLatest(true);
    }
    async function sendMessage(text) {
        const message = text.trim();
        if (!message || busy) return;
        lastMessage = message;
        log.querySelector('.bd-empty')?.remove();
        panel.classList.remove('is-empty');
        log.querySelector('.bd-error')?.remove();
        log.insertAdjacentHTML('beforeend', messageHtml('user', `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`));
        log.insertAdjacentHTML('beforeend', messageHtml('assistant', '<span class="bd-typing" aria-label="Aan het typen"><i></i><i></i><i></i></span>', ' bd-live'));
        history.push({ role: 'user', message });
        input.value = ''; autosize();
        stickToBottom = true; scrollToLatest(true);
        setBusy(true);
        controller = new AbortController();
        const bubble = log.querySelector('.bd-live .bd-bubble');
        let answer = '';
        let failed = null;
        try {
            const response = await fetch('/api/chat/stream', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message }) });
            if (response.status === 401 || response.status === 403) { localStorage.removeItem('token'); window.location.replace('/'); return; }
            if (!response.ok || !response.body) throw new Error((await response.json().catch(() => ({}))).error || 'Verbinding mislukt');
            const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let index;
                while ((index = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
                    if (!line) continue;
                    let event; try { event = JSON.parse(line); } catch { continue; }
                    if (event.type === 'delta') { answer += event.text; bubble.innerHTML = renderMarkdown(answer); scrollToLatest(); }
                    else if (event.type === 'error') failed = event;
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') failed = { message: 'Verbinding mislukt. Controleer of LifeBuddy draait en probeer het opnieuw.' };
        }
        const stopped = controller.signal.aborted;
        controller = null;
        setBusy(false);
        const live = log.querySelector('.bd-live');
        if (answer.trim()) {
            live?.classList.remove('bd-live');
            history.push({ role: 'assistant', message: answer.trim() });
            if (stopped) live?.querySelector('.bd-bubble')?.insertAdjacentHTML('beforeend', '<p class="bd-note">Gestopt</p>');
            if (failed) log.insertAdjacentHTML('beforeend', `<p class="bd-note bd-note-error" role="alert">${escapeHtml(failed.message)}</p>`);
            document.dispatchEvent(new CustomEvent('buddy:reply-complete'));
        } else if (failed) {
            history.pop(); // keep local state aligned with the server, which does not store failed answers
            showError(failed.message, true);
        } else { live?.remove(); }
        if (stopped) input.focus();
    }
    form.addEventListener('submit', (event) => { event.preventDefault(); if (busy) controller?.abort(); else sendMessage(input.value); });
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy) sendMessage(input.value); } });
    function autosize() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 132)}px`; }
    input.addEventListener('input', autosize);
    log.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-bd-suggestion]');
        if (chip) return sendMessage(SUGGESTIONS[Number(chip.dataset.bdSuggestion)].prompt);
        if (event.target.closest('[data-bd-retry]')) { log.querySelector('.bd-error')?.remove(); [...log.querySelectorAll('.bd-msg.bd-user')].pop()?.remove(); sendMessage(lastMessage); }
    });

    // ---------- panel ----------
    function setOpen(open, { focus = true } = {}) {
        panel.hidden = !open;
        launcher.setAttribute('aria-expanded', String(open));
        try { sessionStorage.setItem('lifebuddy-buddy-open', open ? '1' : '0'); } catch { /* ignore */ }
        if (open) { loadHistory().then(() => scrollToLatest(true)); if (focus) requestAnimationFrame(() => input.focus()); }
        else if (focus) launcher.focus();
    }
    launcher.addEventListener('click', () => setOpen(panel.hidden));
    $('#bdClose').addEventListener('click', () => setOpen(false));
    $('#bdCustomize').addEventListener('click', (event) => { const box = $('#bdCustomizer'); box.hidden = !box.hidden; event.currentTarget.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) $('#bdName').focus(); });
    $('#bdName').addEventListener('change', (event) => { prefs.name = event.target.value.trim().slice(0, 18) || 'Buddy'; savePrefs(); applyPrefs(); if (historyLoaded) renderHistory(); });
    root.querySelectorAll('[data-bd-color]').forEach((b) => b.addEventListener('click', () => { prefs.color = b.dataset.bdColor; savePrefs(); applyPrefs(); }));
    root.querySelectorAll('[data-bd-acc]').forEach((b) => b.addEventListener('click', () => { prefs.accessory = b.dataset.bdAcc; savePrefs(); applyPrefs(); }));
    $('#bdHide').addEventListener('click', () => { prefs.hidden = true; savePrefs(); setOpen(false, { focus: false }); applyPrefs(); $('#buddyRestore').focus(); });
    $('#buddyRestore').addEventListener('click', () => { prefs.hidden = false; savePrefs(); applyPrefs(); setOpen(true); });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || panel.hidden) return;
        if (document.querySelector('.friend-profile-modal:not([hidden]), .study-modal:not([hidden])')) return;
        setOpen(false);
    });

    // Other parts of the app can open the buddy with a prepared question: document.dispatchEvent(new CustomEvent('buddy:open', { detail: { prompt } })).
    document.addEventListener('buddy:open', (event) => {
        if (prefs.hidden) { prefs.hidden = false; savePrefs(); applyPrefs(); }
        setOpen(true);
        const prompt = event.detail && event.detail.prompt;
        if (prompt && !busy) { input.value = prompt; autosize(); input.focus(); }
    });
    applyPrefs();
    renderHistory();
    // Stay open while moving between pages, so the buddy feels persistent.
    let wasOpen = false; try { wasOpen = sessionStorage.getItem('lifebuddy-buddy-open') === '1'; } catch { /* ignore */ }
    if (wasOpen && !prefs.hidden) setOpen(true, { focus: false });
})();
