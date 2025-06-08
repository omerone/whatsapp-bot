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
        this.lastSentMessages = new Map(); // Track last N messages sent to prevent duplicates
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
            await this.handleMessage(message);
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

    async sendMessage(userId, message) {
        if (!message) return;

        // Get last N messages sent to this user
        const lastMessages = this.lastSentMessages.get(userId) || [];
        
        // Check if this exact message was sent in the last 3 messages
        if (lastMessages.some(m => m.content === message)) {
            console.log(`[${new Date().toLocaleString('he-IL')}] מניעת שליחת הודעה כפולה: ${message.substring(0, 50)}...`);
            return;
        }

        // Send the message
        await this.client.sendMessage(userId, message);

        // Update tracking of last messages
        lastMessages.unshift({ content: message, timestamp: Date.now() });
        if (lastMessages.length > 3) lastMessages.pop(); // Keep only last 3 messages
        this.lastSentMessages.set(userId, lastMessages);

        // Update last message sent tracking
        this.lastMessageSent.set(userId, {
            content: message,
            timestamp: Date.now(),
            sender: 'bot'
        });
    }

    async handleMessage(message) {
        try {
            if (!this.isInitialized) return;

            // Ignore if message is from a group
            if (message.from.includes('@g.us')) return;

            // Generate unique message ID
            const messageId = `${message.from}-${message.timestamp}`;

            // Check if we're already processing this message
            if (this.processingMessages.has(messageId)) {
                console.log(`[WhatsAppManager] Duplicate message detected, ignoring: ${messageId}`);
                return;
            }

            // Mark message as being processed
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
                    const response = await this.flowEngine.processStep(message.from, message.body, true);
                    if (response && response.messages) {
                        for (const msg of response.messages) {
                            await this.sendMessage(message.from, msg);
                        }
                    }
                    this.processingMessages.delete(messageId);
                    return;
                }
            }

            // Process the message through the flow engine
            const response = await this.flowEngine.processStep(message.from, message.body);
            if (response && response.messages) {
                for (const msg of response.messages) {
                    await this.sendMessage(message.from, msg);
                }
            }

            this.processingMessages.delete(messageId);
        } catch (error) {
            console.error('Error handling message:', error);
            try {
                await this.sendMessage(message.from, 'מצטערים, אירעה שגיאה. אנא נסה שוב או כתוב "תפריט" להתחלה מחדש.');
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }
}

module.exports = WhatsAppManager; 