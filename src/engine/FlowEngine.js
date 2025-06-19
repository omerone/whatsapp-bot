const fs = require('fs').promises;
const path = require('path');
const MessageStep = require('../steps/MessageStep');
const QuestionStep = require('../steps/QuestionStep');
const OptionStep = require('../steps/OptionStep');
const DateStep = require('../steps/DateStep');
const LeadsManager = require('./LeadsManager');
const IntegrationManager = require('../services/IntegrationManager');

class FlowEngine {
    constructor(flowPath, messagesPath, leadsPath, whatsappClient) {
        this.flowPath = flowPath;
        this.messagesPath = messagesPath;
        this.leadsPath = leadsPath;
        this.whatsappClient = whatsappClient;
        this.dataPath = path.dirname(flowPath);
        console.log(`[FlowEngine] 📁 Data path set to: ${this.dataPath}`);
        this.flow = null;
        this.messages = {};
        this.sessions = new Map();
        this.stepHandlers = {
            'message': MessageStep,
            'question': QuestionStep,
            'options': OptionStep,
            'date': DateStep
        };
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.lastCleanup = Date.now();
        this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
        this.leadsManager = new LeadsManager(leadsPath);
        this.integrationManager = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Load flow configuration
            const flowData = await fs.readFile(this.flowPath, 'utf8');
            this.flow = JSON.parse(flowData);

            // Initialize integration manager, now passing the stored whatsappClient and dataPath
            this.integrationManager = new IntegrationManager(this.flow, this, this.whatsappClient, this.dataPath);
            const integrationManagerInitialized = await this.integrationManager.initialize();
            if (!integrationManagerInitialized) {
                // Decide if this is a fatal error. For now, let's log and continue, 
                // as some core functionality might work without all integrations.
                console.warn('FlowEngine: IntegrationManager failed to initialize. Some integrations might not be active.');
            }

            // Initialize leads manager
            await this.leadsManager.initialize();

            // Load message templates
            const messageFiles = await fs.readdir(this.messagesPath);
            for (const file of messageFiles) {
                if (file.endsWith('.txt')) {
                    const content = await fs.readFile(path.join(this.messagesPath, file), 'utf8');
                    this.messages[file] = content;
                }
            }

            // Validate flow structure
            if (!this.flow.start || !this.flow.steps) {
                throw new Error('Invalid flow structure: missing start or steps');
            }

            // Validate steps and message files
            for (const [stepId, step] of Object.entries(this.flow.steps)) {
                // Validate step type
                if (!step.type || !this.stepHandlers[step.type]) {
                    throw new Error(`Invalid step type for step ${stepId}`);
                }
                step.id = stepId;

                // Validate message file if exists
                if (step.messageFile) {
                    const messagePath = path.join(this.messagesPath, step.messageFile);
                    try {
                        await fs.access(messagePath);
                    } catch (error) {
                        throw new Error(`Message file not found: ${step.messageFile} for step ${stepId}`);
                    }
                }
            }

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize FlowEngine:', error);
            this.initialized = false;
            return false;
        }
    }

    async loadMessageFile(filename) {
        try {
            if (!filename) {
                throw new Error('No filename provided');
            }
            const messagePath = path.join(this.messagesPath, filename);
            const content = await fs.readFile(messagePath, 'utf8');
            if (!content.trim()) {
                throw new Error(`Message file ${filename} is empty`);
            }
            return content.trim();
        } catch (error) {
            return ' #1מצטערים, לא הצלחנו לטעון את ההודעה. אנא נסה שוב או כתוב "תפריט" להתחלה מחדש.';
        }
    }

    async getSession(userId) {
        this.cleanupOldSessions();
        console.log(`\n[FlowEngine] 🔄 Getting session for user ${userId}`);

        if (!this.initialized) {
            throw new Error('FlowEngine not initialized');
        }

        // Try to get existing session
        let session = this.sessions.get(userId);
        console.log(`[FlowEngine] 📊 Current session:`, session ? 
            `step=${session.currentStep}, isFirst=${session.isFirstMessage}, isNew=${session.isNewConversation}` : 'None');

        // If no session exists or it's expired
        if (!session || !this.leadsManager.isLeadActive(userId)) {
            console.log(`[FlowEngine] 🆕 No active session found, creating new one`);
            
            // Try to restore session from leads.json
            const lead = await this.leadsManager.getLead(userId);
            console.log(`[FlowEngine] 📋 Lead data:`, lead ? 
                `step=${lead.current_step}, blocked=${lead.blocked}, data=${JSON.stringify(lead.data)}` : 'New lead');
            
            // Check if this is genuinely a new conversation
            const isNewConversation = !lead || !lead.current_step;
            
            if (!isNewConversation) {
                console.log(`[FlowEngine] 🔄 Restoring existing conversation`);
                // This is a continuing conversation
                session = {
                    userId,
                    currentStep: lead.current_step,
                    data: lead.data || {},
                    lastInteraction: new Date(),
                    retryCount: 0,
                    isFirstMessage: false,
                    isNewConversation: false
                };
            } else {
                console.log(`[FlowEngine] 🌟 Starting new conversation`);
                // This is a new conversation
                session = {
                    userId,
                    currentStep: this.flow.start,
                    data: {},
                    lastInteraction: new Date(),
                    retryCount: 0,
                    isFirstMessage: true,
                    isNewConversation: true
                };
            }
            
            this.sessions.set(userId, session);
            console.log(`[FlowEngine] 💾 Session created:`, session);
            
            // If this is a new conversation, create the lead
            if (session.isNewConversation) {
                console.log(`[FlowEngine] 📝 Creating new lead for ${userId}`);
                await this.leadsManager.createOrUpdateLead(userId, {
                    current_step: session.currentStep,
                    data: session.data,
                    is_schedule: false,
                    meeting: null,
                    last_sent_message: null,
                    relevant: true,
                    last_interaction: new Date().toLocaleString('he-IL'),
                    date_and_time_conversation_started: new Date().toLocaleString('he-IL'),
                    blocked: false,
                    blocked_reason: null
                });
            }
        } else {
            console.log(`[FlowEngine] ✅ Using existing session`);
            // Update last interaction time
            session.lastInteraction = new Date();
        }

        return session;
    }

    async handleResetKeyword(userId) {
        const session = await this.getSession(userId);
        const resetConfig = this.flow.configuration?.client_management?.reset;

        if (!resetConfig?.enabled) {
            return null;
        }

        console.log(`[FlowEngine] 🔄 Processing reset for user ${userId}`);

        // Get current lead to check if there are scheduled meetings to delete
        const currentLead = await this.leadsManager.getLead(userId);
        
        // If user has scheduled meetings and reset options allow deletion, delete them
        if (currentLead && currentLead.is_schedule && currentLead.meeting && 
            resetConfig.options?.delete_appointment) {
            
            console.log(`[FlowEngine] 🗑️ Deleting scheduled appointment for user ${userId}`);
            
            try {
                // Delete from Google Calendar if integration is available
                if (this.integrationManager && currentLead.meeting.calendar_event_id) {
                    console.log(`[FlowEngine] 📅 Deleting calendar event: ${currentLead.meeting.calendar_event_id}`);
                    await this.integrationManager.deleteCalendarEvent(currentLead.meeting.calendar_event_id);
                }
                
                // Delete from Google Sheets if integration is available
                if (this.integrationManager && (currentLead.meeting.sheet_row_phone || currentLead.meeting.phone)) {
                    const phoneToDelete = currentLead.meeting.sheet_row_phone || currentLead.meeting.phone || userId;
                    console.log(`[FlowEngine] 📊 Deleting sheet appointment for phone: ${phoneToDelete}`);
                    await this.integrationManager.deleteSheetAppointment(phoneToDelete);
                }
                
                console.log(`[FlowEngine] ✅ Successfully deleted appointment for user ${userId}`);
                
            } catch (error) {
                console.error(`[FlowEngine] ❌ Error deleting appointment for user ${userId}:`, error);
                // Continue with reset even if deletion failed
            }
        }

        // Reset session data
        session.data = {};
        session.currentStep = resetConfig.target_step || 'main_menu';
        session.isFirstMessage = false;
        session.isNewConversation = false;
        session.ignoreNextInput = false;
        
        // Clear meeting data from session
        if (session.meetingData) {
            delete session.meetingData;
        }

        // Update lead with reset values
        const updateData = {
            current_step: session.currentStep,
            data: session.data,
            is_schedule: false,
            meeting: null,
            last_sent_message: 'bot',
            relevant: true,
            last_interaction: new Date().toLocaleString('he-IL')
        };

        // If reset options allow unblocking, clear block status
        if (resetConfig.options?.allow_unblock) {
            updateData.blocked = false;
            updateData.blocked_reason = null;
            updateData.blocked_at = null;
            updateData.allow_unblock = false;
            updateData.unblock_keyword = null;
        }

        // If reset options allow unfreezing, clear freeze status
        if (resetConfig.options?.unfreeze) {
            updateData.frozenUntil = null;
            updateData.lastFreezeReason = null;
        }

        await this.leadsManager.createOrUpdateLead(userId, updateData);

        console.log(`[FlowEngine] ✅ Reset completed for user ${userId}, redirecting to ${session.currentStep}`);

        // Load and return the target step message
        const targetStep = this.flow.steps[session.currentStep];
        let messages = [];
        
        if (targetStep.messageFile) {
            const messageContent = await this.loadMessageFile(targetStep.messageFile);
            if (messageContent) {
                messages.push(this.replacePlaceholders(messageContent, session.data));
            }
        } else if (targetStep.message) {
            messages.push(this.replacePlaceholders(targetStep.message, session.data));
        }

        return {
            messages,
            waitForUser: targetStep.userResponseWaiting !== false
        };
    }

    async processStep(userId, userInput = null, isFirstMessage = false) {
        console.log(`\n[FlowEngine] 🔄 Processing step for ${userId}`, {
            userInput,
            isFirstMessage,
            timestamp: new Date().toLocaleString('he-IL')
        });

        if (!this.initialized) {
            throw new Error('FlowEngine not initialized');
        }

        // Check if user is blocked before processing
        const lead = await this.leadsManager.getLead(userId);
        if (lead && lead.blocked) {
            console.log(`[FlowEngine] 🚫 User ${userId} is blocked, ignoring message`);
            
            // Check if user sent unblock keyword
            if (lead.allow_unblock && lead.unblock_keyword && userInput && 
                userInput.trim().toLowerCase() === lead.unblock_keyword.toLowerCase()) {
                console.log(`[FlowEngine] 🔓 Unblocking user ${userId} with keyword: ${userInput}`);
                await this.leadsManager.createOrUpdateLead(userId, {
                    blocked: false,
                    blocked_reason: null,
                    blocked_at: null,
                    allow_unblock: false,
                    unblock_keyword: null
                });
                // Continue processing after unblocking
            } else {
                // User is blocked and didn't send unblock keyword - ignore message
                return {
                    messages: [],
                    waitForUser: false
                };
            }
        }

        const session = await this.getSession(userId);
        console.log(`[FlowEngine] 📊 Current session state:`, {
            currentStep: session.currentStep,
            isFirstMessage: session.isFirstMessage,
            isNewConversation: session.isNewConversation,
            data: session.data
        });
        
        try {
            // Handle first message from user
            if (isFirstMessage || session.isFirstMessage) {
                console.log(`[FlowEngine] 🌟 Handling first message - ignoring content: ${userInput}`);
                session.isFirstMessage = false;
                session.isNewConversation = true;
                session.currentStep = this.flow.start;
                session.data = {};
                
                console.log(`[FlowEngine] 🔄 Session updated for first message:`, {
                    currentStep: session.currentStep,
                    isFirstMessage: session.isFirstMessage,
                    isNewConversation: session.isNewConversation
                });
                
                // Update the lead to track the client's message
                await this.leadsManager.createOrUpdateLead(userId, {
                    current_step: session.currentStep,
                    data: session.data,
                    is_schedule: false,
                    meeting: null,
                    last_sent_message: 'client',
                    last_client_message: userInput,
                    relevant: true,
                    last_interaction: new Date().toLocaleString('he-IL')
                });
                
                // Process the intro step - it will automatically flow to main_menu
                console.log(`[FlowEngine] 📝 Processing intro step`);
                const response = await this.processStepInternal(userId, null);
                
                // Update the lead after processing
                await this.leadsManager.createOrUpdateLead(userId, {
                    current_step: session.currentStep,
                    data: session.data,
                    is_schedule: false,
                    meeting: null,
                    last_sent_message: 'bot',
                    relevant: true,
                    last_interaction: new Date().toLocaleString('he-IL')
                });
                
                return response;
            }

            // Check for reset keyword
            const resetConfig = this.flow.configuration?.client_management?.reset;
            if (resetConfig?.enabled && 
                resetConfig.keyword && 
                userInput && 
                userInput.trim().toLowerCase() === resetConfig.keyword.toLowerCase() && 
                !session.isFirstMessage) {
                console.log(`[FlowEngine] 🔄 Processing reset keyword`);
                return await this.handleResetKeyword(userId);
            }

            // Normal message processing
            console.log(`[FlowEngine] 📝 Processing normal message for step: ${session.currentStep}`);
            const response = await this.processStepInternal(userId, userInput);
            
            // Update last client message after processing
            if (userInput) {
                await this.leadsManager.updateLastMessage(userId, 'client', userInput);
            }
            
            console.log(`[FlowEngine] 📬 Final response for normal message:`, {
                messageCount: response.messages?.length,
                waitForUser: response.waitForUser,
                currentStep: session.currentStep
            });
            
            return response;
            
        } catch (error) {
            console.error('[FlowEngine] ❌ Error processing step:', error);
            return {
                messages: ['מצטערים, אירעה שגיאה. אנא נסה שוב או כתוב "תפריט" להתחלה מחדש.']
            };
        }
    }

    async processStepInternal(userId, userInput = null) {
        const session = await this.getSession(userId);
        
        try {
            // Get current step
            const step = this.flow.steps[session.currentStep];
            if (!step) {
                throw new Error(`Step ${session.currentStep} not found in flow`);
            }

            // Check for freeze property on any step type BEFORE processing
            if (step.freeze) {
                console.log(`[FlowEngine] Step ${step.id} has freeze property, freezing client ${userId}`);
                await this.freezeClient(session.userId, step.id);
                
                // Get message content for the step before freezing
                let messages = [];
                
                if (step.messageHeader) {
                    messages.push(this.replacePlaceholders(step.messageHeader, session.data));
                }
                
                if (step.messageFile) {
                    const messageContent = await this.loadMessageFile(step.messageFile);
                    if (messageContent) {
                        messages.push(this.replacePlaceholders(messageContent, session.data));
                    }
                }
                
                if (step.message) {
                    messages.push(this.replacePlaceholders(step.message, session.data));
                }
                
                if (step.footerMessage) {
                    messages.push(this.replacePlaceholders(step.footerMessage, session.data));
                }
                
                // If no messages were found using standard fields, try to get message using the step handler
                if (messages.length === 0) {
                    const handler = this.stepHandlers[step.type];
                    if (handler) {
                        const tempResult = await handler.process(step, session, null, this);
                        if (tempResult && tempResult.messages) {
                            messages = tempResult.messages;
                        }
                    }
                }
                
                // Return messages and wait for user (freeze always forces wait)
                return {
                    messages,
                    waitForUser: true
                };
            }

            // Check if this step has blocking enabled and user sent input
            if (step.block && userInput !== null) {
                console.log(`[FlowEngine] 🚫 Step ${step.id} has blocking and user sent input - blocking client ${userId}`);
                await this.blockClient(userId, step.id);
                // Return empty messages since blocking should only send explanation once
                return {
                    messages: [],
                    waitForUser: false
                };
            }

            // Get the appropriate step handler
            const handler = this.stepHandlers[step.type];
            if (!handler) {
                throw new Error(`Unknown step type: ${step.type}`);
            }

            // Process the step
            let result = await handler.process(step, session, userInput, this);

            // Handle errors in processing
            if (!result || !result.messages) {
                throw new Error('Invalid step processing result');
            }

            // Update lead with current step
            await this.leadsManager.updateLeadStep(userId, session.currentStep);
            
            // Update last sent message type if we have messages to send
            if (result && result.messages && result.messages.length > 0) {
                await this.leadsManager.updateLastMessage(userId, 'bot');
            } else if (userInput) {
                // If we got user input but no response messages, mark as client message
                await this.leadsManager.updateLastMessage(userId, 'client', userInput);
            }

            // Use userResponseWaiting from step configuration to determine wait behavior
            // If step explicitly sets userResponseWaiting, use that value
            if (step.userResponseWaiting !== undefined) {
                result.waitForUser = step.userResponseWaiting;
                console.log(`[FlowEngine] 📝 Step ${step.id} userResponseWaiting=${step.userResponseWaiting}, setting waitForUser=${result.waitForUser}`);
            }

            // Handle auto-continuation for steps that don't wait for user (but not if we're about to block)
            if (result.waitForUser === false && !session.ignoreNextInput && !step.block) {
                console.log(`[FlowEngine] ⏭️ Auto-continuing from step ${step.id} (waitForUser=false)`);
                // Continue to next step
                const nextResult = await this.processStepInternal(userId, null);
                if (nextResult && nextResult.messages) {
                    result = {
                        messages: [...result.messages, ...nextResult.messages],
                        waitForUser: nextResult.waitForUser
                    };
                }
            }

            // Handle integrations if present
            if (step.integrations?.enabled) {
                console.log(`[FlowEngine] 🔗 Processing integrations for step ${step.id}`);
                await this.handleStepIntegrations(userId, step, session);
            }

            // If this step has blocking but no user input yet, just wait for input
            if (step.block && userInput === null) {
                console.log(`[FlowEngine] 📝 Step ${step.id} has blocking - waiting for user input`);
                result.waitForUser = true;
            }

            return result;

        } catch (error) {
            console.error('Error in processStepInternal:', error);
            return {
                messages: ['מצטערים, אירעה שגיאה. אנא נסה שוב או כתוב "תפריט" להתחלה מחדש.'],
                waitForUser: true
            };
        }
    }

    async blockClient(userId, stepId = null) {
        let blockConfig;
        
        // First check if there's a step-specific block configuration
        if (stepId && this.flow.steps[stepId] && this.flow.steps[stepId].block && 
            typeof this.flow.steps[stepId].block === 'object') {
            blockConfig = this.flow.steps[stepId].block;
            console.log(`[FlowEngine] Using step-specific block configuration for step ${stepId}`);
        } else if (stepId && this.flow.steps[stepId] && this.flow.steps[stepId].block === true) {
            // When block is just true without configuration, use default values
            blockConfig = {
                enabled: true,
                messaging: {
                    send_explanation: true,
                    message: "לצערנו אינך יכול להמשיך בתהליך כרגע. תודה על ההבנה."
                },
                allow_unblock: false,
                unblock_keyword: "שחרר"
            };
            console.log(`[FlowEngine] Using default block configuration for step ${stepId}`);
        } else {
            console.log(`[FlowEngine] No block configuration found for step ${stepId}`);
            return;
        }
        
        if (!blockConfig?.enabled) {
            return;
        }

        // Get current lead to check if already blocked
        const currentLead = await this.leadsManager.getLead(userId);
        
        // Check if already blocked to prevent duplicate messages
        if (currentLead && currentLead.blocked) {
            console.log(`[FlowEngine] Client ${userId} is already blocked, not sending duplicate message`);
            return;
        }
        
        // Get global block duration if configured
        const blockDuration = this.flow.configuration?.client_management?.block_duration || 0;
        
        // Update lead with block info
        const updateData = {
            blocked: true,
            blocked_reason: stepId || 'unknown',
            blocked_at: new Date().toISOString(),
            allow_unblock: blockConfig.allow_unblock || false,
            unblock_keyword: blockConfig.allow_unblock ? blockConfig.unblock_keyword : null
        };
        
        // If block duration is set, add unblock time
        if (blockDuration > 0) {
            const unblockTime = new Date();
            unblockTime.setMinutes(unblockTime.getMinutes() + blockDuration);
            updateData.unblock_at = unblockTime.toISOString();
        }

        await this.leadsManager.createOrUpdateLead(userId, updateData);

        // Send explanation message if enabled
        if (blockConfig.messaging?.send_explanation && blockConfig.messaging?.message) {
            const explanationText = blockConfig.messaging.message;
            
            try {
                await this.whatsappClient.sendMessage(`${userId.split('@')[0]}@c.us`, explanationText);
                
                // Track that we sent the message
                await this.leadsManager.createOrUpdateLead(userId, {
                    last_block_message_sent: new Date().toISOString(),
                    last_sent_message: 'bot'
                });
                
                console.log(`[FlowEngine] Block explanation message sent to ${userId}`);
            } catch (error) {
                console.error(`[FlowEngine] Error sending block explanation to ${userId}:`, error);
            }
        }

        console.log(`[FlowEngine] Client ${userId} blocked (reason: ${stepId || 'unknown'}, allow_unblock: ${blockConfig.allow_unblock})`);
    }

    async freezeClient(userId, stepId = null) {
        let freezeConfig;
        
        // First check if there's a step-specific freeze configuration
        if (stepId && this.flow.steps[stepId] && this.flow.steps[stepId].freeze && 
            typeof this.flow.steps[stepId].freeze === 'object') {
            freezeConfig = this.flow.steps[stepId].freeze;
            console.log(`[FlowEngine] Using step-specific freeze configuration for step ${stepId}`);
        } else if (stepId && this.flow.steps[stepId] && this.flow.steps[stepId].freeze === true) {
            // When freeze is just true without configuration, use default values
            freezeConfig = {
                enabled: true,
                duration: 60,
                messaging: {
                    send_explanation: true,
                    message: "תחזור אלינו בעוד {duration} דקות. תודה על הסבלנות! 🙏"
                }
            };
            console.log(`[FlowEngine] Using default freeze configuration for step ${stepId}`);
        } else {
            console.log(`[FlowEngine] No freeze configuration found for step ${stepId}`);
            return;
        }
        
        if (!freezeConfig?.enabled) {
            return;
        }

        // Get current lead
        const currentLead = await this.leadsManager.getLead(userId);
        
        // Calculate freeze duration
        const freezeDurationMinutes = freezeConfig.duration || 60;

        const frozenUntil = new Date();
        frozenUntil.setMinutes(frozenUntil.getMinutes() + freezeDurationMinutes);

        // Update lead with freeze info
        const updateData = {
            frozenUntil: frozenUntil.toISOString(),
            lastFreezeReason: stepId || 'unknown',
            lastFrozenAt: new Date().toISOString()
        };

        await this.leadsManager.createOrUpdateLead(userId, updateData);

        // Send explanation message if enabled
        if (freezeConfig.messaging?.send_explanation && freezeConfig.messaging?.message) {
            const explanationText = freezeConfig.messaging.message.replace('{duration}', freezeDurationMinutes);
            
            try {
                await this.whatsappClient.sendMessage(`${userId.split('@')[0]}@c.us`, explanationText);
                
                // Track that we sent the message
                await this.leadsManager.createOrUpdateLead(userId, {
                    lastFreezeMessageSent: new Date().toISOString(),
                    last_sent_message: 'bot'
                });
            } catch (error) {
                console.error(`[FlowEngine] Error sending freeze explanation to ${userId}:`, error);
            }
        }

        console.log(`[FlowEngine] Client ${userId} frozen until ${frozenUntil.toLocaleString('he-IL')} (reason: ${stepId || 'unknown'})`);
    }

    async handleStepIntegrations(userId, step, session) {
        try {
            // Check if we have meeting data to process
            if (!session.meetingData) {
                console.log(`[FlowEngine] No meeting data available for integrations in step ${step.id}`);
                return;
            }

            const integrationConfig = step.integrations;
            const meetingData = session.meetingData;
            const lead = await this.leadsManager.getLead(userId);

            console.log(`[FlowEngine] 🔗 Processing integrations:`, {
                stepId: step.id,
                googleCalendar: integrationConfig.googleCalendar,
                googleSheets: integrationConfig.googleSheets,
                notifications: integrationConfig.notifications,
                reminders: integrationConfig.reminders,
                iPlan: integrationConfig.iPlan
            });

            // Handle individual integrations based on configuration
            if (this.integrationManager) {
                // Google Calendar
                if (integrationConfig.googleCalendar) {
                    try {
                        console.log(`[FlowEngine] 📅 Processing Google Calendar integration...`);
                        await this.integrationManager.handleCalendarIntegration(meetingData, lead);
                    } catch (error) {
                        console.error(`[FlowEngine] ❌ Google Calendar integration failed:`, error);
                    }
                }

                // Google Sheets
                if (integrationConfig.googleSheets) {
                    try {
                        console.log(`[FlowEngine] 📊 Processing Google Sheets integration...`);
                        await this.integrationManager.handleSheetsIntegration(meetingData, lead);
                    } catch (error) {
                        console.error(`[FlowEngine] ❌ Google Sheets integration failed:`, error);
                    }
                }

                // Notifications
                if (integrationConfig.notifications) {
                    try {
                        console.log(`[FlowEngine] 📢 Processing notifications integration...`);
                        await this.integrationManager._sendMeetingNotifications(meetingData, lead);
                    } catch (error) {
                        console.error(`[FlowEngine] ❌ Notifications integration failed:`, error);
                    }
                }

                // Reminders
                if (integrationConfig.reminders) {
                    try {
                        console.log(`[FlowEngine] ⏰ Processing reminders integration...`);
                        await this.integrationManager.handleRemindersIntegration(meetingData, lead);
                    } catch (error) {
                        console.error(`[FlowEngine] ❌ Reminders integration failed:`, error);
                    }
                }

                // iPlan
                if (integrationConfig.iPlan) {
                    try {
                        console.log(`[FlowEngine] 📋 Processing iPlan integration...`);
                        await this.integrationManager.handleIPlanIntegration(meetingData, lead);
                    } catch (error) {
                        console.error(`[FlowEngine] ❌ iPlan integration failed:`, error);
                    }
                }
            }

            console.log(`[FlowEngine] ✅ Completed processing integrations for step ${step.id}`);

        } catch (error) {
            console.error(`[FlowEngine] ❌ Error in handleStepIntegrations:`, error);
        }
    }

    cleanupOldSessions() {
        const now = Date.now();
        if (now - this.lastCleanup < this.cleanupInterval) {
            return;
        }
        this.lastCleanup = now;
        for (const [userId, session] of this.sessions.entries()) {
            if (now - session.lastInteraction > this.sessionTimeout) {
                this.sessions.delete(userId);
            }
        }
    }

    clearSession(userId) {
        this.sessions.delete(userId);
    }
    
    // Helper method to replace placeholders in text with values from data
    replacePlaceholders(text, data) {
        if (!text || !data) return text;
        
        let processedText = text;
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const placeholder = `{${key}}`;
                processedText = processedText.replace(
                    new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), 
                    data[key]
                );
            }
        }
        
        // Replace meeting-related placeholders if available
        if (data.meeting) {
            const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
            const [day, month, year] = data.meeting.date.split('/');
            const date = new Date(year, month - 1, day);
            const dayName = dayNames[date.getDay()];
            
            processedText = processedText
                .replace(/{dayName}/g, dayName)
                .replace(/{selectedDate}/g, data.meeting.date)
                .replace(/{selectedTime}/g, data.meeting.time);
        }
        
        return processedText;
    }
}

module.exports = FlowEngine;
