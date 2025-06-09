const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const RulesManager = require('./engine/RulesManager');

class WhatsAppManager {
    constructor(flowEngine) {
        this.flowEngine = flowEngine;
        this.client = null;
        this.rulesManager = null;
        this.isInitialized = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.processedMessages = new Set();
    }

    initializeRulesManager() {
        if (this.flowEngine && this.flowEngine.initialized && this.flowEngine.integrationManager && this.flowEngine.flow) {
            this.rulesManager = new RulesManager(this.flowEngine.flow.rules || {}, this.flowEngine.integrationManager);
        } else {
            let missingParts = [];
            if (!this.flowEngine) missingParts.push('flowEngine');
            if (this.flowEngine && !this.flowEngine.initialized) missingParts.push('flowEngine not initialized');
            if (this.flowEngine && !this.flowEngine.integrationManager) missingParts.push('flowEngine.integrationManager');
            if (this.flowEngine && !this.flowEngine.flow) missingParts.push('flowEngine.flow');
            
            console.warn(`WhatsAppManager: RulesManager could not be initialized. Missing: ${missingParts.join(', ')}. Using fallback.`);
            this.rulesManager = new RulesManager({}, null);
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

    async handleMessage(message) {
        try {
            if (!message.body && !message.hasMedia) {
                return;
            }

            if (this.processedMessages.has(message.id._serialized)) {
                return;
            }

            this.processedMessages.add(message.id._serialized);

            if (!this.rulesManager) {
                console.warn('[WhatsAppManager] ⚠️ RulesManager not initialized, initializing now');
                this.initializeRulesManager();
            }

            const shouldProcess = await this.rulesManager.shouldProcessMessage(message, this.client);

            if (!shouldProcess) {
                return;
            }

            const lead = await this.flowEngine.leadsManager.getLead(message.from);
            const lastOutgoingMessage = lead?.last_sent_message || 'none';
            const isFirstMessage = !lead || !lead.current_step;
            
            const response = await this.flowEngine.processStep(message.from, message.body, isFirstMessage);

            if (response && response.messages && response.messages.length > 0) {
                for (let i = 0; i < response.messages.length; i++) {
                    const msg = response.messages[i];
                    try {
                        await this.client.sendMessage(message.from, msg);
                        
                        if (i < response.messages.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (error) {
                        console.error(`[WhatsAppManager] ❌ Error sending message ${i + 1}:`, error);
                    }
                }
            }

        } catch (error) {
            console.error('[WhatsAppManager] ❌ Error in handleMessage:', error);
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