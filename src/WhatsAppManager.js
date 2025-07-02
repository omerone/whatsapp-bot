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
            this.rulesManager = new RulesManager(this.flowEngine.flow, this.flowEngine.integrationManager);
            console.log('[WhatsAppManager] ✅ RulesManager initialized with full configuration');
        } else {
            let missingParts = [];
            if (!this.flowEngine) missingParts.push('flowEngine');
            if (this.flowEngine && !this.flowEngine.initialized) missingParts.push('flowEngine not initialized');
            if (this.flowEngine && !this.flowEngine.integrationManager) missingParts.push('flowEngine.integrationManager');
            if (this.flowEngine && !this.flowEngine.flow) missingParts.push('flowEngine.flow');
            
            console.warn(`[WhatsAppManager] ⚠️ RulesManager could not be initialized. Missing: ${missingParts.join(', ')}. Using fallback.`);
            this.rulesManager = new RulesManager({
                configuration: {
                    rules: {
                        blockedSources: {
                            ignoreContacts: true,
                            ignoreArchived: true,
                            ignoreGroups: true,
                            ignoreStatus: true
                        }
                    }
                }
            }, null); // Fallback with basic blocked sources rules
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
        // Skip logging for status messages
        if (message.from === 'status@broadcast') {
            return;
        }

        // Skip empty messages
        if (!message.body && !message.hasMedia) {
            return;
        }

        // Skip if message was already processed
        if (this.processedMessages.has(message.id._serialized)) {
            return;
        }

        // Mark message as processed
        this.processedMessages.add(message.id._serialized);

        console.log(`\n🟡 הודעה חדשה מ-${message.from}: "${message.body}"`);
        
        try {
            // Initialize RulesManager if not already initialized
            if (!this.rulesManager) {
                console.log('⚙️ מאתחל RulesManager...');
                this.initializeRulesManager();
            }
            
            // בדיקת חסימות לפני עיבוד
            const shouldProcess = await this.rulesManager.shouldProcessMessage(message, this.client);
            
            if (!shouldProcess) {
                console.log(`🚫 הודעה נחסמה על פי הכללים`);
                return;
            }

            // תחילה נבדוק/ניצור את ה-lead
            let lead = await this.flowEngine.leadsManager.getLead(message.from);
            
            // Check for saved name from contacts BEFORE processing through FlowEngine
            try {
                const contact = await message.getContact();
                
                // Try to get the best available name - prioritize contact name over profile name
                let savedName = null;
                if (contact) {
                    // First priority: name saved in contacts list
                    if (contact.name && contact.name !== contact.number) {
                        savedName = contact.name;
                        console.log(`📱 רשימת קשרים מכילה: ${contact.name} עבור ${message.from}`);
                    }
                    // Second priority: pushname (profile name) if no contact name
                    else if (contact.pushname && contact.pushname !== contact.number) {
                        savedName = contact.pushname;
                        console.log(`📱 שם פרופיל נמצא: ${contact.pushname} עבור ${message.from}`);
                    }
                    // Third priority: verified name if available
                    else if (contact.verifiedName && contact.verifiedName !== contact.number) {
                        savedName = contact.verifiedName;
                        console.log(`📱 שם מאומת נמצא: ${contact.verifiedName} עבור ${message.from}`);
                    }
                }
                
                if (savedName) {
                    // If we don't have a lead yet, create one with the display_name
                    if (!lead) {
                        await this.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                            data: {
                                display_name: savedName,
                                is_schedule: false
                            }
                        });
                        lead = await this.flowEngine.leadsManager.getLead(message.from);
                        console.log(`✨ נוצר lead חדש עם שם שמור: ${savedName}`);
                    } 
                    // If lead exists but doesn't have display_name, update it
                    else if (!lead.data?.display_name) {
                        await this.flowEngine.leadsManager.updateSavedName(message.from, savedName);
                        lead = await this.flowEngine.leadsManager.getLead(message.from);
                        console.log(`📝 עודכן lead קיים עם שם שמור: ${savedName}`);
                    }
                } else {
                    console.log(`👤 לא נמצא שם שמור עבור ${message.from}`);
                    
                    // If no saved name and no lead exists, create lead with default display_name
                    if (!lead) {
                        await this.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                            data: {
                                display_name: null, // Explicitly set to null for condition checking
                                is_schedule: false
                            }
                        });
                        lead = await this.flowEngine.leadsManager.getLead(message.from);
                        console.log(`🆕 נוצר lead חדש ללא שם שמור`);
                    }
                }
            } catch (error) {
                console.error('❌ שגיאה בקבלת מידע איש קשר:', error.message);
                
                // If contact check failed and no lead exists, create basic lead
                if (!lead) {
                    await this.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                        data: {
                            display_name: null,
                            is_schedule: false
                        }
                    });
                    lead = await this.flowEngine.leadsManager.getLead(message.from);
                    console.log(`🔧 נוצר lead fallback בגלל שגיאה`);
                }
            }

            console.log(`📊 סטטוס lead: שלב=${lead?.current_step}, שם=${lead?.data?.display_name || 'ללא'}`);

            // Process message through FlowEngine
            const isFirstMessage = !lead || !lead.current_step;
            console.log(`🔄 מעבד הודעה ${isFirstMessage ? '(ראשונה)' : '(המשך שיחה)'} עבור שלב: ${lead?.current_step || 'התחלה'}`);
            
            const response = await this.flowEngine.processStep(message.from, message.body, isFirstMessage);

            // Send response messages if any
            if (response && response.messages && response.messages.length > 0) {
                console.log(`📤 שולח ${response.messages.length} הודעות`);
                
                // Send messages with delay between them
                for (let i = 0; i < response.messages.length; i++) {
                    const msg = response.messages[i];
                    try {
                        await this.client.sendMessage(message.from, msg);
                        console.log(`✅ הודעה ${i + 1} נשלחה בהצלחה`);
                        
                        // Add delay between messages
                        if (i < response.messages.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (error) {
                        console.error(`❌ שגיאה בשליחת הודעה ${i + 1}:`, error.message);
                    }
                }
                
                console.log(`📬 סיום שליחת הודעות`);
            } else {
                console.log(`📭 אין הודעות לשליחה`);
            }

        } catch (error) {
            console.error('❌ שגיאה כללית:', error.message);
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