const fs = require('fs').promises;
const path = require('path');
const MessageStep = require('../steps/MessageStep');
const QuestionStep = require('../steps/QuestionStep');
const OptionStep = require('../steps/OptionStep');
const DateStep = require('../steps/DateStep');
const ConditionStep = require('../steps/ConditionStep');
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
            'date': DateStep,
            'condition': ConditionStep
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

            // Start ReminderService after LeadsManager is ready
            if (this.integrationManager && this.integrationManager.startReminderService) {
                await this.integrationManager.startReminderService();
            }

            // Message templates are now embedded in flow.json - no need to load from files

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

                // Skip messageFile validation - using embedded messages in flow.json
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
        // Message files are no longer used - all messages are embedded in flow.json
        console.log(`[FlowEngine] Warning: Attempting to load message file ${filename} - this feature is deprecated`);
        return 'מצטערים, לא הצלחנו לטעון את ההודעה. אנא נסה שוב או כתוב "תפריט" להתחלה מחדש.';
    }

    async getSession(userId) {
        this.cleanupOldSessions();

        if (!this.initialized) {
            throw new Error('FlowEngine not initialized');
        }

        // Try to get existing session
        let session = this.sessions.get(userId);

        // If no session exists or it's expired
        if (!session || !this.leadsManager.isLeadActive(userId)) {
            
            // Try to restore session from leads.json
            const lead = await this.leadsManager.getLead(userId);
            
            // Check if this is genuinely a new conversation
            const isNewConversation = !lead || !lead.current_step;
            
            if (!isNewConversation) {
                // This is a continuing conversation
                const sessionData = lead.data || {};
                            // Always add display_name if exists
            if (lead.data?.display_name) {
                sessionData.display_name = lead.data.display_name;
            }
                
                session = {
                    userId,
                    currentStep: lead.current_step,
                    data: sessionData,
                    lastInteraction: new Date(),
                    retryCount: 0,
                    isFirstMessage: false,
                    isNewConversation: false
                };
            } else {
                            // This is a new conversation
            const sessionData = {};
            // Only set display_name if we actually have one
            if (lead && lead.data?.display_name) {
                sessionData.display_name = lead.data.display_name;
            }
                
                session = {
                    userId,
                    currentStep: this.flow.start,
                    data: sessionData,
                    lastInteraction: new Date(),
                    retryCount: 0,
                    isFirstMessage: true,
                    isNewConversation: true
                };
            }
            
            this.sessions.set(userId, session);
            
            // If this is a new conversation, create the lead
            if (session.isNewConversation) {
                
                // Get existing lead data to preserve any data already set (like display_name)
                const existingLead = await this.leadsManager.getLead(userId);
                const existingData = existingLead?.data || {};
                
                // Merge session data with existing data, preserving existing values
                const mergedData = { ...existingData, ...session.data };
                
                await this.leadsManager.createOrUpdateLead(userId, {
                    current_step: session.currentStep,
                    data: mergedData,
                    is_schedule: false,
                    meeting: null,
                    last_sent_message: null,
                    relevant: true,
                    last_interaction: new Date().toLocaleString('he-IL'),
                    date_and_time_conversation_started: new Date().toLocaleString('he-IL'),
                    blocked: false,
                    blocked_reason: null
                });
                
                // Update session data with merged data
                session.data = mergedData;
            }
        } else {
            // Update last interaction time
            session.lastInteraction = new Date();
        }

        return session;
    }

    async handleResetKeyword(userId) {
        const session = await this.getSession(userId);
        const currentLead = await this.leadsManager.getLead(userId);
        const resetConfig = this.flow.configuration.client_management.reset;

        if (!resetConfig.enabled) {
            console.log(`[FlowEngine] ⚠️ Reset functionality is disabled`);
            return false;
        }

        // Check if we need to delete appointment data
        if (resetConfig.options.delete_appointment) {
            console.log(`[FlowEngine] 🗑️ Deleting appointment data for user ${userId}`);
            
            try {
                let deletionSuccess = true;

                // Delete from Google Calendar if integration is available
                if (this.integrationManager && currentLead?.meeting?.calendar_event_id) {
                    console.log(`[FlowEngine] 📅 Deleting calendar event: ${currentLead.meeting.calendar_event_id}`);
                    const calendarResult = await this.integrationManager.deleteCalendarEvent(currentLead.meeting.calendar_event_id);
                    if (!calendarResult) {
                        console.error(`[FlowEngine] ❌ Failed to delete calendar event: ${currentLead.meeting.calendar_event_id}`);
                        deletionSuccess = false;
                    }
                }
                
                // Delete from Google Sheets - create temporary service for deletion
                try {
                    // Try multiple identifiers to find and delete the sheet row
                    const possiblePhones = [
                        currentLead?.meeting?.sheet_row_phone,
                        currentLead?.meeting?.phone,
                        currentLead?.phone,
                        userId
                    ].filter(Boolean); // Remove undefined/null values

                    if (possiblePhones.length > 0) {
                        let sheetsDeleted = false;
                        
                        // Create a temporary Google Sheets service for deletion
                        const GoogleSheetsService = require('../services/google/sheets');
                        
                        // Get the sheets configuration from the final_confirmation step
                        let sheetsConfig = null;
                        const finalConfirmationStep = this.flow.steps['final_confirmation'];
                        if (finalConfirmationStep?.integration?.sheets) {
                            sheetsConfig = finalConfirmationStep.integration.sheets;
                        }
                        
                        if (!sheetsConfig) {
                            console.log(`[FlowEngine] ❌ No sheets configuration found in final_confirmation step`);
                        } else {
                            // Convert the columns array to the format expected by GoogleSheetsService
                            const convertedConfig = {
                                ...sheetsConfig,
                                enabled: true // Ensure service is enabled
                            };
                            
                            // Convert columns array to object mapping if it's an array
                            if (Array.isArray(sheetsConfig.columns)) {
                                convertedConfig.columns = {};
                                sheetsConfig.columns.forEach((column, index) => {
                                    if (typeof column === 'string') {
                                        // Extract field name from placeholder like "{meeting_date}" -> "meeting_date"
                                        const fieldMatch = column.match(/\{([^}]+)\}/);
                                        if (fieldMatch) {
                                            convertedConfig.columns[fieldMatch[1]] = index + 1;
                                        }
                                    } else if (typeof column === 'object' && column.value) {
                                        // Handle objects with value property like {value: "{meeting_date}", backgroundColor: "#36b044"}
                                        const fieldMatch = column.value.match(/\{([^}]+)\}/);
                                        if (fieldMatch) {
                                            convertedConfig.columns[fieldMatch[1]] = index + 1;
                                        }
                                    }
                                });
                            }
                            
                            console.log(`[FlowEngine] 📊 Creating temporary sheets service with config:`, convertedConfig);
                            const tempSheetsService = new GoogleSheetsService(convertedConfig);
                            await tempSheetsService.initialize();
                            
                            for (const phoneToDelete of possiblePhones) {
                                console.log(`[FlowEngine] 📊 Attempting to delete sheet appointment for phone: ${phoneToDelete}`);
                                const sheetResult = await tempSheetsService.deleteAppointment(phoneToDelete);
                                console.log(`[FlowEngine] 📊 Delete result for ${phoneToDelete}: ${sheetResult}`);
                                if (sheetResult) {
                                    sheetsDeleted = true;
                                    console.log(`[FlowEngine] ✅ Successfully deleted sheet appointment for phone: ${phoneToDelete}`);
                                    break; // Successfully deleted, no need to try other phone numbers
                                }
                            }
                        }
                        
                        if (!sheetsDeleted) {
                            console.error(`[FlowEngine] ❌ Failed to delete sheet appointment for any phone numbers: ${possiblePhones.join(', ')}`);
                            deletionSuccess = false;
                        }
                    } else {
                        console.log(`[FlowEngine] ℹ️ No phone numbers found to delete from sheets`);
                    }
                } catch (sheetsError) {
                    console.error(`[FlowEngine] ❌ Error creating temporary sheets service for deletion:`, sheetsError);
                    deletionSuccess = false;
                }
                
                if (deletionSuccess) {
                    console.log(`[FlowEngine] ✅ Successfully deleted all appointment data for user ${userId}`);
                } else {
                    console.warn(`[FlowEngine] ⚠️ Some appointment deletions failed for user ${userId}`);
                }
                
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

        // Clear date selection data from session
        delete session.selectedDate;
        delete session.selectedTime;
        delete session.selectedWeek;
        delete session.selectedMonth;
        
        // Save the updated session
        await this.saveSession(userId, session);

        // Process the target step and return the response
        console.log(`[FlowEngine] 🔄 Reset complete, processing target step: ${session.currentStep}`);
        return await this.processStepInternal(userId, null);
    }

    async processStep(userId, userInput = null, isFirstMessage = false) {
        console.log(`\n🔵 עיבוד שלב עבור ${userId} - הודעה: "${userInput}" ${isFirstMessage ? '(הודעה ראשונה)' : ''}`);

        if (!this.initialized) {
            throw new Error('FlowEngine not initialized');
        }

        // Check if user is blocked before processing
        const lead = await this.leadsManager.getLead(userId);
        if (lead && lead.blocked) {
            console.log(`🚫 משתמש חסום: ${userId}`);
            
            // Check if user sent unblock keyword
            if (lead.allow_unblock && lead.unblock_keyword && userInput && 
                userInput.trim().toLowerCase() === lead.unblock_keyword.toLowerCase()) {
                console.log(`🔓 ביטול חסימה עם מילת מפתח: ${userInput}`);
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
        console.log(`📂 סשן: שלב=${session.currentStep}, נתונים=${JSON.stringify(session.data)}`);
        
        try {
            // Handle first message from user
            if (isFirstMessage || session.isFirstMessage) {
                console.log(`🌟 מטפל בהודעה ראשונה - מתעלם מתוכן: ${userInput}`);
                session.isFirstMessage = false;
                session.isNewConversation = true;
                session.currentStep = this.flow.start;
                
                // Don't reset session.data - preserve existing data like display_name
                // session.data = {}; // ⬅️ Removed this line to preserve display_name
                
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
                console.log(`📝 מעבד שלב הקדמה`);
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

            // Check for admin action keywords first (higher priority)
            if (userInput && !session.isFirstMessage) {
                const adminActions = await this.checkAdminActionKeywords(userId, userInput);
                if (adminActions.handled) {
                    return adminActions.response;
                }
            }

            // Check for reset keyword
            const resetConfig = this.flow.configuration?.client_management?.reset;
            if (resetConfig?.enabled && 
                resetConfig.keyword && 
                userInput && 
                userInput.trim().toLowerCase() === resetConfig.keyword.toLowerCase() && 
                !session.isFirstMessage) {
                console.log(`🔄 מעבד מילת מפתח איפוס`);
                const resetResponse = await this.handleResetKeyword(userId);
                console.log(`[FlowEngine] ✅ Reset completed, returning response with ${resetResponse.messages?.length || 0} messages`);
                return resetResponse;
            }

            // Normal message processing
            console.log(`📝 עיבוד הודעה רגילה עבור שלב: ${session.currentStep}`);
            const response = await this.processStepInternal(userId, userInput);
            
            // Update last client message after processing
            if (userInput) {
                await this.leadsManager.updateLastMessage(userId, 'client', userInput);
            }
            
            console.log(`📬 תשובה סופית: ${response.messages?.length || 0} הודעות, המתנה=${response.waitForUser}`);
            
            return response;
            
        } catch (error) {
            console.error('❌ שגיאה בעיבוד שלב:', error.message);
            return {
                messages: ['מצטערים, אירעה שגיאה. אנא נסה שוב או כתוב "תפריט" להתחלה מחדש.'],
                waitForUser: true
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

            // Check if step is disabled
            if (step.enabled === false) {
                console.log(`[FlowEngine] 🚫 Step ${step.id} is disabled, skipping to next step`);
                
                // If skipIfDisabled is specified, go to that step
                if (step.skipIfDisabled) {
                    console.log(`[FlowEngine] 🔄 Skipping to step ${step.skipIfDisabled}`);
                    session.currentStep = step.skipIfDisabled;
                    return await this.processStepInternal(userId, userInput);
                } else {
                    // If no skip target specified, return error
                    return {
                        messages: ['השלב הזה אינו זמין כרגע. אנא כתוב "תפריט" להתחלה מחדש.'],
                        waitForUser: true
                    };
                }
            }

            // Check for freeze property on any step type BEFORE processing
            // Only freeze if user has sent input (not on first visit to step)
            if (step.freeze && userInput !== null) {
                console.log(`[FlowEngine] Step ${step.id} has freeze property and user sent input, freezing client ${userId}`);
                
                // Check if client is already frozen to avoid sending duplicate messages
                const currentLead = await this.leadsManager.getLead(userId);
                const now = new Date();
                const isAlreadyFrozen = currentLead?.frozenUntil && new Date(currentLead.frozenUntil) > now;
                
                if (isAlreadyFrozen) {
                    console.log(`[FlowEngine] Client ${userId} is already frozen, checking if should send freeze message`);
                    // Client is already frozen, check if we should send the freeze explanation message
                    const freezeConfig = this.getFreezConfig(step);
                    if (freezeConfig?.messaging?.send_explanation && freezeConfig.messaging.message) {
                        // Check if show_once is enabled and we already sent the message for this step
                        const currentLead = await this.leadsManager.getLead(userId);
                        const shouldSendMessage = !freezeConfig.messaging.show_once || 
                                                !currentLead?.lastFreezeMessageSent ||
                                                currentLead.lastFreezeReason !== step.id;
                        
                        if (shouldSendMessage) {
                            const explanationText = freezeConfig.messaging.message.replace('{duration}', freezeConfig.duration || 60);
                            return {
                                messages: [explanationText],
                                waitForUser: true
                            };
                        } else {
                            console.log(`[FlowEngine] Freeze explanation message skipped for already frozen client ${userId} (show_once enabled)`);
                            return {
                                messages: [],
                                waitForUser: true
                            };
                        }
                    } else {
                        // No freeze message configured, return empty
                        return {
                            messages: [],
                            waitForUser: true
                        };
                    }
                } else {
                    // Client is not yet frozen, freeze them
                    await this.freezeClient(session.userId, step.id);
                    
                    // After freezing, only return freeze message, not step messages
                    const freezeConfig = this.getFreezConfig(step);
                    if (freezeConfig?.messaging?.send_explanation && freezeConfig.messaging.message) {
                        // The freeze message was already sent by freezeClient, so don't return it again
                        // Just return empty messages to avoid duplicate step messages
                return {
                            messages: [],
                            waitForUser: true
                        };
                    } else {
                        // No freeze message configured, return empty
                        return {
                            messages: [],
                    waitForUser: true
                };
                    }
                }
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

            // Handle nextStep from result (for condition steps and dynamic routing)
            if (result.nextStep && this.flow.steps[result.nextStep]) {
                console.log(`[FlowEngine] 🔀 Step ${step.id} specified nextStep: ${result.nextStep}`);
                session.currentStep = result.nextStep;
                const nextResult = await this.processStepInternal(userId, null);
                
                if (nextResult && nextResult.messages) {
                    result = {
                        messages: [...result.messages, ...nextResult.messages],
                        waitForUser: nextResult.waitForUser
                    };
                }
            }
            // Handle auto-continuation for steps that don't wait for user (but not if we're about to block)
            else if (result.waitForUser === false && !session.ignoreNextInput && !step.block) {
                console.log(`[FlowEngine] ⏭️ Auto-continuing from step ${step.id} (waitForUser=false)`);
                
                // Check if the step has a next step defined
                if (step.next && this.flow.steps[step.next]) {
                    console.log(`[FlowEngine] 🔄 Moving to next step: ${step.next}`);
                    session.currentStep = step.next;
                    const nextResult = await this.processStepInternal(userId, null);
                    
                    if (nextResult && nextResult.messages) {
                        result = {
                            messages: [...result.messages, ...nextResult.messages],
                            waitForUser: nextResult.waitForUser
                        };
                    }
                } else {
                    // No next step defined - this is a final step
                    console.log(`[FlowEngine] ⏹️ Step ${step.id} is a final step (no next step defined)`);
                    result.waitForUser = true; // Force wait to end the flow properly
                }
            }

            // Handle integrations if present - both old system and new system
            if (step.integrations?.enabled && (session.pendingIntegrations || !step.userResponseWaiting || userInput === null)) {
                console.log(`[FlowEngine] 🔗 Processing integrations for step ${step.id}`);
                
                // Clear the pending integrations flag after processing
                if (session.pendingIntegrations) {
                    delete session.pendingIntegrations;
                }
                
                // New system: step-level integrations via ReminderService
                if (step.type === 'message' && this.integrationManager?.reminderService) {
                    await this.integrationManager.reminderService.processStepReminders(userId, step);
                }
                
                // Old system: meeting-based integrations
                await this.handleStepIntegrations(userId, step, session);
            }

            // If this step has blocking but no user input yet, just wait for input
            if (step.block && userInput === null) {
                console.log(`[FlowEngine] 📝 Step ${step.id} has blocking - waiting for user input`);
                result.waitForUser = true;
            }

            // Handle retry configuration if validation failed or user didn't respond appropriately
            if (result.retry) {
                await this.handleRetryLogic(userId, step, session, result);
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
            // Check if show_once is enabled and we already sent the message
            const shouldSendMessage = !blockConfig.messaging.show_once || 
                                    !currentLead?.last_block_message_sent ||
                                    currentLead.blocked_reason !== stepId;
            
            if (shouldSendMessage) {
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
            } else {
                console.log(`[FlowEngine] Block explanation message skipped for ${userId} (show_once enabled and already sent for this step)`);
            }
        }

        console.log(`[FlowEngine] Client ${userId} blocked (reason: ${stepId || 'unknown'}, allow_unblock: ${blockConfig.allow_unblock})`);
    }

    getFreezConfig(step) {
        let freezeConfig;
        
        // First check if there's a step-specific freeze configuration
        if (step && step.freeze && typeof step.freeze === 'object') {
            freezeConfig = step.freeze;
        } else if (step && step.freeze === true) {
            // When freeze is just true without configuration, use default values
            freezeConfig = {
                enabled: true,
                duration: 60,
                messaging: {
                    send_explanation: true,
                    message: "תחזור אלינו בעוד {duration} דקות. תודה על הסבלנות! 🙏"
                }
            };
        } else {
            return null;
        }
        
        return freezeConfig;
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
            // Check if show_once is enabled and we already sent the message
            const shouldSendMessage = !freezeConfig.messaging.show_once || 
                                    !currentLead?.lastFreezeMessageSent ||
                                    currentLead.lastFreezeReason !== stepId;
            
            if (shouldSendMessage) {
            const explanationText = freezeConfig.messaging.message.replace('{duration}', freezeDurationMinutes);
            
            try {
                await this.whatsappClient.sendMessage(`${userId.split('@')[0]}@c.us`, explanationText);
                
                // Track that we sent the message
                await this.leadsManager.createOrUpdateLead(userId, {
                    lastFreezeMessageSent: new Date().toISOString(),
                    last_sent_message: 'bot'
                });
                    
                    console.log(`[FlowEngine] Freeze explanation message sent to ${userId}`);
            } catch (error) {
                console.error(`[FlowEngine] Error sending freeze explanation to ${userId}:`, error);
                }
            } else {
                console.log(`[FlowEngine] Freeze explanation message skipped for ${userId} (show_once enabled and already sent for this step)`);
            }
        }

        console.log(`[FlowEngine] Client ${userId} frozen until ${frozenUntil.toLocaleString('he-IL')} (reason: ${stepId || 'unknown'})`);
    }

    async handleStepIntegrations(userId, step, session) {
        if (!step.integration && !step.integrations?.enabled) {
            console.log(`[FlowEngine] No integrations configured for step ${step.id}`);
            return;
        }

        const meetingData = {
            full_name: session.data.full_name || session.data.name || '',
            city_name: session.data.city_name || session.data.city || '',
            phone: userId,
            mobility: session.data.mobility || '',
            meeting_date: session.data.meeting_date || session.selectedDate || '',
            meeting_time: session.data.meeting_time || session.selectedTime || '',
            display_name: session.data.display_name || session.data.full_name || session.data.name || ''
        };

        console.log(`[FlowEngine] 🔗 Processing step-level integrations for ${userId} with data:`, meetingData);

        try {
            // Update the current lead with meeting information for future reference
            const currentLead = await this.leadsManager.getLead(userId);
            if (currentLead) {
                const meetingInfo = {
                    phone: userId,
                    sheet_row_phone: userId, // Store phone for sheet deletion
                    meeting_date: meetingData.meeting_date,
                    meeting_time: meetingData.meeting_time,
                    full_name: meetingData.full_name,
                    city_name: meetingData.city_name,
                    mobility: meetingData.mobility
                };
                
                await this.leadsManager.createOrUpdateLead(userId, {
                    meeting: meetingInfo,
                    is_schedule: true
                });
                
                console.log(`[FlowEngine] 📝 Updated lead with meeting info for ${userId}`);
            }

            const results = {
                calendar: false,
                sheets: false,
                notifications: false,
                reminders: false
            };

            // Process Google Sheets integration
            if (step.integrations?.googleSheets && step.integration?.sheets?.enabled) {
                console.log(`[FlowEngine] 📊 Processing Google Sheets integration...`);
                try {
                    const sheetsConfig = step.integration.sheets;
                    
                    // Initialize Google Sheets service for this step
                    const GoogleSheetsService = require('../services/google/sheets');
                    const stepSheetsService = new GoogleSheetsService({
                        enabled: true,
                        sheetId: sheetsConfig.sheetId,
                        columns: {
                            'meeting_date': 1,
                            'meeting_time': 2,
                            'full_name': 3,
                            'city_name': 4,
                            'phone': 5,
                            'mobility': 6
                        },
                        worksheetName: sheetsConfig.worksheetName || 'Sheet1',
                        credentialsPath: sheetsConfig.credentialsPath,
                        preventDuplicates: sheetsConfig.preventDuplicates || false,
                        updateExistingRows: sheetsConfig.updateExistingRows || false,
                        insertToNextRow: sheetsConfig.insertToNextRow !== false,
                        enableSorting: sheetsConfig.enableSorting || false,
                        sortColumn: sheetsConfig.sortColumn || 1,
                        sortType: sheetsConfig.sortType || 'date',
                        sortDirection: sheetsConfig.sortDirection || 'asc'
                    });

                    const initialized = await stepSheetsService.initialize();
                    if (initialized) {
                        // Prepare column colors if configured
                        const columnColors = [];
                        if (sheetsConfig.columns && Array.isArray(sheetsConfig.columns)) {
                            sheetsConfig.columns.forEach((col, index) => {
                                if (typeof col === 'object' && col.backgroundColor) {
                                    columnColors[index] = col.backgroundColor;
                                }
                            });
                        }

                        const sheetsResult = await stepSheetsService.addRow(meetingData, columnColors);
                        results.sheets = sheetsResult;
                        
                        if (sheetsResult) {
                            console.log(`[FlowEngine] ✅ Google Sheets integration successful`);
                        } else {
                            console.log(`[FlowEngine] ❌ Google Sheets integration failed`);
                        }
                    } else {
                        console.log(`[FlowEngine] ❌ Failed to initialize Google Sheets service`);
                    }
                } catch (error) {
                    console.error(`[FlowEngine] ❌ Google Sheets integration error:`, error);
                }
            }

            // Process Google Calendar integration
            if (step.integrations?.googleCalendar && step.integration?.calendar?.enabled) {
                console.log(`[FlowEngine] 📅 Processing Google Calendar integration...`);
                try {
                    if (this.integrationManager) {
                        const calendarResult = await this.integrationManager.handleStepSpecificCalendarIntegration(
                            meetingData, 
                            currentLead, 
                            step.integration.calendar
                        );
                        results.calendar = calendarResult?.success || false;
                        
                        if (results.calendar) {
                            console.log(`[FlowEngine] ✅ Google Calendar integration successful`);
                        } else {
                            console.log(`[FlowEngine] ❌ Google Calendar integration failed`);
                        }
                    }
                } catch (error) {
                    console.error(`[FlowEngine] ❌ Google Calendar integration error:`, error);
                }
            }

            // Process Notifications
            if (step.integrations?.notifications && step.integration?.notifications?.enabled) {
                console.log(`[FlowEngine] 📢 Processing notifications integration...`);
                try {
                    if (this.integrationManager) {
                        const notificationResult = await this.integrationManager.sendStepNotification(
                            meetingData,
                            step.integration.notifications
                        );
                        results.notifications = notificationResult || false;
                        
                        if (results.notifications) {
                            console.log(`[FlowEngine] ✅ Notifications integration successful`);
                        } else {
                            console.log(`[FlowEngine] ❌ Notifications integration failed`);
                        }
                    }
                } catch (error) {
                    console.error(`[FlowEngine] ❌ Notifications integration error:`, error);
                }
            }

            // Process Reminders
            if (step.integrations?.reminders && step.integration?.reminders?.enabled) {
                console.log(`[FlowEngine] ⏰ Processing reminders integration...`);
                try {
                    if (this.integrationManager && this.integrationManager.reminderService) {
                        const reminderResult = await this.integrationManager.reminderService.scheduleStepReminders(
                            userId,
                            meetingData,
                            step.integration.reminders
                        );
                        results.reminders = reminderResult || false;
                        
                        if (results.reminders) {
                            console.log(`[FlowEngine] ✅ Reminders integration successful`);
                        } else {
                            console.log(`[FlowEngine] ❌ Reminders integration failed`);
                        }
                    }
                } catch (error) {
                    console.error(`[FlowEngine] ❌ Reminders integration error:`, error);
                }
            }

            console.log(`[FlowEngine] 📊 Step integrations results:`, {
                calendar: results.calendar ? '✅' : '❌',
                sheets: results.sheets ? '✅' : '❌',
                notifications: results.notifications ? '✅' : '❌',
                reminders: results.reminders ? '✅' : '❌'
            });
            
        } catch (error) {
            console.error(`[FlowEngine] ❌ Error in step integrations for ${userId}:`, error);
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

    // Add missing saveSession method
    async saveSession(userId, session) {
        // Update the in-memory session
        this.sessions.set(userId, session);
        
        // Update the lead with the session data
        await this.leadsManager.createOrUpdateLead(userId, {
            current_step: session.currentStep,
            data: session.data,
            last_interaction: new Date().toLocaleString('he-IL')
        });
        
        console.log(`[FlowEngine] 💾 Session saved for user ${userId}, step: ${session.currentStep}`);
    }
    
    // Helper method to replace placeholders in text with values from data - שיפור יסודי
    replacePlaceholders(text, data = {}, userId = null, leadData = null) {
        if (!text || typeof text !== 'string') return text || '';
        
        let processedText = text;
        
        // הכנת נתונים מורחבים
        const allData = {
            ...data,
            ...(leadData?.data || {}),
            // משתנים בסיסיים תמיד זמינים
            phone: userId ? userId.split('@')[0] : '',
            display_name: leadData?.data?.display_name || data.display_name || data.full_name || 'אורח',
        };
        
        // החלפת כל המשתנים מהדטה
        for (const key in allData) {
            if (allData.hasOwnProperty(key) && allData[key] !== undefined && allData[key] !== null) {
                const placeholder = `{${key}}`;
                const value = String(allData[key]);
                processedText = processedText.replace(
                    new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), 
                    value
                );
            }
        }
        
        // משתנים מיוחדים מחושבים
        
        // תאריך ושעה מפורמטים
        if (processedText.includes('{date_formatted}') && data.selected_date) {
            const formattedDate = this.formatDate(data.selected_date);
            processedText = processedText.replace(/{date_formatted}/g, formattedDate);
        }
        
        if (processedText.includes('{time_formatted}') && data.selected_time) {
            const formattedTime = this.formatTime(data.selected_time);
            processedText = processedText.replace(/{time_formatted}/g, formattedTime);
        }
        
        if (processedText.includes('{day_name}') && data.selected_date) {
            const dayName = this.getDayName(data.selected_date);
            processedText = processedText.replace(/{day_name}/g, dayName);
        }
        
        // תאריך ושעה ביחד
        if (processedText.includes('{meeting_datetime}') && data.selected_date && data.selected_time) {
            const datetime = `${this.formatDate(data.selected_date)} בשעה ${this.formatTime(data.selected_time)}`;
            processedText = processedText.replace(/{meeting_datetime}/g, datetime);
        }
        
        // סיכום פגישה
        if (processedText.includes('{appointment_summary}') && allData.display_name && data.selected_date && data.selected_time) {
            const summary = `${allData.display_name} - ${this.formatDate(data.selected_date)} בשעה ${this.formatTime(data.selected_time)}`;
            processedText = processedText.replace(/{appointment_summary}/g, summary);
        }
        
        return processedText;
    }
    
    // פונקציות עזר לפורמט תאריכים ושעות
    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('he-IL');
        } catch {
            return dateStr; // Return original if can't format
        }
    }
    
    formatTime(timeStr) {
        if (!timeStr) return '';
        return timeStr; // Simple time format for now
    }
    
    getDayName(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
            return dayNames[date.getDay()];
        } catch {
            return '';
        }
    }

    async handleRetryLogic(userId, step, session, result) {
        try {
            const retryConfig = step.retryConfig;
            
            if (!retryConfig || !retryConfig.enabled) {
                return;
            }

            // Increment retry count
            session.retryCount = (session.retryCount || 0) + 1;
            console.log(`[FlowEngine] 🔄 Retry attempt ${session.retryCount}/${retryConfig.maxAttempts} for step ${step.id}`);

            // Check if max attempts reached
            if (session.retryCount >= retryConfig.maxAttempts) {
                console.log(`[FlowEngine] ⚠️ Max retry attempts reached for step ${step.id}, executing retry actions`);
                
                // Execute all enabled actions
                if (retryConfig.actions.deleteLead) {
                    console.log(`[FlowEngine] 🗑️ Deleting client ${userId} due to max retries`);
                    await this.leadsManager.deleteLead(userId);
                    this.clearSession(userId);
                }
                
                if (retryConfig.actions.stopSession) {
                    console.log(`[FlowEngine] ⏹️ Stopping conversation for ${userId} due to max retries`);
                    session.currentStep = null;
                    await this.leadsManager.createOrUpdateLead(userId, {
                        current_step: null,
                        stopped_due_to_retries: true,
                        stopped_at: new Date().toISOString()
                    });
                }
                
                if (retryConfig.actions.resetBot) {
                    console.log(`[FlowEngine] 🔄 Resetting bot for ${userId} due to max retries`);
                    const session = await this.getSession(userId);
                    session.currentStep = this.flow.start || 'main_menu';
                    session.isNewConversation = true;
                    session.data = {}; // Complete reset of data
                    session.retryCount = 0;
                    
                    await this.leadsManager.createOrUpdateLead(userId, {
                        current_step: session.currentStep,
                        data: {},
                        reset_due_to_retries: true,
                        reset_at: new Date().toISOString()
                    });
                }
                
                if (retryConfig.actions.showMessage?.enabled && retryConfig.actions.showMessage?.message) {
                    console.log(`[FlowEngine] 📨 Sending retry message to ${userId}`);
                    const message = this.replacePlaceholders(
                        retryConfig.actions.showMessage.message, 
                        session.data, 
                        userId, 
                        await this.leadsManager.getLead(userId)
                    );
                    
                    try {
                        await this.whatsappClient.sendMessage(`${userId.split('@')[0]}@c.us`, message);
                        await this.leadsManager.updateLastMessage(userId, 'bot');
                    } catch (error) {
                        console.error(`[FlowEngine] Error sending retry message:`, error);
                    }
                }
                
                // Reset retry count after handling
                session.retryCount = 0;
            } else {
                // Still within retry limit, send retry message if configured
                if (retryConfig.retryMessage) {
                    const message = this.replacePlaceholders(
                        retryConfig.retryMessage, 
                        session.data, 
                        userId, 
                        await this.leadsManager.getLead(userId)
                    );
                    
                    try {
                        await this.whatsappClient.sendMessage(`${userId.split('@')[0]}@c.us`, message);
                        await this.leadsManager.updateLastMessage(userId, 'bot');
                    } catch (error) {
                        console.error(`[FlowEngine] Error sending retry message:`, error);
                    }
                }
            }

        } catch (error) {
            console.error(`[FlowEngine] Error in handleRetryLogic:`, error);
        }
    }

    async checkAdminActionKeywords(userId, userInput) {
        try {
            const inputLower = userInput.trim().toLowerCase();
            const allSteps = Object.values(this.flow.steps);
            
            // Check all retry configurations for admin keywords
            for (const step of allSteps) {
                const retryConfig = step.retryConfig;
                if (!retryConfig?.enabled || !retryConfig.actions) continue;

                // Check delete keyword
                if (retryConfig.actions.deleteLead && retryConfig.actions.deleteKeyword) {
                    const keywords = retryConfig.actions.deleteKeyword.split(',').map(k => k.trim().toLowerCase());
                    if (keywords.includes(inputLower)) {
                        console.log(`[FlowEngine] 🗑️ Admin delete keyword detected: ${userInput}`);
                        await this.leadsManager.deleteLead(userId);
                        this.clearSession(userId);
                        return {
                            handled: true,
                            response: {
                                messages: ['לקוח נמחק מהמערכת.'],
                                waitForUser: false
                            }
                        };
                    }
                }

                // Check stop keyword
                if (retryConfig.actions.stopSession && retryConfig.actions.stopKeyword) {
                    const keywords = retryConfig.actions.stopKeyword.split(',').map(k => k.trim().toLowerCase());
                    if (keywords.includes(inputLower)) {
                        console.log(`[FlowEngine] ⏹️ Admin stop keyword detected: ${userInput}`);
                        const session = await this.getSession(userId);
                        session.currentStep = null;
                        await this.leadsManager.createOrUpdateLead(userId, {
                            current_step: null,
                            stopped_by_admin: true,
                            stopped_at: new Date().toISOString()
                        });
                        return {
                            handled: true,
                            response: {
                                messages: ['השיחה הופסקה על ידי מנהל.'],
                                waitForUser: false
                            }
                        };
                    }
                }

                // Check reset keyword
                if (retryConfig.actions.resetBot && retryConfig.actions.resetKeyword) {
                    const keywords = retryConfig.actions.resetKeyword.split(',').map(k => k.trim().toLowerCase());
                    if (keywords.includes(inputLower)) {
                        console.log(`[FlowEngine] 🔄 Admin reset keyword detected: ${userInput}`);
                        return {
                            handled: true,
                            response: await this.handleResetKeyword(userId)
                        };
                    }
                }

                // Check menu keyword (always available)
                if (retryConfig.actions.menuKeyword) {
                    const keywords = retryConfig.actions.menuKeyword.split(',').map(k => k.trim().toLowerCase());
                    if (keywords.includes(inputLower)) {
                        console.log(`[FlowEngine] 📋 Menu keyword detected: ${userInput}`);
                        const session = await this.getSession(userId);
                        session.currentStep = this.flow.start || 'main_menu';
                        session.isNewConversation = true;
                        session.data = { ...session.data }; // Keep existing data but restart flow
                        
                        await this.leadsManager.createOrUpdateLead(userId, {
                            current_step: session.currentStep,
                            returned_to_menu: true,
                            menu_return_time: new Date().toISOString()
                        });

                        return {
                            handled: true,
                            response: await this.processStepInternal(userId, null)
                        };
                    }
                }
            }

            return { handled: false };
        } catch (error) {
            console.error(`[FlowEngine] Error in checkAdminActionKeywords:`, error);
            return { handled: false };
        }
    }
}

module.exports = FlowEngine;
