const ollama = require('ollama');

async function test() {
    try {
        console.log('🔍 Testen of Ollama werkt...');
        const response = await ollama.chat({
            model: 'llama3.2:3b',
            messages: [{ role: 'user', content: 'Zeg hallo in het Nederlands' }]
        });
        console.log('✅ Ollama werkt! Antwoord:', response.message.content);
    } catch (error) {
        console.error('❌ Fout:', error.message);
        console.error('Stack:', error.stack);
    }
}

test();