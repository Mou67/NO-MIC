class LocalizationManager {
    constructor() {
        this.currentLanguage = 'de';
        this.translations = {};
        this.supportedLanguages = ['de', 'en', 'fr'];
        this.languageVoiceMap = {
            'de': ['de-DE', 'de-AT', 'de-CH'],
            'en': ['en-US', 'en-GB', 'en-AU', 'en-CA'],
            'fr': ['fr-FR', 'fr-CA', 'fr-CH'],
            'es': ['es-ES', 'es-MX', 'es-AR'],
            'it': ['it-IT'],
            'pt': ['pt-BR', 'pt-PT'],
            'ru': ['ru-RU'],
            'zh': ['zh-CN', 'zh-TW'],
            'ja': ['ja-JP'],
            'ko': ['ko-KR']
        };
        this.init();
    }

    async init() {
        // Lade gespeicherte Sprache oder verwende Systemsprache
        const savedLanguage = localStorage.getItem('tts-language');
        const systemLanguage = navigator.language.substring(0, 2);
        
        this.currentLanguage = savedLanguage || 
            (this.supportedLanguages.includes(systemLanguage) ? systemLanguage : 'de');
        
        await this.loadTranslations();
        this.updateUI();
    }

    async loadTranslations() {
        try {
            const response = await fetch(`./locales/${this.currentLanguage}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error('Fehler beim Laden der Übersetzungen:', error);
            // Fallback zu Deutsch
            if (this.currentLanguage !== 'de') {
                const response = await fetch('./locales/de.json');
                this.translations = await response.json();
            }
        }
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key; // Rückgabe des Schlüssels wenn Übersetzung nicht gefunden
            }
        }
        
        return value || key;
    }

    async setLanguage(language) {
        if (this.supportedLanguages.includes(language)) {
            this.currentLanguage = language;
            localStorage.setItem('tts-language', language);
            await this.loadTranslations();
            this.updateUI();
            
            // Event für Sprachänderung senden
            window.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language: language }
            }));
        }
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    getVoicesForLanguage(language) {
        return this.languageVoiceMap[language] || [];
    }

    detectLanguage(text) {
        // Einfache Spracherkennung basierend auf Zeichen
        const patterns = {
            'de': /[äöüßÄÖÜ]/,
            'fr': /[àâäéèêëïîôùûüÿç]/,
            'es': /[ñáéíóúü¿¡]/,
            'it': /[àèéìîíòóù]/,
            'pt': /[ãõáàâäéêíóôõúç]/,
            'ru': /[а-яё]/i,
            'zh': /[\u4e00-\u9fff]/,
            'ja': /[\u3040-\u309f\u30a0-\u30ff]/,
            'ko': /[\uac00-\ud7af]/
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                return lang;
            }
        }

        return 'en'; // Standard Englisch
    }

    getBestVoiceForText(text, availableVoices) {
        const detectedLanguage = this.detectLanguage(text);
        const preferredLanguages = this.getVoicesForLanguage(detectedLanguage);
        
        // Suche nach passenden Stimmen
        for (const langCode of preferredLanguages) {
            const voice = availableVoices.find(v => v.lang.startsWith(langCode));
            if (voice) return voice;
        }
        
        // Fallback zur ersten verfügbaren Stimme
        return availableVoices[0] || null;
    }

    updateUI() {
        // Aktualisiere alle UI-Elemente mit data-i18n Attribut
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Aktualisiere Titel
        document.title = this.t('app.title');
        
        // Aktualisiere Sprachauswahl
        this.updateLanguageSelector();
    }

    updateLanguageSelector() {
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            // Lösche vorhandene Optionen
            languageSelect.innerHTML = '';
            
            // Füge Optionen für unterstützte Sprachen hinzu
            this.supportedLanguages.forEach(lang => {
                const option = document.createElement('option');
                option.value = lang;
                option.textContent = this.t(`languages.${lang}`);
                if (lang === this.currentLanguage) {
                    option.selected = true;
                }
                languageSelect.appendChild(option);
            });
        }
    }
}

// Globale Instanz
window.localization = new LocalizationManager();
