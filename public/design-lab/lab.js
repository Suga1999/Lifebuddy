/*
 * LifeBuddy design lab (Step 3) — internal exploration tool, not part of the product.
 * Renders the Overview and the Gradebook in four interpretations of the same design language.
 * Data: a realistic Dutch demo student, or the logged-in user's own tasks and grades (?data=mine).
 * Everything here is visual comparison only; nothing is saved.
 */
(function () {
    'use strict';
    const $ = (selector, root = document) => root.querySelector(selector);
    const params = new URLSearchParams(location.search);
    const state = {
        v: Math.min(5, Math.max(1, Number(params.get('v')) || 1)),
        view: params.get('view') === 'grades' ? 'grades' : 'overview',
        theme: params.get('theme') === 'light' ? 'light' : 'dark',
        data: params.get('data') === 'mine' ? 'mine' : 'demo',
        chrome: params.get('chrome') !== '0'
    };

    const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = (n, digits = 1) => Number(n).toFixed(digits).replace('.', ',');
    const startOfDay = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
    const TODAY = startOfDay(new Date());
    const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
    const daysFromToday = (date) => Math.round((startOfDay(date) - TODAY) / 86400000);
    const iso = (date) => date.toISOString().slice(0, 10);
    const NL_DATE = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });
    const NL_WEEKDAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'long' });
    const words = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien'];
    const numberWord = (n) => (n >= 0 && n <= 10 ? words[n] : String(n));

    /* ---------- demo data: one believable student ---------- */
    const SUBJECT_KEYS = ['wis', 'ned', 'eng', 'ges', 'bio', 'fra'];
    function demoData() {
        const d = (n) => iso(addDays(TODAY, n));
        const subject = (key, name, grades, mastery) => ({ key, name, grades: grades.map(([label, grade, weight, period, offset]) => ({ label, grade, weight, period, date: d(offset) })), mastery });
        return {
            student: 'Sanne',
            streak: 6,
            subjects: [
                subject('wis', 'Wiskunde B', [['Hoofdstuk 4 toets', 6.2, 2, 'V3', -78], ['Differentiëren SO', 5.4, 1, 'V3', -61], ['Hoofdstuk 5 toets', 5.6, 2, 'V4', -27], ['Hoofdstuk 6 toets', 6.1, 3, 'V4', -17], ['Kansrekening SO', 4.9, 1, 'V4', -6]], null),
                subject('ned', 'Nederlands', [['Betoog', 7.1, 2, 'V3', -74], ['Leesdossier', 6.6, 1, 'V3', -55], ['Debat', 7.8, 2, 'V4', -30], ['Spelling toets', 6.9, 1, 'V4', -19], ['Schrijfopdracht', 7.4, 2, 'V4', -4]], null),
                subject('eng', 'Engels', [['Speaking', 8.0, 1, 'V3', -72], ['Reading toets', 7.6, 2, 'V3', -57], ['Writing: formal letter', 8.1, 2, 'V4', -26], ['Vocabulary test', 7.9, 1, 'V4', -15], ['Listening', 8.4, 1, 'V4', -3]], { name: 'Vocabulary H5', value: 0.82 }),
                subject('ges', 'Geschiedenis', [['Tijdvak 5 toets', 7.0, 2, 'V3', -66], ['Tijdvak 6 toets', 6.8, 2, 'V4', -22], ['Presentatie', 7.5, 1, 'V4', -9]], null),
                subject('bio', 'Biologie', [['Hoofdstuk 3 toets', 6.4, 2, 'V3', -70], ['Practicum', 7.2, 1, 'V3', -52], ['Hoofdstuk 4 toets', 6.9, 2, 'V4', -24], ['Practicumverslag', 7.6, 1, 'V4', -8]], { name: 'Begrippen H4', value: 0.64 }),
                subject('fra', 'Frans', [['Chapitre 2 toets', 6.7, 2, 'V3', -68], ['Oral', 7.0, 1, 'V3', -50], ['Chapitre 3 toets', 7.2, 2, 'V4', -20], ['Vocabulaire', 6.5, 1, 'V4', -11]], { name: 'Chapitre 3', value: 0.58 })
            ],
            tasks: [
                { id: 1, title: 'Engels: formal letter schrijven', subject: 'eng', due: d(-1), minutes: 30 },
                { id: 2, title: 'Oefentoets hoofdstuk 7', subject: 'wis', due: d(0), minutes: 40, next: true },
                { id: 3, title: 'Woordenlijst Frans leren', subject: 'fra', due: d(0), minutes: 15, study: true },
                { id: 4, title: 'Samenvatting hoofdstuk 4 afmaken', subject: 'bio', due: d(1), minutes: 45 },
                { id: 5, title: 'Practicum voorbereiden', subject: 'bio', due: d(3), minutes: 20 },
                { id: 6, title: 'Leesdossier: boek kiezen', subject: 'ned', due: d(4), minutes: 15 },
                { id: 7, title: 'Presentatie tijdvak 7 oefenen', subject: 'ges', due: d(6), minutes: 25 },
                { id: 8, title: 'Differentiëren: opgaven 6.1 t/m 6.8', subject: 'wis', due: d(9), minutes: 50 }
            ],
            doneThisWeek: 4,
            totalThisWeek: 9,
            tests: [
                { subject: 'wis', title: 'Wiskunde B-toets', date: d(3) },
                { subject: 'fra', title: 'Frans-toets', date: d(7) },
                { subject: 'ges', title: 'Geschiedenis-toets', date: d(8) }
            ],
            period: { name: 'V4', start: d(-35), end: d(35) }
        };
    }

    /* ---------- the user's own data (tasks, grades) ---------- */
    async function mineData() {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Log eerst in op LifeBuddy om je eigen data te zien.');
        const headers = { Authorization: `Bearer ${token}` };
        const [tasksResponse, subjectsResponse, statsResponse] = await Promise.all([fetch('/api/tasks', { headers }), fetch('/api/subjects', { headers }), fetch('/api/stats', { headers })]);
        if (!tasksResponse.ok || !subjectsResponse.ok) throw new Error('Je data kon niet worden geladen.');
        const tasks = await tasksResponse.json();
        const subjects = await subjectsResponse.json();
        const stats = statsResponse.ok ? await statsResponse.json() : {};
        let email = 'jij'; try { email = JSON.parse(atob(token.split('.')[1])).email || 'jij'; } catch { /* keep default */ }
        const hash = (text) => [...text].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const name = email.split('@')[0]; 
        return {
            student: name.charAt(0).toUpperCase() + name.slice(1),
            streak: Number(stats.streak) || 0,
            subjects: subjects.map((s) => ({ key: SUBJECT_KEYS[hash(s.name) % SUBJECT_KEYS.length], name: s.name, mastery: null, grades: (s.grades || []).map((g) => ({ label: g.label, grade: Number(g.grade), weight: Number(g.weight) || 1, period: g.period || 'Algemeen', date: g.date || null })).filter((g) => Number.isFinite(g.grade)) })),
            tasks: tasks.filter((t) => t.status !== 'completed').map((t) => ({ id: t.id, title: t.title, subject: null, due: t.due_date || null, minutes: null })),
            doneThisWeek: tasks.filter((t) => t.status === 'completed').length,
            totalThisWeek: tasks.length,
            tests: [],
            period: null
        };
    }

    /* ---------- calculations (same weighted logic as the real gradebook) ---------- */
    const weighted = (entries) => { const valid = entries.filter((e) => Number.isFinite(e.grade)); if (!valid.length) return null; const total = valid.reduce((s, e) => s + e.weight, 0); return valid.reduce((s, e) => s + e.grade * e.weight, 0) / total; };
    const periodsOf = (data) => { const set = new Set(); data.subjects.forEach((s) => s.grades.forEach((g) => set.add(g.period))); return [...set].sort((a, b) => a.localeCompare(b, 'nl', { numeric: true })); };
    function summarise(data) {
        const periods = periodsOf(data);
        const last = periods[periods.length - 1];
        const previous = periods[periods.length - 2];
        data.subjects.forEach((s) => {
            s.avg = weighted(s.grades);
            s.byPeriod = Object.fromEntries(periods.map((p) => [p, weighted(s.grades.filter((g) => g.period === p))]));
            s.delta = last && previous && s.byPeriod[last] !== null && s.byPeriod[previous] !== null ? s.byPeriod[last] - s.byPeriod[previous] : null;
            s.state = s.avg === null ? 'none' : s.avg < 6 ? 'attention' : s.avg >= 7.5 ? 'strong' : 'steady';
        });
        const withAvg = data.subjects.filter((s) => s.avg !== null);
        data.avg = withAvg.length ? withAvg.reduce((sum, s) => sum + s.avg, 0) / withAvg.length : null;
        data.periods = periods;
        data.currentPeriod = last;
        data.gradeCount = data.subjects.reduce((n, s) => n + s.grades.length, 0);
        data.attention = withAvg.filter((s) => s.state === 'attention');
        const everyGrade = data.subjects.flatMap((s) => s.grades.filter((g) => g.date).map((g) => ({ ...g, subject: s })));
        data.latestGrade = everyGrade.sort((a, b) => b.date.localeCompare(a.date))[0] || null;
        data.tests.sort((a, b) => a.date.localeCompare(b.date));
        data.tests.forEach((t) => { t.days = daysFromToday(t.date); t.subjectObj = data.subjects.find((s) => s.key === t.subject); });
        data.tasks.forEach((t) => { t.days = t.due ? daysFromToday(t.due) : null; t.subjectObj = data.subjects.find((s) => s.key === t.subject) || null; });
        if (data.period) {
            const start = new Date(data.period.start), end = new Date(data.period.end);
            data.period.weeks = Math.round((end - start) / 604800000);
            data.period.week = Math.min(data.period.weeks, Math.max(1, Math.floor((TODAY - start) / 604800000) + 1));
            data.period.now = Math.min(1, Math.max(0, (TODAY - start) / (end - start)));
            data.tests.forEach((t) => { t.pos = Math.min(1, Math.max(0, (new Date(t.date) - start) / (end - start))); });
        }
        return data;
    }

    /* ---------- language ---------- */
    const dayLabel = (days) => days === null ? '' : days < -1 ? `${-days} dagen te laat` : days === -1 ? 'gisteren' : days === 0 ? 'vandaag' : days === 1 ? 'morgen' : days < 7 ? NL_WEEKDAY.format(addDays(TODAY, days)) : NL_DATE.format(addDays(TODAY, days));
    const countdown = (days) => days <= 0 ? 'vandaag' : days === 1 ? 'morgen' : days === 7 ? 'volgende week' : `over ${days} dagen`;
    const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'; };
    const dateLabel = () => NL_WEEKDAY.format(TODAY).replace(/^./, (c) => c.toUpperCase()) + ' ' + new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long' }).format(TODAY);

    /* ---------- building blocks ---------- */
    const col = (subject) => (subject ? `style="--c:var(--s-${subject.key})"` : '');
    const grade = (value, extra = '') => value === null || value === undefined ? '<span class="gr none">—</span>' : `<span class="gr ${value < 5.5 ? 'low' : ''} ${extra}">${fmt(value)}</span>`;
    function spark(subject) {
        const values = subject.grades.filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date)).map((g) => g.grade);
        if (values.length < 2) return '<span class="none">—</span>';
        const w = 64, h = 20, min = Math.min(...values) - 0.4, max = Math.max(...values) + 0.4;
        const pts = values.map((v, i) => [Math.round((i / (values.length - 1)) * (w - 4)) + 2, Math.round(h - 3 - ((v - min) / (max - min)) * (h - 6))]);
        const last = pts[pts.length - 1];
        return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.2" style="fill:var(--c, currentColor)"/></svg>`;
    }
    function ink(value) { // mastery as five quiet steps
        const filled = Math.round(value * 5);
        return `<span class="ink" role="img" aria-label="${Math.round(value * 100)} procent geleerd">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('')}</span>`;
    }
    function trend(subject) {
        if (subject.delta === null) return '<span class="none">—</span>';
        const cls = subject.delta > 0.15 ? 'up' : subject.delta < -0.15 ? 'down' : 'flat';
        const arrow = cls === 'up' ? '↑' : cls === 'down' ? '↓' : '→';
        return cls === 'flat' ? '<span class="trend flat">→ gelijk</span>' : `<span class="trend ${cls}">${arrow} ${subject.delta > 0 ? '+' : '−'}${fmt(Math.abs(subject.delta))}</span>`;
    }
    const stateLabel = (s) => s.state === 'attention' ? '<span class="state attention">Aandacht</span>' : s.state === 'strong' ? '<span class="state strong">Sterk</span>' : s.state === 'steady' ? '<span class="state">Stabiel</span>' : '';
    function taskRow(task, opts = {}) {
        const due = task.days === null ? '' : `<span class="due ${task.days < 0 ? 'overdue' : task.days === 0 ? 'today' : ''}">${dayLabel(task.days)}</span>`;
        const meta = [task.subjectObj ? task.subjectObj.name : '', opts.minutes && task.minutes ? `${task.minutes} min` : ''].filter(Boolean).join(' · ');
        return `<li class="row" ${col(task.subjectObj)}><button class="chk" type="button" aria-label="Markeer ${esc(task.title)} als gedaan"></button><span class="spine" aria-hidden="true"></span><span class="t">${esc(task.title)}</span>${meta ? `<span class="sub">${esc(meta)}</span>` : ''}${due}</li>`;
    }
    const groupTasks = (tasks) => ({
        overdue: tasks.filter((t) => t.days !== null && t.days < 0),
        today: tasks.filter((t) => t.days === 0),
        week: tasks.filter((t) => t.days !== null && t.days > 0 && t.days < 7),
        later: tasks.filter((t) => t.days === null || t.days >= 7)
    });
    const section = (title, count, body, extra = '') => `<section class="sec ${extra}"><div class="sec-head"><h2>${title}${count !== null ? ` <span class="count">${count}</span>` : ''}</h2></div>${body}</section>`;
    const list = (tasks, opts) => `<ul class="rows">${tasks.map((t) => taskRow(t, opts)).join('')}</ul>`;
    const tabsHtml = (data) => {
        const total = data.gradeCount;
        const items = [['all', 'Alle perioden', total], ...data.periods.map((p) => [p, p, data.subjects.reduce((n, s) => n + s.grades.filter((g) => g.period === p).length, 0)])];
        return `<div class="tabs" role="tablist">${items.map(([key, label, n], i) => `<button type="button" role="tab" aria-selected="${i === 0}" class="${i === 0 ? 'on' : ''}">${esc(label)} <span class="count">${n}</span></button>`).join('')}</div>`;
    };
    const buddyNote = (text, prompt, cta) => `<p class="margin-note"><span class="bd-glyph" aria-hidden="true"></span><span><b>Buddy</b> ${text} <button type="button" class="link" data-buddy-prompt="${esc(prompt)}">${cta}</button></span></p>`;

    /* ---------- period line ---------- */
    function periodBar(data) {
        const p = data.period; if (!p) return '';
        const next = data.tests[0];
        const ticks = data.tests.map((t) => `<u class="tick" style="left:${(t.pos * 100).toFixed(1)}%;--c:var(--s-${t.subject})" title="${esc(t.title)} · ${countdown(t.days)}"></u>`).join('');
        return `<div class="pl" role="img" aria-label="Periode ${esc(p.name)}, week ${p.week} van ${p.weeks}"><span class="pl-label">Periode ${esc(p.name)} · week ${p.week} van ${p.weeks}</span><div class="pl-track"><i class="pl-fill" style="width:${(p.now * 100).toFixed(1)}%"></i>${ticks}<b class="pl-now" style="left:${(p.now * 100).toFixed(1)}%"></b></div>${next ? `<span class="pl-next" style="--c:var(--s-${next.subject})"><i class="dot"></i>${esc(next.title)} ${countdown(next.days)}</span>` : ''}</div>`;
    }
    function periodTimeline(data) {
        const p = data.period; if (!p) return '';
        const ticks = data.tests.map((t) => `<u class="tick" style="left:${(t.pos * 100).toFixed(1)}%;--c:var(--s-${t.subject})"></u>`).join('');
        const weeks = Array.from({ length: p.weeks }, (_, i) => `<span class="${i + 1 === p.week ? 'now' : ''}">${i + 1}</span>`).join('');
        const legend = data.tests.map((t) => `<li style="--c:var(--s-${t.subject})"><i class="dot"></i><b>${esc(t.subjectObj ? t.subjectObj.name : t.title)}</b> <span>${countdown(t.days)}</span></li>`).join('');
        return `<section class="pt" aria-label="Periode ${esc(p.name)}"><div class="pt-head"><h2>Periode ${esc(p.name)}</h2><span class="pt-sub">week ${p.week} van ${p.weeks}</span></div><div class="pt-track"><i class="pl-fill" style="width:${(p.now * 100).toFixed(1)}%"></i>${ticks}<b class="pl-now" style="left:${(p.now * 100).toFixed(1)}%"></b></div><div class="pt-weeks" aria-hidden="true">${weeks}</div>${legend ? `<ul class="pt-tests">${legend}</ul>` : ''}</section>`;
    }

    /* ---------- sidebar ---------- */
    function sidebar(data, mode) {
        const items = [['overview', 'Overzicht'], ['', 'Taken'], ['grades', 'Cijfers'], ['', 'Studieruimte'], ['', 'Focus']];
        const nav = items.map(([go, label]) => `<a class="sb-item ${(go === state.view) ? 'on' : ''}" ${go ? `data-go="${go}" href="#"` : 'href="#" aria-disabled="true"'}>${label}</a>`).join('');
        const subjects = mode === 'none' ? '' : `<div class="sb-label">Vakken</div>${data.subjects.map((s) => `<a class="sb-item sb-subject" href="#" ${col(s)}><span class="spine"></span><span class="sb-name">${esc(s.name)}</span>${mode === 'grades' && s.avg !== null ? `<span class="sb-avg">${fmt(s.avg)}</span>` : ''}</a>`).join('')}`;
        return `<aside class="sb"><a class="sb-brand" href="#">Life<span>Buddy</span></a><nav>${nav}${subjects}</nav><div class="sb-foot"><span class="avatar">${esc(data.student[0] || 'L')}</span><span class="sb-user">${esc(data.student)}</span></div></aside>`;
    }

    /* ======================= OVERVIEW VARIANTS ======================= */
    const leadSentence = (data) => {
        const open = data.tasks.filter((t) => t.days !== null && t.days <= 0);
        const parts = [];
        if (open.length) parts.push(`${open.length} ${open.length === 1 ? 'taak' : 'taken'} voor vandaag`);
        const next = data.tests[0]; if (next) parts.push(`${next.title} ${countdown(next.days)}`);
        if (data.avg !== null) parts.push(`gemiddelde ${fmt(data.avg)}`);
        return parts.join(' · ') || 'Een rustige start. Voeg een taak toe of open de Studieruimte.';
    };

    function overview1(data) {
        const g = groupTasks(data.tasks);
        const next = data.tasks.find((t) => t.next) || g.today[0] || g.overdue[0];
        const nextRow = next ? `<div class="next" ${col(next.subjectObj)}><span class="spine"></span><div><span class="eyebrow">Volgende stap</span><strong>${esc(next.title)}</strong><span class="sub">${[next.subjectObj && next.subjectObj.name, next.minutes && `ongeveer ${next.minutes} min`].filter(Boolean).join(' · ')}</span></div><button class="btn-primary" type="button">Start</button></div>` : '';
        const groups = [['Achterstallig', g.overdue], ['Vandaag', g.today], ['Deze week', g.week], ['Later', g.later]].filter(([, t]) => t.length).map(([title, t]) => section(title, t.length, list(t, { minutes: true }))).join('');
        const tests = data.tests.length ? section('Toetsen', data.tests.length, `<ul class="rows plain">${data.tests.map((t) => `<li class="row" ${col(t.subjectObj)}><span class="spine"></span><span class="t">${esc(t.subjectObj ? t.subjectObj.name : t.title)}</span><span class="due">${countdown(t.days)}</span></li>`).join('')}</ul>`) : '';
        const progress = section('Voortgang', null, `<dl class="metrics"><div><dt>Taken deze week</dt><dd>${data.doneThisWeek} van ${data.totalThisWeek}</dd><div class="bar"><i style="width:${Math.round((data.doneThisWeek / Math.max(1, data.totalThisWeek)) * 100)}%"></i></div></div><div><dt>Gemiddelde</dt><dd>${data.avg === null ? '—' : grade(data.avg)}</dd></div><div><dt>Ritme</dt><dd>${data.streak} ${data.streak === 1 ? 'dag' : 'dagen'} op rij</dd></div></dl>`);
        return `${sidebar(data, 'names')}<main class="main"><div class="inner">${periodBar(data)}<header class="head"><div><p class="date">${dateLabel()}</p><h1>Goed je te zien, ${esc(data.student)}.</h1><p class="lead">${esc(leadSentence(data))}</p></div><button class="btn-primary" type="button">Nieuwe taak</button></header><div class="cols"><div class="col-main">${nextRow}${groups}</div><aside class="col-rail">${tests}${progress}</aside></div></div></main>`;
    }

    function overview2(data) {
        const g = groupTasks(data.tasks);
        const today = [...g.overdue, ...g.today];
        const rest = [...g.week, ...g.later];
        const todayCount = today.length;
        const first = data.tasks.find((t) => t.study && t.days <= 0) || today[0];
        const note = buddyNote(todayCount ? `Rustig aan. Begin met “${esc(first.title)}”${first.minutes ? ` (${first.minutes} min)` : ''}, daarna de rest.` : 'Geen haast vandaag. Zal ik een rustige studieplanning maken?', 'Help me mijn studieweek te plannen. Vraag eerst wat ik moet doen en wanneer mijn deadlines zijn.', 'Plan met Buddy');
        const tests = data.tests.length ? section('Binnenkort', null, `<ul class="rows plain big">${data.tests.map((t) => `<li class="row" ${col(t.subjectObj)}><span class="spine"></span><span class="t">${esc(t.title)}</span><span class="due">${countdown(t.days)} · ${NL_DATE.format(new Date(t.date))}</span></li>`).join('')}</ul>`) : '';
        const closing = `<p class="closing">Deze week heb je <b>${data.doneThisWeek} van ${data.totalThisWeek}</b> taken afgerond${data.subjects.find((s) => s.mastery) ? ` en <b>${Math.round(data.subjects.find((s) => s.key === 'fra' && s.mastery) ? data.subjects.find((s) => s.key === 'fra').mastery.value * 100 : 60)}%</b> van je Frans-woorden geleerd` : ''}. ${data.streak} ${data.streak === 1 ? 'dag' : 'dagen'} op rij.</p>`;
        return `${sidebar(data, 'names')}<main class="main"><div class="inner"><header class="head"><p class="date">${dateLabel()}${data.period ? ` · periode ${esc(data.period.name)}, week ${data.period.week}` : ''}</p><h1>${greeting()}, ${esc(data.student)}.</h1>${note}</header>${section('Vandaag', todayCount, list(today, { minutes: true }) + `<button type="button" class="link add">+ Taak toevoegen</button>`)}${rest.length ? section('Later deze week', rest.length, list(rest)) : ''}${tests}${closing}</div></main>`;
    }

    function overview3(data) {
        const g = groupTasks(data.tasks);
        const today = [...g.overdue, ...g.today];
        const testRows = data.tests.map((t) => { const s = t.subjectObj; return `<li class="row test" ${col(s)}><span class="spine"></span><span class="t"><b>${esc(s ? s.name : '')}</b> <span class="sub">${esc(t.title.replace(/^.*?-?toets/i, 'toets'))}</span></span><span class="when">${countdown(t.days)}</span>${s && s.mastery ? `<span class="mast">${ink(s.mastery.value)}<small>woorden</small></span>` : '<span class="mast"></span>'}<span class="avg">${s ? grade(s.avg) : ''}</span></li>`; }).join('');
        const subj = data.subjects.map((s) => `<li class="row subj" ${col(s)}><span class="spine"></span><span class="t">${esc(s.name)}</span>${trend(s)}<span class="avg">${grade(s.avg)}</span></li>`).join('');
        return `${sidebar(data, 'grades')}<main class="main"><div class="inner">${periodTimeline(data)}<header class="head compact"><h1>Goed je te zien, ${esc(data.student)}.</h1><p class="lead">${esc(leadSentence(data))}</p></header><div class="cols"><div class="col-main">${data.tests.length ? section('Aankomende toetsen', data.tests.length, `<ul class="rows tests">${testRows}</ul>`) : ''}${section('Vandaag', today.length, list(today, { minutes: true }))}${section('Later deze week', g.week.length + g.later.length, list([...g.week, ...g.later]))}</div><aside class="col-rail">${section('Vakken', data.subjects.length, `<ul class="rows plain">${subj}</ul>`)}<p class="rail-note">Gemiddelde <b>${data.avg === null ? '—' : fmt(data.avg)}</b>${data.attention.length ? ` · <span class="attn">${esc(data.attention.map((s) => s.name).join(', '))} vraagt aandacht</span>` : ''}</p></aside></div></div></main>`;
    }

    function overview4(data) {
        const g = groupTasks(data.tasks);
        const today = [...g.overdue, ...g.today];
        const later = [...g.week, ...g.later];
        const n = today.length;
        const next = data.tests[0];
        const lead = n ? `Je hebt vandaag ${numberWord(n)} ${n === 1 ? 'ding' : 'dingen'} te doen${next ? `, en je ${next.subjectObj ? next.subjectObj.name + '-' : ''}toets is ${countdown(next.days)}` : ''}.` : `Je lijst voor vandaag is leeg${next ? `, en je ${next.subjectObj ? next.subjectObj.name + '-' : ''}toets is ${countdown(next.days)}` : ''}.`;
        const quiet = today.map((t) => `<li class="row" ${col(t.subjectObj)}><button class="chk" type="button" aria-label="Markeer ${esc(t.title)} als gedaan"></button><span class="t">${esc(t.title)}</span><span class="sub">${esc(t.subjectObj ? t.subjectObj.name : '')}</span>${t.days < 0 ? `<span class="due overdue">${dayLabel(t.days)}</span>` : ''}</li>`).join('');
        const note = buddyNote('kan je dag voor je plannen.', 'Help me mijn studieweek te plannen. Vraag eerst wat ik moet doen en wanneer mijn deadlines zijn.', 'Plan mijn dag');
        return `${sidebar(data, 'none')}<main class="main"><div class="inner"><header class="head"><p class="date">${dateLabel()}</p><h1>${greeting()}, ${esc(data.student)}.</h1><p class="lead">${esc(lead)}</p>${data.period ? `<p class="quiet">Periode ${esc(data.period.name)}, week ${data.period.week} van ${data.period.weeks}.</p>` : ''}</header>${section('Vandaag', null, `<ul class="rows">${quiet}</ul>`)}${later.length ? `<p class="more"><button type="button" class="link">${later.length} ${later.length === 1 ? 'taak' : 'taken'} later deze week</button></p>` : ''}<p class="more"><button type="button" class="link add">+ Nieuwe taak</button></p>${note}</div></main>`;
    }

    /* ======================= GRADEBOOK VARIANTS ======================= */
    function detailRows(subject, columns) {
        const rows = [...subject.grades].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return `<tr class="detail"><td colspan="${columns}"><table class="sub-table"><thead><tr><th>Toets</th><th>Datum</th><th class="hide-sm">Periode</th><th class="num">Cijfer</th><th class="num hide-sm">Weging</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="muted">${r.date ? NL_DATE.format(new Date(r.date)) : '—'}</td><td class="muted hide-sm">${esc(r.period)}</td><td class="num">${grade(r.grade)}</td><td class="num muted hide-sm">${fmt(r.weight, Number.isInteger(r.weight) ? 0 : 1)}×</td></tr>`).join('')}</tbody></table></td></tr>`;
    }
    const gbSummary = (data) => `<p class="gb-summary"><span>Gemiddelde <b>${data.avg === null ? '—' : fmt(data.avg)}</b></span><span>${data.subjects.length} vakken</span><span class="${data.attention.length ? 'attn' : ''}">${data.attention.length ? `${data.attention.length} vraagt aandacht` : 'Alles op koers'}</span>${data.latestGrade ? `<span>Laatste cijfer <b>${fmt(data.latestGrade.grade)}</b> ${esc(data.latestGrade.subject.name)}</span>` : ''}</p>`;
    const gbActions = '<div class="gb-actions"><button type="button" class="btn-ghost">Importeren</button><button type="button" class="btn-ghost strong">Cijfer toevoegen</button></div>';
    const periodHeads = (data, cls = '') => data.periods.map((p) => `<th class="num ${cls}">${esc(p)}</th>`).join('');
    const periodCells = (data, s) => data.periods.map((p) => `<td class="num">${grade(s.byPeriod[p])}</td>`).join('');

    function gradebook1(data) {
        const open = data.subjects.find((s) => s.state === 'attention') || data.subjects[0];
        const rows = data.subjects.map((s) => `<tr ${col(s)} class="${s === open ? 'open' : ''}"><th scope="row"><span class="spine"></span><span class="caret">${s === open ? '⌄' : '›'}</span>${esc(s.name)} <small>${s.grades.length}</small></th>${periodCells(data, s)}<td class="num total">${grade(s.avg, 'strong')}</td><td class="num">${trend(s)}</td></tr>${s === open ? detailRows(s, data.periods.length + 3) : ''}`).join('');
        return `${sidebar(data, 'names')}<main class="main"><div class="inner wide"><header class="head compact"><h1>Cijfers</h1>${gbActions}</header>${gbSummary(data)}${tabsHtml(data)}<div class="table-wrap"><table class="gb"><thead><tr><th>Vak</th>${periodHeads(data)}<th class="num total">Gemiddeld</th><th class="num">Trend</th></tr></thead><tbody>${rows}</tbody></table></div></div></main>`;
    }

    function gradebook2(data) {
        const attention = data.attention[0];
        const note = data.avg === null ? '' : buddyNote(`Je gemiddelde staat op ${fmt(data.avg)}.${attention ? ` ${esc(attention.name)} vraagt aandacht${data.tests.find((t) => t.subject === attention.key) ? `, en die toets is ${countdown(data.tests.find((t) => t.subject === attention.key).days)}` : ''}.` : ' Mooi werk.'}`, attention ? `Help me met ${attention.name}. Mijn gemiddelde is ${fmt(attention.avg)}. Wat kan ik het beste eerst oefenen?` : 'Wat kan ik doen om mijn cijfers vast te houden?', attention ? `Oefenen met ${esc(attention.name)}` : 'Vraag Buddy');
        const rows = data.subjects.map((s) => `<tr ${col(s)}><th scope="row"><span class="spine"></span>${esc(s.name)}</th>${periodCells(data, s)}<td class="num total">${grade(s.avg, 'strong')}</td></tr>`).join('');
        return `${sidebar(data, 'names')}<main class="main"><div class="inner"><header class="head"><h1>Je cijfers</h1>${note}</header>${tabsHtml(data)}<div class="table-wrap"><table class="gb soft"><thead><tr><th>Vak</th>${periodHeads(data)}<th class="num total">Gemiddeld</th></tr></thead><tbody>${rows}</tbody></table></div>${gbActions}</div></main>`;
    }

    function gradebook3(data) {
        const open = data.subjects.find((s) => s.state === 'attention') || data.subjects[0];
        const rows = data.subjects.map((s) => { const t = data.tests.find((x) => x.subject === s.key); return `<tr ${col(s)}><th scope="row"><span class="spine"></span>${esc(s.name)}</th><td class="when">${t ? countdown(t.days) : '<span class="none">—</span>'}</td>${periodCells(data, s)}<td class="num total">${grade(s.avg, 'strong')}</td><td class="num">${spark(s)} ${trend(s)}</td><td>${s.mastery ? `${ink(s.mastery.value)}<small class="mast-label">${esc(s.mastery.name)}</small>` : '<span class="none">—</span>'}</td><td>${stateLabel(s)}</td></tr>${s === open ? detailRows(s, data.periods.length + 6) : ''}`; }).join('');
        return `${sidebar(data, 'grades')}<main class="main"><div class="inner wide">${periodTimeline(data)}<header class="head compact"><h1>Cijfers</h1>${gbActions}</header>${gbSummary(data)}${tabsHtml(data)}<div class="table-wrap"><table class="gb"><thead><tr><th>Vak</th><th>Volgende toets</th>${periodHeads(data)}<th class="num total">Gemiddeld</th><th class="num">Verloop</th><th>Woorden</th><th>Stand</th></tr></thead><tbody>${rows}</tbody></table></div></div></main>`;
    }

    function gradebook4(data) {
        const rows = data.subjects.map((s) => `<tr ${col(s)}><th scope="row"><span class="spine"></span>${esc(s.name)} <small>${s.grades.length}</small></th>${periodCells(data, s)}<td class="num total">${grade(s.avg, 'strong')}</td></tr>`).join('');
        const log = data.subjects.flatMap((s) => s.grades.map((g) => ({ ...g, s }))).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 12).map((g) => `<tr ${col(g.s)}><td class="muted">${g.date ? NL_DATE.format(new Date(g.date)) : '—'}</td><th scope="row"><span class="spine"></span>${esc(g.s.name)}</th><td>${esc(g.label)}</td><td class="muted hide-sm">${esc(g.period)}</td><td class="num muted hide-sm">${fmt(g.weight, Number.isInteger(g.weight) ? 0 : 1)}×</td><td class="num">${grade(g.grade)}</td></tr>`).join('');
        return `${sidebar(data, 'none')}<main class="main"><div class="inner wide"><header class="head"><h1>Cijfers</h1><p class="lead">${data.avg === null ? 'Nog geen cijfers.' : `Je gemiddelde staat op ${fmt(data.avg)}${data.attention.length ? `. ${esc(data.attention.map((s) => s.name).join(' en '))} vraagt aandacht` : ''}.`}</p>${gbActions}</header><div class="table-wrap"><table class="gb"><thead><tr><th>Vak</th>${periodHeads(data)}<th class="num total">Gemiddeld</th></tr></thead><tbody>${rows}</tbody></table></div><h2 class="log-title">Laatste cijfers</h2><div class="table-wrap"><table class="gb log"><thead><tr><th>Datum</th><th>Vak</th><th>Toets</th><th class="hide-sm">Periode</th><th class="num hide-sm">Weging</th><th class="num">Cijfer</th></tr></thead><tbody>${log}</tbody></table></div></div></main>`;
    }

    const RENDER = { overview: [overview1, overview2, overview3, overview4], grades: [gradebook1, gradebook2, gradebook3, gradebook4] };
    const NAMES = ['Calm Ledger', 'Warm Study Desk', 'Modern Academic', 'Quiet Personal Workspace', 'Jouw keuze (Overzicht 3 + Cijfers 4)'];
    // Variant 5 is the chosen combination: Overview from variant 3, Gradebook from variant 4.
    const effective = () => (state.v === 5 ? (state.view === 'grades' ? 4 : 3) : state.v);

    /* ---------- lab chrome ---------- */
    function renderBar() {
        const bar = $('#labBar');
        bar.hidden = !state.chrome;
        const seg = (key, options) => `<div class="seg" role="group">${options.map(([value, label]) => `<button type="button" data-set="${key}" data-value="${value}" aria-pressed="${String(state[key]) === String(value)}">${label}</button>`).join('')}</div>`;
        bar.innerHTML = `<span class="lab-tag">Design lab</span>${seg('v', [[1, '1 Ledger'], [2, '2 Desk'], [3, '3 Academic'], [4, '4 Quiet'], [5, '★ Jouw keuze']])}${seg('view', [['overview', 'Overzicht'], ['grades', 'Cijfers']])}${seg('theme', [['dark', 'Donker'], ['light', 'Licht']])}${seg('data', [['demo', 'Demo'], ['mine', 'Mijn data']])}`;
    }
    let cache = {};
    async function render() {
        document.body.className = `v${effective()} theme-${state.theme}${state.chrome ? '' : ' nochrome'}`;
        document.documentElement.dataset.theme = state.theme;
        renderBar();
        const app = $('#app');
        if (!cache[state.data]) {
            try { cache[state.data] = summarise(state.data === 'mine' ? await mineData() : demoData()); }
            catch (error) { app.innerHTML = `<div class="lab-message"><p>${esc(error.message)}</p></div>`; return; }
        }
        app.innerHTML = `<div class="shell">${RENDER[state.view][effective() - 1](cache[state.data])}</div>`;
        document.title = `LifeBuddy design lab · ${NAMES[state.v - 1]} · ${state.view === 'grades' ? 'Cijfers' : 'Overzicht'}`;
    }
    function sync() { const q = new URLSearchParams({ v: state.v, view: state.view, theme: state.theme, data: state.data }); if (!state.chrome) q.set('chrome', '0'); history.replaceState(null, '', `?${q}`); }
    document.addEventListener('click', (event) => {
        const set = event.target.closest('[data-set]');
        if (set) { const key = set.dataset.set; state[key] = key === 'v' ? Number(set.dataset.value) : set.dataset.value; sync(); render(); return; }
        const go = event.target.closest('[data-go]');
        if (go) { event.preventDefault(); state.view = go.dataset.go; sync(); render(); return; }
        if (event.target.closest('a[href="#"]')) event.preventDefault();
        const chk = event.target.closest('.chk');
        if (chk) { chk.closest('.row').classList.toggle('done'); return; }
        const prompt = event.target.closest('[data-buddy-prompt]');
        if (prompt) document.dispatchEvent(new CustomEvent('buddy:open', { detail: { prompt: prompt.dataset.buddyPrompt } }));
    });
    render();
}());
