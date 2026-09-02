(() => {
    const storageKey = 'lifebuddy-language';
    const translations = {
        'LifeBuddy – Dashboard': 'LifeBuddy – Dashboard', 'LifeBuddy – Jouw persoonlijke commandocentrum': 'LifeBuddy – Your personal command center', 'LifeBuddy – Jouw muziek': 'LifeBuddy – Your music',
        'Prijzen': 'Pricing', 'Gratis starten': 'Get started free', 'Volledig werkende app': 'Fully working app',
        'Jouw persoonlijke': 'Your personal', 'commandocentrum': 'command center',
        'LifeBuddy combineert wellness, academie, taken en financiën in één donker dashboard – met een AI-coach en MP3 player.': 'LifeBuddy combines wellness, school, tasks and finances in one dark dashboard — with an AI coach and MP3 player.',
        'Start nu gratis': 'Start for free', 'Inloggen': 'Log in', 'Persoonlijke coach met chathistorie': 'Personal coach with chat history', 'Pro abonnement vanaf €4,99/maand': 'Pro plan from €4.99/month',
        'Functionaliteit': 'Features', 'Alles wat je nodig hebt,': 'Everything you need,', 'op één plek': 'in one place',
        'Persoonlijke begeleiding die meedenkt over je doelen, studie en welzijn.': 'Personal guidance that helps with your goals, studies and wellbeing.',
        'Academisch': 'School', 'Vakken, cijfers, deadlines en afspraken – altijd in beeld.': 'Subjects, grades, deadlines and appointments — always in view.',
        'Volg je slaap, stemming, beweging en bouw gezonde routines.': 'Track sleep, mood and movement, and build healthy routines.',
        'Slim taakbeheer': 'Smart task management', 'Prioriteiten stellen, reminders en een overzicht dat werkt.': 'Set priorities, get reminders and keep an overview that works.',
        'Financieel': 'Finances', 'Budgettering en uitgavenoverzicht – houd grip op je geld.': 'Budgeting and spending insights — stay in control of your money.',
        'Je eigen afspeellijsten, naadloos geïntegreerd in het dashboard.': 'Your own playlists, seamlessly integrated into the dashboard.',
        'Kies het plan dat': 'Choose the plan that', 'bij jou past': 'fits you', '/maand': '/month',
        'Basis functionaliteit om te starten.': 'Essential features to get started.', 'Max 5 vakken / afspraken': 'Unlimited subjects & appointments', 'Max 5 actieve taken': 'Max. 5 active tasks', 'Basis wellness-tracking': 'Basic wellness tracking', 'Taakbeheer': 'Task management', 'Donker thema': 'Dark theme', 'AI Coach (beperkt)': 'AI Coach (limited)',
        'Alles wat je nodig hebt voor maximale productiviteit.': 'Everything you need for maximum productivity.', 'Onbeperkt vakken & afspraken': 'Unlimited subjects & appointments', 'Onbeperkte taken': 'Unlimited tasks', 'Financiële module': 'Finance module', 'AI Coach met volledige chathistorie': 'AI Coach with full chat history', 'Diepgaande inzichten': 'In-depth insights', 'Upgrade naar Pro': 'Upgrade to Pro',
        '*Monetisering wordt pas geactiveerd nadat de app volledig live is.': '*Payments will only be activated once the app is fully live.',
        'Vragen': 'Questions', 'Veelgestelde': 'Frequently asked', 'vragen': 'questions', 'Is dit een echte werkende app?': 'Is this a real working app?',
        "Ja! Deze applicatie heeft een volledige backend met database, authenticatie, API's en een werkende frontend. Je kunt taken, vakken, chatgeschiedenis en playlists opslaan.": 'Yes! This app has a complete backend with a database, authentication, APIs and a working frontend. You can save tasks, subjects, chat history and playlists.',
        'Hoe start ik de app?': 'How do I start the app?', 'Werkt de MP3 Player echt?': 'Does the MP3 Player really work?', 'Ja! De MP3 Player gebruikt de Web Audio API om echte audiobestanden af te spelen. Je kunt je eigen tracks uploaden en playlists beheren.': 'Yes! The MP3 Player uses the Web Audio API to play real audio files. You can upload your own tracks and manage playlists.',
        'Kan ik betalen met Stripe?': 'Can I pay with Stripe?', 'De code is klaar voor Stripe-integratie. Momenteel is het een mock-systeem dat abonnementen simuleert. In productie kun je de Stripe API aansluiten.': 'The code is ready for Stripe integration. It currently uses a mock subscription system. In production, you can connect the Stripe API.',
        'Volledig werkende applicatie': 'Fully working application', 'Welkom terug': 'Welcome back', 'Log in op je LifeBuddy account': 'Log in to your LifeBuddy account', 'Wachtwoord': 'Password', 'Nog geen account?': 'No account yet?', 'Registreer': 'Sign up', 'Start met LifeBuddy': 'Start with LifeBuddy', 'Gratis account aanmaken': 'Create a free account', 'Naam': 'Name', 'Jouw naam': 'Your name', 'Minimaal 6 tekens': 'At least 6 characters', 'Registreren': 'Sign up', 'Al een account?': 'Already have an account?',
        'COMMAND CENTER': 'COMMAND CENTER', 'Overzicht': 'Overview', 'Taken': 'Tasks', 'Vakken': 'Subjects', 'Focus music': 'Focus music', 'Jouw class': 'Your class', 'Uitloggen': 'Log out', 'Jouw level en ervaring': 'Your level and experience',
        'JOUW DAGELIJKSE OVERZICHT': 'YOUR DAILY OVERVIEW', 'Goed bezig,': 'Great job,', 'vriend': 'friend', 'Een kleine stap vandaag is een groot verschil morgen.': 'A small step today makes a big difference tomorrow.', 'Nieuwe taak': 'New task', 'dagen': 'days', 'Begin vandaag je eigen ritme.': 'Start building your own rhythm today.', 'Mijn hoofd is rustig, mijn hart staat open en ik kan alles stap voor stap.': 'My mind is calm, my heart is open, and I can take everything one step at a time.', 'Focusmodus': 'Focus mode',
        'Open taken': 'Open tasks', 'Coach chats': 'Coach chats', 'Dagelijkse streak': 'Daily streak', 'JOUW VOORTGANG': 'YOUR PROGRESS', 'Week': 'Week', 'Maand': 'Month', 'Jaar': 'Year', 'Taakvoltooiing': 'Task completion', 'Voeg je eerste taak toe om je voortgang te zien.': 'Add your first task to see your progress.', 'Taken voltooid': 'Tasks completed', 'Cijfergemiddelde': 'Grade average', 'Coach-momenten': 'Coach moments', 'VANDAAG': 'TODAY', 'Komende taken': 'Upcoming tasks', 'Alles bekijken': 'View all', 'Je planning is helemaal vrij.': 'Your schedule is completely clear.', 'JE COLLECTIE': 'YOUR COLLECTION', 'Bijna ontgrendeld': 'Almost unlocked', 'Bekijk alles': 'View all',
        'PLANNING': 'PLANNING', 'Jouw taken': 'Your tasks', 'Maak ruimte in je hoofd door alles op één plek te plannen.': 'Clear your mind by planning everything in one place.', 'Wat wil je vandaag afronden?': 'What would you like to finish today?', 'Details (optioneel)': 'Details (optional)', 'Deadline': 'Due date', 'Toevoegen': 'Add', 'Nog geen taken. Wat is je eerste kleine stap?': 'No tasks yet. What is your first small step?',
        'STUDIE': 'STUDY', 'Jouw vakken': 'Your subjects', 'Houd je cijfers en je groei inzichtelijk.': 'Keep track of your grades and progress.', 'Vaknaam': 'Subject name', 'Kolom, bv. Periode 1': 'Column, e.g. Period 1', 'Cijfer (0–10)': 'Grade (0–10)', 'CIJFERLIJST IMPORTEREN': 'IMPORT GRADE LIST', 'Upload je CSV-bestand': 'Upload your CSV file', 'Bestand kiezen': 'Choose file', 'Nog geen bestand gekozen.': 'No file chosen yet.', 'Annuleren': 'Cancel', 'Importeer cijfers': 'Import grades', 'Vak': 'Subject', 'Gemiddelde': 'Average', 'Acties': 'Actions', 'Nog geen vakken. Voeg je eerste vak toe.': 'No subjects yet. Add your first subject.',
        'Jouw muziek': 'Your music', "Importeer je eigen MP3's en bouw een playlist voor je volgende focussessie.": 'Import your own MP3s and build a playlist for your next focus session.', 'JOUW LOKALE PLAYLIST': 'YOUR LOCAL PLAYLIST', 'Focus met jouw eigen muziek.': 'Focus with your own music.', "Je MP3-bestanden blijven lokaal opgeslagen in deze browser en worden niet naar een server geüpload.": 'Your MP3 files stay stored locally in this browser and are never uploaded to a server.', 'Open muziekspeler': 'Open music player',
        'GAMIFICATION': 'GAMIFICATION', 'Elke stap telt. Verzamel badges voor de gewoontes die je opbouwt.': 'Every step counts. Collect badges for the habits you build.', 'ontgrendeld': 'unlocked', 'JOUW SPEELSTIJL': 'YOUR PLAY STYLE', 'Kies je class': 'Choose your class', 'Je class geeft je een bonus die past bij jouw manier van studeren.': 'Your class gives you a bonus that fits your way of studying.', 'Je mag altijd wisselen. Kies een bonus die je helpt bij het doel dat nu het belangrijkst is.': 'You can always switch. Pick a bonus that helps with the goal that matters most right now.',
        'Een indrukwekkend ritme. Blijf zo doorgaan!': 'An impressive rhythm. Keep it going!', 'Je momentum groeit. Houd deze flow vast!': 'Your momentum is growing. Keep this flow going!', 'De eerste stap is gezet. Tot morgen!': 'The first step is done. See you tomorrow!', 'Klaar om te starten': 'Ready to start', 'Geen deadline': 'No due date', 'Klaar': 'Done', 'Open': 'Open',
        'JE CIRKEL': 'YOUR CIRCLE', 'Vrienden': 'Friends', 'Nodig studievrienden uit en bekijk hun voortgang.': 'Invite study friends and view their progress.', 'Vriend toevoegen': 'Add friend', 'E-mailadres van je vriend': "Your friend's email address", 'Stuur uitnodiging': 'Send invitation', 'Nog geen vrienden toegevoegd.': 'No friends added yet.', 'Sluit profiel': 'Close profile',
        'JOUW STUDIEMAATJE': 'YOUR STUDY BUDDY', 'is er voor je': 'is here for you', 'Personaliseer je huisdier': 'Customize your pet', 'Sluit chat': 'Close chat', 'Personaliseer je LifeBuddy': 'Customize your LifeBuddy', 'Naam van je maatje': "Your buddy's name", 'Kleur': 'Color', 'Accessoire': 'Accessory', 'Ster': 'Star', 'Boeken': 'Books', 'Rustig': 'Calm', 'Kroon': 'Crown', 'Vraag om hulp met plannen, leren of gewoon wat motivatie.': 'Ask for help with planning, studying or just some motivation.', 'Typ je bericht…': 'Type your message…', 'Verstuur bericht': 'Send message', 'Verberg je LifeBuddy': 'Hide your LifeBuddy', 'Toon je LifeBuddy': 'Show your LifeBuddy', 'Hoi, ik ben Buddy!': "Hi, I'm Buddy!",
        'JOUW FOCUSRUIMTE': 'YOUR FOCUS SPACE', 'Maak een lokale playlist met je eigen MP3-bestanden.': 'Create a local playlist with your own MP3 files.', 'Je playlist is nog leeg.': 'Your playlist is empty.', 'Voeg hieronder één of meerdere MP3-bestanden toe om te beginnen.': 'Add one or more MP3 files below to get started.', 'Geen nummer geselecteerd': 'No track selected', 'Lokale playlist': 'Local playlist', 'Eigen MP3': 'Personal MP3', 'Positie in nummer': 'Position in track', 'Vorig nummer': 'Previous track', 'Afspelen': 'Play', 'Pauzeren': 'Pause', 'Volgend nummer': 'Next track', 'Mijn playlist': 'My playlist', 'nummers': 'tracks', "Selecteer één of meerdere .mp3-bestanden. Ze worden alleen in deze browser opgeslagen; niets wordt naar LifeBuddy geüpload.": 'Select one or more .mp3 files. They are stored only in this browser; nothing is uploaded to LifeBuddy.', "MP3's toevoegen": 'Add MP3s', 'Klaar om muziek toe te voegen.': 'Ready to add music.', 'Nog geen nummers geïmporteerd.': 'No tracks imported yet.', 'De bestanden blijven op dit apparaat. Wis je browserdata niet als je deze playlist wilt behouden.': 'The files stay on this device. Do not clear browser data if you want to keep this playlist.'
    };
    const textSources = new WeakMap();
    const attributeSources = new WeakMap();
    const originalDocumentTitle = document.title;
    let language = localStorage.getItem(storageKey) === 'en' ? 'en' : 'nl';

    function sourceText(node) {
        if (!textSources.has(node)) textSources.set(node, node.nodeValue);
        return textSources.get(node);
    }
    function translateTextNode(node) {
        const source = sourceText(node);
        const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
        const translated = language === 'en' ? (translations[match[2]] || match[2]) : match[2];
        const next = `${match[1]}${translated}${match[3]}`;
        if (node.nodeValue !== next) node.nodeValue = next;
    }
    function translateAttributes(element) {
        ['placeholder', 'aria-label', 'title'].forEach((attribute) => {
            if (!element.hasAttribute(attribute)) return;
            if (!attributeSources.has(element)) attributeSources.set(element, {});
            const sources = attributeSources.get(element);
            if (!(attribute in sources)) sources[attribute] = element.getAttribute(attribute);
            const source = sources[attribute];
            const translated = language === 'en' ? (translations[source] || source) : source;
            if (element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
        });
    }
    function translateTree(root) {
        if (!root) return;
        if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                return parent && !['SCRIPT', 'STYLE', 'CODE'].includes(parent.tagName) && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        let node;
        while ((node = walker.nextNode())) translateTextNode(node);
        if (root.querySelectorAll) root.querySelectorAll('*').forEach(translateAttributes);
    }
    function updateButtons() {
        document.querySelectorAll('[data-language]').forEach((button) => {
            const selected = button.dataset.language === language;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
    }
    function apply(nextLanguage = language) {
        language = nextLanguage === 'en' ? 'en' : 'nl';
        document.documentElement.lang = language;
        document.documentElement.dataset.language = language;
        if (document.body) translateTree(document.body);
        document.title = language === 'en' ? (translations[originalDocumentTitle] || originalDocumentTitle) : originalDocumentTitle;
        updateButtons();
        document.dispatchEvent(new CustomEvent('lifebuddy-languagechange', { detail: { language } }));
    }
    function setLanguage(nextLanguage) { localStorage.setItem(storageKey, nextLanguage); apply(nextLanguage); }
    function t(text) { return language === 'en' ? (translations[text] || text) : text; }

    window.LifeBuddyI18n = { t, setLanguage, getLanguage: () => language, apply };
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-language]').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.language)));
        apply(language);
        const observer = new MutationObserver((records) => {
            if (language !== 'en') return;
            records.forEach((record) => record.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) translateTree(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
            }));
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();
