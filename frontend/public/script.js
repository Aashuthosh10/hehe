/**
 * Clara AI Reception System - Client Script
 */

class Clara {
    constructor() {
        this.socket = io(window.location.origin, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 500,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });
        this.conversationId = null;
        this.sessionId = null;
        this.speechRecognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.isListening = false;
        		this.isSpeechEnabled = true;
		this.isTextCleaningEnabled = true; // New property for text cleaning
		this.isTyping = false;
        this.isConversationStarted = false;
		this.availableVoices = [];
		this.pendingSpeakQueue = [];
		this.noSpeechRetries = 0;
		// iOS audio fix - track user interaction
		this.hasUserInteracted = false;
		// iOS: Store last response for replay
		this.lastBotResponse = null;
		// Video call state
		this.peerConnection = null;
		this.localStream = null;
		this.remoteStream = null;
		this.currentCallId = null;
        
        this.initializeElements();
        this.initializeSpeechRecognition();
		this.initializeVoices();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.setWelcomeTime();
        this.setupKeyboardShortcuts();
        this.setupDebugPanel(); // iOS debugging helper
    }

    initializeElements() {
        // Chat elements
        this.chatMessages = document.getElementById('chatMessages');
        this.speechInputButton = document.getElementById('speechInputButton');
        this.micIcon = document.getElementById('micIcon');
        this.speechStatusDisplay = document.getElementById('speechStatusDisplay');
        this.speechToggle = document.getElementById('speechToggle');
        this.speechIcon = document.getElementById('speechIcon');
        this.speechStatus = document.getElementById('speechStatus');
        
        // Text cleaning controls
        this.textCleaningToggle = document.getElementById('textCleaningToggle');
        this.textCleaningIcon = document.getElementById('textCleaningIcon');
        this.textCleaningStatus = document.getElementById('textCleaningStatus');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        
        // Error handling
        this.errorModal = document.getElementById('errorModal');
        this.errorTitle = document.getElementById('errorTitle');
        this.errorMessage = document.getElementById('errorMessage');
        this.closeError = document.getElementById('closeError');
        
        // Browser detection
        this.browserInfo = this.detectBrowser();
    }
    
    detectBrowser() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        const isAndroid = /android/i.test(ua);
        const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
        const isChrome = /chrome/i.test(ua) && !/edge/i.test(ua);
        const isFirefox = /firefox/i.test(ua);
        const isEdge = /edge/i.test(ua);
        
        // Detect in-app browsers
        const isInAppBrowser = 
            ua.includes('FBAN') || // Facebook in-app
            ua.includes('FBAV') || // Facebook in-app
            ua.includes('Instagram') || // Instagram in-app
            ua.includes('WhatsApp') || // WhatsApp in-app
            ua.includes('wv') || // Android WebView
            (isIOS && window.navigator.standalone === undefined && window.navigator.standalone !== true); // iOS in-app
        
        return {
            isIOS,
            isAndroid,
            isSafari,
            isChrome,
            isFirefox,
            isEdge,
            isInAppBrowser,
            isMobile: isIOS || isAndroid
        };
    }

    initializeSpeechRecognition() {
        // Check if we're in an unsupported browser environment
        if (this.browserInfo.isInAppBrowser) {
            const appName = this.getInAppBrowserName();
            this.speechInputButton.style.display = 'none';
            this.speechStatusDisplay.textContent = `Microphone not available in ${appName}`;
            this.showBrowserWarning(appName);
            return;
        }
        
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.speechRecognition = new SpeechRecognition();
            
            // Improved configuration for better reliability
            this.speechRecognition.continuous = false; // Changed to false for better control
            this.speechRecognition.interimResults = false; // Changed to false to avoid partial results
            this.speechRecognition.lang = 'en-US';
            this.speechRecognition.maxAlternatives = 1;
            
            this.speechRecognition.onstart = () => {
                this.isListening = true;
                this.speechInputButton.classList.add('recording');
                this.micIcon.className = 'fas fa-stop';
                this.speechStatusDisplay.textContent = 'Listening... Speak now!';
                this.speechStatusDisplay.classList.add('listening');
                this.updateStatus('Listening...', 'listening');
            };
            
            this.speechRecognition.onresult = (event) => {
                if (event.results.length > 0) {
                    const transcript = event.results[0][0].transcript.trim();
                    if (transcript) {
                        this.speechStatusDisplay.textContent = `Heard: "${transcript}"`;
                        this.sendMessage(transcript);
                    }
                }
            };
            
            this.speechRecognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                
                switch (event.error) {
                    case 'no-speech':
                        this.speechStatusDisplay.textContent = "Didn't catch that. Please try again.";
                        this.speechStatusDisplay.classList.remove('listening');
                        if (this.noSpeechRetries < 2 && this.isConversationStarted) {
                            this.noSpeechRetries += 1;
                            setTimeout(() => {
                                try { 
                                    this.speechRecognition.start(); 
                                } catch (e) {
                                    console.error('Failed to restart speech recognition:', e);
                                    this.resetSpeechInput();
                                }
                            }, 1000);
                            return;
                        }
                        break;
                        
                    case 'audio-capture':
                        this.showError('No microphone input detected. Please check your microphone and ensure it\'s not being used by another application.');
                        break;
                        
                    case 'not-allowed':
                    case 'service-not-allowed':
                        if (this.browserInfo.isIOS) {
                            this.showIOSMicrophoneError();
                        } else {
                            this.showError('Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.');
                        }
                        break;
                        
                    case 'network':
                        this.showError('Network error occurred. Please check your internet connection.');
                        break;
                        
                    case 'aborted':
                        // User manually stopped, no need to show error
                        break;
                        
                    default:
                        this.showError(`Speech recognition error: ${event.error}. Please try again.`);
                }
                
                this.resetSpeechInput();
            };
            
            this.speechRecognition.onend = () => {
                // Only reset if we're not trying to restart
                if (this.noSpeechRetries === 0) {
                    this.resetSpeechInput();
                }
            };
        } else {
            console.warn('Speech recognition not supported');
            this.speechInputButton.style.display = 'none';
            this.speechStatusDisplay.textContent = 'Speech recognition not supported in this browser';
            if (this.browserInfo.isIOS) {
                this.showIOSBrowserError();
            } else {
                this.showError('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari for the best experience.');
            }
        }
    }
    
    getInAppBrowserName() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        if (ua.includes('WhatsApp')) return 'WhatsApp browser';
        if (ua.includes('FBAN') || ua.includes('FBAV')) return 'Facebook browser';
        if (ua.includes('Instagram')) return 'Instagram browser';
        if (ua.includes('wv')) return 'in-app browser';
        return 'this in-app browser';
    }
    
    showBrowserWarning(appName) {
        const message = `Microphone is not available in ${appName}.\n\n` +
            `📱 To use voice input:\n\n` +
            `1. Open Safari on your iPhone\n` +
            `2. Go to: clara-ai-reception.onrender.com\n` +
            `3. Allow microphone permission when asked\n\n` +
            `💡 Tip: You can also type your messages instead!`;
        this.showError(message, 'Browser Not Supported');
    }
    
    showIOSMicrophoneError() {
        const message = `Microphone permission is required for voice input.\n\n` +
            `📱 To fix this on iPhone:\n\n` +
            `1. Open iPhone Settings\n` +
            `2. Go to Safari → Website Settings\n` +
            `3. Find this website and allow Microphone\n` +
            `4. Or refresh the page and tap "Allow" when prompted\n\n` +
            `💡 You can also use text input by typing your messages!`;
        this.showError(message, 'Microphone Permission Needed');
    }
    
    showIOSBrowserError() {
        const message = `Speech recognition works best in Safari on iPhone.\n\n` +
            `📱 Recommended:\n` +
            `• Use Safari browser (built-in iPhone browser)\n` +
            `• Or use Chrome from App Store\n\n` +
            `💡 For now, you can type your messages instead!`;
        this.showError(message, 'Browser Compatibility');
    }
    
    showIOSPlayButton(text) {
        // Find the last bot message and add a play button
        const messages = document.getElementById('chatMessages');
        if (!messages || !messages.lastElementChild) return;
        
        const lastMessage = messages.lastElementChild;
        if (!lastMessage.classList.contains('bot-message')) return;
        
        // Check if button already exists
        if (lastMessage.querySelector('.ios-play-audio-btn')) return;
        
        const messageContent = lastMessage.querySelector('.message-content');
        if (!messageContent) return;
        
        const playButton = document.createElement('button');
        playButton.className = 'ios-play-audio-btn';
        playButton.innerHTML = '<i class="fas fa-volume-up"></i> Tap to hear';
        
        playButton.onclick = async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (!this.speechSynthesis) {
                console.error('iOS: speechSynthesis not available');
                this.showError('Speech synthesis is not available in this browser.');
                return;
            }
            
            const textToSpeak = text || this.lastBotResponse;
            if (!textToSpeak) {
                console.error('iOS: No text to speak');
                return;
            }
            
            console.log('iOS: Button clicked, attempting to speak:', textToSpeak.substring(0, 50) + '...');
            
            // Mark as interacted
            this.hasUserInteracted = true;
            
            // Cancel any existing speech first
            try {
                this.speechSynthesis.cancel();
            } catch (e) {
                console.warn('iOS: Failed to cancel:', e);
            }
            
            // Ensure speechSynthesis is not paused (iOS requirement)
            try {
                if (this.speechSynthesis.paused) {
                    this.speechSynthesis.resume();
                }
            } catch (e) {
                console.warn('iOS: Resume check failed:', e);
            }
            
            // Get voices - try multiple sources
            let voices = [];
            try {
                voices = this.availableVoices && this.availableVoices.length > 0
                    ? this.availableVoices
                    : (this.speechSynthesis.getVoices() || []);
            } catch (e) {
                console.warn('iOS: Failed to get voices:', e);
            }
            
            console.log('iOS: Available voices:', voices.length);
            if (voices.length === 0) {
                console.warn('iOS: No voices available - trying without voice selection');
            }
            
            // Create utterance
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            
            // iOS Safari is picky about voice selection - only set if we have valid voices
            // Sometimes NOT setting a voice works better on iOS
            if (voices.length > 0) {
                // Prefer local voices (more reliable on iOS)
                const preferred = voices.find(v => v.localService && /en/i.test(v.lang))
                    || voices.find(v => /en(-|_)US/i.test(v.lang))
                    || voices.find(v => /en(-|_)GB/i.test(v.lang))
                    || voices.find(v => /en/i.test(v.lang))
                    || voices[0];
                
                if (preferred) {
                    utterance.voice = preferred;
                    console.log('iOS: Using voice:', preferred.name, preferred.lang, 'localService:', preferred.localService);
                }
            }
            
            // iOS-compatible settings
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0; // Full volume - iOS respects this
            utterance.lang = 'en-US';
            
            // Comprehensive error handling
            let hasStarted = false;
            let hasErrored = false;
            
            utterance.onstart = () => {
                hasStarted = true;
                console.log('iOS: ✅ Speech synthesis STARTED successfully');
                console.log('iOS: Text being spoken:', textToSpeak.substring(0, 100) + (textToSpeak.length > 100 ? '...' : ''));
                playButton.innerHTML = '<i class="fas fa-volume-up"></i> Speaking...';
                playButton.style.opacity = '0.7';
            };
            
            utterance.onend = () => {
                console.log('iOS: ✅ Speech synthesis COMPLETED successfully');
                setTimeout(() => {
                    playButton.remove();
                }, 500);
            };
            
            utterance.onerror = (event) => {
                hasErrored = true;
                const errorDetails = {
                    error: event.error,
                    charIndex: event.charIndex,
                    type: event.type,
                    utterance: event.utterance?.text?.substring(0, 50)
                };
                console.error('iOS: ❌ Speech synthesis ERROR:', errorDetails);
                console.error('iOS: Full error event:', event);
                
                // Show error feedback
                playButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
                playButton.style.background = '#ef4444';
                
                // Try to provide helpful error message
                let errorMsg = 'Audio playback failed. ';
                let helpMsg = '';
                switch (event.error) {
                    case 'not-allowed':
                        errorMsg += 'Permission denied.';
                        helpMsg = 'Go to Settings → Safari → Microphone → Allow';
                        break;
                    case 'audio-busy':
                        errorMsg += 'Audio system busy.';
                        helpMsg = 'Another app may be using audio. Close other apps and try again.';
                        break;
                    case 'audio-hardware':
                        errorMsg += 'Audio hardware issue.';
                        helpMsg = 'Check: 1) Volume is up, 2) Not in silent mode, 3) Speakers/headphones working';
                        break;
                    case 'synthesis-failed':
                        errorMsg += 'Synthesis failed.';
                        helpMsg = 'Your iOS version may not support speech synthesis. Try updating iOS.';
                        break;
                    case 'interrupted':
                        errorMsg += 'Speech was interrupted.';
                        helpMsg = 'This is usually normal if you clicked something else.';
                        break;
                    case 'canceled':
                        errorMsg += 'Speech was canceled.';
                        helpMsg = 'This is usually normal if you clicked something else.';
                        break;
                    default:
                        errorMsg += `Error: ${event.error || 'Unknown'}.`;
                        helpMsg = 'Check: 1) Volume up, 2) Not silent mode, 3) Safari settings';
                }
                
                console.warn('iOS: Help message:', helpMsg);
                
                setTimeout(() => {
                    this.showError(errorMsg + (helpMsg ? '\n\n' + helpMsg : ''));
                    playButton.innerHTML = '<i class="fas fa-volume-up"></i> Tap to hear';
                    playButton.style.background = '';
                    playButton.style.opacity = '1';
                    playButton.disabled = false;
                }, 2000);
            };
            
            utterance.onpause = () => {
                console.log('iOS: Speech paused');
            };
            
            utterance.onresume = () => {
                console.log('iOS: Speech resumed');
            };
            
            // Log complete state before speaking
            console.log('iOS: 🔊 PRE-SPEAK DIAGNOSTICS:');
            console.log('iOS: - speechSynthesis exists:', !!this.speechSynthesis);
            console.log('iOS: - speechSynthesis.speaking:', this.speechSynthesis.speaking);
            console.log('iOS: - speechSynthesis.pending:', this.speechSynthesis.pending);
            console.log('iOS: - speechSynthesis.paused:', this.speechSynthesis.paused);
            console.log('iOS: - Voices loaded:', voices.length);
            console.log('iOS: - Text length:', textToSpeak.length);
            console.log('iOS: - Utterance voice:', utterance.voice ? utterance.voice.name : 'default');
            console.log('iOS: - Utterance settings:', {
                rate: utterance.rate,
                pitch: utterance.pitch,
                volume: utterance.volume,
                lang: utterance.lang
            });
            
            // Update button state
            playButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
            playButton.disabled = true;
            
            try {
                // iOS Safari workaround: Sometimes need to cancel first, then wait a tiny bit
                if (this.speechSynthesis.speaking || this.speechSynthesis.pending) {
                    console.log('iOS: Canceling existing speech before starting new one');
                    this.speechSynthesis.cancel();
                    // Give iOS a moment to fully cancel
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                // CRITICAL: Call speak() synchronously from user interaction
                console.log('iOS: 🎤 Calling speechSynthesis.speak() NOW...');
                this.speechSynthesis.speak(utterance);
                console.log('iOS: ✅ speak() returned (no exception)');
                
                // Immediate state check (iOS Safari sometimes returns success but doesn't actually speak)
                setTimeout(() => {
                    const isActuallySpeaking = this.speechSynthesis.speaking || this.speechSynthesis.pending;
                    console.log('iOS: Post-speak() state check (100ms):', {
                        speaking: this.speechSynthesis.speaking,
                        pending: this.speechSynthesis.pending,
                        paused: this.speechSynthesis.paused,
                        hasStarted: hasStarted,
                        hasErrored: hasErrored,
                        isActuallySpeaking: isActuallySpeaking
                    });
                    
                    if (!isActuallySpeaking && !hasStarted && !hasErrored) {
                        console.warn('iOS: ⚠️ speak() returned but speech did not start - iOS Safari silent failure');
                    }
                }, 100);
                
                // Verify it actually started (iOS quirk - sometimes speak() doesn't work)
                setTimeout(() => {
                    if (!hasStarted && !hasErrored) {
                        console.error('iOS: ❌ Speech did NOT start after 1 second - iOS Safari bug confirmed');
                        console.error('iOS: Final speechSynthesis state:', {
                            speaking: this.speechSynthesis.speaking,
                            pending: this.speechSynthesis.pending,
                            paused: this.speechSynthesis.paused,
                            voicesAvailable: this.speechSynthesis.getVoices()?.length || 0,
                            utteranceText: utterance.text?.substring(0, 50)
                        });
                        
                        // Try iOS workaround: Cancel and retry once
                        console.log('iOS: 🔄 Attempting iOS Safari workaround - retry with cancel/resume');
                        try {
                            this.speechSynthesis.cancel();
                            this.speechSynthesis.resume();
                            
                            // Create new utterance (iOS sometimes needs fresh utterance)
                            const retryUtterance = new SpeechSynthesisUtterance(textToSpeak);
                            retryUtterance.rate = utterance.rate;
                            retryUtterance.pitch = utterance.pitch;
                            retryUtterance.volume = utterance.volume;
                            retryUtterance.lang = utterance.lang;
                            if (utterance.voice) retryUtterance.voice = utterance.voice;
                            
                            // Copy event handlers
                            retryUtterance.onstart = utterance.onstart;
                            retryUtterance.onend = utterance.onend;
                            retryUtterance.onerror = utterance.onerror;
                            
                            this.speechSynthesis.speak(retryUtterance);
                            console.log('iOS: Retry speak() called');
                            
                            // Check again after retry
                            setTimeout(() => {
                                if (!hasStarted && !hasErrored) {
                                    playButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Not supported';
                                    playButton.style.background = '#ffa500';
                                    playButton.disabled = false;
                                    
                                    const helpText = `Speech synthesis is not working on this device.

iOS Safari has a known bug where speech may fail silently.

Troubleshooting:
1. Check iOS version (iOS 14.5+ required)
2. Update Safari to latest version  
3. Go to Settings → Safari → Clear Website Data
4. Restart Safari completely
5. Ensure device volume is UP and NOT in silent mode
6. Try using Chrome from App Store instead`;

                                    this.showError(helpText);
                                    console.error('iOS: Speech synthesis failed after retry - device may not support it');
                                }
                            }, 1000);
                        } catch (retryError) {
                            console.error('iOS: Retry also failed:', retryError);
                            playButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Not supported';
                            playButton.style.background = '#ffa500';
                            playButton.disabled = false;
                            this.showError('Speech synthesis is not supported on this iOS version or device.');
                        }
                    }
                }, 1000);
                
            } catch (error) {
                console.error('iOS: ❌ Exception in speak():', error);
                console.error('iOS: Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                this.showError('Failed to start speech: ' + error.message);
                playButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed';
                playButton.style.background = '#ef4444';
                playButton.disabled = false;
            }
        };
        
        messageContent.appendChild(playButton);
    }

    initializeVoices() {
        if (!this.speechSynthesis) return;

        const loadVoices = () => {
            const voices = this.speechSynthesis.getVoices() || [];
            if (voices.length > 0) {
                this.availableVoices = voices;
                
                // Set default English voice
                const defaultVoice = voices.find(v => /en(-|_)US/i.test(v.lang) && /Google|Natural|Premium|Enhanced/i.test(v.name))
                    || voices.find(v => /en(-|_)GB/i.test(v.lang) && /Google|Natural|Premium|Enhanced/i.test(v.name))
                    || voices.find(v => /en(-|_)US/i.test(v.lang))
                    || voices.find(v => /en(-|_)GB/i.test(v.lang))
                    || voices.find(v => /en/i.test(v.lang));
                
                if (defaultVoice) {
                    console.log('Default English voice set:', defaultVoice.name, defaultVoice.lang);
                }
                
                // Flush any pending speech once voices are available
                if (this.pendingSpeakQueue.length > 0) {
                    const queue = [...this.pendingSpeakQueue];
                    this.pendingSpeakQueue = [];
                    queue.forEach(text => this.speak(text));
                }
            }
        };

        // Attempt to load immediately (Chrome may already have voices)
        loadVoices();
        // Also listen for async population of voices
        if (typeof window !== 'undefined') {
            window.speechSynthesis.onvoiceschanged = () => loadVoices();
            
            // Ensure speech synthesis is properly initialized
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
        }
    }

    setupEventListeners() {
        // Track user interaction for iOS audio - any click/touch enables audio
        const enableAudioOnInteraction = () => {
            if (!this.hasUserInteracted) {
                this.hasUserInteracted = true;
                console.log('User interaction detected - audio enabled for iOS');
                
                // iOS: Establish audio context immediately
                if (this.browserInfo.isIOS && this.speechSynthesis) {
                    try {
                        const unlockUtterance = new SpeechSynthesisUtterance('');
                        unlockUtterance.volume = 0.01;
                        unlockUtterance.onerror = () => {};
                        this.speechSynthesis.speak(unlockUtterance);
                        setTimeout(() => this.speechSynthesis.cancel(), 10);
                        console.log('iOS: Audio context unlocked');
                    } catch (e) {
                        console.warn('iOS: Audio unlock failed:', e);
                    }
                }
                
                // Process any queued speech - call immediately while in interaction context
                if (this.pendingSpeakQueue.length > 0 && this.isSpeechEnabled) {
                    const queued = [...this.pendingSpeakQueue];
                    this.pendingSpeakQueue = [];
                    // On iOS, must call synchronously, not in setTimeout
                    if (this.browserInfo.isIOS) {
                        queued.forEach(text => {
                            try {
                                this.speak(text);
                            } catch (e) {
                                console.error('iOS: Failed to speak queued text:', e);
                            }
                        });
                    } else {
                        setTimeout(() => {
                            queued.forEach(text => this.speak(text));
                        }, 100);
                    }
                }
            }
        };
        
        // Listen for any user interaction
        document.addEventListener('click', enableAudioOnInteraction, { once: true });
        document.addEventListener('touchstart', enableAudioOnInteraction, { once: true });
        document.addEventListener('keydown', enableAudioOnInteraction, { once: true });
        
        // Speech input button
        this.speechInputButton.addEventListener('click', () => {
            if (!this.isConversationStarted) {
                this.startConversation();
                return;
            }
            
            if (this.isListening) {
                this.speechRecognition.stop();
            } else {
                this.startSpeechRecognition();
            }
        });

        // Speech toggle
        this.speechToggle.addEventListener('click', () => {
            this.toggleSpeech();
        });

        // Text cleaning toggle
        this.textCleaningToggle.addEventListener('click', () => {
            this.toggleTextCleaning();
        });

        // Error modal
        if (this.closeError) {
            this.closeError.addEventListener('click', () => {
                this.closeErrorModal();
            });
        }

        // Close error modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeErrorModal();
            }
        });
    }

    setupSocketListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateStatus('Connected', 'ready');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateStatus('Disconnected', 'error');
        });

        // Conversation events
        this.socket.on('conversation-started', (data) => {
            console.log('Conversation started:', data);
            this.sessionId = data.sessionId;
            this.conversationId = data.callId;
            this.isConversationStarted = true;
            this.selectedStaffId = data.selectedStaffId || this.selectedStaffId;
            this.updateStatus('Ready to chat', 'ready');
            this.speechStatusDisplay.textContent = 'Click the microphone to speak';
            
            // Store user data for welcome message
            this.userData = data;
            
            // Add welcome message
            let welcome;
            if (data.purpose && data.purpose.trim() !== "Just wanted to chat and get some help") {
                welcome = `Hi ${data.name}! I'm Clara, your friendly AI receptionist! 😊 I see you mentioned: "${data.purpose}". I'd love to help you with that and anything else you need! What would you like to know?`;
            } else {
                welcome = `Hi ${data.name}! I'm Clara, your friendly AI receptionist! 😊 I'm so excited to help you today! What can I assist you with? Feel free to ask me anything - I'm here to help!`;
            }
			this.addMessage(welcome, 'bot');
			if (this.isSpeechEnabled) {
				this.speak(welcome);
			}
        });

        // Video call flow (targeted staff request)
        this.socket.on('initiate-video-call', (data) => {
            try {
                console.log('🎥 Initiating video call:', data);
                const payload = {
                    staffName: data.staffName,
                    staffEmail: data.staffEmail,
                    staffDepartment: data.staffDepartment,
                    clientName: (this.userData && this.userData.name) ? this.userData.name : 'Client',
                    clientSocketId: this.socket.id
                };
                this.socket.emit('video-call-request', payload);
                this.updateStatus('Connecting to staff...', 'processing');
                this.addMessage('Please wait while I establish the connection...', 'bot');
            } catch (error) {
                console.error('Error initiating video call:', error);
            }
        });

        // Fallback: if initiate-video-call missing staffEmail, derive from selected staff and re-send
        this.socket.on('initiate-video-call', (data) => {
            if (!data.staffEmail && this.selectedStaffId) {
                try {
                    const staffMap = {
                        'NN': 'nagashreen@gmail.com',
                        'LDN': 'lakshmidurgan@gmail.com',
                        'ACS': 'anithacs@gmail.com',
                        'GD': 'gdhivyasri@gmail.com',
                        'NSK': 'nishask@gmail.com',
                        'ABP': 'amarnathbpatil@gmail.com',
                        'JK': 'jyotikumari@gmail.com',
                        'VR': 'vidyashreer@gmail.com',
                        'BA': 'bhavanaa@gmail.com',
                        'BTN': 'bhavyatn@gmail.com'
                    };
                    const fallbackEmail = staffMap[this.selectedStaffId];
                    if (fallbackEmail) {
                        this.socket.emit('video-call-request', {
                            staffName: data.staffName || this.userData?.staffName || 'Staff',
                            staffEmail: fallbackEmail,
                            staffDepartment: data.staffDepartment || 'Computer Science Engineering',
                            clientName: (this.userData && this.userData.name) ? this.userData.name : 'Client',
                            clientSocketId: this.socket.id
                        });
                    }
                } catch (_) {}
            }
        });

        this.socket.on('video-call-request-sent', (data) => {
            console.log('Video call request sent:', data);
            this.updateStatus('Request sent. Waiting for staff...', 'processing');
        });

        this.socket.on('video-call-accepted', (data) => {
            console.log('Video call accepted:', data);
            this.updateStatus('Staff accepted. Starting call...', 'ready');
            this.addMessage(`Great news! ${data.staffName} accepted your video call.`, 'bot');
        });

        this.socket.on('video-call-rejected', (data) => {
            console.log('Video call rejected:', data);
            this.updateStatus('Staff unavailable', 'error');
            this.addMessage(data.message || 'The staff member is not available for a video call right now.', 'bot');
        });

        // Display QR code when a call ends and server sends it
        this.socket.on('call-completed-qr', async (data) => {
            try {
                const qrContainer = document.createElement('canvas');
                await (window.QRCode && QRCode.toCanvas)
                    ? QRCode.toCanvas(qrContainer, data.qrCode?.data || JSON.stringify(data.qrCode || {}), { width: 200, margin: 2 })
                    : Promise.resolve();

                const modal = document.createElement('div');
                modal.className = 'qr-code-modal';
                modal.innerHTML = `
                    <div class="qr-code-content">
                        <h3>${data.message || 'Your QR code'}</h3>
                        <div class="qr-code-canvas"></div>
                        <p><small>If you don't see a QR image, it may be a demo text QR.</small></p>
                        <button class="btn btn-primary" id="qrCloseBtn">Close</button>
                    </div>`;
                document.body.appendChild(modal);
                const holder = modal.querySelector('.qr-code-canvas');
                holder.appendChild(qrContainer);
                modal.querySelector('#qrCloseBtn').onclick = () => modal.remove();
            } catch (err) {
                console.error('Error showing QR code:', err);
            }
        });

        // Show server-side conversation errors immediately
        this.socket.on('conversation-error', (data) => {
            const msg = (data && data.message) ? data.message : 'Failed to start conversation.';
            this.showError(msg);
            this.updateStatus('Error', 'error');
        });

        this.socket.on('ai-response', (data) => {
            this.hideTypingIndicator();
            this.addMessage(data.response, 'bot');
            
            // Store last response for iOS replay
            this.lastBotResponse = data.response;
            
            if (this.isSpeechEnabled) {
                // iOS: Socket.IO responses come outside user interaction window
                // Always show play button for iOS as fallback
                if (this.browserInfo.isIOS) {
                    // Show play button - user can tap to hear
                    this.showIOSPlayButton(data.response);
                    // Also try auto-play (might work if audio context still valid)
                    try {
                        this.speak(data.response);
                    } catch (e) {
                        console.log('iOS: Auto-play failed (expected), user can tap play button');
                    }
                } else {
                    // Non-iOS: works normally
                    this.speak(data.response);
                }
            }
            
            this.updateStatus('Ready', 'ready');
        });

        this.socket.on('call-accepted', (data) => {
            this.addMessage(`Your call has been accepted by ${data.staffName} from ${data.staffDepartment}. You will be connected shortly.`, 'system');
        });

        this.socket.on('call-completed', (data) => {
            const decision = data.decision === 'accepted' ? 'accepted' : 'declined';
            this.addMessage(`Your meeting request has been ${decision}. ${data.notes ? 'Notes: ' + data.notes : ''}`, 'system');
        });

        // Call started -> initialize WebRTC as caller
        this.socket.on('call-started', async (data) => {
            try {
                this.currentCallId = data.callId;
                await this.initializeWebRTCForClient();
                await this.createOffer();
                this.addMessage('Starting video call...', 'system');
            } catch (e) {
                console.error('Failed to start video call:', e);
            }
        });

        // Receive answer from staff
        this.socket.on('answer', async (data) => {
            try {
                if (!this.peerConnection || data.callId !== this.currentCallId) return;
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (e) {
                console.error('Failed to handle answer:', e);
            }
        });

        // Receive ICE candidate from staff
        this.socket.on('ice-candidate', async (data) => {
            try {
                if (!this.peerConnection || data.callId !== this.currentCallId) return;
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error('Failed to add ICE candidate:', e);
            }
        });

        // Error handling
        this.socket.on('error', (data) => {
            console.error('Socket error:', data);
            this.showError(data.message || 'An error occurred');
            this.updateStatus('Error', 'error');
        });
        
        // Connection error handling
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            const msg = (error && (error.message || error.description)) || 'Failed to connect to server.';
            this.showError(msg + ' Retrying...');
            this.updateStatus('Reconnecting...', 'connecting');
        });

        this.socket.on('reconnect_attempt', (n) => {
            this.updateStatus('Reconnecting...', 'connecting');
        });

        this.socket.on('reconnect', () => {
            this.updateStatus('Connected', 'ready');
        });

        this.socket.on('reconnect_failed', () => {
            this.updateStatus('Connection Failed', 'error');
            this.showError('Unable to reconnect to server. Please refresh the page.');
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Spacebar to toggle speech input
            if (e.code === 'Space' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                if (!this.isConversationStarted) {
                    this.startConversation();
                    return;
                }
                
                if (this.speechRecognition) {
                    if (this.isListening) {
                        this.speechRecognition.stop();
                    } else {
                        this.startSpeechRecognition();
                    }
                }
            }
        });
    }

    setupDebugPanel() {
        // Show debug panel on mobile devices (iOS/Android) where Web Inspector isn't easily accessible
        // Also add fallback check in case browser detection fails
        const isMobileDevice = this.browserInfo.isMobile || 
                              /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
                              (window.innerWidth < 768); // Fallback: small screen = likely mobile
        
        if (!isMobileDevice) {
            console.log('Debug panel: Not showing (desktop device)');
            return;
        }
        
        // Ensure body is ready before creating panel
        if (!document.body) {
            setTimeout(() => this.setupDebugPanel(), 100);
            return;
        }
        
        // Check if already exists
        if (document.getElementById('debugToggleBtn')) {
            console.log('Debug panel: Already exists');
            return;
        }
        
        console.log('Debug panel: Initializing for mobile device', {
            isIOS: this.browserInfo.isIOS,
            isMobile: this.browserInfo.isMobile,
            userAgent: navigator.userAgent.substring(0, 50),
            screenWidth: window.innerWidth
        });
        
        // Create debug panel HTML
        const debugPanelHTML = `
            <div id="iosDebugPanel" style="display: none; position: fixed; bottom: 10px; right: 10px; width: 90%; max-width: 400px; max-height: 300px; background: rgba(0, 0, 0, 0.9); color: #fff; border-radius: 10px; padding: 15px; z-index: 10000; font-family: monospace; font-size: 11px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 8px;">
                    <strong style="color: #ffa500;">🐛 Mobile Debug Panel</strong>
                    <div>
                        <button id="debugClearBtn" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 5px; font-size: 10px; cursor: pointer;">Clear</button>
                        <button id="debugCloseBtn" style="background: #666; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">✕</button>
                    </div>
                </div>
                <div id="debugLogs" style="line-height: 1.4;"></div>
            </div>
            <button id="debugToggleBtn" style="position: fixed; bottom: 10px; right: 10px; background: rgba(0, 0, 0, 0.7); color: #ffa500; border: none; padding: 8px 12px; border-radius: 20px; z-index: 9999; font-size: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                🐛 Debug
            </button>
        `;
        
        try {
            document.body.insertAdjacentHTML('beforeend', debugPanelHTML);
            
            const debugPanel = document.getElementById('iosDebugPanel');
            const debugLogs = document.getElementById('debugLogs');
            const debugToggleBtn = document.getElementById('debugToggleBtn');
            const debugCloseBtn = document.getElementById('debugCloseBtn');
            const debugClearBtn = document.getElementById('debugClearBtn');
            
            if (!debugPanel || !debugLogs || !debugToggleBtn) {
                console.error('Debug panel: Failed to create elements');
                return;
            }
            
            // Toggle panel
            debugToggleBtn.addEventListener('click', () => {
                debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
            });
            
            debugCloseBtn.addEventListener('click', () => {
                debugPanel.style.display = 'none';
            });
            
            debugClearBtn.addEventListener('click', () => {
                debugLogs.innerHTML = '';
            });
            
            // Intercept console methods to show in panel
            const originalLog = console.log;
            const originalWarn = console.warn;
            const originalError = console.error;
            
            const addLog = (message, type = 'log') => {
                const timestamp = new Date().toLocaleTimeString();
                const colors = {
                    log: '#0ea5e9',
                    warn: '#f59e0b',
                    error: '#ef4444'
                };
                const icons = {
                    log: 'ℹ️',
                    warn: '⚠️',
                    error: '❌'
                };
                
                const logEntry = document.createElement('div');
                logEntry.style.marginBottom = '6px';
                logEntry.style.padding = '4px';
                logEntry.style.borderLeft = `3px solid ${colors[type]}`;
                logEntry.style.paddingLeft = '8px';
                logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> <span style="color: ${colors[type]};">${icons[type]} ${String(message)}</span>`;
                
                debugLogs.appendChild(logEntry);
                debugLogs.scrollTop = debugLogs.scrollHeight;
                
                // Keep only last 50 logs
                while (debugLogs.children.length > 50) {
                    debugLogs.removeChild(debugLogs.firstChild);
                }
            };
            
            console.log = (...args) => {
                originalLog.apply(console, args);
                addLog(args.join(' '), 'log');
            };
            
            console.warn = (...args) => {
                originalWarn.apply(console, args);
                addLog(args.join(' '), 'warn');
            };
            
            console.error = (...args) => {
                originalError.apply(console, args);
                addLog(args.join(' '), 'error');
            };
            
            // Show initial debug info
            setTimeout(() => {
                console.log('🔍 Mobile Debug Panel Initialized');
                console.log(`Device: ${this.browserInfo.isIOS ? 'iOS' : this.browserInfo.isAndroid ? 'Android' : 'Mobile'}`);
                console.log(`Browser: ${this.browserInfo.isSafari ? 'Safari' : this.browserInfo.isChrome ? 'Chrome' : 'Other'}`);
                console.log(`In-App Browser: ${this.browserInfo.isInAppBrowser ? 'Yes' : 'No'}`);
                console.log(`Speech Synthesis: ${this.speechSynthesis ? 'Available' : 'Not Available'}`);
                console.log(`Voices Available: ${this.availableVoices?.length || 0}`);
                console.log(`User Interacted: ${this.hasUserInteracted ? 'Yes' : 'No'}`);
                
                if (this.speechSynthesis) {
                    const voices = this.speechSynthesis.getVoices() || [];
                    console.log(`Current Voices: ${voices.length}`);
                    if (voices.length > 0) {
                        const voiceNames = voices.slice(0, 3).map(v => v.name).join(', ');
                        console.log(`Sample Voices: ${voiceNames}${voices.length > 3 ? '...' : ''}`);
                    }
                }
            }, 1000);
            
            console.log('✅ Debug panel created successfully');
        } catch (error) {
            console.error('❌ Failed to setup debug panel:', error);
        }
    }

    startConversation() {
        // Show conversation start form
        this.showConversationForm();
    }

    showConversationForm() {
		const formHTML = `
            <div class="conversation-form-overlay">
                <div class="conversation-form">
                                         <h2>Let's Get Started! 😊</h2>
                     <p>Hi there! I'm Clara and I'm excited to chat with you! Just tell me your name and email, and optionally share what brings you here. I'll analyze everything from your voice or text to help you better!</p>
                    
                                         <form id="conversationForm">
                         <div class="form-group">
                             <label for="userName">Your Name</label>
 							<div style="display:flex; gap:8px; align-items:center;">
 								<input type="text" id="userName" name="name" required>
 								<button type="button" class="btn btn-secondary field-mic" data-field="userName" title="Speak your name">
 									<i class="fas fa-microphone"></i>
 								</button>
 							</div>
                         </div>
                         
                         <div class="form-group">
                             <label for="userEmail">Email Address</label>
 							<div style="display:flex; gap:8px; align-items:center;">
 								<input type="email" id="userEmail" name="email" required>
 								<button type="button" class="btn btn-secondary field-mic" data-field="userEmail" title="Speak your email">
 									<i class="fas fa-microphone"></i>
 								</button>
 							</div>
                         </div>
                         
                         <div class="form-group">
                             <label for="purpose">Tell me about your visit (optional)</label>
 							<div style="display:flex; gap:8px; align-items:center;">
 								<textarea id="purpose" name="purpose" placeholder="You can tell me anything - I'll analyze it from your voice or text! Or just say 'hello' to start chatting." rows="3"></textarea>
 								<button type="button" class="btn btn-secondary field-mic" data-field="purpose" title="Speak about your visit">
 									<i class="fas fa-microphone"></i>
 								</button>
 							</div>
                         </div>
                         
                         <div class="form-group">
                             <label for="staffSelect">Select Staff Member <span id="staffStatus" style="color: #666; font-size: 12px;">(Loading...)</span></label>
                             <select id="staffSelect" name="selectedStaffId" required>
                                 <option value="">Loading staff members...</option>
                             </select>
                         </div>
                         
                         <div class="form-actions">
                             <button type="submit" class="btn btn-primary">
                                 <i class="fas fa-play"></i>
                                 Start Conversation
                             </button>
                         </div>
                     </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', formHTML);
        
        const form = document.getElementById('conversationForm');
        form.addEventListener('submit', (e) => this.handleConversationSubmit(e));
        
        // Load available staff with a small delay to ensure DOM is ready
        setTimeout(() => {
            this.loadAvailableStaff().then(() => {
                console.log('✅ Staff loading completed');
            }).catch(error => {
                console.error('❌ Staff loading failed:', error);
            });
        }, 100);
		
		// Voice dictation buttons for form fields
		const fieldMics = document.querySelectorAll('.field-mic');
		fieldMics.forEach(btn => {
			btn.addEventListener('click', () => {
				const fieldId = btn.getAttribute('data-field');
				this.dictateToField(fieldId, fieldId === 'userEmail' ? 'email' : 'text', btn);
			});
		});
    }

	// Load available staff members
	async loadAvailableStaff() {
		try {
			console.log('🔄 Loading available staff...');
			let staff = [];
			let response;
			try {
				response = await fetch('/api/staff/available');
				if (response.ok) {
					staff = await response.json();
				}
			} catch (_) {}

			// Always include static staff directory if connected list is empty OR to allow selecting staff before they log in
			if (!Array.isArray(staff) || staff.length === 0) {
				console.log('ℹ️ No connected staff. Falling back to static staff list');
				const res2 = await fetch('/api/staff/list');
				if (res2.ok) {
					staff = await res2.json();
				}
			}
			// If some are connected, enrich by appending static entries that are not present yet
			else {
				try {
					const res2 = await fetch('/api/staff/list');
					if (res2.ok) {
						const staticList = await res2.json();
						const existingIds = new Set(staff.map(s => s._id || s.id));
						staticList.forEach(s => { if (!existingIds.has(s._id)) staff.push(s); });
					}
				} catch (_) {}
			}
			console.log('📋 Staff data received:', staff);
			
			const staffSelect = document.getElementById('staffSelect');
			if (staffSelect && staff.length > 0) {
				const options = '<option value="">Select a staff member...</option>' +
					staff.map(member => `<option value="${member._id || member.id}">${member.name} (${member.department || 'General'})</option>`).join('');
				staffSelect.innerHTML = options;
				
				// Update status
				const staffStatus = document.getElementById('staffStatus');
				if (staffStatus) {
					staffStatus.textContent = `(${staff.length} staff members available)`;
					staffStatus.style.color = '#10b981';
				}
				
				console.log('✅ Staff dropdown populated with', staff.length, 'options');
			} else {
				staffSelect.innerHTML = '<option value="">No staff members available</option>';
				
				// Update status
				const staffStatus = document.getElementById('staffStatus');
				if (staffStatus) {
					staffStatus.textContent = '(No staff available)';
					staffStatus.style.color = '#ef4444';
				}
				
				console.log('⚠️ No staff members available');
			}
		} catch (error) {
			console.error('❌ Error loading staff:', error);
			const staffSelect = document.getElementById('staffSelect');
			if (staffSelect) {
				staffSelect.innerHTML = '<option value="">Failed to load staff - please refresh</option>';
			}
			
			// Update status
			const staffStatus = document.getElementById('staffStatus');
			if (staffStatus) {
				staffStatus.textContent = '(Failed to load)';
				staffStatus.style.color = '#ef4444';
			}
			
			// Show error to user
			this.showError('Failed to load staff members. Please refresh the page and try again.');
		}
	}

	// Dictate to a specific form field using a temporary SpeechRecognition instance
	dictateToField(fieldId, fieldType = 'text', buttonEl) {
		if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
			this.showError('Speech recognition is not supported in your browser.');
			return;
		}
		const target = document.getElementById(fieldId);
		if (!target) return;
		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		const rec = new SpeechRecognition();
		rec.continuous = false;
		rec.interimResults = false;
		rec.lang = 'en-US';
		rec.onstart = () => { if (buttonEl) buttonEl.classList.add('recording'); };
		rec.onend = () => { if (buttonEl) buttonEl.classList.remove('recording'); };
		rec.onerror = () => { if (buttonEl) buttonEl.classList.remove('recording'); };
		rec.onresult = (event) => {
			let transcript = (event.results[0][0].transcript || '').trim();
			if (!transcript) return;
			if (fieldType === 'email') {
				// Basic normalization for spoken emails
				transcript = transcript
					.replace(/ at /gi, '@')
					.replace(/ dot /gi, '.')
					.replace(/ underscore /gi, '_')
					.replace(/ dash /gi, '-')
					.replace(/\s+/g, '')
					.toLowerCase();
				target.value = transcript;
			} else if (fieldType === 'select') {
				const select = target;
				let matched = null;
				const spoken = transcript.toLowerCase();
				Array.from(select.options).forEach(opt => {
					const label = String(opt.textContent || opt.value || '').toLowerCase();
					if (!matched && (label === spoken || label.includes(spoken) || spoken.includes(label))) {
						matched = opt.value;
					}
				});
				if (matched) {
					select.value = matched;
				} else {
					this.showError(`Could not match purpose: "${transcript}". Please select from the list.`);
				}
			} else {
				target.value = transcript;
			}
		};
		try { rec.start(); } catch (e) {}
	}

    handleConversationSubmit(e) {
        e.preventDefault();
        
        // Check if staff is loaded
        const staffSelect = document.getElementById('staffSelect');
        if (!staffSelect || staffSelect.options.length <= 1) {
            console.error('❌ Staff not loaded yet!');
            this.showError('Staff members are still loading. Please wait a moment and try again.');
            return;
        }
        
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            purpose: formData.get('purpose'),
            selectedStaffId: formData.get('selectedStaffId')
        };
        
        console.log('📝 Form data collected:', data);
        
        // Validate form data
        if (!data.name || !data.email) {
            this.showError('Please provide your name and email');
            return;
        }
        
        if (!data.selectedStaffId) {
            console.error('❌ No staff member selected!');
            this.showError('Please select a staff member');
            return;
        }
        
        // If no purpose provided, set a default friendly message
        if (!data.purpose || data.purpose.trim() === '') {
            data.purpose = "Just wanted to chat and get some help";
        }
        
        // Remove the form
        const overlay = document.querySelector('.conversation-form-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Update UI
        this.updateStatus('Starting conversation...', 'processing');
        this.speechStatusDisplay.textContent = 'Setting up your conversation...';
        
        // Start conversation with server
        try {
            this.socket.emit('start-conversation', data);
            console.log('Emitting start-conversation with data:', data);
            
            // Store selected staff information for video call requests
            this.selectedStaffId = data.selectedStaffId;
            this.userData = {
                name: data.name,
                email: data.email,
                purpose: data.purpose
            };
            
            // Automatically trigger video call request after conversation starts
            setTimeout(() => {
                this.triggerVideoCallRequest(data);
            }, 2000); // Wait 2 seconds for conversation to establish
            
            // Set a timeout for conversation start
            setTimeout(() => {
                if (!this.isConversationStarted) {
                    this.showError('Failed to start conversation. Please check your connection and try again.');
                    this.updateStatus('Error', 'error');
                }
            }, 10000); // 10 second timeout
            
        } catch (error) {
            console.error('Error starting conversation:', error);
            this.showError('Failed to start conversation. Please try again.');
            this.updateStatus('Error', 'error');
        }
    }

    startSpeechRecognition() {
        if (!this.speechRecognition) {
            this.showError('Speech recognition is not available in your browser.');
            return;
        }
        
        if (!this.isConversationStarted) {
            this.showError('Please start a conversation first.');
            return;
        }
        
        if (this.isListening) {
            try {
                this.speechRecognition.stop();
            } catch (e) {
                console.error('Failed to stop speech recognition:', e);
            }
            return;
        }
        
        // Reset retry counter
        this.noSpeechRetries = 0;
        
        try {
            this.speechRecognition.start();
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            this.showError('Failed to start speech recognition. Please try again.');
            this.resetSpeechInput();
        }
    }

    resetSpeechInput() {
        this.isListening = false;
        this.noSpeechRetries = 0; // Reset retry counter
        
        // Reset UI elements
        this.speechInputButton.classList.remove('recording');
        this.micIcon.className = 'fas fa-microphone';
        this.speechStatusDisplay.classList.remove('listening');
        
        // Update status text based on conversation state
        if (this.isConversationStarted) {
            this.speechStatusDisplay.textContent = 'Click the microphone to speak';
            this.updateStatus('Ready to chat', 'ready');
        } else {
            this.speechStatusDisplay.textContent = 'Click to start conversation';
            this.updateStatus('Ready', 'ready');
        }
    }

    sendMessage(message) {
        if (!message.trim() || !this.isConversationStarted) return;
        
        // iOS Safari audio fix: Establish audio context immediately from user interaction
        // This MUST be called synchronously during the user's click/tap event
        if (this.browserInfo.isIOS && this.isSpeechEnabled && this.speechSynthesis) {
            // Call speechSynthesis during user interaction to unlock audio
            // Use minimal utterance to establish context
            try {
                const unlockUtterance = new SpeechSynthesisUtterance('');
                unlockUtterance.volume = 0.01; // Almost silent
                unlockUtterance.onerror = () => {}; // Ignore errors
                this.speechSynthesis.speak(unlockUtterance);
                // Immediately cancel to keep it silent
                setTimeout(() => this.speechSynthesis.cancel(), 10);
                this.hasUserInteracted = true; // Mark as interacted
                console.log('iOS: Audio context established from user interaction');
            } catch (e) {
                console.warn('iOS: Failed to establish audio context:', e);
            }
        }
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Update status
        this.updateStatus('Processing...', 'processing');
        
        // Send message via Socket.IO
        this.socket.emit('chat-message', {
            sessionId: this.sessionId,
            message: message
        });
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.setAttribute('role', 'article');
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        const icon = document.createElement('i');
        if (sender === 'bot') {
            icon.className = 'fas fa-robot';
        } else if (sender === 'user') {
            icon.className = 'fas fa-user';
        } else if (sender === 'system') {
            icon.className = 'fas fa-info-circle';
        }
        avatar.appendChild(icon);
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = text;
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date().toLocaleTimeString();
        
        content.appendChild(messageText);
        content.appendChild(time);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        if (this.isTyping) return;
        
        this.isTyping = true;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-message';
        typingDiv.setAttribute('role', 'article');
        typingDiv.id = 'typingIndicator';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        const icon = document.createElement('i');
        icon.className = 'fas fa-robot';
        avatar.appendChild(icon);
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        
        content.appendChild(typingIndicator);
        typingDiv.appendChild(avatar);
        typingDiv.appendChild(content);
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    toggleSpeech() {
        this.isSpeechEnabled = !this.isSpeechEnabled;
        
        if (this.isSpeechEnabled) {
            this.speechIcon.className = 'fas fa-volume-up';
            this.speechStatus.textContent = 'Clara voice enabled';
            this.speechToggle.classList.remove('disabled');
        } else {
            this.speechIcon.className = 'fas fa-volume-mute';
            this.speechStatus.textContent = 'Clara voice disabled';
            this.speechToggle.classList.add('disabled');
        }
    }

    toggleTextCleaning() {
        this.isTextCleaningEnabled = !this.isTextCleaningEnabled;
        
        if (this.isTextCleaningEnabled) {
            this.textCleaningIcon.className = 'fas fa-magic';
            this.textCleaningStatus.textContent = 'Text cleaning enabled';
        } else {
            this.textCleaningIcon.className = 'fas fa-magic-slash';
            this.textCleaningStatus.textContent = 'Text cleaning disabled';
        }
    }

	speak(text) {
		if (!this.speechSynthesis || !this.isSpeechEnabled || !text) return;
		
		// iOS Safari requires user interaction to start audio - check if we have that
		if (this.browserInfo.isIOS) {
			// On iOS, speech synthesis must be triggered by user interaction
			// If we're not in a user interaction context, queue it
			if (!this.hasUserInteracted) {
				console.warn('iOS: Speech synthesis requires user interaction. Queuing speech...');
				this.pendingSpeakQueue.push(text);
				// Show a helpful indicator
				if (this.speechStatusDisplay) {
					this.speechStatusDisplay.textContent = 'Tap anywhere to enable audio responses';
					this.speechStatusDisplay.style.color = '#ffa500';
				}
				return;
			}
			
			// iOS: Ensure speechSynthesis is not paused
			if (this.speechSynthesis.pending || this.speechSynthesis.speaking) {
				// If already speaking, queue this
				this.pendingSpeakQueue.push(text);
				return;
			}
		}
		
		// Clean text for speech synthesis - remove emojis and special characters (if enabled)
		let cleanedText = text;
		if (this.isTextCleaningEnabled) {
			cleanedText = this.cleanTextForSpeech(text);
			console.log('Original text:', text);
			console.log('Cleaned text for speech:', cleanedText);
			
			// Show speech indicator if text was cleaned
			if (cleanedText !== text) {
				this.showSpeechIndicator(cleanedText);
			}
		}
		
		// Stop current speech for promptness
		try { 
			this.speechSynthesis.cancel(); 
		} catch (e) {
			console.warn('Failed to cancel speech synthesis:', e);
		}

		// Ensure speech synthesis is ready
		if (this.speechSynthesis.paused) {
			this.speechSynthesis.resume();
		}
		
		// Ensure we have voices; if not, queue until voiceschanged fires
		const voices = this.availableVoices && this.availableVoices.length > 0
			? this.availableVoices
			: (this.speechSynthesis.getVoices() || []);
			
		if (!voices || voices.length === 0) {
			this.pendingSpeakQueue.push(text);
			return;
		}

		const utterance = new SpeechSynthesisUtterance(cleanedText);
		
		// Improved voice settings for better quality
		utterance.rate = 0.9; // Slightly slower for clarity
		utterance.pitch = 1.0; // Natural pitch
		utterance.volume = 0.85; // Slightly lower volume
		utterance.lang = 'en-US';

		// Enhanced voice selection logic - Prioritize English voices
		const preferred = voices.find(v => /en(-|_)US/i.test(v.lang) && /Google|Natural|Premium|Enhanced/i.test(v.name))
			|| voices.find(v => /en(-|_)GB/i.test(v.lang) && /Google|Natural|Premium|Enhanced/i.test(v.name))
			|| voices.find(v => /en(-|_)US/i.test(v.lang) && v.localService)
			|| voices.find(v => /en(-|_)GB/i.test(v.lang) && v.localService)
			|| voices.find(v => /en(-|_)US/i.test(v.lang))
			|| voices.find(v => /en(-|_)GB/i.test(v.lang))
			|| voices.find(v => /en/i.test(v.lang))
			|| voices[0];
			
		if (preferred) {
			utterance.voice = preferred;
		}

		// Enhanced error handling for speech synthesis
		utterance.onerror = (event) => {
			console.error('Speech synthesis error:', event.error);
			
			// Handle specific error types
			switch (event.error) {
				case 'interrupted':
					console.log('Speech was interrupted, continuing...');
					// Don't clear queue for interrupted - just continue
					return;
				case 'canceled':
					console.log('Speech was canceled');
					break;
				case 'not-allowed':
					console.error('Speech synthesis not allowed by browser');
					this.showError('Speech synthesis is not allowed. Please check your browser settings.');
					break;
				case 'audio-busy':
					console.log('Audio system busy, retrying...');
					setTimeout(() => this.speak(text), 1000);
					return;
				case 'audio-hardware':
					console.error('Audio hardware error');
					this.showError('Audio hardware error. Please check your speakers/headphones.');
					break;
				case 'network':
					console.error('Network error in speech synthesis');
					break;
				case 'synthesis-not-supported':
					console.error('Speech synthesis not supported');
					this.showError('Speech synthesis is not supported in this browser.');
					break;
				case 'synthesis-failed':
					console.error('Speech synthesis failed');
					break;
				default:
					console.error('Unknown speech synthesis error:', event.error);
			}
			
			// Clear the queue and continue
			this.pendingSpeakQueue = [];
		};

		utterance.onend = () => {
			console.log('Speech synthesis completed successfully');
			// Process next item in queue if any
			if (this.pendingSpeakQueue.length > 0) {
				const nextText = this.pendingSpeakQueue.shift();
				setTimeout(() => this.speak(nextText), 100);
			}
		};
		
		utterance.onstart = () => {
			console.log('Speech synthesis started');
		};
		
		utterance.onpause = () => {
			console.log('Speech synthesis paused');
		};
		
		utterance.onresume = () => {
			console.log('Speech synthesis resumed');
		};

		try {
			// iOS Safari fix: Ensure speech is called in the right context
			if (this.browserInfo.isIOS) {
				// On iOS, we must call speak directly - no setTimeout wrapping
				// If we're here, we've already checked hasUserInteracted
				this.speechSynthesis.speak(utterance);
			} else {
				this.speechSynthesis.speak(utterance);
			}
		} catch (error) {
			console.error('Failed to start speech synthesis:', error);
			
			// iOS: Don't retry in setTimeout as it won't work
			if (this.browserInfo.isIOS) {
				console.warn('iOS: Speech synthesis failed. User interaction may be required.');
				if (this.speechStatusDisplay) {
					this.speechStatusDisplay.textContent = 'Tap the page to enable audio';
				}
				// Queue it for next user interaction
				this.pendingSpeakQueue.unshift(cleanedText);
			} else {
				// Retry once after a short delay for non-iOS
				setTimeout(() => {
					try {
						console.log('Retrying speech synthesis...');
						this.speechSynthesis.speak(utterance);
					} catch (retryError) {
						console.error('Speech synthesis retry failed:', retryError);
						// Clear queue and continue without speech
						this.pendingSpeakQueue = [];
					}
				}, 500);
			}
		}
	}

	/**
	 * Clean text for speech synthesis by removing emojis, special characters, and formatting
	 * @param {string} text - The original text to clean
	 * @returns {string} - Cleaned text suitable for speech synthesis
	 */
	cleanTextForSpeech(text) {
		if (!text || typeof text !== 'string') return '';
		
		let cleaned = text;
		
		// Remove emojis and special Unicode characters
		cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
		cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc symbols and pictographs
		cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport and map symbols
		cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ''); // Regional indicator symbols
		cleaned = cleaned.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // Supplemental symbols and pictographs
		cleaned = cleaned.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols and pictographs extended-A
		cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');   // Misc symbols
		cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');   // Dingbats
		
		// Remove markdown formatting
		cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold text
		cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');     // Italic text
		cleaned = cleaned.replace(/`(.*?)`/g, '$1');       // Code blocks
		cleaned = cleaned.replace(/#{1,6}\s/g, '');        // Headers
		cleaned = cleaned.replace(/\n\s*\n/g, '. ');       // Double line breaks to periods
		
		// Remove HTML tags
		cleaned = cleaned.replace(/<[^>]*>/g, '');
		
		// Remove extra whitespace and normalize
		cleaned = cleaned.replace(/\s+/g, ' ').trim();
		
		// Remove common special characters that might cause speech issues
		cleaned = cleaned.replace(/[^\w\s.,!?;:()'-]/g, '');
		
		// Ensure proper sentence endings
		cleaned = cleaned.replace(/([.!?])\s*([a-z])/g, '$1 $2');
		
		// Remove multiple periods or exclamation marks
		cleaned = cleaned.replace(/[.!?]{2,}/g, '.');
		
		// Clean up spacing around punctuation
		cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');
		cleaned = cleaned.replace(/([.,!?;:])\s+/g, '$1 ');
		
		// If text is empty after cleaning, provide a fallback
		if (!cleaned.trim()) {
			cleaned = 'No readable text available';
		}
		
		return cleaned;
	}

	/**
	 * Show a temporary indicator of what text is being spoken
	 * @param {string} cleanedText - The cleaned text being spoken
	 */
	showSpeechIndicator(cleanedText) {
		// Create a temporary speech indicator
		const indicator = document.createElement('div');
		indicator.className = 'speech-indicator';
		indicator.innerHTML = `
			<div class="speech-indicator-content">
				<i class="fas fa-volume-up"></i>
				<span>Speaking: "${cleanedText.substring(0, 100)}${cleanedText.length > 100 ? '...' : ''}"</span>
			</div>
		`;
		
		// Style the indicator
		indicator.style.cssText = `
			position: fixed;
			bottom: 20px;
			right: 20px;
			background: rgba(102, 126, 234, 0.9);
			color: white;
			padding: 10px 15px;
			border-radius: 25px;
			font-size: 14px;
			z-index: 1000;
			box-shadow: 0 4px 12px rgba(0,0,0,0.2);
			animation: slideIn 0.3s ease-out;
		`;
		
		// Add animation styles if not already present
		if (!document.getElementById('speech-indicator-styles')) {
			const styles = document.createElement('style');
			styles.id = 'speech-indicator-styles';
			styles.textContent = `
				@keyframes slideIn {
					from { transform: translateX(100%); opacity: 0; }
					to { transform: translateX(0); opacity: 1; }
				}
				@keyframes slideOut {
					from { transform: translateX(0); opacity: 1; }
					to { transform: translateX(100%); opacity: 0; }
				}
			`;
			document.head.appendChild(styles);
		}
		
		// Add to page
		document.body.appendChild(indicator);
		
		// Remove after 3 seconds
		setTimeout(() => {
			indicator.style.animation = 'slideOut 0.3s ease-in';
			setTimeout(() => {
				if (indicator.parentNode) {
					indicator.parentNode.removeChild(indicator);
				}
			}, 300);
		}, 3000);
	}

    // Initialize WebRTC and local media for the client (caller)
    async initializeWebRTCForClient() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const localVideo = document.getElementById('localVideo');
            if (localVideo) localVideo.srcObject = this.localStream;

            const configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            };
            this.peerConnection = new RTCPeerConnection(configuration);

            this.localStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.localStream));

            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        callId: this.currentCallId
                    });
                }
            };

            this.peerConnection.ontrack = (event) => {
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                }
            };
        } catch (e) {
            console.error('Media init failed:', e);
        }
    }

    // Create SDP offer and send to server for forwarding
    async createOffer() {
        try {
            if (!this.peerConnection) return;
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.socket.emit('offer', { offer, callId: this.currentCallId });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    updateStatus(text, status) {
        if (this.statusText) {
            this.statusText.textContent = text;
        }
        
        if (this.statusDot) {
            this.statusDot.className = `status-dot ${status}`;
        }
    }

    showError(message, title = 'Error') {
        if (this.errorModal && this.errorMessage) {
            if (this.errorTitle) {
                this.errorTitle.textContent = title;
            }
            // Replace \n with <br> for multi-line messages
            const formattedMessage = message.replace(/\n/g, '<br>');
            this.errorMessage.innerHTML = formattedMessage;
            this.errorModal.style.display = 'flex';
        } else {
            alert(`${title}\n\n${message}`);
        }
    }

    closeErrorModal() {
        if (this.errorModal) {
            this.errorModal.style.display = 'none';
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    setWelcomeTime() {
        const welcomeTime = document.getElementById('welcomeTime');
        if (welcomeTime) {
            welcomeTime.textContent = new Date().toLocaleTimeString();
        }
    }

    // Trigger video call request automatically when staff is selected
    triggerVideoCallRequest(data) {
        try {
            console.log('🎥 Triggering automatic video call request for staff:', data.selectedStaffId);
            
            // Use the new direct endpoint for call requests
            fetch('/api/staff/call-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    staffId: data.selectedStaffId,
                    clientName: data.name,
                    purpose: data.purpose || 'Video consultation',
                    clientSocketId: this.socket.id
                })
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    console.log('✅ Call request sent successfully:', result.message);
                    this.updateStatus('Call request sent', 'ready');
                    this.addMessage(`I've sent a video call request to the staff member. ${result.message}`, 'bot');
                } else {
                    console.error('❌ Call request failed:', result.error);
                    this.addMessage('I encountered an error while sending the call request. Please try again.', 'bot');
                }
            })
            .catch(error => {
                console.error('❌ Error sending call request:', error);
                this.addMessage('I encountered an error while sending the call request. Please try again.', 'bot');
            });
            
        } catch (error) {
            console.error('❌ Error triggering video call request:', error);
            this.addMessage('I encountered an error while requesting the video call. Please try again.', 'bot');
        }
    }
}

