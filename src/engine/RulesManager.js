class RulesManager {
    constructor(flow = {}, integrationManager = null) {
        this.rules = flow;
        this.integrationManager = integrationManager;
        console.log('⚙️ RulesManager הותקן עם כללים');
    }

    async shouldProcessMessage(message, client) {
        try {
            // Block status@broadcast and invalid user IDs immediately and silently
            if (!message.from || 
                message.from === 'status@broadcast' || 
                message.from === 'undefined' || 
                message.from.trim() === '' ||
                !message.from.includes('@')) {
                return false;
            }

            // Get blocked sources rules first
            const blockedSourcesRules = this.rules?.configuration?.rules?.blockedSources;
            if (!blockedSourcesRules) {
                return false;
            }

            // STRICT BLOCKING: Check all blocked sources rules first
            // These checks must happen before any other processing

            // 1. Block groups if ignoreGroups is true
            if (message.from.includes('@g.us') && blockedSourcesRules.ignoreGroups === true) {
                await this.blockAndRecord(message.from, 'is_group');
                return false;
            }

            // 2. Block status messages if ignoreStatus is true
            if (message.from === 'status@broadcast' && blockedSourcesRules.ignoreStatus === true) {
                await this.blockAndRecord(message.from, 'is_status');
                return false;
            }

            // 3. Block contacts if ignoreContacts is true
            if (blockedSourcesRules.ignoreContacts === true) {
                try {
                    const contact = await message.getContact();
                    if (contact && contact.isMyContact) {
                        await this.blockAndRecord(message.from, 'is_contact');
                        return false;
                    }
                } catch (error) {
                    console.error('❌ שגיאה בבדיקת איש קשר:', error.message);
                    await this.blockAndRecord(message.from, 'contact_check_failed');
                    return false;
                }
            }

            // 4. Block archived chats if ignoreArchived is true
            if (blockedSourcesRules.ignoreArchived === true) {
                try {
                    const chat = await message.getChat();
                    if (chat && chat.archived) {
                        await this.blockAndRecord(message.from, 'is_archived');
                        return false;
                    }
                } catch (error) {
                    console.error('❌ שגיאה בבדיקת ארכיון:', error.message);
                    await this.blockAndRecord(message.from, 'archive_check_failed');
                    return false;
                }
            }

            // Only after passing ALL conversation checks, proceed with other checks
            
            // Get current lead status
            const lead = this.integrationManager?.flowEngine?.leadsManager ? 
                await this.integrationManager.flowEngine.leadsManager.getLead(message.from) : null;

            // Check if the lead is already blocked
            if (lead?.blocked) {
                // Check if unblock is allowed and the message matches the unblock keyword
                if (lead.allow_unblock && 
                    lead.unblock_keyword && 
                    message.body && 
                    message.body.trim().toLowerCase() === lead.unblock_keyword.toLowerCase()) {
                    console.log(`🔓 ביטול חסימה עבור ${message.from}`);
                    
                    // Unblock the client
                    await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                        blocked: false,
                        unblocked_at: new Date().toISOString(),
                        unblocked_reason: 'unblock_keyword'
                    });
                    
                    return true;
                }
                
                // Check if block has a time limit and it has expired
                if (lead.unblock_at) {
                    const unblockTime = new Date(lead.unblock_at);
                    const now = new Date();
                    
                    if (now > unblockTime) {
                        console.log(`⏰ תפוגת חסימה עבור ${message.from}`);
                        
                        // Unblock the client
                        await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                            blocked: false,
                            unblocked_at: new Date().toISOString(),
                            unblocked_reason: 'time_expired'
                        });
                        
                        return true;
                    }
                }
                
                return false;
            }

            // Check if client has scheduled appointments
            const blockScheduledConfig = this.rules?.configuration?.client_management?.blockScheduledClients;
            if (blockScheduledConfig?.enabled) {
                const shouldBlock = await this.checkScheduledAppointments(message.from, blockScheduledConfig);
                if (shouldBlock) {
                    console.log(`📅 חסימה בגלל פגישות מתוכננות`);
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
                        console.log(`🔑 אין מילות מפתח להפעלה: ${message.body}`);
                        return false;
                    } else {
                        // If activation successful, update the last activation time
                        if (this.integrationManager?.flowEngine?.leadsManager) {
                            await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                                last_activation_time: new Date().toISOString()
                            });
                        }
                        console.log(`🔓 הפעלה מוצלחת`);
                    }
                }
            }

            // Check reset keyword (only for existing conversations)
            if (!isNewConversation) {
                const resetConfig = this.rules?.configuration?.client_management?.reset;
                const resetKeyword = resetConfig?.keyword;
                
                // Case-insensitive check for reset keyword
                const isResetKeyword = resetKeyword && 
                    message.body && 
                    message.body.trim().toLowerCase() === resetKeyword.toLowerCase();

                if (isResetKeyword && resetConfig?.enabled) {
                    console.log(`🔄 מילת מפתח איפוס זוהתה`);
                    return true;
                }
            }

            // Check if client is frozen
            const isFrozen = await this.isClientFrozen(message.from);
            if (isFrozen) {
                console.log(`❄️ משתמש קפוא`);
                return false;
            }

            console.log(`✅ הודעה עברה את כל הכללים`);
            return true;
        } catch (error) {
            console.error('❌ שגיאה בעיבוד כללים:', error.message);
            return false;
        }
    }

    async checkScheduledAppointments(userId, config) {
        if (!this.integrationManager?.sheetsService) {
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
                return true; // Block if has appointment
            }

            return false; // No appointments found
        } catch (error) {
            console.error('❌ שגיאה בבדיקת פגישות:', error.message);
            return false;
        }
    }

    async isClientFrozen(userId) {
        // We only check if the user is frozen, not if freeze is enabled globally
        // This allows steps with their own freeze configuration to work
        
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
                lastUnfrozenAt: now.toISOString()
            });
            
            console.log(`❄️➡️ הפשרה אוטומטית`);
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