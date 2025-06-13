class OptionStep {
    static async process(step, session, input, flowEngine) {
        // If we have input, try to process the selection
        if (input) {
            const normalizedInput = input.trim().toLowerCase();
            
            // Find the matching option
            let selectedOption = null;
            let selectedKey = null;

            for (const [key, value] of Object.entries(step.options)) {
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

            if (selectedOption && step.branches[selectedOption]) {
                // Store the selection
                if (step.key) {
                    session.data[step.key] = selectedOption;
                }
                
                console.log(`✅ OptionStep: User input "${input}" matched option "${selectedKey}" → "${selectedOption}" → "${step.branches[selectedOption]}"`);
                
                // Update the lead with the client's message
                await flowEngine.leadsManager.updateLastMessage(session.userId, 'client', input);
                
                // Move to the selected branch
                session.currentStep = step.branches[selectedOption];
                return flowEngine.processStepInternal(session.userId);
            } else {
                // Create a comprehensive list of valid options for the error message
                const validOptions = Object.keys(step.options)
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
            messages.push(footerMessage);
        }

        return {
            messages,
            waitForUser: true
        };
    }
}

module.exports = OptionStep;
