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
                if (session.meeting) {
                    // Get the day name in Hebrew
                    const [day, month, year] = session.meeting.date.split('/');
                    const date = new Date(year, month - 1, day);
                    const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' });
                    
                    // Support both {{}} and {} formats
                    message = message.replace(/\{\{dayName\}\}/g, dayName);
                    message = message.replace(/\{dayName\}/g, dayName);
                    message = message.replace(/\{\{selectedDate\}\}/g, session.meeting.date);
                    message = message.replace(/\{selectedDate\}/g, session.meeting.date);
                    message = message.replace(/\{\{selectedTime\}\}/g, session.meeting.time);
                    message = message.replace(/\{selectedTime\}/g, session.meeting.time);
                }

                // הוספת לוגיקה גנרית להחלפת placeholders מ-session.data
                if (message && session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), session.data[keyInSession]);
                        }
                    }
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

            // If this is not a waiting step and has a next step, just move to the next step
            // but don't process it immediately - let it be processed on the next interaction
            if (!step.userResponseWaiting && step.next) {
                session.currentStep = step.next;
                return {
                    messages,
                    waitForUser: false // This will cause the next step to be processed immediately after
                };
            }

            // If this is a waiting step and we received input, move to next step
            if (step.userResponseWaiting && input && step.next) {
    
                session.currentStep = step.next;
                return await flowEngine.processStepInternal(session.userId);
            }

            return {
                messages,
                waitForUser: step.userResponseWaiting
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
