class RulesManager {
    constructor(config, integrationManager) {
        this.rules = config.rules || {};
        this.integrationManager = integrationManager;
        this.whatsappClient = integrationManager?.whatsappClient;
        this.processedMessages = new Set();
    }

    initialize() {
        if (!this.rules) {
            throw new Error('Rules configuration is required');
        }
    }

    async shouldProcessMessage(message, client) {
        try {
            // Skip messages from contacts if ignoreContacts is true
            if (this.rules.ignoreContacts && message.fromMe) {
                return false;
            }

            // Skip messages from archived chats if ignoreArchived is true
            if (this.rules.ignoreArchived) {
                const chat = await message.getChat();
                if (chat.archived) {
                    return false;
                }
            }

            // Skip messages from groups if ignoreGroups is true
            if (this.rules.ignoreGroups && message.from.includes('@g.us')) {
                return false;
            }

            // Skip status messages if ignoreStatus is true
            if (this.rules.ignoreStatus && message.from === 'status@broadcast') {
                return false;
            }

            // Check if client is frozen
            const isFrozen = await this.isClientFrozen(message.from);
            if (isFrozen) {
                return false;
            }

            // Check activation keywords if enabled
            if (this.rules.activationKeywords?.enabled) {
                const isActivated = await this.checkActivationKeywords(message);
                if (!isActivated) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('Error in shouldProcessMessage:', error);
            return false;
        }
    }

    async isClientFrozen(userId) {
        try {
            const lead = await this.integrationManager.flowEngine.leadsManager.getLead(userId);
            if (!lead) return false;

            const now = new Date();
            const frozenUntil = lead.frozenUntil ? new Date(lead.frozenUntil) : null;

            if (frozenUntil && now < frozenUntil) {
                if (this.rules.freezeClients?.sendExplanationMessage && this.rules.freezeClients?.preventDuplicateMessages) {
                    const lastMessageTime = lead.lastUnfrozenAt ? new Date(lead.lastUnfrozenAt) : null;
                    const timeSinceLastMessage = lastMessageTime ? (now - lastMessageTime) / 1000 / 60 : Infinity;

                    if (timeSinceLastMessage >= 1) {
                        const minutesLeft = Math.ceil((frozenUntil - now) / 1000 / 60);
                        const message = this.rules.freezeClients.explanationMessageText.replace('{duration}', minutesLeft.toString());
                        await this.integrationManager.whatsappClient.sendMessage(userId, message);
                        await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(userId, { lastUnfrozenAt: now.toISOString() });
                    }
                }
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking if client is frozen:', error);
            return false;
        }
    }

    async checkActivationKeywords(message) {
        try {
            const lead = await this.integrationManager.flowEngine.leadsManager.getLead(message.from);
            const now = new Date();

            // Check if message contains activation keyword
            const hasKeyword = this.rules.activationKeywords.keywords.some(keyword => 
                message.body.toLowerCase().includes(keyword.toLowerCase())
            );

            if (hasKeyword) {
                await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                    activation_time: now.toISOString()
                });
                return true;
            }

            // If no activation time is set, return false
            if (!lead?.activation_time) {
                return false;
            }

            // Check if activation has expired
            const activationTime = new Date(lead.activation_time);
            const hoursSinceActivation = (now - activationTime) / 1000 / 60 / 60;

            if (hoursSinceActivation > this.rules.activationKeywords.resetAfterHours) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking activation keywords:', error);
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