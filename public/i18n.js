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
        'STUDIE': 'STUDY', 'Jouw vakken': 'Your subjects', 'Houd je cijfers en je groei inzichtelijk.': 'Keep track of your grades and progress.', 'Vaknaam': 'Subject name', 'Kolom, bv. Periode 1': 'Column, e.g. Period 1', 'Cijfer (0–10)': 'Grade (0–10)', 'CIJFERLIJST IMPORTEREN': 'IMPORT GRADE LIST', 'Upload je CSV-bestand': 'Upload your CSV file', 'Importeer je cijferback-up': 'Import your grade backup', 'Gebruik een .stgrades-back-up van Somtoday of een CSV-bestand. Back-ups worden automatisch gegroepeerd in V4, V5, V6 en eindcijfers, inclusief gewogen gemiddelden.': 'Use a Somtoday .stgrades backup or a CSV file. Backups are automatically grouped into V4, V5, V6 and final grades, including weighted averages.', 'Bestand kiezen': 'Choose file', 'Nog geen bestand gekozen.': 'No file chosen yet.', 'Annuleren': 'Cancel', 'Importeer cijfers': 'Import grades', 'CIJFEROVERZICHT': 'GRADE OVERVIEW', 'Per periode': 'By period', 'Kies een cijferperiode': 'Choose a grade period', 'Kies een periode om cijfers en het gewogen gemiddelde per vak te bekijken.': 'Choose a period to view grades and the weighted average for each subject.', 'Beoordelingen': 'Assessments', 'Gewogen gemiddelde': 'Weighted average', 'Vak': 'Subject', 'Gemiddelde': 'Average', 'Acties': 'Actions', 'Nog geen vakken. Voeg je eerste vak toe.': 'No subjects yet. Add your first subject.',
        'Jouw muziek': 'Your music', "Importeer je eigen MP3's en bouw een playlist voor je volgende focussessie.": 'Import your own MP3s and build a playlist for your next focus session.', 'JOUW LOKALE PLAYLIST': 'YOUR LOCAL PLAYLIST', 'Focus met jouw eigen muziek.': 'Focus with your own music.', "Je MP3-bestanden blijven lokaal opgeslagen in deze browser en worden niet naar een server geüpload.": 'Your MP3 files stay stored locally in this browser and are never uploaded to a server.', 'Open muziekspeler': 'Open music player',
        'GAMIFICATION': 'GAMIFICATION', 'Elke stap telt. Verzamel badges voor de gewoontes die je opbouwt.': 'Every step counts. Collect badges for the habits you build.', 'ontgrendeld': 'unlocked', 'JOUW SPEELSTIJL': 'YOUR PLAY STYLE', 'Kies je class': 'Choose your class', 'Je class geeft je een bonus die past bij jouw manier van studeren.': 'Your class gives you a bonus that fits your way of studying.', 'Je mag altijd wisselen. Kies een bonus die je helpt bij het doel dat nu het belangrijkst is.': 'You can always switch. Pick a bonus that helps with the goal that matters most right now.',
        'Een indrukwekkend ritme. Blijf zo doorgaan!': 'An impressive rhythm. Keep it going!', 'Je momentum groeit. Houd deze flow vast!': 'Your momentum is growing. Keep this flow going!', 'De eerste stap is gezet. Tot morgen!': 'The first step is done. See you tomorrow!', 'Klaar om te starten': 'Ready to start', 'Geen deadline': 'No due date', 'Klaar': 'Done', 'Open': 'Open',
        'JE CIRKEL': 'YOUR CIRCLE', 'Vrienden': 'Friends', 'Nodig studievrienden uit en bekijk hun voortgang.': 'Invite study friends and view their progress.', 'Vriend toevoegen': 'Add friend', 'E-mailadres van je vriend': "Your friend's email address", 'Stuur uitnodiging': 'Send invitation', 'Nog geen vrienden toegevoegd.': 'No friends added yet.', 'Sluit profiel': 'Close profile',
        'JOUW STUDIEMAATJE': 'YOUR STUDY BUDDY', 'is er voor je': 'is here for you', 'Personaliseer je huisdier': 'Customize your pet', 'Sluit chat': 'Close chat', 'Personaliseer je LifeBuddy': 'Customize your LifeBuddy', 'Naam van je maatje': "Your buddy's name", 'Kleur': 'Color', 'Accessoire': 'Accessory', 'Ster': 'Star', 'Boeken': 'Books', 'Rustig': 'Calm', 'Kroon': 'Crown', 'Vraag om hulp met plannen, leren of gewoon wat motivatie.': 'Ask for help with planning, studying or just some motivation.', 'Typ je bericht…': 'Type your message…', 'Verstuur bericht': 'Send message', 'Verberg je LifeBuddy': 'Hide your LifeBuddy', 'Toon je LifeBuddy': 'Show your LifeBuddy', 'Hoi, ik ben Buddy!': "Hi, I'm Buddy!",
        'JOUW FOCUSRUIMTE': 'YOUR FOCUS SPACE', 'Maak een lokale playlist met je eigen MP3-bestanden.': 'Create a local playlist with your own MP3 files.', 'Je playlist is nog leeg.': 'Your playlist is empty.', 'Voeg hieronder één of meerdere MP3-bestanden toe om te beginnen.': 'Add one or more MP3 files below to get started.', 'Geen nummer geselecteerd': 'No track selected', 'Lokale playlist': 'Local playlist', 'Eigen MP3': 'Personal MP3', 'Positie in nummer': 'Position in track', 'Vorig nummer': 'Previous track', 'Afspelen': 'Play', 'Pauzeren': 'Pause', 'Volgend nummer': 'Next track', 'Mijn playlist': 'My playlist', 'nummers': 'tracks', "Selecteer één of meerdere .mp3-bestanden. Ze worden alleen in deze browser opgeslagen; niets wordt naar LifeBuddy geüpload.": 'Select one or more .mp3 files. They are stored only in this browser; nothing is uploaded to LifeBuddy.', "MP3's toevoegen": 'Add MP3s', 'Klaar om muziek toe te voegen.': 'Ready to add music.', 'Nog geen nummers geïmporteerd.': 'No tracks imported yet.', 'De bestanden blijven op dit apparaat. Wis je browserdata niet als je deze playlist wilt behouden.': 'The files stay on this device. Do not clear browser data if you want to keep this playlist.',
        'LifeBuddy – Studieruimte': 'LifeBuddy – Study room', 'Studieruimte': 'Study room', 'Taal kiezen': 'Choose language', 'JOUW STUDIERUIMTE': 'YOUR STUDY ROOM', 'Leer slimmer, op jouw tempo.': 'Study smarter, at your own pace.', 'Maak woordenlijsten, oefen op verschillende manieren en zie waar je al sterk in bent.': 'Create word lists, practise in different ways and see where you are already strong.', 'Nieuwe lijst': 'New list', 'Woordenlijsten': 'Word lists', 'Woorden': 'Words', 'Geoefend': 'Practised', 'Lastig': 'Difficult', 'JOUW COLLECTIE': 'YOUR COLLECTION', 'Nog geen woordenlijsten': 'No word lists yet', 'Maak een lijst of importeer woorden uit Excel om te beginnen.': 'Create a list or import words from Excel to get started.', 'Alle woordenlijsten': 'All word lists', 'WOORDENLIJST': 'WORD LIST', 'Lijst bewerken': 'Edit list', 'Lijst verwijderen': 'Delete list', 'Je voortgang wordt automatisch bewaard.': 'Your progress is saved automatically.', 'Importeren': 'Import', 'Term toevoegen': 'Add term', 'Oefenen': 'Practise', 'Term': 'Term', 'Definitie': 'Definition', 'Voortgang': 'Progress', 'Sluiten': 'Close', 'Nieuwe woordenlijst': 'New word list', 'Titel': 'Title', 'Beschrijving': 'Description', '(optioneel)': '(optional)', 'Termtaal': 'Term language', 'Definitietaal': 'Definition language', 'Niet ingesteld': 'Not set', 'Nederlands': 'Dutch', 'Engels': 'English', 'Duits': 'German', 'Frans': 'French', 'Spaans': 'Spanish', 'Lijst opslaan': 'Save list', 'Term opslaan': 'Save term', 'Gebruik een schuine streep voor meerdere geldige betekenissen, zoals “house / home”.': 'Use a slash for multiple accepted meanings, such as “house / home”.', 'IMPORTEREN': 'IMPORT', 'Woorden importeren': 'Import words', 'Plak uit Excel/Google Sheets, gebruik “term = definitie”, of kies een CSV-bestand.': 'Paste from Excel/Google Sheets, use “term = definition”, or select a CSV file.', 'Excel / tab': 'Excel / tab', '= formaat': '= format', 'Titel van de nieuwe lijst': 'New list title', 'Woorden importeren': 'Import words', 'CSV-bestand kiezen': 'Choose CSV file', 'Nog geen bestand gekozen.': 'No file chosen yet.', 'Importeer woorden': 'Import words', 'OEFENSESSIE': 'PRACTICE SESSION', 'Hoe wil je oefenen?': 'How would you like to practise?', 'Overhoormethode': 'Practice method', 'Toets': 'Test', 'Typ het antwoord': 'Type the answer', 'Meerkeuze': 'Multiple choice', 'Kies uit 4 opties': 'Choose from 4 options', 'Flashcards': 'Flashcards', 'Weet ik / nog niet': 'Know it / not yet', 'Spelling': 'Spelling', 'Typ het woord na': 'Copy the word', 'Gemixt': 'Mixed', 'Beide richtingen': 'Both directions', 'Richting': 'Direction', 'Term → definitie': 'Term → definition', 'Definitie → term': 'Definition → term', 'Aantal woorden': 'Number of words', 'Alle woorden': 'All words', 'Oefen selectie': 'Practice selection', 'Alleen lastige woorden': 'Difficult words only', 'Alleen nog niet geoefend': 'Unpractised words only', 'Specifieke woorden kiezen': 'Choose specific words', 'Laat me fout beantwoorde woorden opnieuw oefenen aan het einde.': 'Let me practise incorrect answers again at the end.', 'Start sessie': 'Start session', 'Sessie stoppen': 'Stop session', 'SESSIE KLAAR': 'SESSION COMPLETE', 'Goed gedaan!': 'Well done!', 'Terug naar lijst': 'Back to list', 'Foute woorden opnieuw': 'Retry incorrect words', 'Bijv. Engels hoofdstuk 3': 'E.g. English chapter 3', 'Waar gaat deze lijst over?': 'What is this list about?', 'Bijv. Engelse woorden': 'E.g. English words'
    };
    Object.assign(translations, {
        'LifeBuddy – Jouw persoonlijke studieplek': 'LifeBuddy – Your personal study space',
        'Een rustige plek om te studeren': 'A calm place to study',
        'Minder losse lijstjes.': 'Fewer scattered lists.',
        'Meer grip op je studie.': 'More control over your studies.',
        'LifeBuddy brengt je planning, cijfers, woordenlijsten en studiebuddy samen in één overzichtelijke studieplek.': 'LifeBuddy brings your planning, grades, word lists and study buddy together in one clear study space.',
        'Plan': 'Plan', 'Taken met duidelijke deadlines': 'Tasks with clear deadlines',
        'Leer': 'Learn', 'Woordenlijsten en oefensessies': 'Word lists and practice sessions',
        'Volg': 'Track', 'Cijfers en voortgang per periode': 'Grades and progress by period',
        'Jouw studiebuddy': 'Your study buddy', 'Vraag om een planning, uitleg of een haalbare volgende stap wanneer je vastloopt.': 'Ask for a plan, an explanation or a manageable next step when you get stuck.',
        'Vakken & cijfers': 'Subjects & grades', 'Importeer een Somtoday-back-up of voeg zelf beoordelingen toe. Zie gewogen gemiddelden per periode.': 'Import a Somtoday backup or add assessments yourself. See weighted averages by period.',
        'Focus op wat telt': 'Focus on what matters', 'Leg taken vast, geef ze een deadline en houd je volgende kleine stap zichtbaar.': 'Capture tasks, give them a deadline and keep your next small step visible.',
        'Actief leren': 'Active learning', 'Maak woordenlijsten en oefen met toetsen, flashcards, spelling of meerkeuzevragen.': 'Create word lists and practise with tests, flashcards, spelling or multiple-choice questions.',
        'Je studiecirkel': 'Your study circle', 'Voeg studievrienden toe en deel alleen de voortgang die je samen wilt zien.': 'Add study friends and share only the progress you want to see together.',
        'Jouw focusmuziek': 'Your focus music', 'Bewaar je eigen MP3’s lokaal in je browser voor je volgende focussessie.': 'Keep your own MP3s locally in your browser for your next focus session.',
        'Zo werkt het': 'How it works', 'Bouw een': 'Build a', 'studieritme': 'study rhythm', 'dat blijft hangen': 'that sticks',
        '1. Zet alles klaar': '1. Set yourself up', 'Begin met wat je deze week echt nodig hebt.': 'Start with what you genuinely need this week.',
        'Maak taken met deadlines': 'Create tasks with deadlines', 'Voeg al je vakken toe': 'Add all your subjects', 'Importeer je cijferback-up': 'Import your grade backup', 'Maak je eerste woordenlijst': 'Create your first word list', 'Maak een account': 'Create an account',
        '2. Oefen en verbeter': '2. Practise and improve', 'Gebruik je dashboard als rustige thuisbasis voor je studie.': 'Use your dashboard as a calm home base for studying.',
        'Oefen wat je nog lastig vindt': 'Practise what you still find difficult', 'Zie voortgang per lijst': 'See progress per list', 'Vraag je studiebuddy om hulp': 'Ask your study buddy for help', 'Vier consistente dagen, niet perfecte dagen': 'Celebrate consistent days, not perfect days', 'Begin met LifeBuddy': 'Start with LifeBuddy',
        'LifeBuddy is op dit moment gratis te gebruiken. We beloven geen functies die nog niet klaar zijn.': 'LifeBuddy is currently free to use. We do not promise features that are not ready yet.',
        'Waar blijven mijn muziekbestanden?': 'Where do my music files stay?', 'Jouw MP3-bestanden worden opgeslagen in de browser op dit apparaat. Ze staan niet in de LifeBuddy-database en gaan niet mee naar een ander apparaat.': 'Your MP3 files are stored in this browser on this device. They are not in the LifeBuddy database and do not move to another device.',
        'Ja. Je kunt eigen MP3-bestanden toevoegen en afspelen. De bestanden blijven lokaal in jouw browser en worden niet naar de LifeBuddy-server geüpload.': 'Yes. You can add and play your own MP3 files. The files stay local in your browser and are not uploaded to the LifeBuddy server.',
        'Voor studenten die hun studie rustig willen organiseren.': 'For students who want to organise their studies calmly.',
        'Samenvatting geschiedenis': 'History summary', 'Vandaag · 16:00': 'Today · 16:00', 'Toets wiskunde': 'Maths test', 'vrijdag': 'Friday',
        '01 · PLANNEN': '01 · PLAN', '02 · CIJFERS': '02 · GRADES', '03 · LEREN': '03 · LEARN',
        'Een rustige volgende stap': 'One calm next step', 'Breng taken, deadlines en toetsvoorbereiding samen in een overzicht dat je helpt kiezen wat nu telt.': 'Bring tasks, deadlines and test preparation together in an overview that helps you choose what matters now.',
        'Zie hoe je ervoor staat': 'See where you stand', 'Oefen wat nog lastig is': 'Practise what is still difficult',
        'JE EIGEN WERKRUIMTE': 'YOUR WORKSPACE', 'Van vandaag tot je volgende': 'From today to your next', 'studiesessie.': 'study session.',
        'LifeBuddy houdt de onderdelen van je studiedag dichtbij elkaar, zodat je steeds weet wat je volgende stap is.': 'LifeBuddy keeps the parts of your study day close together, so you always know your next step.',
        'Een productvoorbeeld van de LifeBuddy werkruimte': 'A product preview of the LifeBuddy workspace',
        'Onderdelen van LifeBuddy': 'LifeBuddy sections', 'Overzicht': 'Overview', 'Taken': 'Tasks',
        'Een helder begin van je studiedag.': 'A clear start to your study day.', 'open taken': 'open tasks', 'toets deze week': 'test this week',
        'Begin bij vandaag': 'Start with today', 'Open je overzicht en zie welke taak, afspraak of toets nu het belangrijkst is.': 'Open your overview and see which task, appointment or test matters most now.',
        'Plan taken rond je toetsen': 'Plan tasks around your tests', 'Maak kleine voorbereidingstaken en houd deadlines en toetsmomenten bij elkaar.': 'Create small preparation tasks and keep deadlines and test moments together.',
        'Houd je cijfers serieus bij': 'Keep your grades seriously organised', 'Voeg beoordelingen toe of importeer een back-up en bekijk gewogen gemiddelden per periode.': 'Add assessments or import a backup and view weighted averages by period.',
        'Leer gericht verder': 'Keep learning with intent', 'Maak woordenlijsten en oefen met de methode die past bij wat je nog wilt onthouden.': 'Create word lists and practise with the method that fits what you still want to remember.',
        'Maak je voorbereiding concreet.': 'Make your preparation concrete.', 'Leer hoofdstuk 4': 'Study chapter 4', 'Morgen': 'Tomorrow', 'Oefentoets wiskunde': 'Maths practice test',
        'Zie je resultaten per vak en periode.': 'See your results by subject and period.', 'Periode 1': 'Period 1', 'Wiskunde': 'Maths', 'Geschiedenis': 'History', 'Gewogen gemiddelden blijven overzichtelijk.': 'Weighted averages stay clear.',
        'Oefen precies wat nog aandacht vraagt.': 'Practise exactly what still needs attention.', 'Engels hoofdstuk 3': 'English chapter 3', '24 woorden · 8 lastig': '24 words · 8 difficult', 'Oefenen': 'Practise', '16 van 24 woorden geoefend': '16 of 24 words practised',
        'JOUW VOLGENDE STAP': 'YOUR NEXT STEP', 'Maak ruimte voor een': 'Make room for a', 'rustig studiejaar.': 'calmer school year.',
        'Begin met een heldere plek voor je taken, toetsen, cijfers en woordenlijsten.': 'Start with one clear place for your tasks, tests, grades and word lists.',
        'Menu openen': 'Open menu', 'Menu sluiten': 'Close menu', 'Ga naar inhoud': 'Skip to content', 'E-mail': 'Email', 'Minimaal 8 tekens': 'At least 8 characters', 'Even geduld…': 'One moment…', 'Sluiten': 'Close',
        'Persoonlijk account': 'Personal account', 'Sinds je bent begonnen': 'Since you started',
        'LifeBuddy – Jouw studiewerkruimte': 'LifeBuddy – Your study workspace', 'STUDY WORKSPACE': 'STUDY WORKSPACE', 'WERKRUIMTE': 'WORKSPACE', 'PERSOONLIJK': 'PERSONAL',
        'Cijfers': 'Grades', 'Focus': 'Focus', 'Mijlpalen': 'Milestones', 'JOUW STUDIEDAG': 'YOUR STUDY DAY', 'Goed je te zien,': 'Good to see you,', 'Een heldere plek voor wat vandaag belangrijk is.': 'A clear place for what matters today.',
        'JOUW RITME': 'YOUR RHYTHM', 'dagen op rij': 'days in a row', 'KLAAR OM TE LEREN': 'READY TO STUDY', 'Maak van je volgende sessie een concrete stap.': 'Make your next session a concrete step.',
        'Oefen woorden, bekijk je cijfers of vraag Buddy om een plan.': 'Practise words, review your grades or ask Buddy for a plan.', 'Open studieruimte': 'Open study room', 'Coachgesprekken': 'Coach conversations', 'Dagen in je ritme': 'Days in your rhythm',
        'Jouw cijfers': 'Your grades', 'Houd je resultaten en groei inzichtelijk.': 'Keep your results and progress clear.', 'Jouw mijlpalen': 'Your milestones', 'Een rustig overzicht van de gewoontes die je onderweg hebt opgebouwd.': 'A calm overview of the habits you have built along the way.'
    });

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
