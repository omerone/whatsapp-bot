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
        });

        this.setupEventHandlers();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isInitialized = false;
        this.processedMessages = new Set(); // Track all processed message IDs
        this.lastOutgoingMessages = new Map(); // Track last outgoing message per user

        // Bind event handlers in constructor
        this.handleMessage = this.handleMessage.bind(this);
        this.handleDisconnect = this.handleDisconnect.bind(this);
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
                } catch (error) {
                    console.error('Failed to reconnect:', error);
                }
            }
            console.log(`[${now.toLocaleString('he-IL')}] נכשל בניסיון להתחבר מחדש. יש להפעיל את הבוט מחדש.`);
            process.exit(1);
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
        if (this.isInitialized) return;

        return new Promise((resolve, reject) => {
            // Add timeout to prevent hanging forever
            const timeout = setTimeout(() => {
                console.log('⚠️ WhatsApp: אתחול נכשל אחרי 60 שניות - בדוק חיבור לאינטרנט');
                reject(new Error('WhatsApp initialization timeout after 60 seconds'));
            }, 60000);

            // Set up event handlers
            this.client.once('ready', () => {
                clearTimeout(timeout);
                this.isInitialized = true;
                console.log('WhatsApp client initialized successfully');
                resolve(true);
            });

            this.client.once('auth_failure', () => {
                clearTimeout(timeout);
                console.log('❌ WhatsApp: אימות נכשל - יש לסרוק קוד QR מחדש');
                reject(new Error('Authentication failure during initialization'));
            });

            this.client.once('disconnected', (reason) => {
                clearTimeout(timeout);
                console.log(`❌ WhatsApp: התנתקות במהלך אתחול: ${reason}`);
                reject(new Error(`Client disconnected during initialization: ${reason}`));
            });

            // Set up message and disconnect handlers
            this.client.on('message', this.handleMessage);
            this.client.on('disconnected', this.handleDisconnect);

            // Start initialization
            this.client.initialize().catch((error) => {
                clearTimeout(timeout);
                console.error('WhatsAppManager: שגיאה ב-client.initialize():', error);
                reject(error);
            });
        });
    }

    async handleDisconnect(reason) {
        console.log(`[WhatsAppManager] 🔌 Client disconnected:`, reason);
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[WhatsAppManager] 🔄 Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            try {
                await this.initialize();
                console.log('[WhatsAppManager] ✅ Reconnected successfully');
                this.reconnectAttempts = 0;
            } catch (error) {
                console.error('[WhatsAppManager] ❌ Reconnection failed:', error);
            }
        } else {
            console.error('[WhatsAppManager] ❌ Max reconnection attempts reached');
        }
    }

    async handleMessage(message) {
        try {
            if (!message.body || message.body.trim() === '') {
                return;
            }

            if (this.processedMessages.has(message.id._serialized)) {
                return;
            }

            this.processedMessages.add(message.id._serialized);

            if (!this.rulesManager || !this.flowEngine) {
                console.error('WhatsAppManager: Required components not initialized');
                return;
            }

            const shouldProcess = await this.rulesManager.shouldProcessMessage(message, this.client);
            if (!shouldProcess) {
                return;
            }

            const lead = this.flowEngine.leadsManager ? 
                await this.flowEngine.leadsManager.getLead(message.from) : null;

            const lastOutgoingMessage = this.lastOutgoingMessages.get(message.from);
            const isFirstMessage = !lead || !lead.current_step;

            const response = await this.flowEngine.processStep(
                message.from,
                message.body,
                isFirstMessage
            );

            if (response && response.messages && response.messages.length > 0) {
                for (let i = 0; i < response.messages.length; i++) {
                    const msg = response.messages[i];
                    try {
                        await this.client.sendMessage(message.from, msg);
                        this.lastOutgoingMessages.set(message.from, msg);
                        if (i < response.messages.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (error) {
                        console.error('Error sending message:', error);
                    }
                }
            }

        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    async sendMessage(userId, message) {
        if (!message) return;

        try {
            await this.client.sendMessage(userId, message);
            await this.flowEngine.leadsManager.updateLastMessage(userId, 'bot');
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
}

module.exports = WhatsAppManager; 