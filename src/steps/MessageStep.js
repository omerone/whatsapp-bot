class MessageStep {
    static async process(step, session, input, flowEngine) {
        try {
            const messages = [];

            // Get lead data for placeholder replacement
            const leadData = await flowEngine.leadsManager.getLead(session.userId);

            // Process message header if exists and not empty
            if (step.messageHeader && step.messageHeader.trim()) {
                const headerMessage = flowEngine.replacePlaceholders(step.messageHeader, session.data, session.userId, leadData);
                messages.push(headerMessage);
            }

            // Load message from file if specified
            if (step.messageFile) {
                const messageContent = await flowEngine.loadMessageFile(step.messageFile);
                if (messageContent) {
                    const processedMessage = flowEngine.replacePlaceholders(messageContent, session.data, session.userId, leadData);
                    messages.push(processedMessage);
                }
            }

            if (step.message && step.message.trim()) {
                const directMessage = flowEngine.replacePlaceholders(step.message, session.data, session.userId, leadData);
                messages.push(directMessage);
            }

            // אם אין שום הודעה כלל, החזר מערך ריק במקום לזרוק שגיאה
            if (messages.length === 0 && !step.messageFile) {
                console.log(`MessageStep: Step "${step.id}" has no content to display`);
                return {
                    messages: [],
                    waitForUser: false
                };
            }

            // Process footer message if exists and not empty
            if (step.footerMessage && step.footerMessage.trim()) {
                const footerMessage = flowEngine.replacePlaceholders(step.footerMessage, session.data, session.userId, leadData);
                messages.push(footerMessage);
            }

            // Special handling for final_confirmation step
            if (step.id === 'final_confirmation') {
                const lead = await flowEngine.leadsManager.getLead(session.userId);
                // Only block duplicate messages if the lead is already blocked
                if (lead?.blocked) {
                    return {
                        messages: [],
                        waitForUser: false
                    };
                }
            }

            // Note: Block handling is done in FlowEngine.processStepInternal, not here
            // This prevents duplicate block messages

            // If this is not a waiting step and has a next step
            if (!step.userResponseWaiting && step.next) {
                session.currentStep = step.next;
                return {
                    messages,
                    waitForUser: false
                };
            }

            // If this is a waiting step and user provided input and there's a next step
            if (step.userResponseWaiting && input && step.next) {
                console.log(`[MessageStep] Step ${step.id} received user input "${input}", moving to next step: ${step.next}`);
                session.currentStep = step.next;
                return {
                    messages,
                    waitForUser: false,
                    nextStep: step.next
                };
            }

            // If this is a waiting step but no input yet (first time showing the message)
            if (step.userResponseWaiting && !input) {
                return {
                    messages,
                    waitForUser: true
                };
            }

            // Default case - return messages and wait for user
            return {
                messages,
                waitForUser: step.userResponseWaiting !== false
            };
        } catch (error) {
            console.error('Error in MessageStep:', error);
            return {
                messages: ['מצטערים, אירעה שגיאה. אנא נסה שוב או כתוב "תפריט" להתחלה מחדש.'],
                waitForUser: true
            };
        }
    }
}

module.exports = MessageStep;
