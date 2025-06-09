class RulesManager {
    constructor(rules = {}, integrationManager = null) {
        this.rules = rules;
        this.integrationManager = integrationManager;
    }

    async shouldProcessMessage(message, client) {
        try {
            if (!message.from || 
                message.from === 'status@broadcast' || 
                message.from === 'undefined' || 
                message.from.trim() === '' ||
                !message.from.includes('@')) {
                return false;
            }

            const lead = this.integrationManager?.flowEngine?.leadsManager ? 
                await this.integrationManager.flowEngine.leadsManager.getLead(message.from) : null;

            if (lead?.blocked) {
                return false;
            }

            if (this.rules.ignoreContacts) {
                const contact = await message.getContact();
                if (contact.isMyContact) {
                    if (this.integrationManager.flowEngine?.leadsManager) {
                        await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                            blocked: true,
                            blocked_reason: 'is_contact'
                        });
                    }
                    return false;
                }
            }

            if (this.rules.ignoreGroups && message.from.includes('@g.us')) {
                return false;
            }

            if (this.rules.ignoreStatus && message.isStatus) {
                return false;
            }

            if (this.rules.ignoreArchived) {
                const chat = await message.getChat();
                if (chat.archived) {
                    if (this.integrationManager.flowEngine?.leadsManager) {
                        await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                            blocked: true,
                            blocked_reason: 'is_archived'
                        });
                    }
                    return false;
                }
            }

            const isNewConversation = !lead || !lead.current_step;

            if (isNewConversation && this.rules.activationKeywords?.enabled) {
                const hasKeywords = this.hasActivationKeywords(message.body);
                if (!hasKeywords) {
                    return false;
                }
            }

            if (!isNewConversation) {
                const resetConfig = this.rules?.resetConfig;
                const resetKeyword = resetConfig?.keyword;
                const isResetKeyword = resetKeyword && message.body === resetKeyword;

                if (isResetKeyword && resetConfig?.enabled) {
                    return true;
                }
            }

            const isFrozen = await this.isClientFrozen(message.from);
            if (isFrozen) {
                return false;
            }

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
            return true;
        } else {
            await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(userId, {
                frozenUntil: null,
                freezeCount: lead.freezeCount || 0,
                lastUnfrozenAt: now.toISOString()
            });
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