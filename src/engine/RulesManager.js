class RulesManager {
    constructor(rules = {}, integrationManager = null) {
        this.rules = rules;
        this.integrationManager = integrationManager;
        console.log('[RulesManager] Initialized with rules:', JSON.stringify(rules, null, 2));
    }

    async shouldProcessMessage(message, client) {
        console.log(`\n[RulesManager] 🔍 Processing message from ${message.from}:`, message.body);
        try {
            // Block status@broadcast and invalid user IDs immediately and silently
            if (!message.from || 
                message.from === 'status@broadcast' || 
                message.from === 'undefined' || 
                message.from.trim() === '' ||
                !message.from.includes('@')) {
                console.log('[RulesManager] ❌ Invalid message source, blocking');
                return false;
            }

            // Get current lead status first
            const lead = this.integrationManager?.flowEngine?.leadsManager ? 
                await this.integrationManager.flowEngine.leadsManager.getLead(message.from) : null;
            console.log(`[RulesManager] 📊 Lead status for ${message.from}:`, lead ? 
                `current_step=${lead.current_step}, blocked=${lead.blocked}, frozen=${!!lead.frozenUntil}` : 'New client');

            // Check if the lead is already blocked
            if (lead?.blocked) {
                console.log(`[RulesManager] 🚫 Blocked client ${message.from} (reason: ${lead.blocked_reason}) tried to send a message`);
                return false;
            }

            // Check if message is from a contact
            if (this.rules.ignoreContacts) {
                const contact = await message.getContact();
                if (contact.isMyContact) {
                    console.log(`[RulesManager] 📱 Blocking message from contact: ${message.from}`);
                    if (this.integrationManager.flowEngine?.leadsManager) {
                        await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                            blocked: true,
                            blocked_reason: 'is_contact'
                        });
                    }
                    return false;
                }
            }

            // Check if message is from a group
            if (this.rules.ignoreGroups && message.from.includes('@g.us')) {
                console.log('[RulesManager] 👥 Blocking group message');
                return false;
            }

            // Check if message is a status update
            if (this.rules.ignoreStatus && message.isStatus) {
                console.log('[RulesManager] 📢 Blocking status message');
                return false;
            }

            // Check if chat is archived
            if (this.rules.ignoreArchived) {
                const chat = await message.getChat();
                if (chat.archived) {
                    console.log(`[RulesManager] 📁 Blocking message from archived chat: ${message.from}`);
                    if (this.integrationManager.flowEngine?.leadsManager) {
                        await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                            blocked: true,
                            blocked_reason: 'is_archived'
                        });
                    }
                    return false;
                }
            }

            // Check if this is a new conversation
            const isNewConversation = !lead || !lead.current_step;
            console.log(`[RulesManager] 🆕 Is new conversation: ${isNewConversation}`);

            // Check activation keywords for new conversations
            if (isNewConversation && this.rules.activationKeywords?.enabled) {
                const hasKeywords = this.hasActivationKeywords(message.body);
                console.log(`[RulesManager] 🔑 Checking activation keywords: ${hasKeywords ? 'Found' : 'Not found'}`);
                if (!hasKeywords) {
                    console.log(`[RulesManager] ❌ New client ${message.from} didn't use activation keywords, ignoring message`);
                    return false;
                }
            }

            // Check reset keyword (only for existing conversations)
            if (!isNewConversation) {
                const resetConfig = this.rules?.resetConfig;
                const resetKeyword = resetConfig?.keyword;
                const isResetKeyword = resetKeyword && message.body === resetKeyword;

                if (isResetKeyword && resetConfig?.enabled) {
                    console.log(`[RulesManager] 🔄 Reset keyword detected from ${message.from}: "${message.body}"`);
                    return true;
                }
            }

            // Check if client is frozen
            const isFrozen = await this.isClientFrozen(message.from);
            if (isFrozen) {
                console.log(`[RulesManager] ❄️ Client ${message.from} is frozen, ignoring message`);
                return false;
            }

            console.log(`[RulesManager] ✅ Message from ${message.from} passed all rules`);
            return true;
        } catch (error) {
            console.error('[RulesManager] ❌ Error in shouldProcessMessage:', error);
            return false;
        }
    }

    async isClientFrozen(userId) {
        const newConfig = this.rules?.freezeClients;
        
        if (!newConfig?.enabled) {
            return false;
        }

        const lead = this.integrationManager?.flowEngine?.leadsManager ? 
            await this.integrationManager.flowEngine.leadsManager.getLead(userId) : null;

        if (!lead || !lead.frozenUntil) {
            return false;
        }

        const now = new Date();
        const frozenUntil = new Date(lead.frozenUntil);
        
        if (now < frozenUntil) {
            if (newConfig?.logFreezeActions) {
                console.log(`[RulesManager] Client ${userId} is frozen until ${frozenUntil.toLocaleString('he-IL')}`);
            }
            return true;
        } else {
            await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(userId, {
                frozenUntil: null,
                freezeCount: lead.freezeCount || 0,
                lastUnfrozenAt: now.toISOString()
            });
            
            if (newConfig?.logFreezeActions) {
                console.log(`[RulesManager] Client ${userId} unfrozen automatically`);
            }
            return false;
        }
    }

    hasActivationKeywords(messageBody) {
        if (!this.rules.activationKeywords?.enabled || !this.rules.activationKeywords?.keywords) {
            return true;
        }

        const messageText = messageBody.toLowerCase().trim();
        const keywords = this.rules.activationKeywords.keywords;

        return keywords.some(keyword => {
            const keywordLower = keyword.toLowerCase().trim();
            return messageText.includes(keywordLower);
        });
    }

    setRules(rules) {
        this.rules = {
            ...this.rules,
            ...rules
        };
    }

    getRules() {
        return this.rules;
    }
}

module.exports = RulesManager; 