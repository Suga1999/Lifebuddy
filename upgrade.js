const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Verbind met de database
const db = new sqlite3.Database(path.join(__dirname, 'database', 'lifebuddy.db'));

// Vervang met JOUW email!
const email = 'sugawaratoshiaki1999@gmail.com';

// Upgrade gebruiker naar Pro
db.run(
    'UPDATE users SET plan = ? WHERE email = ?',
    ['pro', email],
    function(err) {
        if (err) {
            console.error('❌ Fout bij upgraden:', err.message);
        } else if (this.changes === 0) {
            console.log('❌ Gebruiker niet gevonden met email:', email);
            console.log('📝 Tip: Check of je de juiste email gebruikt.');
        } else {
            console.log(`✅ Gebruiker ${email} is geupgrade naar Pro!`);
        }
        
        // Toon alle gebruikers
        db.all('SELECT id, email, name, plan FROM users', (err, rows) => {
            if (err) {
                console.error('❌ Fout bij ophalen users:', err.message);
            } else {
                console.log('\n📋 Huidige gebruikers:');
                rows.forEach(row => {
                    console.log(`  - ${row.email} (${row.name || 'geen naam'}) → ${row.plan}`);
                });
            }
            db.close();
        });
    }
);