// Initialize Clara when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Clara();
});

// Video Call Functions
function showVideoCall() {
    document.getElementById('videoCallInterface').style.display = 'flex';
    initializeVideoCall();
}

function hideVideoCall() {
    document.getElementById('videoCallInterface').style.display = 'none';
    endCall();
}

function initializeVideoCall() {
    // Initialize video call functionality
    console.log('🎥 Initializing video call...');
    // Add video call initialization logic here
}

function toggleMute() {
    const muteBtn = document.getElementById('muteBtn');
    const icon = muteBtn.querySelector('i');
    
    if (icon.classList.contains('fa-microphone')) {
        icon.classList.remove('fa-microphone');
        icon.classList.add('fa-microphone-slash');
        muteBtn.classList.add('muted');
        // Add mute logic here
    } else {
        icon.classList.remove('fa-microphone-slash');
        icon.classList.add('fa-microphone');
        muteBtn.classList.remove('muted');
        // Add unmute logic here
    }
}

function toggleVideo() {
    const videoBtn = document.getElementById('videoBtn');
    const icon = videoBtn.querySelector('i');
    
    if (icon.classList.contains('fa-video')) {
        icon.classList.remove('fa-video');
        icon.classList.add('fa-video-slash');
        videoBtn.classList.add('video-off');
        // Add video off logic here
    } else {
        icon.classList.remove('fa-video-slash');
        icon.classList.add('fa-video');
        videoBtn.classList.remove('video-off');
        // Add video on logic here
    }
}

function endCall() {
    console.log('📞 Ending video call...');
    // Add call end logic here
    hideVideoCall();
}
