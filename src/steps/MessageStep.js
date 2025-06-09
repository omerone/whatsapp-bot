class MessageStep {
    static async process(step, session, input, flowEngine) {
        try {
            const messages = [];

            // Load message from file if specified
            if (step.messageFile) {
                const messageContent = await flowEngine.loadMessageFile(step.messageFile);
                if (messageContent) {
                    // Replace placeholders in message content
                    let processedMessage = messageContent;
                    if (session.data) {
                        for (const keyInSession in session.data) {
                            if (session.data.hasOwnProperty(keyInSession)) {
                                const placeholder = `{${keyInSession}}`;
                                processedMessage = processedMessage.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), session.data[keyInSession]);
                            }
                        }
                    }

                    // Replace date/time placeholders
                    if (session.meeting) {
                        const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
                        const [day, month, year] = session.meeting.date.split('/');
                        const date = new Date(year, month - 1, day);
                        const dayName = dayNames[date.getDay()];
                        
                        processedMessage = processedMessage
                            .replace(/{dayName}/g, dayName)
                            .replace(/{selectedDate}/g, session.meeting.date)
                            .replace(/{selectedTime}/g, session.meeting.time);
                    }

                    messages.push(processedMessage);
                }
            }

            if (step.message) {
                let directMessage = step.message;
                // Replace placeholders in direct message
                if (directMessage && session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            directMessage = directMessage.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), session.data[keyInSession]);
                        }
                    }
                }
                messages.push(directMessage);
            } else if (!step.messageFile) {
                throw new Error('Step has neither messageFile nor message');
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

            // Handle freeze flag
            if (step.freeze) {
                // Freeze the client
                await flowEngine.freezeClient(session.userId, step.id);
                // Return messages but don't move to next step
                return {
                    messages,
                    waitForUser: true
                };
            }

            // Handle block property
            if (step.block) {
                await flowEngine.leadsManager.blockLead(session.userId);
            }

            // If this is not a waiting step and has a next step
            if (!step.userResponseWaiting && step.next) {
                session.currentStep = step.next;
                return {
                    messages,
                    waitForUser: false
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
