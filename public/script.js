// ============================================================
// LIFE BUDDY - GAMIFICATION ENGINE
// ============================================================

const Game = {
    // ===== USER STATE =====
    user: null,
    xp: 0,
    level: 1,
    class: 'wizard',
    achievements: [],
    initialized: false,
    lastDailyBonus: null,
    stats: {
        tasks_completed: 0,
        subjects_added: 0,
        chat_messages: 0,
        study_streak: 0,
        total_xp: 0
    },
    
    // ===== LEVEL CONFIG =====
    xpPerLevel: 100,
    xpRewards: {
        task: 10,
        subject: 5,
        chat: 2,
        daily_bonus: 15
    },
    
    // ===== ACHIEVEMENTS =====
    achievementsList: [
        { id: 'first_task', name: '🌟 First Steps', desc: 'Voltooi je eerste taak', icon: '🎯', requirement: { type: 'tasks', value: 1 } },
        { id: 'task_master', name: '⚡ Task Master', desc: 'Voltooi 50 taken', icon: '🏆', requirement: { type: 'tasks', value: 50 } },
        { id: 'scholar', name: '📚 Scholar', desc: 'Voeg 20 vakken toe', icon: '🎓', requirement: { type: 'subjects', value: 20 } },
        { id: 'streak_7', name: '🔥 7-Day Streak', desc: 'Studieer 7 dagen achter elkaar', icon: '🔥', requirement: { type: 'streak', value: 7 } },
        { id: 'level_10', name: '⭐ Level 10', desc: 'Bereik level 10', icon: '⭐', requirement: { type: 'level', value: 10 } },
        { id: 'chatty', name: '💬 Chatty', desc: 'Stuur 50 chat berichten', icon: '🗣️', requirement: { type: 'chats', value: 50 } },
        { id: 'dedicated', name: '💪 Dedicated', desc: 'Voltooi 100 taken', icon: '💪', requirement: { type: 'tasks', value: 100 } },
    ],
    
    // ===== INIT =====
    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.loadState();
        if (typeof window.remoteStreak === 'number') {
            this.syncStreak(window.remoteStreak);
        }
        this.updateUI();
        console.log('🎮 Game engine initialized!');
        console.log(`📊 Level ${this.level} | ${this.xp}/${this.xpPerLevel} XP`);
    },
    
    // ===== STATE MANAGEMENT =====
    loadState() {
        const saved = localStorage.getItem('gameState');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                Object.assign(this, state);
                this.stats = {
                    tasks_completed: 0,
                    subjects_added: 0,
                    chat_messages: 0,
                    study_streak: 0,
                    total_xp: 0,
                    ...(state.stats || {})
                };
                this.achievements = Array.isArray(state.achievements) ? state.achievements : [];
            } catch (e) {
                console.log('⚠️ Failed to load game state, using defaults');
            }
        }
    },
    
    saveState() {
        try {
            const state = {
                user: this.user,
                xp: this.xp,
                level: this.level,
                class: this.class,
                achievements: this.achievements,
                lastDailyBonus: this.lastDailyBonus,
                stats: this.stats
            };
            localStorage.setItem('gameState', JSON.stringify(state));
        } catch (e) {
            console.log('⚠️ Failed to save game state');
        }
    },
    
    // ===== XP & LEVEL =====
    addXP(amount, source = 'unknown') {
        this.xp += amount;
        this.stats.total_xp += amount;
        
        // Check level up
        while (this.xp >= this.xpPerLevel) {
            this.xp -= this.xpPerLevel;
            this.level++;
            this.onLevelUp();
        }

        this.checkAchievements();
        
        this.saveState();
        this.updateUI();
        this.showXPToast(amount, source);
    },
    
    onLevelUp() {
        // Check achievement
        this.checkAchievements();
        
        // Show level up animation
        const levelDisplay = document.getElementById('levelDisplay');
        if (levelDisplay) {
            levelDisplay.classList.add('level-up');
            setTimeout(() => levelDisplay.classList.remove('level-up'), 1000);
        }
        
        // Show notification
        this.showNotification('🎉 Level Up!', `Je hebt level ${this.level} bereikt! 🎊`);
        
        // Special rewards at certain levels
        if (this.level === 5) {
            this.showNotification('🌟 Nieuwe class beschikbaar!', 'Je kunt nu een nieuwe class kiezen!');
        }
        if (this.level === 10) {
            this.showNotification('🌟 Premium thema\'s ontgrendeld!', 'Je kunt nu alle thema\'s gebruiken!');
        }
    },
    
    // ===== ACHIEVEMENTS =====
    checkAchievements() {
        this.achievementsList.forEach(ach => {
            if (this.achievements.includes(ach.id)) return;
            
            let unlocked = false;
            const req = ach.requirement;
            
            switch(req.type) {
                case 'tasks':
                    if (this.stats.tasks_completed >= req.value) unlocked = true;
                    break;
                case 'subjects':
                    if (this.stats.subjects_added >= req.value) unlocked = true;
                    break;
                case 'chats':
                    if (this.stats.chat_messages >= req.value) unlocked = true;
                    break;
                case 'streak':
                    if (this.stats.study_streak >= req.value) unlocked = true;
                    break;
                case 'level':
                    if (this.level >= req.value) unlocked = true;
                    break;
            }
            
            if (unlocked) {
                this.achievements.push(ach.id);
                this.saveState();
                this.showNotification(`🏅 Achievement Unlocked!`, `${ach.icon} ${ach.name}`);
                this.updateUI();
            }
        });
    },
    
    // ===== ACTIONS =====
    rewardFor(activity) {
        const classBonuses = {
            warrior: { task: 5 },
            wizard: { subject: 3 },
            archer: { chat: 2 },
            guardian: {}
        };
        return (this.xpRewards[activity] || 0) + (classBonuses[this.class]?.[activity] || 0);
    },

    registerActivity() {
        const today = new Date().toISOString().slice(0, 10);
        if (this.class !== 'guardian' || this.lastDailyBonus === today) return;

        this.lastDailyBonus = today;
        this.addXP(10, 'Guardian-dagbonus');
    },

    completeTask() {
        this.registerActivity();
        this.stats.tasks_completed++;
        this.addXP(this.rewardFor('task'), 'taak voltooid');
        this.saveState();
        this.updateUI();
    },
    
    addSubject() {
        this.registerActivity();
        this.stats.subjects_added++;
        this.addXP(this.rewardFor('subject'), 'vak toegevoegd');
        this.saveState();
        this.updateUI();
    },
    
    sendChat() {
        this.registerActivity();
        this.stats.chat_messages++;
        this.addXP(this.rewardFor('chat'), 'chat bericht');
        this.saveState();
        this.updateUI();
    },
    
    // ===== CLASS SYSTEM =====
    setClass(className) {
        if (!['warrior', 'wizard', 'archer', 'guardian'].includes(className)) return;
        this.class = className;
        this.saveState();
        this.updateUI();
        this.showNotification('👤 Class gekozen!', `Je bent nu een ${className.charAt(0).toUpperCase() + className.slice(1)}!`);
    },

    syncStreak(streak) {
        const nextStreak = Math.max(0, Number(streak) || 0);
        if (this.stats.study_streak === nextStreak) return;
        this.stats.study_streak = nextStreak;
        this.checkAchievements();
        this.saveState();
        this.updateUI();
    },
    
    // ===== UI UPDATE =====
    updateUI() {
        // Level display
        const levelDisplay = document.getElementById('levelDisplay');
        if (levelDisplay) {
            levelDisplay.textContent = `🎮 Level ${this.level}`;
        }
        
        // XP bar
        const xpBar = document.getElementById('xpBar');
        if (xpBar) {
            const progress = (this.xp / this.xpPerLevel) * 100;
            xpBar.style.width = Math.min(progress, 100) + '%';
        }
        
        // XP text
        const xpText = document.getElementById('xpText');
        if (xpText) {
            xpText.textContent = `${this.xp} / ${this.xpPerLevel} XP`;
        }
        
        // Stats
        const statElements = document.querySelectorAll('[data-stat]');
        statElements.forEach(el => {
            const key = el.dataset.stat;
            if (this.stats[key] !== undefined) {
                el.textContent = this.stats[key];
            }
        });
        
        // Class badge
        const classBadge = document.getElementById('classBadge');
        if (classBadge) {
            const classEmojis = {
                warrior: '🗡️',
                wizard: '🧙',
                archer: '🏹',
                guardian: '🛡️'
            };
            classBadge.textContent = `${classEmojis[this.class] || '🧙'} ${this.class.charAt(0).toUpperCase() + this.class.slice(1)}`;
        }

        document.querySelectorAll('.class-card[data-class]').forEach(card => {
            card.classList.toggle('selected', card.dataset.class === this.class);
        });
        
        // Achievements
        const achievementList = document.getElementById('achievementList');
        if (achievementList) {
            achievementList.innerHTML = this.achievementsList.map(ach => {
                const unlocked = this.achievements.includes(ach.id);
                return `
                    <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
                        <div class="icon">${ach.icon}</div>
                        <div class="info">
                            <div class="name">${ach.name}</div>
                            <div class="desc">${ach.desc}</div>
                            <div class="unlock-state">
                                ${unlocked ? '✅ Ontgrendeld' : '🔒 Nog niet ontgrendeld'}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const overviewAchievements = document.getElementById('overviewAchievements');
        if (overviewAchievements) {
            overviewAchievements.innerHTML = this.achievementsList.slice(0, 3).map(ach => {
                const unlocked = this.achievements.includes(ach.id);
                return `
                    <div class="achievement-preview ${unlocked ? 'unlocked' : 'locked'}">
                        <div class="icon">${ach.icon}</div>
                        <div class="info">
                            <div class="name">${ach.name}</div>
                            <div class="desc">${unlocked ? 'Ontgrendeld' : ach.desc}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Achievement count in sidebar
        const achievementCount = document.getElementById('achievementCount');
        if (achievementCount) {
            achievementCount.textContent = this.achievements.length || 0;
        }

        const achievementHeadingCount = document.getElementById('achievementHeadingCount');
        if (achievementHeadingCount) {
            achievementHeadingCount.textContent = this.achievements.length || 0;
        }
    },
    
    // ===== NOTIFICATIONS =====
    showNotification(title, message) {
        // Check of container bestaat
        let notifContainer = document.getElementById('notificationContainer');
        
        if (!notifContainer) {
            // Create container if it doesn't exist
            notifContainer = document.createElement('div');
            notifContainer.id = 'notificationContainer';
            notifContainer.style.cssText = `
                position: fixed; bottom: 24px; right: 24px; z-index: 9999;
                display: flex; flex-direction: column; gap: 12px;
                max-width: 360px; width: 100%;
            `;
            document.body.appendChild(notifContainer);
        }
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: var(--bg-card);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-glass);
            border-radius: var(--radius-md);
            padding: 16px 20px;
            box-shadow: var(--shadow-lg);
            animation: slideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1);
            color: var(--text-primary);
        `;
        notification.innerHTML = `
            <div style="font-weight:700;font-size:0.95rem;">${title}</div>
            <div style="font-size:0.85rem;color:var(--text-secondary);">${message}</div>
        `;
        
        notifContainer.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards';
            setTimeout(() => notification.remove(), 500);
        }, 4000);
    },
    
    showXPToast(amount, source) {
        // Floating XP text
        const xpToast = document.createElement('div');
        xpToast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 2.5rem;
            font-weight: 800;
            color: var(--accent-soft);
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            animation: xpFloat 1.2s ease-out forwards;
            text-shadow: 0 0 40px rgba(139,92,246,0.5);
        `;
        xpToast.textContent = `+${amount} XP ${source ? '🎯' : ''}`;
        document.body.appendChild(xpToast);
        setTimeout(() => xpToast.remove(), 1500);
    }
};

// ===== CSS ANIMATIONS =====
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        0% { transform: translateX(100px); opacity: 0; }
        100% { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        0% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(100px); opacity: 0; }
    }
    @keyframes xpFloat {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        20% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        80% { transform: translate(-50%, -80%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -120%) scale(0.8); opacity: 0; }
    }
    .level-up { animation: levelUp 0.6s ease; }
    @keyframes levelUp {
        0% { transform: scale(1); }
        50% { transform: scale(1.4); color: #fbbf24; text-shadow: 0 0 40px rgba(251,191,36,0.5); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);

// ===== EXPOSE TO WINDOW =====
window.Game = Game;

// ===== INIT ON LOAD =====
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
    console.log('🎮 LifeBuddy Gamification loaded!');
});

console.log('🎮 Game script loaded!');
