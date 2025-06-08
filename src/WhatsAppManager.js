const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const RulesManager = require('./engine/RulesManager');

class WhatsAppManager {
    constructor(flowEngine) {
        // flowEngine can be initially null
        this.flowEngine = flowEngine;
        this.rulesManager = null; // Deferred initialization
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '../.wwebjs_auth')
            }),
            webVersionCache: {
                type: 'local',
                path: path.join(__dirname, '../.wwebjs_cache')
            },
            puppeteer: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ],
                headless: true
            },
            restartOnAuthFail: true
        });

        this.setupEventHandlers();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isInitialized = false;
        this.knownUsers = new Set();
        this.lastMessageSent = new Map(); // Track last message sent to each user
        this.processingMessages = new Set(); // Track messages being processed to prevent duplicates
    }

    setFlowEngine(flowEngine) {
        if (!flowEngine) {
            // Allow flowEngine to be initially null, but perhaps log if set to null later explicitly?
            // For now, the main usage is setting it to a valid engine.
        }
        this.flowEngine = flowEngine;
        // RulesManager is NOT initialized here anymore.
    }

    initializeRulesManager() {
        if (this.flowEngine && this.flowEngine.initialized && this.flowEngine.integrationManager && this.flowEngine.flow) {
            this.rulesManager = new RulesManager(this.flowEngine.flow.rules || {}, this.flowEngine.integrationManager);
            // console.log('WhatsAppManager: RulesManager initialized successfully.');
        } else {
            let missingParts = [];
            if (!this.flowEngine) missingParts.push('flowEngine');
            if (this.flowEngine && !this.flowEngine.initialized) missingParts.push('flowEngine not initialized');
            if (this.flowEngine && !this.flowEngine.integrationManager) missingParts.push('flowEngine.integrationManager');
            if (this.flowEngine && !this.flowEngine.flow) missingParts.push('flowEngine.flow');
            
            console.warn(`WhatsAppManager: RulesManager could not be initialized. Missing: ${missingParts.join(', ')}. Using fallback.`);
            this.rulesManager = new RulesManager({}, null); // Fallback to default/empty RulesManager
        }
    }

    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            console.log('🔗 יש לסרוק את קוד ה-QR כדי להתחבר ל-WhatsApp Web:');
            qrcode.generate(qr, { small: true });
            console.log('אחרי סריקת ה-QR, הבוט ימשיך באתחול...');
        });

        this.client.on('ready', () => {
            const now = new Date();
            console.log(`[${now.toLocaleString('he-IL')}] הבוט מוכן ופעיל!`);
            this.reconnectAttempts = 0;
            this.isInitialized = true;
        });

        this.client.on('message', async (message) => {
            try {
                if (!this.isInitialized) return;

                // Ignore if message is from a group
                if (message.from.includes('@g.us')) return;

                // Ignore status@broadcast and undefined users 
                if (message.from === 'status@broadcast' || message.from === 'undefined' || !message.from || message.from.trim() === '') {
                    console.log(`[${now.toLocaleString('he-IL')}] התעלמות מהודעה לא תקינה: ${message.from}`);
                    return;
                }

                // Ignore business auto-messages and welcome messages
                if (message.body && (
                    message.body.includes('ברוכים הבאים') || 
                    message.body.includes('תודה שיצרתם קשר') ||
                    message.body.includes('נחזור אליכם בהקדם') ||
                    message.body.includes('Welcome') ||
                    message.body.includes('Thank you for contacting') ||
                    message.type === 'notification' ||
                    (message.body.length > 200 && message.body.includes('שעות')) // Long auto messages about business hours
                )) {
                    console.log(`[${now.toLocaleString('he-IL')}] התעלמות מהודעת מערכת אוטומטית: ${phoneNumber}`);
                    return;
                }

                const now = new Date();
                const phoneNumber = message.from.split('@')[0];

                // Enhanced duplicate prevention for rapid messages
                const messageContent = (message.body || '').trim();
                const messageId = `${message.from}-${message.timestamp}-${messageContent}`;
                
                // Check for rapid duplicate messages (same user, similar time, same/empty content)
                const userKey = message.from;
                const lastProcessedTime = this.lastMessageTime?.get(userKey) || 0;
                const timeDiff = Date.now() - lastProcessedTime;
                
                // If same user sent a message within 2 seconds, and it's empty or identical content
                if (timeDiff < 2000) {
                    const lastContent = this.lastMessageContent?.get(userKey) || '';
                    if (!messageContent || messageContent === lastContent || messageContent.length < 2) {
                        // console.log(`[${now.toLocaleString('he-IL')}] מניעת הודעה כפולה/מהירה: ${phoneNumber} (${timeDiff}ms)`);
                        return;
                    }
                }
                
                // Standard duplicate prevention by message ID
                if (this.processingMessages.has(messageId)) {
                    // console.log(`[${now.toLocaleString('he-IL')}] הודעה כבר מעובדת: ${phoneNumber}`);
                    return;
                }
                
                // Update tracking
                this.lastMessageTime = this.lastMessageTime || new Map();
                this.lastMessageContent = this.lastMessageContent || new Map();
                this.lastMessageTime.set(userKey, Date.now());
                this.lastMessageContent.set(userKey, messageContent);
                
                this.processingMessages.add(messageId);
                
                // Clean up old processing messages (older than 1 minute)
                setTimeout(() => {
                    this.processingMessages.delete(messageId);
                }, 60000);

                // Check rules before processing (do this first)
                const shouldProcess = await this.rulesManager.shouldProcessMessage(message, this.client);
                if (!shouldProcess) {
                    this.processingMessages.delete(messageId);
                    return;
                }

                // Check if this is a new user
                const isNewUser = !this.knownUsers.has(message.from);
                if (isNewUser) {
                    this.knownUsers.add(message.from);
                    
                    // Get lead info to check if this is really a new conversation
                    const lead = await this.flowEngine.leadsManager.getLead(message.from);
                    const isNewConversation = !lead || !lead.current_step || lead.current_step === this.flowEngine.flow.start;
                    const botInitiatedConversation = lead && lead.last_sent_message && lead.last_sent_message.sender === 'bot';
                    
                    if (isNewConversation && !botInitiatedConversation) {
                        // This is a genuinely new conversation initiated by the client
                        // Start the flow without processing their first message
                        let response = await this.flowEngine.processStep(message.from, '');
                        if (response && response.messages && response.messages.length > 0) {
                            for (const msg of response.messages) {
                                if (!msg) continue;
                                await this.client.sendMessage(message.from, msg);
                                // Update last message sent tracking
                                this.lastMessageSent.set(message.from, {
                                    content: msg,
                                    timestamp: Date.now(),
                                    sender: 'bot'
                                });
                            }
                        }
                        this.processingMessages.delete(messageId);
                        return;
                    }
                }

                try {
                    const chat = await message.getChat();
                    if (chat) await chat.sendStateTyping();
                } catch (error) {}

                // Process the message through the flow engine - FlowEngine will handle auto-continuation internally
                let response = await this.flowEngine.processStep(message.from, message.body);

                try {
                    const chat = await message.getChat();
                    if (chat) await chat.clearState();
                } catch (error) {}

                // Send all response messages
                if (response && response.messages && response.messages.length > 0) {
                    for (const msg of response.messages) {
                        try {
                            if (!msg) continue;

                            // More specific duplicate check - only prevent if same message was sent recently
                            // AND there was no user input (indicating this might be a duplicate call)
                            const lastMessage = this.lastMessageSent.get(message.from);
                            const timeSinceLastMessage = lastMessage ? Date.now() - lastMessage.timestamp : Infinity;
                            
                            // Only prevent duplicates if: same message + sent within last 5 seconds + no new user input
                            if (lastMessage && 
                                lastMessage.content === msg && 
                                timeSinceLastMessage < 5000 && 
                                (!message.body || message.body.trim() === '')) {
                                // console.log(`[${now.toLocaleString('he-IL')}] מניעת שליחה כפולה של הודעה למספר ${phoneNumber}`);
                                continue;
                            }

                            await this.client.sendMessage(message.from, msg);
                            // Update last message sent
                            this.lastMessageSent.set(message.from, {
                                content: msg,
                                timestamp: Date.now()
                            });
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } catch (sendError) {
                            try {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                await this.client.sendMessage(message.from, msg);
                                this.lastMessageSent.set(message.from, {
                                    content: msg,
                                    timestamp: Date.now()
                                });
                            } catch (retryError) {}
                        }
                    }
                }
                
                // Always clean up processing flag when done
                this.processingMessages.delete(messageId);
                
            } catch (error) {
                // Clean up processing flag on error
                const messageId = `${message.from}-${message.timestamp}-${message.body}`;
                this.processingMessages.delete(messageId);
                
                try {
                    if (message && message.from) {
                        await this.client.sendMessage(message.from, 'מצטערים, אירעה שגיאה. אנא נסה שוב מאוחר יותר או כתוב "תפריט" להתחלה מחדש.');
                    }
                } catch (sendError) {}
            }
        });

        this.client.on('disconnected', async (reason) => {
            const now = new Date();
            console.log(`[${now.toLocaleString('he-IL')}] הבוט התנתק. מנסה להתחבר מחדש...`);
            this.isInitialized = false;
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                try {
                    await new Promise(resolve => setTimeout(resolve, 5000 * this.reconnectAttempts));
                    await this.initialize();
                } catch (error) {}
            } else {
                console.log(`[${now.toLocaleString('he-IL')}] נכשל בניסיון להתחבר מחדש. יש להפעיל את הבוט מחדש.`);
                process.exit(1);
            }
        });

        this.client.on('auth_failure', async () => {
            const now = new Date();
            console.log(`[${now.toLocaleString('he-IL')}] אימות נכשל. מנסה להתחבר מחדש...`);
            await this.handleAuthFailure();
        });
    }

    async handleAuthFailure() {
        try {
            await this.client.destroy();
            console.log('WhatsAppManager: Attempting to re-initialize after auth failure.');
            this.initialize()
                .then(() => {
                    console.log('WhatsAppManager: Re-initialized successfully after auth failure.');
                })
                .catch(err => {
                    console.error('WhatsAppManager: Re-initialization failed after auth failure:', err);
                    process.exit(1);
                });
        } catch (error) {
            const now = new Date();
            console.log(`[${now.toLocaleString('he-IL')}] Error destroying client during auth failure handling: ${error.message}. Exiting.`);
            process.exit(1);
        }
    }

    async initialize() {
        return new Promise(async (resolve, reject) => {
            try {
                // Add timeout to prevent hanging forever
                const timeout = setTimeout(() => {
                    console.log('⚠️ WhatsApp: אתחול נכשל אחרי 60 שניות - בדוק חיבור לאינטרנט');
                    reject(new Error('WhatsApp initialization timeout after 60 seconds'));
                }, 60000);
                
                this.client.once('ready', () => {
                    clearTimeout(timeout);
                    resolve(true);
                });

                this.client.once('auth_failure', () => {
                    console.log('❌ WhatsApp: אימות נכשל - יש לסרוק קוד QR מחדש');
                    clearTimeout(timeout);
                    reject(new Error('Authentication failure during initialization'));
                });

                this.client.once('disconnected', (reason) => {
                    console.log(`❌ WhatsApp: התנתקות במהלך אתחול: ${reason}`);
                    clearTimeout(timeout);
                    reject(new Error(`Client disconnected during initialization: ${reason}`));
                });

                await this.client.initialize();

            } catch (error) {
                console.error('WhatsAppManager: שגיאה ב-client.initialize():', error);
                reject(error);
            }
        });
    }
}

module.exports = WhatsAppManager; 