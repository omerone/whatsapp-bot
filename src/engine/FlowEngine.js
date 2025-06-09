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

        let session = this.sessions.get(userId);

        if (!session || !this.leadsManager.isLeadActive(userId)) {
            const lead = await this.leadsManager.getLead(userId);
            const isNewConversation = !lead || !lead.current_step;
            
            if (!isNewConversation) {
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
            session.lastInteraction = new Date();
        }

        return session;
    }

    async handleResetKeyword(userId) {
        const session = await this.getSession(userId);
        const resetConfig = this.flow.rules?.resetConfig || this.flow.resetConfig;

        if (!resetConfig?.enabled) {
            return null;
        }

        // Reset session data
        session.data = {};
        session.currentStep = resetConfig.targetStep || 'main_menu';
        session.isFirstMessage = false;
        session.isNewConversation = false;
        session.ignoreNextInput = false;

        // Update lead
        await this.leadsManager.createOrUpdateLead(userId, {
            current_step: session.currentStep,
            data: session.data,
            is_schedule: false,
            meeting: null,
            last_sent_message: { sender: 'bot' },
            relevant: true,
            last_interaction: new Date().toLocaleString('he-IL')
        });

        // Load and return the main menu message
        const menuStep = this.flow.steps[session.currentStep];
        const menuMessage = menuStep.messageFile ? 
            await this.loadMessageFile(menuStep.messageFile) : 
            menuStep.message;

        return {
            messages: [menuMessage],
            waitForUser: true
        };
    }

    async processStep(userId, userInput = null, isFirstMessage = false) {
        if (!this.initialized) {
            throw new Error('FlowEngine not initialized');
        }

        const session = await this.getSession(userId);
        
        try {
            if (isFirstMessage || session.isFirstMessage) {
                session.isFirstMessage = false;
                session.isNewConversation = true;
                session.currentStep = this.flow.start;
                session.data = {};
                
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
                
                const response = await this.processStepInternal(userId, null);
                
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

            const resetConfig = this.flow.rules?.resetConfig;
            if (resetConfig?.enabled && userInput === resetConfig.keyword && !session.isFirstMessage) {
                return await this.handleResetKeyword(userId);
            }

            const response = await this.processStepInternal(userId, userInput);
            
            if (userInput) {
                await this.leadsManager.updateLastMessage(userId, 'client', userInput);
            }
            
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

            // Handle block property if present
            if (step.block === true) {
                console.log(`[FlowEngine] 🚫 Blocking client ${userId} at step ${step.id}`);
                await this.leadsManager.blockLead(userId);
                return result;
            }

            // Handle auto-continuation for steps that don't wait for user
            if (result.waitForUser === false && !session.ignoreNextInput) {
                // Continue to next step
                const nextResult = await this.processStepInternal(userId, null);
                if (nextResult && nextResult.messages) {
                    result = {
                        messages: [...result.messages, ...nextResult.messages],
                        waitForUser: nextResult.waitForUser
                    };
                }
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
                    
                    // Track that we sent the message and update last_sent_message
                    await this.leadsManager.createOrUpdateLead(userId, {
                        lastFreezeMessageSent: new Date().toISOString(),
                        last_sent_message: 'bot'
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
