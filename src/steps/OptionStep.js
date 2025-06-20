class OptionStep {
    static async process(step, session, input, flowEngine) {
        // If we have input, try to process the selection
        if (input && input.trim()) {
            const normalizedInput = input.trim().toLowerCase();
            
            // Find the matching option
            let selectedOption = null;
            let selectedKey = null;

            for (const [key, value] of Object.entries(step.branches || {})) {
                const options = key.split('||').map(opt => opt.trim().toLowerCase());
                
                // Check if input matches any of the options (case insensitive)
                if (options.includes(normalizedInput)) {
                    selectedOption = value;
                    selectedKey = key;
                    break;
                }

                // Check for partial matches (if input contains or is contained in any option)
                for (const option of options) {
                    if (option === normalizedInput || 
                        (option.length > 2 && normalizedInput.includes(option)) ||
                        (normalizedInput.length > 2 && option.includes(normalizedInput))) {
                        selectedOption = value;
                        selectedKey = key;
                        break;
                    }
                }
             
                if (selectedOption) break;
            }

            if (selectedOption) {
                // Store the selection
                if (step.key) {
                    session.data[step.key] = selectedOption;
                }
                
                console.log(`✅ OptionStep: User input "${input}" matched option "${selectedKey}" → target step "${selectedOption}"`);
                
                // Update the lead with the client's message
                await flowEngine.leadsManager.updateLastMessage(session.userId, 'client', input);
                
                // Move to the selected branch
                session.currentStep = selectedOption;
                return flowEngine.processStepInternal(session.userId);
            } else {
                // Create a comprehensive list of valid options for the error message
                const validOptions = Object.keys(step.branches || {})
                    .map(key => {
                        const options = key.split('||').map(opt => opt.trim());
                        return options.length > 1 ? `${options[0]} (${options.slice(1).join(', ')})` : options[0];
                    })
                    .join(' | ');

                console.log(`❌ OptionStep: User input "${input}" didn't match any option in step "${step.id}"`);
                
                // Update the lead with the invalid input
                await flowEngine.leadsManager.updateLastMessage(session.userId, 'client', input);
                
                // Invalid selection with custom message if available
                const errorMessage = step.noMatchMessage || `בחירה לא תקינה, אנא בחר מהאפשרויות הבאות: ${validOptions}`;
                
                return {
                    messages: [errorMessage],
                    waitForUser: true
                };
            }
        }

        // If we're just starting this step or had an invalid selection
        // BUT if user sent empty/whitespace input, show error
        if (input && !input.trim()) {
            const validOptions = Object.keys(step.branches || {})
                .map(key => {
                    const options = key.split('||').map(opt => opt.trim());
                    return options.length > 1 ? `${options[0]} (${options.slice(1).join(', ')})` : options[0];
                })
                .join(' | ');

            console.log(`❌ OptionStep: User sent empty/whitespace input in step "${step.id}"`);
            
            // Update the lead with the invalid input
            await flowEngine.leadsManager.updateLastMessage(session.userId, 'client', input);
            
            const errorMessage = step.noMatchMessage || `בחירה לא תקינה, אנא בחר מהאפשרויות הבאות: ${validOptions}`;
            
            return {
                messages: [errorMessage],
                waitForUser: true
            };
        }

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

        // Process main message
        let messageToSend = step.message || await flowEngine.loadMessageFile(step.messageFile);
        if (messageToSend && session.data) {
            for (const keyInSession in session.data) {
                if (session.data.hasOwnProperty(keyInSession)) {
                    const placeholder = `{${keyInSession}}`;
                    messageToSend = messageToSend.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), session.data[keyInSession]);
                }
            }
        }

        // Replace date/time placeholders in main message
        if (messageToSend && session.data && session.data.meeting_date && session.data.meeting_time) {
            const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
            const [day, month, year] = session.data.meeting_date.split('/');
            const date = new Date(year, month - 1, day);
            const dayName = dayNames[date.getDay()];
            
            messageToSend = messageToSend
                .replace(/{dayName}/g, dayName)
                .replace(/{selectedDate}/g, session.data.meeting_date)
                .replace(/{selectedTime}/g, session.data.meeting_time)
                .replace(/{meeting_date}/g, session.data.meeting_date)
                .replace(/{meeting_time}/g, session.data.meeting_time);
        }

        messages.push(messageToSend);

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

        return {
            messages,
            waitForUser: true
        };
    }
}

module.exports = OptionStep;
