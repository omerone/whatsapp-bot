class RulesManager {
    constructor(rules = {}, integrationManager = null) {
        this.rules = rules;
        this.integrationManager = integrationManager;
    }

    async shouldProcessMessage(message, client) {
        try {
            const isProblematicUser = message.from === '972535916434@c.us';
            if (isProblematicUser) {
                console.log(`[RulesManager Debug ${message.from}] Received message. Body: "${message.body}"`);
            }

            // Block invalid user IDs immediately
            if (message.from === 'status@broadcast' || message.from === 'undefined' || !message.from || message.from.trim() === '') {
                return false;
            }

            // Check if this is a bot message by looking for common bot indicators
            if (this.isBotMessage(message)) {
                console.log(`[RulesManager] Ignoring bot message from ${message.from}: "${message.body}"`);
                return false;
            }

            // Check if this is the reset keyword (check both old and new locations)
            const oldResetConfig = this.integrationManager?.flowEngine?.flow?.resetConfig;
            const newResetConfig = this.rules?.resetConfig;
            const resetKeyword = (newResetConfig?.enabled && newResetConfig?.keyword) || oldResetConfig?.keyword;
            const isResetKeyword = resetKeyword && message.body === resetKeyword;

            // Check if client is frozen (but allow reset keyword)
            if (!isResetKeyword && await this.isClientFrozen(message.from)) {
                console.log(`[RulesManager] Client ${message.from} is frozen, ignoring message`);
                return false;
            }

            // Check activation keywords for new clients (only if not reset keyword)
            if (!isResetKeyword && await this.shouldCheckActivationKeywords(message.from)) {
                if (!this.hasActivationKeywords(message.body)) {
                    console.log(`[RulesManager] Client ${message.from} didn't use activation keywords, ignoring message`);
                    return false;
                }
            }
            if (isProblematicUser) {
                console.log(`[RulesManager Debug ${message.from}] Reset keyword configured: "${resetKeyword}", Is this message reset keyword: ${isResetKeyword}`);
            }
            
            // Get current lead status first
            const lead = this.integrationManager?.flowEngine?.leadsManager ? 
                await this.integrationManager.flowEngine.leadsManager.getLead(message.from) : null;

            // Check if the lead is already blocked
            if (lead?.blocked) {
                // If it's reset keyword, check if reset is allowed for blocked clients
                if (isResetKeyword) {
                    const allowResetForBlocked = newResetConfig?.allowResetForBlockedClients;
                    if (!allowResetForBlocked) {
                        if (newResetConfig?.logResetActions) {
                            console.log(`[RulesManager] Blocked client ${message.from} (reason: ${lead.blocked_reason}) tried to reset but allowResetForBlockedClients is false`);
                        }
                        return false;
                    }
                    // If allowed, continue processing (don't return false here)
                } else {
                    return false;
                }
            }

            // Check if message is from a contact
            if (this.rules.ignoreContacts && !isResetKeyword) {
                const contact = await message.getContact();
                if (isProblematicUser) {
                    console.log(`[RulesManager Debug ${message.from}] ignoreContacts: ${this.rules.ignoreContacts}, contact.isMyContact: ${contact.isMyContact}`);
                }
                if (contact.isMyContact) {
                    if (isProblematicUser) console.log(`[RulesManager Debug ${message.from}] Rule: Blocked due to ignoreContacts.`);
                    // Update lead to blocked
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
                return false;
            }

            // Check if message is a status update
            if (this.rules.ignoreStatus && message.isStatus) {
                return false;
            }

            // Check if chat is archived
            if (this.rules.ignoreArchived && !isResetKeyword) {
                const chat = await message.getChat();
                if (isProblematicUser) {
                    console.log(`[RulesManager Debug ${message.from}] ignoreArchived: ${this.rules.ignoreArchived}, chat.archived: ${chat.archived}`);
                }
                if (chat.archived) {
                    if (isProblematicUser) console.log(`[RulesManager Debug ${message.from}] Rule: Blocked due to ignoreArchived.`);
                    // Update lead to blocked
                    if (this.integrationManager.flowEngine?.leadsManager) {
                        await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                            blocked: true,
                            blocked_reason: 'is_archived'
                        });
                    }
                    return false;
                }
            }

            // Check if client has a scheduled appointment
            if (this.rules.blockScheduledClients && this.integrationManager?.services?.sheets && !isResetKeyword) {
                const blockConfig = this.rules.blockScheduledClients;
                
                // Support both old boolean format and new object format for backwards compatibility
                if (blockConfig === true || blockConfig.enabled) {
                    const phone = message.from.split('@')[0];
                    
                    // Determine what type of appointments to check
                    let shouldBlock = false;
                    let blockReason = 'scheduled_appointment';
                    
                    if (blockConfig === true) {
                        // Old format - check future and present appointments
                        shouldBlock = await this.integrationManager.services.sheets.hasScheduledAppointment(phone, 'futureAndPresent');
                    } else if (blockConfig.blockPastAndPresent && blockConfig.blockFutureAndPresent) {
                        // Block all appointments
                        shouldBlock = await this.integrationManager.services.sheets.hasScheduledAppointment(phone, 'any');
                    } else if (blockConfig.blockPastAndPresent) {
                        shouldBlock = await this.integrationManager.services.sheets.hasScheduledAppointment(phone, 'pastAndPresent');
                        blockReason = 'past_or_present_appointment';
                    } else if (blockConfig.blockFutureAndPresent) {
                        shouldBlock = await this.integrationManager.services.sheets.hasScheduledAppointment(phone, 'futureAndPresent');
                        blockReason = 'future_or_present_appointment';
                    }
                    
                    if (shouldBlock) {
                        // Check if this is a rescheduling attempt
                        if (blockConfig.allowRescheduling && message.body && this.isReschedulingMessage(message.body)) {
                            // If only future appointments can reschedule, check if they have future appointments
                            if (blockConfig.rescheduleOnlyFuture) {
                                const hasFutureAppointment = await this.integrationManager.services.sheets.hasScheduledAppointment(phone, 'future');
                                if (!hasFutureAppointment) {
                                    shouldBlock = true;
                                    blockReason = 'no_future_appointment_for_reschedule';
                                } else {
                                    shouldBlock = false; // Allow rescheduling
                                }
                            } else {
                                shouldBlock = false; // Allow rescheduling
                            }
                        }
                        
                        if (shouldBlock) {
                            // Update the lead's blocked status in leads.json
                            if (this.integrationManager.flowEngine?.leadsManager) {
                                await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(message.from, {
                                    blocked: true,
                                    blocked_reason: blockReason
                                });
                            }
                            return false;
                        }
                    }
                }
            }

            if (isProblematicUser) {
                console.log(`[RulesManager Debug ${message.from}] All rules passed. Allowing message processing.`);
            }
            return true;
        } catch (error) {
            console.error('Error in shouldProcessMessage:', error);
            // In case of error checking contacts or other rules, don't process the message to be safe
            return false;
        }
    }

    isBotMessage(message) {
        if (!message.body) return false;
        
        const messageBody = message.body.toLowerCase();
        
        // Check for common bot indicators
        const botIndicators = [
            'הנכם מוזמנים',
            'נשלח באמצעות',
            'קבלת הפנים',
            'https://tinyurl.com',
            'אישורי הגעה',
            'דיגיטל פיק',
            'save the date',
            'אולמי',
            'האירוע יתקיים',
            'לחצו כאן',
            'צריכים הסעה',
            'רוצים להשתתף',
            'במשחק אינטראקטיבי',
            'קודם מחברה',
            'הזמנה לאירוע',
            'מוזמנות ומוזמנים',
            'להרשמה לחצו',
            'לפרטים נוספים'
        ];
        
        // Check if message contains URLs (common in bot messages)
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const hasUrl = urlPattern.test(message.body);
        
        // Check if message contains multiple bot indicators
        const indicatorCount = botIndicators.filter(indicator => 
            messageBody.includes(indicator.toLowerCase())
        ).length;
        
        // Check for phone numbers in Hebrew context (common in invitations)
        const phonePattern = /05\d{1}-?\d{7}|02-?\d{7}|03-?\d{7}|04-?\d{7}|08-?\d{7}|09-?\d{7}/g;
        const hasPhoneNumber = phonePattern.test(message.body);
        
        // Check for date patterns (common in invitations)
        const datePattern = /\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\.\d{1,2}\.\d{4}/g;
        const hasDate = datePattern.test(message.body);
        
        // If message has URL and at least one bot indicator, or multiple indicators
        if ((hasUrl && indicatorCount >= 1) || indicatorCount >= 2) {
            return true;
        }
        
        // Check for very long messages (typical for invitations/automated messages)
        if (message.body.length > 300 && (hasUrl || indicatorCount >= 1 || hasPhoneNumber || hasDate)) {
            return true;
        }
        
        // Check for structured invitation format (has URL + date + phone/indicator)
        if (hasUrl && hasDate && (hasPhoneNumber || indicatorCount >= 1)) {
            return true;
        }
        
        return false;
    }

    async isClientFrozen(userId) {
        // Check both old and new freeze config for backwards compatibility
        const oldConfig = this.integrationManager?.flowEngine?.flow?.freezeConfig;
        const newConfig = this.rules?.freezeClients;
        
        if (!oldConfig?.enabled && !newConfig?.enabled) {
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
            return true; // Still frozen
        } else {
            // Unfreeze the client
            await this.integrationManager.flowEngine.leadsManager.createOrUpdateLead(userId, {
                frozenUntil: null,
                freezeCount: lead.freezeCount || 0, // Keep freeze count for tracking
                lastUnfrozenAt: now.toISOString()
            });
            
            if (newConfig?.logFreezeActions) {
                console.log(`[RulesManager] Client ${userId} unfrozen automatically`);
            }
            return false;
        }
    }

    async shouldCheckActivationKeywords(userId) {
        if (!this.rules.activationKeywords?.enabled) {
            return false;
        }

        const lead = this.integrationManager?.flowEngine?.leadsManager ? 
            await this.integrationManager.flowEngine.leadsManager.getLead(userId) : null;

        // Check activation keywords for new clients (no lead or lead at start step)
        if (!lead || !lead.current_step || lead.current_step === this.integrationManager?.flowEngine?.flow?.start) {
            return true;
        }

        // Check if enough time has passed since last interaction to require keywords again
        if (this.rules.activationKeywords.resetAfterHours && lead.last_interaction) {
            const resetAfterMs = this.rules.activationKeywords.resetAfterHours * 60 * 60 * 1000; // Convert hours to milliseconds
            const lastInteractionTime = this.parseHebrewDate(lead.last_interaction);
            const now = new Date();
            
            if (now - lastInteractionTime > resetAfterMs) {
                console.log(`[RulesManager] Client ${userId} last interaction was ${lead.last_interaction}, requiring activation keywords again`);
                return true;
            }
        }

        return false;
    }

    hasActivationKeywords(messageBody) {
        if (!this.rules.activationKeywords?.enabled || !this.rules.activationKeywords?.keywords) {
            return true; // If not enabled, always allow
        }

        const messageText = messageBody.toLowerCase().trim();
        const keywords = this.rules.activationKeywords.keywords;

        return keywords.some(keyword => {
            const keywordLower = keyword.toLowerCase().trim();
            // Check for exact word match (not just substring)
            const wordBoundaryPattern = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
            return wordBoundaryPattern.test(messageText) || messageText.includes(keywordLower);
        });
    }

    parseHebrewDate(dateString) {
        try {
            // Format: "05.06.2025, 18:51:26"
            const [datePart, timePart] = dateString.split(', ');
            const [day, month, year] = datePart.split('.');
            const [hour, minute, second] = timePart.split(':');
            
            return new Date(
                parseInt(year),
                parseInt(month) - 1, // Month is 0-indexed
                parseInt(day),
                parseInt(hour),
                parseInt(minute),
                parseInt(second)
            );
        } catch (error) {
            console.error('Error parsing Hebrew date:', error);
            return new Date(0); // Return epoch if parsing fails
        }
    }

    isReschedulingMessage(messageBody) {
        if (!messageBody || typeof messageBody !== 'string') {
            return false;
        }

        const messageText = messageBody.toLowerCase().trim();
        
        // Common rescheduling keywords in Hebrew
        const reschedulingKeywords = [
            'לשנות',
            'לדחות',
            'לעדכן',
            'לשנות תאריך',
            'לדחות פגישה',
            'לעדכן פגישה',
            'תאריך אחר',
            'שעה אחרת',
            'לא יכול',
            'לא אוכל',
            'בעיה',
            'מבטל',
            'ביטול',
            'לבטל',
            'ריסדוול',
            'reschedule',
            'רשדיול',
            'לתזמן מחדש',
            'תזמון מחדש',
            'פגישה חדשה',
            'לקבוע מחדש'
        ];

        return reschedulingKeywords.some(keyword => 
            messageText.includes(keyword.toLowerCase())
        );
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