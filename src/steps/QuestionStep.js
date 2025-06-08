const ValidatorRegistry = require('../engine/ValidatorRegistry');

class QuestionStep {
    static async process(step, session, input, flowEngine) {
        try {
            // Utility to escape strings for RegExp
            const escapeRegExp = (string) => {
                return string.replace(/[.*+?^${}()|[\\\\]]/g, '\\\\$&');
            };

            if (input) {
                // השתמש במערכת הולידטורים החדשה
                const validatorType = step.validation?.type;
                if (!validatorType) {
                    console.error('No validation type specified in step:', step.id);
                    return { messages: ['שגיאה בהגדרת הולידציה'], waitForUser: true };
                }

                // הכנת אפשרויות ולידציה
                const validationOptions = {
                    ...step.validation.options,
                    pendingSuggestion: session.pendingSuggestion
                };

                // הוספת הודעות מותאמות אישית לולידציה מתקדמת של ערים
                if ((validatorType === 'City' || validatorType === 'Location') && step.cityValidationConfig) {
                    validationOptions.messages = step.cityValidationConfig.messages;
                }

                // ביצוע הולידציה
                const validationResult = ValidatorRegistry.validate(validatorType, input, validationOptions);

                // טיפול בולידציה מתקדמת של ערים (תאימות לאחור)
                if ((validatorType === 'City' || validatorType === 'Location') && 
                    validationResult.status && step.cityValidationConfig) {
                    
                    const cityValidationConfig = step.cityValidationConfig;
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
                            responseMessageText = cityValidationConfig.messages.קלט_ריק;
                            break;
                        case 'עיר_לא_זמינה':
                            responseMessageText = cityValidationConfig.messages.עיר_לא_זמינה
                                .replace(/{cityName}/g, validationResult.cityName);
                            break;
                        case 'SUGGESTION_SERVICEABLE':
                            responseMessageText = cityValidationConfig.messages.SUGGESTION_SERVICEABLE
                                .replace(/{suggestedCity}/g, validationResult.suggestedCity);
                            session.pendingSuggestion = validationResult.suggestedCity;
                            break;
                        case 'הצעה_עיר_לא_זמינה':
                            responseMessageText = cityValidationConfig.messages.הצעה_עיר_לא_זמינה
                                .replace(/{suggestedCity}/g, validationResult.suggestedCity);
                            break;
                        case 'עיר_לא_מוכרת':
                            responseMessageText = cityValidationConfig.messages.עיר_לא_מוכרת
                                .replace(/{originalInput}/g, validationResult.originalInput);
                            break;
                        default:
                            console.error(`QuestionStep: Unknown status from LocationValidator: ${validationResult.status}`);
                            responseMessageText = 'אירעה שגיאה בעיבוד העיר, אנא נסה שנית.';
                    }
                    
                    session.currentStep = step.id;
                    
                    // Append back instruction if configured
                    if (responseMessageText && cityValidationConfig.messages?.הוראת_חזרה) {
                        responseMessageText += '\n' + cityValidationConfig.messages.הוראת_חזרה;
                    }

                    return { messages: [responseMessageText || 'אנא נסה עיר אחרת.'], waitForUser: true };
                }

                // ולידציה סטנדרטית חדשה
                if (validationResult.isValid) {
                    delete session.pendingSuggestion;
                    session.data[step.key] = validationResult.value;
                    
                    // העברת נתונים נוספים מהולידציה
                    if (validationResult.motoEnabled !== undefined) {
                        session.motoEnabled = validationResult.motoEnabled;
                    }
                    
                    session.currentStep = step.next;
                    return flowEngine.processStepInternal(session.userId);
                } else {
                    // טיפול בשגיאות ולידציה
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
            let questionMessage = step.message;
            if (questionMessage && session.data) {
                for (const keyInSession in session.data) {
                    if (session.data.hasOwnProperty(keyInSession)) {
                        const placeholder = `{${keyInSession}}`;
                        questionMessage = questionMessage.replace(new RegExp(escapeRegExp(placeholder), 'g'), session.data[keyInSession]);
                    }
                }
            }

            return {
                messages: [questionMessage],
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
