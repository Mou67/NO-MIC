class GameTTSOverlay {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.currentVoice = null;
        this.currentUtterance = null;
        this.isInitialized = false;
        this.chatToSpeechEnabled = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadVoices();
        this.setupGameIntegration();
        this.initializeLocalization();
    }

    async initializeLocalization() {
        // Warte auf Lokalisierungs-Manager
        if (window.localization) {
            await window.localization.init();
            
            // Event-Listener für Sprachänderung
            window.addEventListener('languageChanged', (event) => {
                this.onLanguageChanged(event.detail.language);
            });
        }
    }

    initializeElements() {
        // Main controls
        this.quickText = document.getElementById('quickText');
        this.quickSpeakBtn = document.getElementById('quickSpeakBtn');
        this.quickStopBtn = document.getElementById('quickStopBtn');
        this.voiceQuickSelect = document.getElementById('voiceQuickSelect');
        this.statusText = document.getElementById('statusText');
        this.statusBar = document.getElementById('statusBar');
        
        // Overlay controls
        this.expandBtn = document.getElementById('expandBtn');
        this.closeBtn = document.getElementById('closeBtn');
        
        // Chat integration
        this.chatSection = document.getElementById('chatSection');
        this.chatToggleBtn = document.getElementById('chatToggleBtn');
        this.filterProfanity = document.getElementById('filterProfanity');
        this.autoSpeak = document.getElementById('autoSpeak');
    }

    setupEventListeners() {
        // Quick input
        this.quickText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.quickSpeak();
            }
        });

        // Buttons
        this.quickSpeakBtn.addEventListener('click', () => this.quickSpeak());
        this.quickStopBtn.addEventListener('click', () => this.stopSpeech());
          // Overlay controls
        if (window.electronAPI) {
            this.expandBtn.addEventListener('click', async () => {
                try {
                    const result = await window.electronAPI.toggleOverlay();
                    if (result && result.success) {
                        this.updateStatus('Vollmodus aktiviert');
                    } else {
                        this.updateStatus('Fehler beim Umschalten', 'error');
                        console.error('Toggle overlay failed:', result);
                    }
                } catch (error) {
                    this.updateStatus('Verbindungsfehler', 'error');
                    console.error('Toggle overlay error:', error);
                }
            });
            
            this.closeBtn.addEventListener('click', async () => {
                try {
                    const result = await window.electronAPI.closeOverlay();
                    if (result && result.success) {
                        // Window will close automatically
                    } else {
                        this.updateStatus('Fehler beim Schließen', 'error');
                        console.error('Close overlay failed:', result);
                    }
                } catch (error) {
                    this.updateStatus('Verbindungsfehler', 'error');
                    console.error('Close overlay error:', error);
                }
            });
        } else {
            // Fallback wenn electronAPI nicht verfügbar ist
            this.expandBtn.addEventListener('click', () => {
                this.updateStatus('Nur in Desktop-App verfügbar', 'error');
            });
            
            this.closeBtn.addEventListener('click', () => {
                window.close();
            });
        }

        // Chat toggle
        this.chatToggleBtn.addEventListener('click', () => {
            this.toggleChatToSpeech();
        });

        // IPC listeners for hotkeys
        if (window.electronAPI) {
            window.electronAPI.onQuickSpeak(() => {
                this.quickSpeak();
            });
            
            window.electronAPI.onStopSpeech(() => {
                this.stopSpeech();
            });
            
            window.electronAPI.onSpeakText((text, voiceSettings) => {
                this.speakWithSettings(text, voiceSettings);
            });
        }

        // Speech synthesis events
        this.synth.addEventListener('voiceschanged', () => {
            this.loadVoices();
        });
    }

    async loadVoices() {
        await this.waitForVoices();
        this.voices = this.synth.getVoices();
        this.renderQuickVoices();
        this.selectDefaultVoice();
        this.updateStatus('Bereit');
    }

    waitForVoices() {
        return new Promise((resolve) => {
            if (this.synth.getVoices().length > 0) {
                resolve();
                return;
            }
            
            const checkVoices = () => {
                if (this.synth.getVoices().length > 0) {
                    resolve();
                } else {
                    setTimeout(checkVoices, 100);
                }
            };
            
            checkVoices();
        });
    }

    renderQuickVoices() {
        this.voiceQuickSelect.innerHTML = '';
        
        // Zeige nur die wichtigsten Stimmen (max 3)
        const priorityVoices = this.getPriorityVoices();
        
        priorityVoices.forEach((voice, index) => {
            const voiceItem = this.createQuickVoiceItem(voice, index);
            this.voiceQuickSelect.appendChild(voiceItem);
        });
    }

    getPriorityVoices() {
        // Deutsche Stimmen zuerst, dann englische, dann lokale Stimmen
        const germanVoices = this.voices.filter(v => v.lang.startsWith('de'));
        const englishVoices = this.voices.filter(v => v.lang.startsWith('en'));
        const localVoices = this.voices.filter(v => v.localService);
        
        const priority = [];
        
        if (germanVoices.length > 0) priority.push(germanVoices[0]);
        if (englishVoices.length > 0) priority.push(englishVoices[0]);
        if (localVoices.length > 0 && !priority.includes(localVoices[0])) {
            priority.push(localVoices[0]);
        }
        
        return priority.slice(0, 3);
    }

    createQuickVoiceItem(voice, index) {
        const item = document.createElement('div');
        item.className = 'voice-quick-item';
        item.dataset.voiceIndex = this.voices.indexOf(voice);
        
        const lang = this.getLanguageCode(voice.lang);
        
        item.innerHTML = `
            <div class="voice-name-quick">${voice.name.split(' ')[0]}</div>
            <div class="voice-lang-quick">${lang}</div>
        `;
        
        item.addEventListener('click', () => {
            this.selectQuickVoice(this.voices.indexOf(voice));
        });
        
        return item;
    }

    getLanguageCode(langCode) {
        const codes = {
            'de': 'DE',
            'en': 'EN',
            'es': 'ES',
            'fr': 'FR',
            'it': 'IT'
        };
        
        const lang = langCode.split('-')[0];
        return codes[lang] || lang.toUpperCase();
    }

    selectQuickVoice(index) {
        // Entferne vorherige Auswahl
        document.querySelectorAll('.voice-quick-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Markiere neue Auswahl
        const selectedItem = document.querySelector(`[data-voice-index="${index}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        this.currentVoice = this.voices[index];
        this.updateStatus(`${this.currentVoice.name.split(' ')[0]} ausgewählt`);
    }

    selectDefaultVoice() {
        let defaultIndex = this.voices.findIndex(voice => 
            voice.lang.startsWith('de') && voice.localService
        );
        
        if (defaultIndex === -1) {
            defaultIndex = 0;
        }
        
        if (defaultIndex >= 0 && this.voices.length > 0) {
            this.selectQuickVoice(defaultIndex);
        }
    }

    quickSpeak() {
        const text = this.quickText.value.trim();
        
        if (!text) {
            this.updateStatus('Kein Text eingegeben', 'error');
            this.quickText.focus();
            return;
        }
        
        this.speak(text);
    }

    speak(text, settings = {}) {
        if (!this.currentVoice) {
            this.updateStatus('Keine Stimme ausgewählt', 'error');
            return;
        }
        
        if (this.synth.speaking) {
            this.synth.cancel();
        }
        
        // Game-optimierte Einstellungen
        const defaultSettings = {
            rate: 1.2,    // Etwas schneller für Gaming
            pitch: 1.0,
            volume: 0.8   // Nicht zu laut, um Game-Audio nicht zu übertönen
        };
        
        const finalSettings = { ...defaultSettings, ...settings };
        
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance.voice = this.currentVoice;
        this.currentUtterance.rate = finalSettings.rate;
        this.currentUtterance.pitch = finalSettings.pitch;
        this.currentUtterance.volume = finalSettings.volume;
        
        // Event listeners
        this.currentUtterance.onstart = () => {
            this.updateStatus('Spreche...', 'speaking');
            this.updateButtonStates(true);
        };
        
        this.currentUtterance.onend = () => {
            this.updateStatus('Bereit');
            this.updateButtonStates(false);
        };
        
        this.currentUtterance.onerror = (event) => {
            this.updateStatus(`Fehler: ${event.error}`, 'error');
            this.updateButtonStates(false);
        };
        
        this.synth.speak(this.currentUtterance);
    }

    speakWithSettings(text, voiceSettings) {
        this.speak(text, voiceSettings);
    }

    stopSpeech() {
        if (this.synth.speaking) {
            this.synth.cancel();
        }
        this.updateStatus('Gestoppt');
        this.updateButtonStates(false);
    }

    updateButtonStates(isSpeaking) {
        this.quickSpeakBtn.disabled = isSpeaking;
        this.quickStopBtn.disabled = !isSpeaking;
        
        if (isSpeaking) {
            this.quickSpeakBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
            this.quickSpeakBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    onLanguageChanged(language) {
        // Aktualisiere Platzhalter und andere UI-Elemente
        if (window.localization) {
            const placeholder = window.localization.t('overlay.quick_text');
            if (this.quickText && placeholder) {
                this.quickText.placeholder = placeholder;
            }
        }
        
        // Aktualisiere Status
        this.updateStatus('ready');
    }

    // Methode zur Status-Aktualisierung mit Lokalisierung
    updateStatus(statusKey, type = 'info') {
        if (!this.statusText) return;
        
        let message = statusKey;
        if (window.localization) {
            // Versuche Übersetzung zu finden
            if (statusKey === 'ready') {
                message = 'Bereit zum Sprechen';
            } else if (statusKey === 'speaking') {
                message = window.localization.t('messages.speaking');
            } else if (statusKey === 'error') {
                message = window.localization.t('messages.error_occurred');
            } else {
                message = window.localization.t(`messages.${statusKey}`) || statusKey;
            }
        }
        
        this.statusText.textContent = message;
        
        // Status-Styling
        this.statusText.className = `status-text ${type}`;
    }

    toggleChatToSpeech() {
        this.chatToSpeechEnabled = !this.chatToSpeechEnabled;
        
        if (this.chatToSpeechEnabled) {
            this.chatToggleBtn.innerHTML = '<i class="fas fa-toggle-on"></i>';
            this.chatToggleBtn.classList.add('active');
            this.chatSection.style.display = 'block';
            this.setupChatMonitoring();
            this.updateStatus('Chat-to-Speech aktiv');
        } else {
            this.chatToggleBtn.innerHTML = '<i class="fas fa-toggle-off"></i>';
            this.chatToggleBtn.classList.remove('active');
            this.chatSection.style.display = 'none';
            this.updateStatus('Chat-to-Speech deaktiviert');
        }
    }

    setupChatMonitoring() {
        // Simulation für Chat-Integration
        // In einer echten Implementierung würde hier die Clipboard-Überwachung 
        // oder Game-API-Integration stehen
        
        if (this.chatToSpeechEnabled && this.autoSpeak.checked) {
            // Überwache Zwischenablage für neue Chat-Nachrichten
            this.monitorClipboard();
        }
    }

    monitorClipboard() {
        // Einfache Clipboard-Überwachung für Demo-Zwecke
        let lastClipboard = '';
        
        const checkClipboard = async () => {
            if (!this.chatToSpeechEnabled) return;
            
            try {
                const text = await navigator.clipboard.readText();
                if (text !== lastClipboard && text.length > 0 && text.length < 200) {
                    lastClipboard = text;
                    
                    // Filtere Chat-Nachrichten (einfache Heuristik)
                    if (this.isChatMessage(text)) {
                        const cleanText = this.filterProfanity.checked ? 
                            this.cleanProfanity(text) : text;
                        
                        this.speak(cleanText, { volume: 0.6, rate: 1.3 });
                    }
                }
            } catch (err) {
                // Clipboard-Zugriff fehlgeschlagen (normal in manchen Browsern)
            }
            
            setTimeout(checkClipboard, 1000);
        };
        
        checkClipboard();
    }

    isChatMessage(text) {
        // Einfache Heuristik zur Erkennung von Chat-Nachrichten
        const chatPatterns = [
            /^\w+:\s*.+/,           // "Player: message"
            /^\[\w+\]\s*.+/,        // "[Player] message"
            /^<\w+>\s*.+/,          // "<Player> message"
            /^\w+\s*>>\s*.+/        // "Player >> message"
        ];
        
        return chatPatterns.some(pattern => pattern.test(text.trim()));
    }

    cleanProfanity(text) {
        // Einfacher Profanity-Filter
        const badWords = ['idiot', 'stupid', 'noob', 'trash', 'ez'];
        let cleaned = text;
        
        badWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            cleaned = cleaned.replace(regex, '*'.repeat(word.length));
        });
        
        return cleaned;
    }

    setupGameIntegration() {
        // API für externe Game-Integration
        window.gameTTS = {
            speak: (text, settings) => this.speak(text, settings),
            stop: () => this.stopSpeech(),
            setVoice: (voiceName) => this.setVoiceByName(voiceName),
            getVoices: () => this.voices.map(v => ({ name: v.name, lang: v.lang })),
            isReady: () => this.isInitialized,
            enableChatToSpeech: () => this.toggleChatToSpeech()
        };
        
        this.isInitialized = true;
        
        // Benachrichtige Parent-Window über Bereitschaft
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'tts-ready' }, '*');
        }
    }

    setVoiceByName(voiceName) {
        const voice = this.voices.find(v => v.name.includes(voiceName));
        if (voice) {
            const index = this.voices.indexOf(voice);
            this.selectQuickVoice(index);
            return true;
        }
        return false;
    }
}

// Initialize when page loads
let gameOverlay;

document.addEventListener('DOMContentLoaded', () => {
    gameOverlay = new GameTTSOverlay();
});

// Prevent context menu in overlay
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Handle window focus for better game integration
window.addEventListener('focus', () => {
    if (gameOverlay && gameOverlay.quickText) {
        gameOverlay.quickText.focus();
    }
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameTTSOverlay;
}
