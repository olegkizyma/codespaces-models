#!/usr/bin/env node

/**
 * Демонстрація українських голосів TTS API
 * Тестування всіх доступних українських голосів
 */

import { writeFileSync } from 'fs';

const API_BASE = 'https://8a42c760f69d.ngrok-free.app/tts';

// Доступні українські голоси
const UKRAINIAN_VOICES = [
    {
        name: 'anatol',
        gender: 'чоловічий',
        description: 'Анатоль - стандартний чоловічий голос'
    },
    {
        name: 'natalia', 
        gender: 'жіночий',
        description: 'Наталя - стандартний жіночий голос'
    }
];

// Тестові фрази українською (транслітеровані)
const TEST_PHRASES = [
    {
        text: 'Vitayu%21%20Mene%20zvaty%20',
        description: 'Вітання'
    },
    {
        text: 'Ya%20hovoryu%20ukrainskoyu%20movoyu',
        description: 'Українська мова'
    },
    {
        text: 'Tsey%20ukrainsky%20syntez%20movlennya',
        description: 'Опис TTS'
    },
    {
        text: 'Kyiv%20-%20stolytsa%20Ukrainy',
        description: 'Про Київ'
    },
    {
        text: 'Slava%20Ukraini%21',
        description: 'Патріотичне гасло'
    }
];

// Тестування різних параметрів гучності
const VOLUME_TESTS = [
    { scale: 0.5, description: 'Тихо' },
    { scale: 1.0, description: 'Нормально' },
    { scale: 1.5, description: 'Гучно' },
    { scale: 2.0, description: 'Дуже гучно' }
];

async function downloadAudio(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        writeFileSync(filename, buffer);
        console.log(`✅ ${filename} (${buffer.length} байт)`);
        return true;
    } catch (error) {
        console.log(`❌ ${filename}: ${error.message}`);
        return false;
    }
}

