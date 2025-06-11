class RulesManager {
    constructor(flow = {}, integrationManager = null) {
        this.rules = flow;
        this.integrationManager = integrationManager;
        console.log('[RulesManager] Initialized with rules:', JSON.stringify(flow?.configuration || {}, null, 2));
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

            // Get blocked sources rules first
            const blockedSourcesRules = this.rules?.configuration?.rules?.blockedSources;
            if (!blockedSourcesRules) {
                console.log('[RulesManager] ⚠️ No blocked sources rules found, blocking for safety');
                return false;
            }

            // STRICT BLOCKING: Check all blocked sources rules first
            // These checks must happen before any other processing

            // 1. Block groups immediately
            if (message.from.includes('@g.us')) {
                console.log(`[RulesManager] 👥 Blocking message from group: ${message.from}`);
                await this.blockAndRecord(message.from, 'is_group');
                return false;
            }

            // 2. Block status messages immediately
            if (message.from === 'status@broadcast') {
                console.log(`[RulesManager] 📢 Blocking status broadcast message`);
                await this.blockAndRecord(message.from, 'is_status');
                return false;
            }

            // 3. Block contacts
            try {
                const contact = await message.getContact();
                if (contact && contact.isMyContact) {
                    console.log(`[RulesManager] 📱 Blocking message from contact: ${message.from}`);
                    await this.blockAndRecord(message.from, 'is_contact');
                    return false;
                }
            } catch (error) {
                console.error('[RulesManager] Error checking contact:', error);
                await this.blockAndRecord(message.from, 'contact_check_failed');
                return false;
            }

            // 4. Block archived chats
            try {
                const chat = await message.getChat();
                if (chat && chat.archived) {
                    console.log(`[RulesManager] 📁 Blocking message from archived chat: ${message.from}`);
                    await this.blockAndRecord(message.from, 'is_archived');
                    return false;
                }
            } catch (error) {
                console.error('[RulesManager] Error checking archived status:', error);
                await this.blockAndRecord(message.from, 'archive_check_failed');
                return false;
            }

            // Only after passing ALL conversation checks, proceed with other checks
            
            // Get current lead status
            const lead = this.integrationManager?.flowEngine?.leadsManager ? 
                await this.integrationManager.flowEngine.leadsManager.getLead(message.from) : null;
            console.log(`[RulesManager] 📊 Lead status for ${message.from}:`, lead ? 
                `current_step=${lead.current_step}, blocked=${lead.blocked}, frozen=${!!lead.frozenUntil}` : 'New client');

            // Check if the lead is already blocked
            if (lead?.blocked) {
                console.log(`[RulesManager] 🚫 Blocked client ${message.from} (reason: ${lead.blocked_reason}) tried to send a message`);
                return false;
            }

            // Check if client has scheduled appointments
            const blockScheduledConfig = this.rules?.configuration?.client_management?.blockScheduledClients;
            if (blockScheduledConfig?.enabled) {
                const shouldBlock = await this.checkScheduledAppointments(message.from, blockScheduledConfig);
                if (shouldBlock) {
                    console.log(`[RulesManager] 📅 Client ${message.from} has scheduled appointments, blocking according to rules`);
                    return false;
                }
            }

            // Check if this is a new conversation or if we need to check activation
            const isNewConversation = !lead || !lead.current_step;
            const activationConfig = this.rules?.configuration?.rules?.activation;
            
            if (activationConfig?.enabled) {
                const needsActivation = isNewConversation || this.needsReactivation(lead, activationConfig.resetAfterHours);
                
                if (needsActivation) {
                    if (!this.hasActivationKeywords(message.body)) {
                        console.log(`[RulesManager] 🔑 Message does not contain activation keywords: ${message.body}`);
                        return false;
                    } else {
                        // If activation successful, update the last activation time
                        if (this.integrationManager?.flowEngine?.leadsManager) {
                            await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                                last_activation_time: new Date().toISOString()
                            });
                        }
                        console.log(`[RulesManager] 🔓 Activation successful for ${message.from}`);
                    }
                }
            }

            // Check reset keyword (only for existing conversations)
            if (!isNewConversation) {
                const resetConfig = this.rules?.configuration?.client_management?.reset;
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

    async checkScheduledAppointments(userId, config) {
        if (!this.integrationManager?.sheetsService) {
            console.log('[RulesManager] No Sheets service available for checking appointments');
            return false;
        }

        try {
            const lead = await this.integrationManager.flowEngine?.leadsManager?.getLead(userId);
            const isReschedulingAttempt = lead?.data?.is_rescheduling === true;
            
            // If this is a rescheduling attempt and rescheduling is allowed
            if (isReschedulingAttempt && config.allowRescheduling) {
                if (config.rescheduleOnlyFuture) {
                    // Check if they have past appointments
                    const hasPastAppointment = await this.integrationManager.sheetsService.hasScheduledAppointment(
                        userId.split('@')[0],
                        'past'
                    );
                    if (hasPastAppointment) {
                        console.log(`[RulesManager] Client ${userId} has past appointments and can't reschedule`);
                        return true; // Block if has past appointment
                    }
                }
                return false; // Allow rescheduling if no past appointments
            }

            // Not rescheduling, check appointments based on configuration
            let checkType = 'all';
            if (config.blockPastAndPresent) {
                checkType = 'pastAndPresent';
            } else if (config.blockFutureAndPresent) {
                checkType = 'futureAndPresent';
            }

            const hasAppointment = await this.integrationManager.sheetsService.hasScheduledAppointment(
                userId.split('@')[0],
                checkType
            );

            if (hasAppointment) {
                console.log(`[RulesManager] Client ${userId} has ${checkType} appointments`);
                return true; // Block if has appointment
            }

            return false; // No appointments found
        } catch (error) {
            console.error('[RulesManager] Error checking scheduled appointments:', error);
            return false;
        }
    }

    async isClientFrozen(userId) {
        const freezeConfig = this.rules?.configuration?.client_management?.freeze;
        
        if (!freezeConfig?.enabled) {
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
            console.log(`[RulesManager] Client ${userId} is frozen until ${frozenUntil.toLocaleString('he-IL')}`);
            return true;
        } else {
            await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(userId, {
                frozenUntil: null,
                lastUnfrozenAt: now.toISOString()
            });
            
            console.log(`[RulesManager] Client ${userId} unfrozen automatically`);
            return false;
        }
    }

    hasActivationKeywords(messageBody) {
        const activationConfig = this.rules?.configuration?.rules?.activation;
        if (!activationConfig?.enabled || !activationConfig.keywords || activationConfig.keywords.length === 0) {
            return true;
        }

        const lowerMessage = messageBody.toLowerCase();
        return activationConfig.keywords.some(keyword => 
            lowerMessage.includes(keyword.toLowerCase())
        );
    }

    needsReactivation(lead, resetAfterHours = 24) {
        if (!lead?.last_activation_time) {
            return true;
        }

        const lastActivation = new Date(lead.last_activation_time);
        const now = new Date();
        const hoursSinceLastActivation = (now - lastActivation) / (1000 * 60 * 60);

        return hoursSinceLastActivation >= resetAfterHours;
    }

    setRules(rules) {
        this.rules = rules;
    }

    getRules() {
        return this.rules;
    }

    // Helper method to block a user and record the reason
    async blockAndRecord(userId, reason) {
        if (this.integrationManager?.flowEngine?.leadsManager) {
            await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(userId, {
                blocked: true,
                blocked_reason: reason
            });
        }
    }
}

module.exports = RulesManager; 