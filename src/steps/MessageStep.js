class MessageStep {
    static async process(step, session, input, flowEngine) {
        try {
            const messages = [];

            // Get lead data for placeholder replacement
            const leadData = await flowEngine.leadsManager.getLead(session.userId);

            // Process message header if exists and not empty
            if (step.messageHeader && step.messageHeader.trim()) {
                let headerMessage = step.messageHeader;
                if (session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            headerMessage = headerMessage.replace(new RegExp(placeholder, 'g'), session.data[keyInSession]);
                        }
                    }
                }
                messages.unshift(headerMessage);
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
                let message = step.message;
                if (session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            message = message.replace(new RegExp(placeholder, 'g'), session.data[keyInSession]);
                        }
                    }
                }
                messages.push(message);
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
                let footerMessage = step.footerMessage;
                if (session.data) {
                    for (const keyInSession in session.data) {
                        if (session.data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            footerMessage = footerMessage.replace(new RegExp(placeholder, 'g'), session.data[keyInSession]);
                        }
                    }
                }
                messages.push(footerMessage);
            }

            // Handle integration removal if configured
            let removalResults = null;
            if (step.integrationRemoval?.enabled) {
                console.log(`[MessageStep] Processing integration removal for step: ${step.id}`);
                removalResults = await MessageStep.handleIntegrationRemoval(step, session, flowEngine);
                
                // Add confirmation message if configured
                if (step.integrationRemoval.confirmationMessage && removalResults.success) {
                    let confirmationMsg = step.integrationRemoval.confirmationMessage;
                    if (session.data) {
                        for (const keyInSession in session.data) {
                            if (session.data.hasOwnProperty(keyInSession)) {
                                const placeholder = `{${keyInSession}}`;
                                confirmationMsg = confirmationMsg.replace(new RegExp(placeholder, 'g'), session.data[keyInSession]);
                            }
                        }
                    }
                    messages.push(confirmationMsg);
                }
            }

            // Special handling for final_confirmation step
            if (step.id === 'final_confirmation') {
                const lead = await flowEngine.leadsManager.getLead(session.userId);
                
                // If this is the first time showing the step (no user input yet)
                if (!input) {
                    console.log(`[MessageStep] First time showing final_confirmation for ${session.userId}`);
                    // Mark that integrations should be processed for this step
                    session.pendingIntegrations = true;
                    return {
                        messages,
                        waitForUser: true
                    };
                }
                
                // If user provided input and we have a next step, move to it
                if (input && step.next) {
                    console.log(`[MessageStep] final_confirmation received user input "${input}", moving to next step: ${step.next}`);
                    session.currentStep = step.next;
                    // Clear the pending integrations flag since they should have been processed already
                    delete session.pendingIntegrations;
                    return {
                        messages: [], // Don't repeat the message
                        waitForUser: false,
                        nextStep: step.next
                    };
                }
                
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
            if (step.userResponseWaiting && input && step.next && step.id !== 'final_confirmation') {
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

    static async handleIntegrationRemoval(step, session, flowEngine) {
        const results = {
            success: false,
            removed: [],
            failed: [],
            details: {}
        };

        try {
            const currentLead = await flowEngine.leadsManager.getLead(session.userId);
            const removalConfig = step.integrationRemoval;

            console.log(`[MessageStep] Starting integration removal with config:`, removalConfig);

            // Remove from Google Calendar
            if (removalConfig.removeCalendar && currentLead?.meeting?.calendar_event_id) {
                console.log(`[MessageStep] 🗑️ Removing calendar event: ${currentLead.meeting.calendar_event_id}`);
                try {
                    // Find calendar configuration from final_confirmation step
                    const finalConfirmationStep = flowEngine.flow.steps['final_confirmation'];
                    if (finalConfirmationStep?.integration?.calendar) {
                        const GoogleCalendarService = require('../services/google/GoogleCalendarService');
                        const calendarService = new GoogleCalendarService(finalConfirmationStep.integration.calendar);
                        await calendarService.initialize();
                        
                        const deleteResult = await calendarService.deleteEvent(currentLead.meeting.calendar_event_id);
                        if (deleteResult) {
                            results.removed.push('calendar');
                            results.details.calendar = 'Event deleted successfully';
                        } else {
                            results.failed.push('calendar');
                            results.details.calendar = 'Failed to delete event';
                        }
                    } else {
                        results.failed.push('calendar');
                        results.details.calendar = 'Calendar configuration not found';
                    }
                } catch (error) {
                    console.error(`[MessageStep] ❌ Error removing calendar event:`, error);
                    results.failed.push('calendar');
                    results.details.calendar = error.message;
                }
            }

            // Remove from Google Sheets
            if (removalConfig.removeSheets) {
                console.log(`[MessageStep] 🗑️ Removing sheet appointment`);
                try {
                    // Find sheets configuration from final_confirmation step
                    const finalConfirmationStep = flowEngine.flow.steps['final_confirmation'];
                    if (finalConfirmationStep?.integration?.sheets) {
                        const GoogleSheetsService = require('../services/google/sheets');
                        const sheetsService = new GoogleSheetsService(finalConfirmationStep.integration.sheets);
                        await sheetsService.initialize();
                        
                        // Try multiple phone identifiers
                        const possiblePhones = [
                            currentLead?.meeting?.sheet_row_phone,
                            currentLead?.meeting?.phone,
                            currentLead?.phone,
                            session.userId
                        ].filter(Boolean);
                        
                        let sheetsDeleted = false;
                        for (const phoneToDelete of possiblePhones) {
                            const deleteResult = await sheetsService.deleteAppointment(phoneToDelete);
                            if (deleteResult) {
                                sheetsDeleted = true;
                                break;
                            }
                        }
                        
                        if (sheetsDeleted) {
                            results.removed.push('sheets');
                            results.details.sheets = 'Appointment deleted successfully';
                        } else {
                            results.failed.push('sheets');
                            results.details.sheets = 'No matching appointment found';
                        }
                    } else {
                        results.failed.push('sheets');
                        results.details.sheets = 'Sheets configuration not found';
                    }
                } catch (error) {
                    console.error(`[MessageStep] ❌ Error removing sheet appointment:`, error);
                    results.failed.push('sheets');
                    results.details.sheets = error.message;
                }
            }

            // Cancel notifications (this is more conceptual since notifications are usually already sent)
            if (removalConfig.removeNotifications) {
                console.log(`[MessageStep] 🗑️ Canceling notifications`);
                results.removed.push('notifications');
                results.details.notifications = 'Notifications canceled (if not already sent)';
            }

            // Cancel reminders
            if (removalConfig.removeReminders) {
                console.log(`[MessageStep] 🗑️ Canceling reminders`);
                try {
                    if (flowEngine.integrationManager?.services?.reminders) {
                        // Cancel reminders for this user
                        await flowEngine.integrationManager.services.reminders.cancelReminders(session.userId);
                        results.removed.push('reminders');
                        results.details.reminders = 'Reminders canceled successfully';
                    } else {
                        results.removed.push('reminders');
                        results.details.reminders = 'No active reminder service found';
                    }
                } catch (error) {
                    console.error(`[MessageStep] ❌ Error canceling reminders:`, error);
                    results.failed.push('reminders');
                    results.details.reminders = error.message;
                }
            }

            // Clean up meeting data from lead
            if (results.removed.length > 0) {
                await flowEngine.leadsManager.createOrUpdateLead(session.userId, {
                    meeting: null,
                    is_schedule: false,
                    integrations_removed: true,
                    removal_timestamp: new Date().toISOString(),
                    removed_integrations: results.removed
                });
                console.log(`[MessageStep] ✅ Successfully removed integrations: ${results.removed.join(', ')}`);
            }

            results.success = results.removed.length > 0;
            return results;

        } catch (error) {
            console.error(`[MessageStep] ❌ Error in handleIntegrationRemoval:`, error);
            results.details.general_error = error.message;
            return results;
        }
    }
}

module.exports = MessageStep;
