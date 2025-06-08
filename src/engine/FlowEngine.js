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
        this.dataPath = path.dirname(leadsPath);
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

        if (!this.initialized) {
            throw new Error('FlowEngine not initialized');
        }

        // Try to get existing session
        let session = this.sessions.get(userId);

        // If no session exists or it's expired
        if (!session || !this.leadsManager.isLeadActive(userId)) {
            // Try to restore session from leads.json
            const lead = await this.leadsManager.getLead(userId);
            
            // Check if this is genuinely a continuing conversation
            const isNewConversation = !lead || !lead.current_step || lead.current_step === this.flow.start;
            const botInitiatedConversation = lead && lead.last_sent_message && lead.last_sent_message.sender === 'bot';
            
            if (!isNewConversation || botInitiatedConversation) {
                // This is a continuing conversation or bot-initiated conversation
                session = {
                    userId,
                    currentStep: lead.current_step || this.flow.start,
                    data: lead.data || {},
                    lastInteraction: new Date(),
                    retryCount: 0,
                    isFirstMessage: false,
                    isNewConversation: false
                };
            } else {
                // This is a new conversation initiated by the client
                session = {
                    userId,
                    currentStep: this.flow.start,
                    data: {},
                    lastInteraction: new Date(),
                    retryCount: 0,
                    isFirstMessage: true,
                    isNewConversation: true,
                    ignoreNextInput: false // Flag to ignore next input for new conversations
                };
            }
            
            this.sessions.set(userId, session);
            
            // If this is a new conversation, make sure to update the lead
            if (session.isNewConversation) {
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
            // Update last interaction time
            session.lastInteraction = new Date();
        }

        return session;
    }

    async processStep(userId, userInput = null, isFirstMessage = false) {
        if (!this.initialized) {
            throw new Error('FlowEngine not initialized');
        }

        const session = await this.getSession(userId);
        
        try {
            // Handle first message from user - process intro sequence first
            if (session.isFirstMessage || isFirstMessage) {
                session.isFirstMessage = false;
                
                // Always start from intro for new conversations
                if (session.isNewConversation) {
                    session.currentStep = this.flow.start;
                    session.data = {}; // Clear any potentially stale session data
                    
                    // Process the intro step without the user's input
                    const introResponse = await this.processStepInternal(userId, '');
                    
                    // After intro, automatically move to main_menu
                    session.currentStep = 'main_menu';
                    const menuResponse = await this.processStepInternal(userId, '');
                    
                    // Update the session and lead after processing
                    await this.leadsManager.createOrUpdateLead(userId, {
                        current_step: session.currentStep,
                        data: session.data,
                        is_schedule: false,
                        meeting: null,
                        last_sent_message: { sender: 'bot' },
                        relevant: true,
                        last_interaction: new Date().toLocaleString('he-IL')
                    });
                    
                    // Return combined responses
                    return {
                        messages: [...(introResponse.messages || []), ...(menuResponse.messages || [])],
                        waitForUser: true // Now we wait for real user input
                    };
                }
                
                // If this is the first message but not a new conversation,
                // just ignore the input and continue with normal flow
                return {
                    messages: [],
                    waitForUser: true
                };
            }
            
            // Normal message processing
            return await this.processStepInternal(userId, userInput);
            
        } catch (error) {
            console.error('Error processing step:', error);
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

            // Handle auto-continuation for steps that don't wait for user
            if (result.waitForUser === false) {
                // Continue to next step
                const nextResult = await this.processStepInternal(userId, null);
                if (nextResult && nextResult.messages) {
                    result = {
                        messages: [...result.messages, ...nextResult.messages],
                        waitForUser: nextResult.waitForUser
                    };
                }
            }

            // Update lead with current step
            await this.leadsManager.updateLeadStep(userId, session.currentStep);
            
            // Update last sent message type if we have messages to send
            if (result && result.messages && result.messages.length > 0) {
                await this.leadsManager.updateLastMessage(userId, 'bot', session.currentStep);
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

    async freezeClient(userId, stepId = null) {
        // Check both old and new freeze config for backwards compatibility
        const oldConfig = this.flow.freezeConfig;
        const newConfig = this.flow.rules?.freezeClients;
        
        if (!oldConfig?.enabled && !newConfig?.enabled) {
            return;
        }

        // Get current lead for freeze count tracking
        const currentLead = await this.leadsManager.getLead(userId);
        const currentFreezeCount = (currentLead?.freezeCount || 0) + 1;
        
        // Check max freeze count limit
        if (newConfig?.maxFreezeCount && currentFreezeCount > newConfig.maxFreezeCount) {
            console.log(`[FlowEngine] Client ${userId} exceeded max freeze count (${newConfig.maxFreezeCount}), not freezing`);
            return;
        }

        // Determine freeze duration
        let freezeDurationMinutes;
        if (newConfig?.stepSpecificDurations && stepId && newConfig.stepSpecificDurations[stepId]) {
            freezeDurationMinutes = newConfig.stepSpecificDurations[stepId];
        } else if (newConfig?.defaultDurationMinutes) {
            freezeDurationMinutes = newConfig.defaultDurationMinutes;
        } else {
            freezeDurationMinutes = oldConfig?.freezeDurationMinutes || 60; // Fallback
        }

        const frozenUntil = new Date();
        frozenUntil.setMinutes(frozenUntil.getMinutes() + freezeDurationMinutes);

        // Update lead with freeze info
        const updateData = {
            frozenUntil: frozenUntil.toISOString(),
            freezeCount: currentFreezeCount,
            lastFreezeReason: stepId || 'unknown',
            lastFrozenAt: new Date().toISOString()
        };

        await this.leadsManager.createOrUpdateLead(userId, updateData);

        // Send explanation message if enabled
        if (newConfig?.sendExplanationMessage && newConfig?.explanationMessageText) {
            const explanationText = newConfig.explanationMessageText.replace('{duration}', freezeDurationMinutes);
            
            // Only send if not already sent recently (prevent duplicate messages)
            if (!newConfig.preventDuplicateMessages || !currentLead?.lastFreezeMessageSent ||
                (Date.now() - new Date(currentLead.lastFreezeMessageSent).getTime()) > 60000) { // 1 minute cooldown
                
                try {
                    await this.whatsappClient.sendMessage(`${userId.split('@')[0]}@c.us`, explanationText);
                    
                    // Track that we sent the message
                    await this.leadsManager.createOrUpdateLead(userId, {
                        lastFreezeMessageSent: new Date().toISOString()
                    });
                } catch (error) {
                    console.error(`[FlowEngine] Error sending freeze explanation to ${userId}:`, error);
                }
            }
        }

        if (newConfig?.logFreezeActions) {
            console.log(`[FlowEngine] Client ${userId} frozen until ${frozenUntil.toLocaleString('he-IL')} (reason: ${stepId || 'unknown'}, count: ${currentFreezeCount})`);
        } else {
            console.log(`[FlowEngine] Client ${userId} frozen until ${frozenUntil.toLocaleString('he-IL')}`);
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
}

module.exports = FlowEngine;
