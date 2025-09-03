// AI Chat з використанням OpenAI SDK
class AIChat {
    constructor() {
        this.apiUrl = 'https://8a42c760f69d.ngrok-free.app/v1';
        this.conversationHistory = [];
        this.currentModel = 'microsoft/phi-3-mini-4k-instruct';
        
        this.initializeElements();
        this.attachEventListeners();
        this.setupTextareaAutoResize();
    }

    initializeElements() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.modelSelect = document.getElementById('modelSelect');
        this.typingIndicator = document.getElementById('typingIndicator');
    }

    attachEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.modelSelect.addEventListener('change', (e) => {
            this.currentModel = e.target.value;
            this.showMessage('system', `🔄 Модель змінено на ${e.target.options[e.target.selectedIndex].text}`);
        });
    }

    setupTextareaAutoResize() {
        this.messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.sendButton.disabled) return;

        // Показати повідомлення користувача
        this.showMessage('user', message);
        this.messageInput.value = '';
        this.messageInput.style.height = '50px';
        
        // Заблокувати інтерфейс
        this.sendButton.disabled = true;
        this.showTypingIndicator();

        try {
            // Додати до історії розмови
            this.conversationHistory.push({
                role: 'user',
                content: message
            });

            // Надіслати запит до API
            const response = await this.callAPI();
            
            if (response.choices && response.choices[0]) {
                const assistantMessage = response.choices[0].message.content;
                
                // Додати відповідь до історії
                this.conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessage
                });

                // Показати відповідь асистента
                this.showMessage('assistant', assistantMessage, response.usage);
            } else {
                throw new Error('Некоректна відповідь від API');
            }

        } catch (error) {
            console.error('Помилка:', error);
            this.showError(`Помилка: ${error.message}`);
            
            // Видалити останнє повідомлення користувача з історії при помилці
            if (this.conversationHistory.length > 0) {
                this.conversationHistory.pop();
            }
        } finally {
            this.hideTypingIndicator();
            this.sendButton.disabled = false;
            this.messageInput.focus();
        }
    }

    async callAPI() {
        const requestBody = {
            model: this.currentModel,
            messages: [
                {
                    role: 'system',
                    content: 'Ви корисний AI асистент, який відповідає українською мовою. Будьте дружніми та інформативними.'
                },
                ...this.conversationHistory.slice(-10) // Останні 10 повідомлень для контексту
            ],
            temperature: 0.7,
            max_tokens: 1000
        };

        let response;
        try {
            response = await fetch(`${this.apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer dummy-key'
                },
                body: JSON.stringify(requestBody)
            });
        } catch (networkErr) {
            // Типова мережна помилка fetch (TypeError)
            const msg = networkErr?.message || String(networkErr) || 'Network error';
            throw new Error(`Network error: ${msg}`);
        }

        const status = response.status;
        const statusText = response.statusText || '';
        let rawText = '';
        let parsed;
        if (!response.ok) {
            try {
                // Спроба розпарсити JSON помилки
                parsed = await response.json();
            } catch (_) {
                // Якщо це не JSON, читаємо як текст
                try { rawText = await response.text(); } catch (_) { rawText = ''; }
            }

            const serverMsg = parsed?.error?.message || parsed?.message || rawText || 'Unknown server error';
            // Обрізаємо довгі тіла, щоб не ламати UI
            const snippet = (serverMsg || '').toString().slice(0, 500);
            throw new Error(`HTTP ${status} ${statusText}: ${snippet}`);
        }

        // OK відповіді: намагаємося JSON, з фолбеком на текст
        try {
            parsed = await response.json();
        } catch (e) {
            try { rawText = await response.text(); } catch (_) { rawText = ''; }
            throw new Error(`Invalid JSON from API. HTTP ${status}. Body: ${rawText.slice(0, 500)}`);
        }

        return parsed;
    }

    showMessage(role, content, usage = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        if (role === 'system') {
            messageDiv.innerHTML = `
                <div class="message-content" style="background: #ffc107; color: #000; text-align: center; font-style: italic;">
                    ${content}
                </div>
            `;
        } else {
            const avatar = role === 'user' ? '👤' : '🤖';
            let usageInfo = '';
            
            if (usage) {
                usageInfo = `<div style="font-size: 11px; color: #666; margin-top: 8px; opacity: 0.8;">
                    📊 Токени: ${usage.total_tokens} (${usage.prompt_tokens}+${usage.completion_tokens})
                </div>`;
            }

            // Додаємо TTS кнопку для повідомлень асистента
            let ttsButton = '';
            if (role === 'assistant') {
                ttsButton = `
                    <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
                        <button onclick="playTTS('${this.escapeForTTS(content)}', 'anatol')" 
                                style="padding: 5px 12px; background: #4facfe; color: white; border: none; border-radius: 15px; cursor: pointer; font-size: 12px;">
                            🔊 Анатоль
                        </button>
                        <button onclick="playTTS('${this.escapeForTTS(content)}', 'natalia')" 
                                style="padding: 5px 12px; background: #ff6b9d; color: white; border: none; border-radius: 15px; cursor: pointer; font-size: 12px;">
                            🎤 Наталя
                        </button>
                    </div>
                `;
            }

            messageDiv.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    ${this.formatMessage(content)}
                    ${usageInfo}
                    ${ttsButton}
                </div>
            `;
        }

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatMessage(text) {
        if (text == null) return '';
        if (typeof text !== 'string') {
            try { text = JSON.stringify(text, null, 2); } catch (_) { text = String(text); }
        }
        // Прості форматування для покращення читабельності
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">$1</code>');
    }

    showTypingIndicator() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        this.chatMessages.appendChild(errorDiv);
        
        // Автоматично видалити помилку через 5 секунд
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
        
        this.scrollToBottom();
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    // Метод для очищення історії розмови
    clearHistory() {
        this.conversationHistory = [];
        this.chatMessages.innerHTML = `
            <div class="message assistant">
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    Історію розмови очищено. Можете почати нову розмову! 😊
                </div>
            </div>
        `;
    }

    escapeForTTS(text) {
        // Очищуємо текст для безпечного використання в TTS
        return text
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, ' ')
            .replace(/[<>]/g, '')
            .substring(0, 200); // Обмежуємо довжину
    }

    // Метод для тестування з'єднання
    async testConnection() {
        try {
            const response = await fetch(`${this.apiUrl}/models`, {
                headers: {
                    'Authorization': 'Bearer dummy-key'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.showMessage('system', `✅ З'єднання встановлено. Доступно ${data.data.length} моделей.`);
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            this.showError(`❌ Помилка з'єднання: ${error.message}`);
            return false;
        }
    }
}

// Ініціалізація чату після завантаження сторінки
let chat;
document.addEventListener('DOMContentLoaded', () => {
    chat = new AIChat();
    
    // Тестування з'єднання при завантаженні
    setTimeout(() => {
        chat.testConnection();
    }, 1000);
});

// Глобальні функції для консолі браузера
window.clearChat = () => chat && chat.clearHistory();
window.testAPI = () => chat && chat.testConnection();

// Глобальна функція для TTS
window.playTTS = async function(text, voice = 'anatol') {
    try {
        // Конвертуємо український текст у транслітерацію для кращої озвучки
    const transliterated = transliterateUkrainian(text);
    const base = `${location.protocol}//${location.host}`;
    const u = new URL('/tts', base);
    u.searchParams.set('text', transliterated);
    if (voice) u.searchParams.set('voice', voice);

    // Створюємо аудіо елемент
    const audio = new Audio(u.toString());
        
        // Показуємо індикатор завантаження
        const button = event.target;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = '⏳';
        
        audio.oncanplay = () => {
            button.textContent = '🔊';
            audio.play();
        };
        
        audio.onended = () => {
            button.textContent = originalText;
            button.disabled = false;
        };
        
        audio.onerror = () => {
            button.textContent = '❌';
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 2000);
            console.error('Помилка TTS:', audio.error);
        };
        
    } catch (error) {
        console.error('TTS Error:', error);
        alert('Помилка TTS: ' + error.message);
    }
};

// Функція транслітерації українського тексту
function transliterateUkrainian(text) {
    const ukrainianMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
        'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
        'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ю': 'yu',
        'я': 'ya', 'ь': '', "'": '',
        
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'H', 'Ґ': 'G', 'Д': 'D', 'Е': 'E', 'Є': 'Ye',
        'Ж': 'Zh', 'З': 'Z', 'И': 'Y', 'І': 'I', 'Ї': 'Yi', 'Й': 'Y', 'К': 'K', 'Л': 'L',
        'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ю': 'Yu',
        'Я': 'Ya'
    };
    
    return text.split('').map(char => ukrainianMap[char] || char).join('');
}
