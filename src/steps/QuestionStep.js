const validators = require('../engine/validators/index');

class QuestionStep {
    static async process(step, session, input, flowEngine) {
        try {
            // Utility to escape strings for RegExp
            const escapeRegExp = (string) => {
                return string.replace(/[.*+?^${}()|[\\\\]]/g, '\\\\$&');
            };

            if (input) {
                // Check if this is a confirmation of a suggestion
                if (session.pendingSuggestion && step.options && step.branches) {
                    // Check if input matches any option pattern for suggestion confirmation
                    for (const optionPattern in step.options) {
                        const patterns = optionPattern.split('||').map(p => p.trim());
                        
                        // Check if input matches any of the patterns
                        if (patterns.some(pattern => 
                            new RegExp(`^${escapeRegExp(pattern)}$`, 'i').test(input))) {
                            
                            const branch = step.options[optionPattern];
                            if (step.branches[branch]) {
                                // Set the confirmed suggestion as the value
                                session.data[step.key] = session.pendingSuggestion;
                                delete session.pendingSuggestion;
                                
                                // Move to the branch step
                                session.currentStep = step.branches[branch];
                                return flowEngine.processStepInternal(session.userId);
                            }
                        }
                    }
                }
                
                // Validate input using validators
                const validationResult = validators.validate(input, step);

                // Legacy compatibility for Location validator which uses status field
                if ((step.validation?.type === 'City' || step.validation?.type === 'Location') && 
                    validationResult.status && step.cityValidationConfig) {
                    
                    const cityValidationConfig = step.cityValidationConfig || {};
                    const configMessages = cityValidationConfig.messages || {};
                    let responseMessageText = '';

                    // Clear pending suggestion by default
                    delete session.pendingSuggestion;

                    switch (validationResult.status) {
                        case 'VALID':
                        case 'CONFIRMED_VALID_SUGGESTION':
                            session.data[step.key] = validationResult.value;
                            if (validationResult.motoEnabled !== undefined) {
                                session.motoEnabled = validationResult.motoEnabled;
                            }
                            session.currentStep = step.next;
                            return flowEngine.processStepInternal(session.userId);

                        case 'קלט_ריק':
                            responseMessageText = configMessages.קלט_ריק || 'לא הזנת עיר. אנא נסה שנית.';
                            break;
                        case 'עיר_לא_זמינה':
                            if (configMessages.עיר_לא_זמינה) {
                                responseMessageText = configMessages.עיר_לא_זמינה
                                    .replace(/{cityName}/g, validationResult.cityName || '');
                            } else {
                                responseMessageText = `איננו פועלים ב${validationResult.cityName || 'אזור זה'} כרגע.`;
                            }
                            break;
                        case 'SUGGESTION_SERVICEABLE':
                            if (configMessages.SUGGESTION_SERVICEABLE) {
                                responseMessageText = configMessages.SUGGESTION_SERVICEABLE
                                    .replace(/{suggestedCity}/g, validationResult.suggestedCity || '');
                            } else {
                                responseMessageText = `האם התכוונת ל*${validationResult.suggestedCity || ''}*?\nהשב כן לאישור או הקלד את שם העיר הנכון.`;
                            }
                            session.pendingSuggestion = validationResult.suggestedCity;
                            break;
                        case 'הצעה_עיר_לא_זמינה':
                            if (configMessages.הצעה_עיר_לא_זמינה) {
                                responseMessageText = configMessages.הצעה_עיר_לא_זמינה
                                    .replace(/{suggestedCity}/g, validationResult.suggestedCity || '');
                            } else {
                                responseMessageText = `נראה שהתכוונת ל${validationResult.suggestedCity || ''}, אבל איננו פועלים באזור זה כרגע.`;
                            }
                            break;
                        case 'עיר_לא_מוכרת':
                            if (configMessages.עיר_לא_מוכרת) {
                                responseMessageText = configMessages.עיר_לא_מוכרת
                                    .replace(/{originalInput}/g, validationResult.originalInput || '');
                            } else {
                                responseMessageText = 'לא הכרנו את העיר שציינת. אנא נסה שוב.';
                            }
                            break;
                        default:
                            console.error(`QuestionStep: Unknown status from LocationValidator: ${validationResult.status}`);
                            responseMessageText = 'אירעה שגיאה בעיבוד העיר, אנא נסה שנית.';
                    }
                    
                    session.currentStep = step.id;
                    
                    // Append back instruction if configured
                    if (responseMessageText && configMessages.הוראת_חזרה && !configMessages.skipBackInstruction) {
                        responseMessageText += '\n' + configMessages.הוראת_חזרה;
                    }

                    return { messages: [responseMessageText || 'אנא נסה עיר אחרת.'], waitForUser: true };
                }

                // Standard validation handling for all validation types
                if (validationResult.isValid) {
                    delete session.pendingSuggestion;
                    session.data[step.key] = validationResult.value;
                    
                    // Pass any additional data from validation result
                    if (validationResult.motoEnabled !== undefined) {
                        session.motoEnabled = validationResult.motoEnabled;
                    }
                    
                    session.currentStep = step.next;
                    return flowEngine.processStepInternal(session.userId);
                } else {
                    // Handle validation errors
                    if (validationResult.pendingSuggestion) {
                        session.pendingSuggestion = validationResult.pendingSuggestion;
                    } else {
                        delete session.pendingSuggestion;
                    }
                    
                    const messageToSend = validationResult.message || 'הקלט אינו תקין. אנא נסה שנית.';
                    return { messages: [messageToSend], waitForUser: true };
                }
            }

            // If no input, show the question
            const messages = [];

            // Process message header if exists
            if (step.messageHeader) {
                let headerMessage = step.messageHeader;
                if (session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            headerMessage = headerMessage.replace(new RegExp(escapeRegExp(placeholder), 'g'), session.data[keyInSession]);
                        }
                    }
                }
                messages.push(headerMessage);
            }

            // Process main message
            let questionMessage = step.message;
            if (questionMessage && session.data) {
                for (const keyInSession in session.data) {
                    if (session.data.hasOwnProperty(keyInSession)) {
                        const placeholder = `{${keyInSession}}`;
                        questionMessage = questionMessage.replace(new RegExp(escapeRegExp(placeholder), 'g'), session.data[keyInSession]);
                    }
                }
            }
            messages.push(questionMessage);

            // Process footer message if exists
            if (step.footerMessage) {
                let footerMessage = step.footerMessage;
                if (session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            footerMessage = footerMessage.replace(new RegExp(escapeRegExp(placeholder), 'g'), session.data[keyInSession]);
                        }
                    }
                }
                messages.push(footerMessage);
            }

            return {
                messages,
                waitForUser: true
            };

        } catch (error) {
            console.error('Error in QuestionStep:', error);
            return {
                messages: ['מצטערים, אירעה שגיאה כללית. אנא נסה שוב או כתוב "תפריט" להתחלה מחדש.'],
                waitForUser: true
            };
        }
    }
}

module.exports = QuestionStep;
