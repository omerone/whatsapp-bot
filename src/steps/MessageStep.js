class MessageStep {
    static async process(step, session, input, flowEngine) {
        try {
            let messages = [];
            
            // Load message from file or use direct message
            if (step.messageFile) {
                let message = await flowEngine.loadMessageFile(step.messageFile);
                if (!message) {
                    throw new Error(`Failed to load message file: ${step.messageFile}`);
                }

                // Replace variables in the message if they exist
                if (session.data) {
                    // הוספת לוגיקה גנרית להחלפת placeholders
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), session.data[keyInSession]);
                        }
                    }
                }

                // Replace meeting-specific variables
                if (session.meeting) {
                    // Get the day name in Hebrew
                    const [day, month, year] = session.meeting.date.split('/');
                    const date = new Date(year, month - 1, day);
                    const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' });
                    
                    message = message.replace(/\{dayName\}/g, dayName);
                    message = message.replace(/\{selectedDate\}/g, session.meeting.date);
                    message = message.replace(/\{selectedTime\}/g, session.meeting.time);
                }

                messages.push(message);
            } else if (step.message) {
                let directMessage = step.message;
                // הוספת לוגיקה גנרית להחלפת placeholders גם להודעה ישירה
                if (directMessage && session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            directMessage = directMessage.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), session.data[keyInSession]);
                        }
                    }
                }
                messages.push(directMessage);
            } else {
                throw new Error('Step has neither messageFile nor message');
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
