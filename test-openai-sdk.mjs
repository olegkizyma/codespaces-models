#!/usr/bin/env node

/**
 * Тестування OpenAI SDK з вашим API
 * Використання: node test-openai-sdk.mjs
 */

import OpenAI from 'openai';
import readline from 'readline';

// Налаштування клієнта OpenAI для вашого API
const client = new OpenAI({
    apiKey: 'dummy-key',
    baseURL: 'https://8a42c760f69d.ngrok-free.app/v1'
});

// Доступні моделі для тестування
const MODELS = [
    'microsoft/phi-3-mini-4k-instruct',
    'microsoft/phi-3.5-mini-instruct',
    'openai/gpt-4o-mini',
    'meta/llama-3.3-70b-instruct',
    'mistral-ai/mistral-small-2503'
];

async function testModels() {
    console.log('🚀 Тестування моделей через OpenAI SDK\n');
    
    try {
        // Спочатку отримаємо список доступних моделей
        console.log('📋 Отримання списку моделей...');
        const modelsList = await client.models.list();
        console.log(`✅ Знайдено ${modelsList.data.length} моделей\n`);
        
        // Тестуємо кілька моделей
        const testPrompt = 'Привіт! Коротко розкажи про себе українською мовою.';
        
        for (const model of MODELS.slice(0, 3)) { // Тестуємо перші 3 моделі
            console.log(`🤖 Тестування моделі: ${model}`);
            
            try {
                const startTime = Date.now();
                
                const response = await client.chat.completions.create({
                    model: model,
                    messages: [
                        { role: 'system', content: 'Ти корисний AI асистент, який відповідає українською мовою.' },
                        { role: 'user', content: testPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 200
                });
                
                const duration = Date.now() - startTime;
                
                console.log(`✅ Відповідь (${duration}ms):`);
                console.log(`   "${response.choices[0].message.content.substring(0, 100)}..."`);
                console.log(`📊 Токени: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})\n`);
                
            } catch (error) {
                const status = error?.status || error?.response?.status;
                // Спроба дістати тіло помилки
                let detail = '';
                if (error?.response?.data) {
                    try { detail = JSON.stringify(error.response.data).slice(0, 500); } catch (_) {}
                } else if (error?.message) {
                    detail = error.message;
                }
                console.log(`❌ Помилка${status ? ` (${status})` : ''}: ${detail}\n`);
            }
        }
        
    } catch (error) {
        const status = error?.status || error?.response?.status;
        let detail = error?.message || '';
        if (error?.response?.data) {
            try { detail = JSON.stringify(error.response.data).slice(0, 500); } catch (_) {}
        }
        console.error(`❌ Помилка підключення${status ? ` (${status})` : ''}: ${detail}`);
    }
}

async function interactiveChat() {
    console.log('\n💬 Інтерактивний чат (введіть "exit" для виходу)\n');
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const messages = [
        { role: 'system', content: 'Ти корисний AI асистент, який відповідає українською мовою.' }
    ];
    
    const model = 'microsoft/phi-3-mini-4k-instruct'; // Використовуємо стабільну модель
    
    const askQuestion = () => {
        rl.question('👤 Ви: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                rl.close();
                return;
            }
            
            if (input.trim()) {
                messages.push({ role: 'user', content: input });
                
                try {
                    console.log('🤖 Думаю...');
                    
                    const response = await client.chat.completions.create({
                        model: model,
                        messages: messages,
                        temperature: 0.7,
                        max_tokens: 500
                    });
                    
                    const assistantMessage = response.choices[0].message.content;
                    messages.push({ role: 'assistant', content: assistantMessage });
                    
                    console.log(`🤖 AI: ${assistantMessage}\n`);
                    
                } catch (error) {
                    console.log(`❌ Помилка: ${error.message}\n`);
                }
            }
            
            askQuestion();
        });
    };
    
    askQuestion();
}

async function testStreaming() {
    console.log('\n🌊 Тестування стрімінгу...\n');
    
    try {
        const stream = await client.chat.completions.create({
            model: 'microsoft/phi-3-mini-4k-instruct',
            messages: [
                { role: 'system', content: 'Ти корисний AI асистент, який відповідає українською мовою.' },
                { role: 'user', content: 'Розкажи коротку історію про роботів майбутнього.' }
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 300
        });
        
        console.log('🤖 AI (streaming): ');
        process.stdout.write('   ');
        
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                process.stdout.write(content);
            }
        }
        
        console.log('\n✅ Стрімінг завершено\n');
        
    } catch (error) {
        console.error('❌ Помилка стрімінгу:', error.message);
    }
}

async function testTTS() {
    console.log('🔊 Тестування TTS API...\n');
    
    try {
        const ttsUrl = 'https://8a42c760f69d.ngrok-free.app/tts?text=Привіт%20від%20вашого%20AI%20асистента!';
        console.log(`🌐 TTS URL: ${ttsUrl}`);
        console.log('💡 Відкрийте це посилання в браузері, щоб прослухати аудіо\n');
        
    } catch (error) {
        console.error('❌ Помилка TTS:', error.message);
    }
}

// Головна функція
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--chat') || args.includes('-c')) {
        await interactiveChat();
    } else if (args.includes('--stream') || args.includes('-s')) {
        await testStreaming();
    } else if (args.includes('--tts') || args.includes('-t')) {
        await testTTS();
    } else {
        // Повний тест за замовчуванням
        await testModels();
        
        if (args.includes('--full') || args.includes('-f')) {
            await testStreaming();
            await testTTS();
            await interactiveChat();
        } else {
            console.log('💡 Додаткові опції:');
            console.log('   --chat, -c     : Інтерактивний чат');
            console.log('   --stream, -s   : Тестування стрімінгу');
            console.log('   --tts, -t      : Тестування TTS');
            console.log('   --full, -f     : Повний тест усіх функцій\n');
        }
    }
}

// Запуск
main().catch(console.error);
