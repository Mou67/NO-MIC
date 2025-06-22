class TTSManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.currentVoice = null;
        this.isInitialized = false;
        this.currentUtterance = null;
        this.autoLanguageDetection = true;
          this.initializeElements();
        this.setupEventListeners();
        this.loadVoices();
        this.initializeLocalization();
        this.loadLanguageSettings();
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
        // Title bar controls
        this.minimizeBtn = document.getElementById('minimize-btn');
        this.maximizeBtn = document.getElementById('maximize-btn');
        this.closeBtn = document.getElementById('close-btn');
        
        // Language controls
        this.languageSelect = document.getElementById('languageSelect');
        this.autoLanguageDetection = document.getElementById('autoLanguageDetection');
        
        // Main controls
        this.textInput = document.getElementById('textInput');
        this.voiceGrid = document.getElementById('voiceGrid');
        this.speedSlider = document.getElementById('speedSlider');
        this.pitchSlider = document.getElementById('pitchSlider');
        this.volumeSlider = document.getElementById('volumeSlider');
        
        // Buttons
        this.speakBtn = document.getElementById('speakBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Status and values
        this.statusDisplay = document.getElementById('statusDisplay');
        this.speedValue = document.getElementById('speedValue');
        this.pitchValue = document.getElementById('pitchValue');
        this.volumeValue = document.getElementById('volumeValue');
        this.charCount = document.getElementById('charCount');
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    setupEventListeners() {
        // Title bar controls
        if (window.electronAPI) {
            this.minimizeBtn?.addEventListener('click', () => {
                window.electronAPI.minimizeWindow();
            });
            
            this.maximizeBtn?.addEventListener('click', () => {
                window.electronAPI.maximizeWindow();
            });
            
            this.closeBtn?.addEventListener('click', () => {
                window.electronAPI.closeWindow();
            });
        }        // Text input
        this.textInput.addEventListener('input', () => {
            this.updateCharCount();
        });

        // Language controls
        this.languageSelect?.addEventListener('change', (e) => {
            window.localization.setLanguage(e.target.value);
        });

        this.autoLanguageDetection?.addEventListener('change', (e) => {
            this.autoLanguageDetection = e.target.checked;
            localStorage.setItem('tts-auto-language', this.autoLanguageDetection);
        });

        // Control sliders
        this.speedSlider.addEventListener('input', () => {
            this.speedValue.textContent = parseFloat(this.speedSlider.value).toFixed(1) + 'x';
        });

        this.pitchSlider.addEventListener('input', () => {
            this.pitchValue.textContent = parseFloat(this.pitchSlider.value).toFixed(1) + 'x';
        });

        this.volumeSlider.addEventListener('input', () => {
            this.volumeValue.textContent = Math.round(this.volumeSlider.value * 100) + '%';
        });

        // Action buttons
        this.speakBtn.addEventListener('click', () => {
            this.speak();
        });

        this.pauseBtn.addEventListener('click', () => {
            this.pauseResume();
        });

        this.stopBtn.addEventListener('click', () => {
            this.stop();
        });

        this.clearBtn.addEventListener('click', () => {
            this.clearText();
        });

        // Gaming features
        this.overlayToggleBtn = document.getElementById('overlayToggleBtn');
        this.apiInfoBtn = document.getElementById('apiInfoBtn');
        
        if (this.overlayToggleBtn) {
            this.overlayToggleBtn.addEventListener('click', () => {
                this.toggleOverlayMode();
            });
        }
        
        if (this.apiInfoBtn) {
            this.apiInfoBtn.addEventListener('click', () => {
                this.showAPIInfo();
            });
        }

        // Speech synthesis events
        this.synth.addEventListener('voiceschanged', () => {
            this.loadVoices();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        this.speak();
                        break;
                    case ' ':
                        e.preventDefault();
                        this.pauseResume();
                        break;
                    case 'Escape':
                        e.preventDefault();
                        this.stop();
                        break;
                }
            }
        });
    }

    async loadVoices() {
        this.updateStatus('Stimmen werden geladen...', 'loading');
        
        // Warten auf Stimmen
        await this.waitForVoices();
        
        this.voices = this.synth.getVoices();
        this.renderVoices();
        this.selectDefaultVoice();
        this.hideLoading();
        this.updateStatus('Bereit zum Sprechen');
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

    renderVoices() {
        this.voiceGrid.innerHTML = '';
        
        // Gruppiere Stimmen nach Sprache
        const voicesByLang = this.groupVoicesByLanguage();
        
        // Deutsche Stimmen zuerst
        const germanVoices = voicesByLang['de'] || [];
        const englishVoices = voicesByLang['en'] || [];
        const otherVoices = [];
        
        Object.keys(voicesByLang).forEach(lang => {
            if (lang !== 'de' && lang !== 'en') {
                otherVoices.push(...voicesByLang[lang]);
            }
        });
        
        const orderedVoices = [...germanVoices, ...englishVoices, ...otherVoices];
        
        orderedVoices.forEach((voice, index) => {
            const voiceCard = this.createVoiceCard(voice, index);
            this.voiceGrid.appendChild(voiceCard);
        });
    }

    groupVoicesByLanguage() {
        const grouped = {};
        this.voices.forEach(voice => {
            const lang = voice.lang.split('-')[0];
            if (!grouped[lang]) {
                grouped[lang] = [];
            }
            grouped[lang].push(voice);
        });
        return grouped;
    }

    createVoiceCard(voice, index) {
        const card = document.createElement('div');
        card.className = 'voice-card';
        card.dataset.voiceIndex = index;
        
        const lang = this.getLanguageName(voice.lang);
        const gender = this.detectGender(voice.name);
        
        card.innerHTML = `
            <div class="voice-info">
                <div class="voice-name">${voice.name}</div>
                <div class="voice-details">
                    <div class="voice-lang">🌍 ${lang}</div>
                    <div class="voice-gender">👤 ${gender}</div>
                </div>
                <button class="voice-test-btn" onclick="event.stopPropagation(); ttsManager.testVoice(${index})">
                    <i class="fas fa-play"></i> Testen
                </button>
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.selectVoice(index);
        });
        
        return card;
    }

    getLanguageName(langCode) {
        const langMap = {
            'de': 'Deutsch',
            'en': 'English',
            'es': 'Español',
            'fr': 'Français',
            'it': 'Italiano',
            'pt': 'Português',
            'ru': 'Русский',
            'ja': '日本語',
            'ko': '한국어',
            'zh': '中文',
            'ar': 'العربية',
            'hi': 'हिन्दी',
            'nl': 'Nederlands',
            'sv': 'Svenska',
            'no': 'Norsk',
            'da': 'Dansk',
            'fi': 'Suomi',
            'pl': 'Polski',
            'cs': 'Čeština',
            'hu': 'Magyar',
            'tr': 'Türkçe'
        };
        
        const lang = langCode.split('-')[0];
        return langMap[lang] || langCode;
    }

    detectGender(voiceName) {
        const name = voiceName.toLowerCase();
        
        if (name.includes('female') || name.includes('woman') || name.includes('frau') ||
            name.includes('weiblich') || name.includes('anna') || name.includes('maria') ||
            name.includes('sarah') || name.includes('emma') || name.includes('lisa')) {
            return 'Weiblich';
        } else if (name.includes('male') || name.includes('man') || name.includes('mann') ||
                   name.includes('männlich') || name.includes('david') || name.includes('mark') ||
                   name.includes('thomas') || name.includes('michael') || name.includes('stefan')) {
            return 'Männlich';
        }
        
        return 'Unbekannt';
    }

    selectVoice(index) {
        // Entferne vorherige Auswahl
        document.querySelectorAll('.voice-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Markiere neue Auswahl
        const selectedCard = document.querySelector(`[data-voice-index="${index}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        this.currentVoice = this.voices[index];
        this.updateStatus(`Stimme ausgewählt: ${this.currentVoice.name}`);
    }

    selectDefaultVoice() {
        // Versuche eine deutsche Stimme zu finden
        let defaultIndex = this.voices.findIndex(voice => 
            voice.lang.startsWith('de') && voice.localService
        );
        
        // Falls keine deutsche Stimme gefunden, nimm die erste verfügbare
        if (defaultIndex === -1) {
            defaultIndex = 0;
        }
        
        if (defaultIndex >= 0 && this.voices.length > 0) {
            this.selectVoice(defaultIndex);
        }
    }

    testVoice(index) {
        if (this.synth.speaking) {
            this.synth.cancel();
        }
        
        const voice = this.voices[index];
        const testText = voice.lang.startsWith('de') ? 
            'Hallo, das ist eine Testaufnahme meiner Stimme.' : 
            'Hello, this is a test recording of my voice.';
        
        const utterance = new SpeechSynthesisUtterance(testText);
        utterance.voice = voice;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        this.synth.speak(utterance);
    }    speak() {
        const text = this.textInput.value.trim();
        
        if (!text) {
            const message = window.localization ? window.localization.t('messages.text_required') : 'Bitte geben Sie Text ein';
            this.updateStatus(message, 'error');
            this.textInput.focus();
            return;
        }
        
        // Automatische Spracherkennung wenn aktiviert
        let targetVoice = this.currentVoice;
        if (this.autoLanguageDetection && window.localization) {
            const bestVoice = window.localization.getBestVoiceForText(text, this.voices);
            if (bestVoice) {
                targetVoice = bestVoice;
                // Stimme auswählen ohne UI zu aktualisieren
                this.currentVoice = targetVoice;
            }
        }
        
        if (!targetVoice) {
            const message = window.localization ? window.localization.t('messages.voice_not_available') : 'Bitte wählen Sie eine Stimme aus';
            this.updateStatus(message, 'error');
            return;
        }
        
        if (this.synth.speaking) {
            this.synth.cancel();
        }
        
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance.voice = targetVoice;
        this.currentUtterance.rate = parseFloat(this.speedSlider.value);
        this.currentUtterance.pitch = parseFloat(this.pitchSlider.value);
        this.currentUtterance.volume = parseFloat(this.volumeSlider.value);
        
        // Event listeners für die Sprachausgabe
        this.currentUtterance.onstart = () => {
            const message = window.localization ? window.localization.t('messages.speaking') : 'Spreche...';
            this.updateStatus(message, 'speaking');
            this.updateButtonStates(true);
            this.animateWaves(true);
        };
        
        this.currentUtterance.onend = () => {
            const message = window.localization ? window.localization.t('messages.speech_ended') : 'Sprachausgabe beendet';
            this.updateStatus(message);
            this.updateButtonStates(false);
            this.animateWaves(false);
        };
        
        this.currentUtterance.onerror = (event) => {
            const errorMsg = window.localization ? window.localization.t('messages.error_occurred') : 'Fehler';
            this.updateStatus(`${errorMsg}: ${event.error}`, 'error');
            this.updateButtonStates(false);
            this.animateWaves(false);
        };
        
        this.currentUtterance.onpause = () => {
            const message = window.localization ? window.localization.t('messages.paused') : 'Pausiert';
            this.updateStatus(message);
            this.animateWaves(false);
        };
        
        this.currentUtterance.onresume = () => {
            this.updateStatus('Spreche...', 'speaking');
            this.animateWaves(true);
        };
        
        this.synth.speak(this.currentUtterance);
    }

    pauseResume() {
        if (this.synth.speaking) {
            if (this.synth.paused) {
                this.synth.resume();
            } else {
                this.synth.pause();
            }
        }
    }

    stop() {
        if (this.synth.speaking) {
            this.synth.cancel();
        }
        this.updateStatus('Gestoppt');
        this.updateButtonStates(false);
        this.animateWaves(false);
    }

    clearText() {
        this.textInput.value = '';
        this.updateCharCount();
        this.textInput.focus();
        this.updateStatus('Text gelöscht');
    }

    updateCharCount() {
        const count = this.textInput.value.length;
        this.charCount.textContent = count;
        
        if (count > 900) {
            this.charCount.style.color = 'var(--danger-color)';
        } else if (count > 750) {
            this.charCount.style.color = 'var(--warning-color)';
        } else {
            this.charCount.style.color = 'var(--text-secondary)';
        }
    }

    updateButtonStates(isSpeaking) {
        this.speakBtn.disabled = isSpeaking;
        this.pauseBtn.disabled = !isSpeaking;
        this.stopBtn.disabled = !isSpeaking;
        
        if (isSpeaking) {
            this.speakBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Spreche...</span>';
        } else {
            this.speakBtn.innerHTML = '<i class="fas fa-play"></i><span>Sprechen</span>';
        }
    }

    updateStatus(message, type = 'info') {
        this.statusDisplay.className = 'status-display';
        if (type !== 'info') {
            this.statusDisplay.classList.add(type);
        }
        
        const icon = type === 'error' ? 'fa-exclamation-triangle' :
                    type === 'speaking' ? 'fa-volume-up' :
                    type === 'loading' ? 'fa-spinner fa-spin' :
                    'fa-info-circle';
        
        this.statusDisplay.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    }

    animateWaves(animate) {
        const waves = document.querySelectorAll('.wave');
        waves.forEach(wave => {
            if (animate) {
                wave.style.animationPlayState = 'running';
            } else {
                wave.style.animationPlayState = 'paused';
            }
        });
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }    // Gaming Integration Methods
    async toggleOverlayMode() {
        if (window.electronAPI) {
            try {
                const result = await window.electronAPI.toggleOverlay();
                if (result && result.success) {
                    this.updateStatus(`Overlay-Modus: ${result.isOverlayMode ? 'Aktiviert' : 'Deaktiviert'}`);
                } else {
                    this.updateStatus('Fehler beim Umschalten des Overlay-Modus', 'error');
                    console.error('Toggle overlay failed:', result);
                }
            } catch (error) {
                this.updateStatus('Verbindungsfehler beim Overlay-Umschaltung', 'error');
                console.error('Toggle overlay error:', error);
            }
        } else {
            this.updateStatus('Overlay nur in Desktop-App verfügbar', 'error');
        }
    }

    showAPIInfo() {
        const apiInfo = `
Game Integration API:

// Text sprechen
window.gameTTS.speak("Hello World!");

// Mit Einstellungen sprechen
window.gameTTS.speak("Text", {
    rate: 1.2,     // Geschwindigkeit
    pitch: 1.0,    // Tonhöhe  
    volume: 0.8    // Lautstärke
});

// Stoppen
window.gameTTS.stop();

// Stimme setzen
window.gameTTS.setVoice("Microsoft David");

// Verfügbare Stimmen abrufen
const voices = window.gameTTS.getVoices();

// Bereitschaft prüfen
if (window.gameTTS.isReady()) {
    // TTS ist bereit
}

Hotkeys:
F9  - Overlay umschalten
F10 - Schnell sprechen
F11 - Stoppen

Chat-to-Speech:
Aktiviere den Overlay-Modus und nutze die Chat-Integration
für automatische Sprachausgabe von Spieler-Nachrichten.
        `;
        
        // Erstelle ein Modal mit der API-Info
        this.showModal('Game Integration API', apiInfo);
    }

    showModal(title, content) {
        // Entferne existierendes Modal
        const existingModal = document.querySelector('.api-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'api-modal';
        modal.innerHTML = `
            <div class="api-modal-content">
                <div class="api-modal-header">
                    <h3>${title}</h3>
                    <button class="api-modal-close">&times;</button>
                </div>
                <div class="api-modal-body">
                    <pre>${content}</pre>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const closeBtn = modal.querySelector('.api-modal-close');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // ESC zum Schließen
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // Game API Integration
    setupGameAPI() {
        // Stelle TTS API für Spiele zur Verfügung
        window.gameTTS = {
            speak: (text, settings = {}) => {
                if (this.currentVoice) {
                    this.speakGameText(text, settings);
                }
            },
            stop: () => this.stop(),
            setVoice: (voiceName) => this.setVoiceByName(voiceName),
            getVoices: () => this.voices.map(v => ({ 
                name: v.name, 
                lang: v.lang,
                localService: v.localService 
            })),
            isReady: () => this.isInitialized && this.currentVoice !== null,
            enableChatToSpeech: () => this.toggleOverlayMode()
        };

        // Markiere als initialisiert
        this.isInitialized = true;
        
        // Dispatch custom event für Game-Integration
        window.dispatchEvent(new CustomEvent('gameTTSReady', {
            detail: { api: window.gameTTS }
        }));
    }

    speakGameText(text, settings = {}) {
        // Optimierte Einstellungen für Gaming
        const gameSettings = {
            rate: 1.2,     // Etwas schneller
            pitch: 1.0,
            volume: 0.7,   // Leiser für Gaming
            ...settings
        };

        if (this.synth.speaking) {
            this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = this.currentVoice;
        utterance.rate = gameSettings.rate;
        utterance.pitch = gameSettings.pitch;
        utterance.volume = gameSettings.volume;

        this.synth.speak(utterance);
    }

    setVoiceByName(voiceName) {
        const voice = this.voices.find(v => 
            v.name.toLowerCase().includes(voiceName.toLowerCase())
        );
        
        if (voice) {
            const index = this.voices.indexOf(voice);
            this.selectVoice(index);
            return true;
        }
        return false;
    }

    onLanguageChanged(language) {
        // Aktualisiere die gespeicherten Einstellungen
        localStorage.setItem('tts-language', language);
        
        // Lade die Voice-Liste neu um sie nach der neuen Sprache zu sortieren
        this.populateVoiceGrid();
        
        // Aktualisiere Status-Nachricht
        if (window.localization) {
            const message = window.localization.t('messages.language_changed');
            this.updateStatus(message);
        }
    }

    loadLanguageSettings() {
        // Lade automatische Spracherkennung Einstellung
        const autoLangSetting = localStorage.getItem('tts-auto-language');
        if (autoLangSetting !== null) {
            this.autoLanguageDetection = autoLangSetting === 'true';
            if (this.autoLanguageDetection) {
                this.autoLanguageDetection.checked = this.autoLanguageDetection;
            }
        }
    }

    filterVoicesByLanguage(targetLanguage) {
        if (!targetLanguage || !window.localization) return this.voices;
        
        const preferredLanguages = window.localization.getVoicesForLanguage(targetLanguage);
        const filtered = [];
        const others = [];
        
        this.voices.forEach(voice => {
            const isPreferred = preferredLanguages.some(lang => voice.lang.startsWith(lang));
            if (isPreferred) {
                filtered.push(voice);
            } else {
                others.push(voice);
            }
        });
        
        return [...filtered, ...others];
    }

    // Erweiterte Speak-Funktion für Gaming API
    speakWithSettings(text, settings = {}) {
        if (!text || !text.trim()) return false;

        const originalText = this.textInput.value;
        const originalVoice = this.currentVoice;
        const originalRate = this.speedSlider.value;
        const originalPitch = this.pitchSlider.value;
        const originalVolume = this.volumeSlider.value;

        try {
            // Temporäre Einstellungen anwenden
            this.textInput.value = text.trim();
            
            if (settings.voice && this.voices.find(v => v.name === settings.voice)) {
                this.currentVoice = this.voices.find(v => v.name === settings.voice);
            }
            
            if (settings.rate) {
                this.speedSlider.value = Math.max(0.5, Math.min(2, settings.rate));
            }
            
            if (settings.pitch) {
                this.pitchSlider.value = Math.max(0.5, Math.min(2, settings.pitch));
            }
            
            if (settings.volume) {
                this.volumeSlider.value = Math.max(0, Math.min(1, settings.volume));
            }

            // Sprechen
            this.speak();
            
            return true;
        } catch (error) {
            console.error('Fehler beim Sprechen mit Einstellungen:', error);
            return false;
        } finally {
            // Originalwerte wiederherstellen (nach kurzer Verzögerung)
            setTimeout(() => {
                this.textInput.value = originalText;
                this.currentVoice = originalVoice;
                this.speedSlider.value = originalRate;
                this.pitchSlider.value = originalPitch;
                this.volumeSlider.value = originalVolume;
            }, 100);
        }
    }
}

// Initialize the TTS Manager when the page loads
let ttsManager;

document.addEventListener('DOMContentLoaded', () => {
    ttsManager = new TTSManager();
    
    // Setup Game API nach Initialisierung
    setTimeout(() => {
        if (ttsManager) {
            ttsManager.setupGameAPI();
        }
    }, 1000);
});

// Prevent context menu
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Handle drag and drop for text files
document.addEventListener('drop', (e) => {
    e.preventDefault();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                if (text.length <= 1000) {
                    document.getElementById('textInput').value = text;
                    ttsManager.updateCharCount();
                    ttsManager.updateStatus('Text aus Datei geladen');
                } else {
                    ttsManager.updateStatus('Datei zu groß (max. 1000 Zeichen)', 'error');
                }
            };
            reader.readAsText(file);
        } else {
            ttsManager.updateStatus('Nur Textdateien (.txt) werden unterstützt', 'error');
        }
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TTSManager;
}
