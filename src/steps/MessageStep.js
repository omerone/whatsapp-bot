class MessageStep {
    static async process(step, session, input, flowEngine) {
        try {
            const messages = [];

            // Process message header if exists
            if (step.messageHeader) {
                let headerMessage = step.messageHeader;
                if (session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            headerMessage = headerMessage.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), session.data[keyInSession]);
                        }
                    }
                }

                // Replace date/time placeholders in header
                if (session.data && session.data.meeting_date && session.data.meeting_time) {
                    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
                    const [day, month, year] = session.data.meeting_date.split('/');
                    const date = new Date(year, month - 1, day);
                    const dayName = dayNames[date.getDay()];
                    
                    headerMessage = headerMessage
                        .replace(/{dayName}/g, dayName)
                        .replace(/{selectedDate}/g, session.data.meeting_date)
                        .replace(/{selectedTime}/g, session.data.meeting_time)
                        .replace(/{meeting_date}/g, session.data.meeting_date)
                        .replace(/{meeting_time}/g, session.data.meeting_time);
                }

                messages.push(headerMessage);
            }

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
                    if (session.data && session.data.meeting_date && session.data.meeting_time) {
                        const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
                        const [day, month, year] = session.data.meeting_date.split('/');
                        const date = new Date(year, month - 1, day);
                        const dayName = dayNames[date.getDay()];
                        
                        processedMessage = processedMessage
                            .replace(/{dayName}/g, dayName)
                            .replace(/{selectedDate}/g, session.data.meeting_date)
                            .replace(/{selectedTime}/g, session.data.meeting_time)
                            .replace(/{meeting_date}/g, session.data.meeting_date)
                            .replace(/{meeting_time}/g, session.data.meeting_time);
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

                // Replace date/time placeholders in direct message
                if (session.data && session.data.meeting_date && session.data.meeting_time) {
                    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
                    const [day, month, year] = session.data.meeting_date.split('/');
                    const date = new Date(year, month - 1, day);
                    const dayName = dayNames[date.getDay()];
                    
                    directMessage = directMessage
                        .replace(/{dayName}/g, dayName)
                        .replace(/{selectedDate}/g, session.data.meeting_date)
                        .replace(/{selectedTime}/g, session.data.meeting_time)
                        .replace(/{meeting_date}/g, session.data.meeting_date)
                        .replace(/{meeting_time}/g, session.data.meeting_time);
                }

                messages.push(directMessage);
            } else if (!step.messageFile && !step.messageHeader) {
                throw new Error('Step has neither messageFile, message, nor messageHeader');
            }

            // Process footer message if exists
            if (step.footerMessage) {
                let footerMessage = step.footerMessage;
                if (session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            footerMessage = footerMessage.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), session.data[keyInSession]);
                        }
                    }
                }

                // Replace date/time placeholders in footer
                if (session.data && session.data.meeting_date && session.data.meeting_time) {
                    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
                    const [day, month, year] = session.data.meeting_date.split('/');
                    const date = new Date(year, month - 1, day);
                    const dayName = dayNames[date.getDay()];
                    
                    footerMessage = footerMessage
                        .replace(/{dayName}/g, dayName)
                        .replace(/{selectedDate}/g, session.data.meeting_date)
                        .replace(/{selectedTime}/g, session.data.meeting_time)
                        .replace(/{meeting_date}/g, session.data.meeting_date)
                        .replace(/{meeting_time}/g, session.data.meeting_time);
                }

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
