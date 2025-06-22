const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Game integration
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
  closeOverlay: () => ipcRenderer.invoke('close-overlay'),
  getOverlayMode: () => ipcRenderer.invoke('get-overlay-mode'),
  
  // Game TTS API
  gameSpeak: (text, voiceSettings) => ipcRenderer.invoke('game-speak', text, voiceSettings),
  gameGetVoices: () => ipcRenderer.invoke('game-get-voices'),
  
  // IPC event listeners for hotkeys
  onQuickSpeak: (callback) => ipcRenderer.on('quick-speak', callback),
  onStopSpeech: (callback) => ipcRenderer.on('stop-speech', callback),
  onSpeakText: (callback) => ipcRenderer.on('speak-text', (event, text, settings) => callback(text, settings)),
  
  // Voice management
  onGetVoicesRequest: (callback) => ipcRenderer.on('get-voices-request', callback),
  sendVoicesResponse: (voices) => ipcRenderer.send('voices-response', voices)
});