async function testVoices() {
    console.log('🎙️  Тестування українських голосів TTS\n');
    
    let successCount = 0;
    let totalTests = 0;
    
    // Тестуємо кожен голос з різними фразами
    for (const voice of UKRAINIAN_VOICES) {
        console.log(`\n👤 Голос: ${voice.name} (${voice.gender})`);
        console.log(`   ${voice.description}\n`);
        
        for (const phrase of TEST_PHRASES) {
            const url = `${API_BASE}?text=${phrase.text}${voice.name}&voice=${voice.name}`;
            const filename = `ukrainian_${voice.name}_${phrase.description.replace(/\s+/g, '_')}.mp3`;
            
            console.log(`   🔊 ${phrase.description}...`);
            const success = await downloadAudio(url, filename);
            
            totalTests++;
            if (success) successCount++;
            
            // Невелика затримка між запитами
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return { successCount, totalTests };
}

async function testVolumeScales() {
    console.log('\n🔊 Тестування рівнів гучності\n');
    
    const testText = 'Test%20guchnoti%20ukrainskoyu';
    let volumeSuccess = 0;
    
    for (const volumeTest of VOLUME_TESTS) {
        const url = `${API_BASE}?text=${testText}&voice=natalia&scale=${volumeTest.scale}`;
        const filename = `volume_test_${volumeTest.scale}.mp3`;
        
        console.log(`   📢 ${volumeTest.description} (${volumeTest.scale})...`);
        const success = await downloadAudio(url, filename);
        
        if (success) volumeSuccess++;
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return volumeSuccess;
}

async function createDemoPlaylist() {
    console.log('\n🎵 Створення демо-плейліста\n');
    
    const demoTexts = [
        { text: 'Vitayu%21%20Ya%20ukrainsky%20syntez%20movlennya', voice: 'anatol', name: 'demo_intro_anatol' },
        { text: 'Mene%20zvaty%20Natalya%20i%20ya%20zhinochyy%20holos', voice: 'natalia', name: 'demo_intro_natalia' },
        { text: 'My%20pidtrymuyemo%20ukrainsku%20movu', voice: 'anatol', name: 'demo_support' },
        { text: 'Dякuyu%20za%20uvagu%21', voice: 'natalia', name: 'demo_thanks' }
    ];
    
    let demoSuccess = 0;
    
    for (const demo of demoTexts) {
        const url = `${API_BASE}?text=${demo.text}&voice=${demo.voice}&name=${demo.name}`;
        const filename = `${demo.name}.mp3`;
        
        console.log(`   🎤 ${demo.voice}: ${decodeURIComponent(demo.text.replace(/%/g, '%25'))}...`);
        const success = await downloadAudio(url, filename);
        
        if (success) demoSuccess++;
        await new Promise(resolve => setTimeout(resolve, 400));
    }
    
    return demoSuccess;
}

async function generateVoiceComparison() {
    console.log('\n⚖️  Порівняння голосів\n');
    
    const comparisonText = 'Tse%20test%20porivnyannya%20holosiv%20ukrainskoyu%20movoyu';
    let comparisonSuccess = 0;
    
    for (const voice of UKRAINIAN_VOICES) {
        const url = `${API_BASE}?text=${comparisonText}&voice=${voice.name}&name=comparison_${voice.name}`;
        const filename = `comparison_${voice.name}.mp3`;
        
        console.log(`   🎭 ${voice.name}: Тест порівняння...`);
        const success = await downloadAudio(url, filename);
        
        if (success) comparisonSuccess++;
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return comparisonSuccess;
}

async function main() {
    console.log('🇺🇦 ДЕМОНСТРАЦІЯ УКРАЇНСЬКИХ ГОЛОСІВ TTS\n');
    console.log('=' .repeat(50));
    
    const startTime = Date.now();
    
    try {
        // Основні тести голосів
        const { successCount, totalTests } = await testVoices();
        
        // Тести гучності
        const volumeSuccess = await testVolumeScales();
        
        // Демо-плейліст
        const demoSuccess = await createDemoPlaylist();
        
        // Порівняння голосів
        const comparisonSuccess = await generateVoiceComparison();
        
        // Підсумки
        const duration = Math.round((Date.now() - startTime) / 1000);
        const totalSuccess = successCount + volumeSuccess + demoSuccess + comparisonSuccess;
        const totalAllTests = totalTests + VOLUME_TESTS.length + 4 + UKRAINIAN_VOICES.length;
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 РЕЗУЛЬТАТИ ТЕСТУВАННЯ');
        console.log('='.repeat(50));
        console.log(`✅ Успішно: ${totalSuccess}/${totalAllTests} тестів`);
        console.log(`⏱️  Час виконання: ${duration} секунд`);
        console.log(`📁 Створено аудіо файлів: ${totalSuccess}`);
        
        console.log('\n🎙️  Доступні українські голоси:');
        UKRAINIAN_VOICES.forEach(voice => {
            console.log(`   • ${voice.name} (${voice.gender}) - ${voice.description}`);
        });
        
        console.log('\n🔊 Підтримувані параметри:');
        console.log('   • voice: anatol, natalia');
        console.log('   • scale: 0.1-3.0 (рівень гучності)');
        console.log('   • name: назва файлу для завантаження');
        
        console.log('\n💡 Приклади використання:');
        console.log('   🌐 Веб: https://8a42c760f69d.ngrok-free.app/tts?text=Привіт&voice=natalia');
        console.log('   📱 Локально: http://localhost:8080?text=Привіт&voice=anatol&scale=1.5');
        
        if (totalSuccess === totalAllTests) {
            console.log('\n🎉 Всі тести пройшли успішно! Українська TTS готова до використання.');
        } else {
            console.log(`\n⚠️  ${totalAllTests - totalSuccess} тестів не вдалося. Перевірте з'єднання.`);
        }
        
    } catch (error) {
        console.error('\n❌ Критична помилка:', error.message);
        process.exit(1);
    }
}

// Запуск демонстрації
main().catch(console.error);
