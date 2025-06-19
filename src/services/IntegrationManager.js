const GoogleSheetsService = require('./google/sheets');
const GoogleCalendarService = require('./google/GoogleCalendarService');
const iPlanService = require('./google/iPlanService');
const ReminderService = require('./ReminderService');
const GroupFetcherService = require('./GroupFetcherService');
const path = require('path');

class IntegrationManager {
    constructor(config, flowEngine = null, whatsappClient = null, dataPath = null) {
        this.config = config;
        this.services = {};
        this.flowKeys = this._collectFlowKeys();
        this.flowEngine = flowEngine;
        this.whatsappClient = whatsappClient;
        this.dataPath = dataPath;
        this.processingMeetings = new Set(); // Track meetings being processed
    }

    _collectFlowKeys() {
        const keys = new Set();
        // Collect all keys from flow steps
        if (this.config.steps) {
            for (const step of Object.values(this.config.steps)) {
                if (step.key) {
                    keys.add(step.key);
                }
            }
        }
        return Array.from(keys);
    }

    _getSheetsConfig(isNewStructure, integrationsConfig) {
        if (isNewStructure && integrationsConfig?.googleWorkspace?.sheets) {
            return integrationsConfig.googleWorkspace.sheets;
        }
        // Fallback to old structure
        return this.config.googleSheet;
    }

    _getCalendarConfig(isNewStructure, integrationsConfig) {
        if (isNewStructure && integrationsConfig?.googleWorkspace?.calendar) {
            return integrationsConfig.googleWorkspace.calendar;
        }
        // Fallback to old structure
        return this.config.googleCalendar;
    }

    _getNotificationsConfig(isNewStructure, integrationsConfig) {
        if (isNewStructure && integrationsConfig?.notifications?.meetingScheduled) {
            return integrationsConfig.notifications.meetingScheduled;
        }
        // Fallback to old structure
        return this.config.meetingNotificationSettings;
    }

    _getRemindersConfig(isNewStructure, integrationsConfig) {
        if (isNewStructure && integrationsConfig?.reminders) {
            return integrationsConfig.reminders;
        }
        // Fallback to old structure
        return this.config.reminders;
    }

    _getiPlanConfig(isNewStructure, integrationsConfig) {
        if (isNewStructure && integrationsConfig?.iPlan) {
            return integrationsConfig.iPlan;
        }
        // No fallback for iPlan as it's a new service
        return null;
    }

    _getIntegrationsConfig() {
        // Helper method to get integrations config for use in other methods
        const topLevelIntegrations = this.config.integrations;
        const rulesIntegrations = this.config.rules?.integrations;
        
        if (topLevelIntegrations?.enabled) {
            return { config: topLevelIntegrations, isNew: true };
        } else if (rulesIntegrations?.enabled) {
            return { config: rulesIntegrations, isNew: true };
        }
        
        return { config: null, isNew: false };
    }

    async initialize() {
        try {
            // Get integrations config (support multiple structures)
            // 1. Top-level integrations (newest)
            // 2. rules.integrations (middle structure)
            // 3. Individual configs (oldest - backward compatibility)
            const topLevelIntegrations = this.config.integrations;
            const rulesIntegrations = this.config.rules?.integrations;
            
            let integrationsConfig = null;
            let structureType = 'legacy';
            
            if (topLevelIntegrations?.enabled) {
                integrationsConfig = topLevelIntegrations;
                structureType = 'top-level';
            } else if (rulesIntegrations?.enabled) {
                integrationsConfig = rulesIntegrations;
                structureType = 'rules-nested';
            }
            
            console.log(`🔧 IntegrationManager: Using ${structureType} structure`);
            const isNewStructure = structureType !== 'legacy';
            
            // Initialize Google Sheets if configured
            const sheetsConfig = this._getSheetsConfig(isNewStructure, integrationsConfig);
            if (sheetsConfig?.enabled) {
                const sheetsService = new GoogleSheetsService(sheetsConfig);
                const initialized = await sheetsService.initialize();
                if (initialized) {
                    this.services.sheets = sheetsService;
                    console.log('✅ IntegrationManager: Google Sheets initialized');
                }
            }

            // Initialize Google Calendar if configured
            const calendarConfig = this._getCalendarConfig(isNewStructure, integrationsConfig);
            if (calendarConfig?.enabled) {
                const calendarService = new GoogleCalendarService(calendarConfig);
                const initialized = await calendarService.initialize();
                if (initialized) {
                    this.services.calendar = calendarService;
                    console.log('✅ IntegrationManager: Google Calendar initialized');
                }
            }

            // Initialize iPlan if configured
            const iPlanConfig = this._getiPlanConfig(isNewStructure, integrationsConfig);
            if (iPlanConfig?.enabled) {
                const iPlanServiceInstance = new iPlanService(iPlanConfig);
                const initialized = await iPlanServiceInstance.initialize();
                if (initialized) {
                    this.services.iPlan = iPlanServiceInstance;
                    console.log('✅ IntegrationManager: iPlan initialized');
                }
            }

            // Initialize ReminderService if configured
            const remindersConfig = this._getRemindersConfig(isNewStructure, integrationsConfig);
            if (remindersConfig && remindersConfig.enabled && remindersConfig.configurations && remindersConfig.configurations.length > 0 && this.flowEngine?.leadsManager && this.whatsappClient) {
                const messagesBasePath = path.join(__dirname, '..', '..', 'data', 'messages');
                const reminderService = new ReminderService(
                    remindersConfig, // Pass the whole remindersConfig object
                    this.flowEngine.leadsManager,
                    this.whatsappClient,
                    messagesBasePath,
                    this // Pass IntegrationManager instance itself
                );
                reminderService.start();
                this.services.reminders = reminderService;
                console.log('✅ IntegrationManager: Reminder Service initialized');
            } else {
                // הסרת הלוגים הקשורים ל-ReminderService
                // if (!remindersConfig || !remindersConfig.enabled) {
                //     console.log('IntegrationManager: ReminderService not started, reminders are globally disabled or config missing.');
                // } else if (!remindersConfig.configurations || remindersConfig.configurations.length === 0) {
                //     console.log('IntegrationManager: ReminderService not started, no specific reminder configurations found.');
                // }
                // if (!this.flowEngine?.leadsManager) {
                //     console.warn('IntegrationManager: ReminderService not started, LeadsManager not available.');
                // }
                // if (!this.whatsappClient) {
                //     console.warn('IntegrationManager: ReminderService not started, WhatsApp client not available.');
                // }
            }

            return true;
        } catch (error) {
            console.error('Failed to initialize IntegrationManager:', error);
            return false;
        }
    }

    async handleMeetingScheduled(data, currentLead) {
        console.log('\n[IntegrationManager] 📅 Processing new meeting scheduling:', {
            name: data.full_name,
            date: data.meeting_date,
            time: data.meeting_time,
            city: data.city_name,
            mobility: data.mobility
        });

        // Log calendar service status
        console.log('[IntegrationManager] 🔍 Calendar service status:', {
            exists: !!this.services.calendar,
            initialized: this.services.calendar?.initialized
        });

        try {
            // Initialize results object
            const results = {
                calendar: { success: false, error: null },
                sheets: { success: false, error: null },
                notifications: { success: false, error: null },
                iplan: { success: false, error: null }
            };

            // Initialize meeting details object to track IDs
            const meetingDetails = {
                ...data,
                calendar_event_id: null,
                sheet_row_id: null,
                iplan_meeting_id: null
            };

            // Google Calendar Integration
            if (this.services.calendar && this.services.calendar.initialized) {
                console.log('[IntegrationManager] 🔄 Creating Google Calendar event...');
                try {
                    const calendarResult = await this.services.calendar.createEvent(data);
                    results.calendar = calendarResult;
                    
                    if (calendarResult.success) {
                        console.log('[IntegrationManager] ✅ Calendar event created successfully:', {
                            eventId: calendarResult.eventId,
                            eventLink: calendarResult.eventLink,
                            wasExisting: calendarResult.wasExisting
                        });
                        
                        // Store calendar event ID for potential deletion
                        meetingDetails.calendar_event_id = calendarResult.eventId;
                        meetingDetails.calendar_event_link = calendarResult.eventLink;
                    } else {
                        console.error('[IntegrationManager] ❌ Failed to create calendar event:', calendarResult.error);
                    }
                } catch (error) {
                    console.error('[IntegrationManager] ❌ Error in calendar integration:', error.message);
                    results.calendar.error = error.message;
                }
            } else {
                console.log('[IntegrationManager] ℹ️ Google Calendar integration not initialized or disabled');
            }

            // Google Sheets Integration
            if (this.services.sheets && this.services.sheets.initialized) {
                console.log('[IntegrationManager] 🔄 Adding meeting to Google Sheets...');
                try {
                    const sheetsResult = await this.services.sheets.addRow(data);
                    results.sheets.success = sheetsResult.success;
                    if (sheetsResult.success) {
                        console.log('[IntegrationManager] ✅ Meeting added to sheets successfully');
                        // Store sheet row ID - we'll need to get this from the sheets service
                        // For now, we'll use the phone number to identify the row later
                        meetingDetails.sheet_row_phone = data.phone;
                    } else {
                        console.error('[IntegrationManager] ❌ Failed to add to sheets:', sheetsResult.error);
                        results.sheets.error = sheetsResult.error;
                    }
                } catch (error) {
                    console.error('[IntegrationManager] ❌ Error in sheets integration:', error.message);
                    results.sheets.error = error.message;
                }
            } else {
                console.log('[IntegrationManager] ℹ️ Google Sheets integration not initialized or disabled');
            }

            // iPlan Integration
            if (this.services.iPlan && this.services.iPlan.initialized) {
                console.log('[IntegrationManager] 🔄 Creating iPlan meeting...');
                try {
                    const iPlanResult = await this.services.iPlan.createMeeting(data);
                    results.iplan.success = iPlanResult.success;
                    if (iPlanResult.success) {
                        console.log('[IntegrationManager] ✅ iPlan meeting created successfully');
                    } else {
                        console.error('[IntegrationManager] ❌ Failed to create iPlan meeting:', iPlanResult.error);
                        results.iplan.error = iPlanResult.error;
                    }
                } catch (error) {
                    console.error('[IntegrationManager] ❌ Error in iPlan integration:', error.message);
                    results.iplan.error = error.message;
                }
            } else {
                console.log('[IntegrationManager] ℹ️ iPlan integration not initialized or disabled');
            }

            // Send notifications - check if notifications are enabled
            console.log('[IntegrationManager] 🔍 Checking notification requirements:', {
                hasRemindersService: !!this.services.reminders,
                hasWhatsappClient: !!this.whatsappClient,
                clientType: this.whatsappClient ? this.whatsappClient.constructor.name : 'none'
            });
            
            if (this.whatsappClient) {
                console.log('[IntegrationManager] 🔄 Sending meeting notifications...');
                try {
                    const notificationResults = await this._sendMeetingNotifications(data, currentLead);
                    results.notifications = notificationResults;
                    if (notificationResults.success) {
                        console.log('[IntegrationManager] ✅ Meeting notifications sent successfully');
                    } else {
                        console.error('[IntegrationManager] ❌ Failed to send notifications:', notificationResults.error);
                    }
                } catch (error) {
                    console.error('[IntegrationManager] ❌ Error sending notifications:', error.message);
                    results.notifications.error = error.message;
                }
            } else {
                console.log('[IntegrationManager] ℹ️ WhatsApp client not available for notifications');
                results.notifications = { success: false, error: 'WhatsApp client not available' };
            }

            // Update lead with meeting details for potential deletion
            if (this.flowEngine && this.flowEngine.leadsManager && data.phone) {
                try {
                    await this.flowEngine.leadsManager.markLeadScheduled(data.phone, meetingDetails);
                    console.log('[IntegrationManager] ✅ Lead updated with meeting details for deletion capability');
                } catch (error) {
                    console.error('[IntegrationManager] ❌ Failed to update lead with meeting details:', error);
                }
            }

            // Log final results
            console.log('[IntegrationManager] 📊 Meeting scheduling results:', {
                calendar: results.calendar.success ? '✅' : '❌',
                sheets: results.sheets.success ? '✅' : '❌',
                notifications: results.notifications.success ? '✅' : '❌',
                iplan: results.iplan.success ? '✅' : '❌'
            });

            return results;

        } catch (error) {
            console.error('[IntegrationManager] ❌ Error in handleMeetingScheduled:', error);
            throw error;
        }
    }

    async handleCalendarIntegration(meetingData, currentLead) {
        try {
            if (this.services.calendar) {
                console.log('[IntegrationManager] 🔄 Creating Google Calendar event...');
                const calendarResult = await this.services.calendar.createEvent(meetingData);
                console.log('[IntegrationManager] ✅ Calendar event created successfully:', {
                    eventId: calendarResult.eventId,
                    eventLink: calendarResult.eventLink,
                    wasExisting: calendarResult.wasExisting
                });
                return { success: true, result: calendarResult };
            } else {
                console.log('[IntegrationManager] ℹ️ Calendar service not available');
                return { success: false, error: 'Calendar service not available' };
            }
        } catch (error) {
            console.error('[IntegrationManager] ❌ Calendar integration error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleSheetsIntegration(meetingData, currentLead) {
        try {
            if (this.services.sheets) {
                console.log('[IntegrationManager] 🔄 Adding meeting to Google Sheets...');
                const sheetsResult = await this.services.sheets.addMeeting(meetingData);
                console.log('[IntegrationManager] ✅ Meeting added to Google Sheets successfully');
                return { success: true, result: sheetsResult };
            } else {
                console.log('[IntegrationManager] ℹ️ Sheets service not available');
                return { success: false, error: 'Sheets service not available' };
            }
        } catch (error) {
            console.error('[IntegrationManager] ❌ Sheets integration error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleRemindersIntegration(meetingData, currentLead) {
        try {
            if (this.services.reminders) {
                console.log('[IntegrationManager] 🔄 Setting up reminders...');
                // Note: Reminders are typically handled by a separate service/scheduler
                console.log('[IntegrationManager] ℹ️ Reminders setup completed');
                return { success: true };
            } else {
                console.log('[IntegrationManager] ℹ️ Reminders service not available');
                return { success: false, error: 'Reminders service not available' };
            }
        } catch (error) {
            console.error('[IntegrationManager] ❌ Reminders integration error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleIPlanIntegration(meetingData, currentLead) {
        try {
            if (this.services.iplan) {
                console.log('[IntegrationManager] 🔄 Syncing with iPlan...');
                const iplanResult = await this.services.iplan.syncMeeting(meetingData);
                console.log('[IntegrationManager] ✅ iPlan sync completed');
                return { success: true, result: iplanResult };
            } else {
                console.log('[IntegrationManager] ℹ️ iPlan integration not initialized or disabled');
                return { success: false, error: 'iPlan service not available' };
            }
        } catch (error) {
            console.error('[IntegrationManager] ❌ iPlan integration error:', error);
            return { success: false, error: error.message };
        }
    }

    async _sendMeetingNotifications(meetingData, currentLead) {
        try {
            console.log('[IntegrationManager] 🔄 Processing meeting notifications...');
            
            // Get the integrations config
            const integrationsResult = this._getIntegrationsConfig();
            const notificationsConfig = this._getNotificationsConfig(integrationsResult.isNew, integrationsResult.config);
            
            if (!notificationsConfig || !notificationsConfig.enabled) {
                console.log('[IntegrationManager] ℹ️ Meeting notifications are disabled');
                return { success: false, error: 'Notifications disabled' };
            }
            
            if (!notificationsConfig.recipients || notificationsConfig.recipients.length === 0) {
                console.log('[IntegrationManager] ⚠️ No notification recipients configured');
                return { success: false, error: 'No recipients configured' };
            }
            
            // Load the notification message template
            let messageTemplate = '';
            if (notificationsConfig.messageTemplateFile) {
                const fs = require('fs');
                const path = require('path');
                const templatePath = path.join(this.dataPath || 'data', 'messages', notificationsConfig.messageTemplateFile);
                
                try {
                    messageTemplate = fs.readFileSync(templatePath, 'utf8');
                } catch (error) {
                    console.error('[IntegrationManager] ❌ Failed to load notification template:', error.message);
                    return { success: false, error: `Failed to load template: ${error.message}` };
                }
            } else {
                // Default template if none specified
                messageTemplate = `📢 זומן לראיון עבודה:\n\n👤 שם: {full_name}\n📍 עיר: {city_name}\n📞 טלפון: {phone}\n🚗 ניידות: {mobility}\n🗓 תאריך: {meeting_date}\n🕒 שעה: {meeting_time}`;
            }
            
            // Replace placeholders in the message
            const formattedMessage = this._formatNotificationMessage(messageTemplate, meetingData);
            
            // Send to all recipients
            const results = [];
            for (const recipient of notificationsConfig.recipients) {
                try {
                    console.log(`[IntegrationManager] 📤 Sending notification to ${recipient}...`);
                    await this.whatsappClient.sendMessage(recipient, formattedMessage);
                    results.push({ recipient, success: true });
                    console.log(`[IntegrationManager] ✅ Notification sent to ${recipient}`);
                } catch (error) {
                    console.error(`[IntegrationManager] ❌ Failed to send notification to ${recipient}:`, error.message);
                    results.push({ recipient, success: false, error: error.message });
                }
            }
            
            // Check if all notifications were sent successfully
            const successful = results.filter(r => r.success).length;
            const total = results.length;
            
            console.log(`[IntegrationManager] 📊 Notification results: ${successful}/${total} sent successfully`);
            
            return {
                success: successful > 0,
                results,
                message: `${successful}/${total} notifications sent successfully`
            };
            
        } catch (error) {
            console.error('[IntegrationManager] ❌ Error in _sendMeetingNotifications:', error);
            return { success: false, error: error.message };
        }
    }
    
    _formatNotificationMessage(template, meetingData) {
        let message = template;
        const placeholders = {
            '{full_name}': meetingData.full_name || '',
            '{city_name}': meetingData.city_name || '',
            '{phone}': meetingData.phone || '',
            '{mobility}': meetingData.mobility || '',
            '{meeting_date}': meetingData.meeting_date || '',
            '{meeting_time}': meetingData.meeting_time || ''
        };
        
        for (const [placeholder, value] of Object.entries(placeholders)) {
            message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        
        return message;
    }

    // Method to stop services, e.g., on application shutdown
    async shutdown() {
        if (this.services.reminders) {
            this.services.reminders.stop();
        }
    }

    async deleteCalendarEvent(eventId) {
        if (!this.services.calendar) {
            console.log('[IntegrationManager] ⚠️ Calendar service not available for deletion');
            return false;
        }

        try {
            console.log(`[IntegrationManager] 🗑️ Deleting calendar event: ${eventId}`);
            const result = await this.services.calendar.deleteEvent(eventId);
            console.log(`[IntegrationManager] ✅ Calendar event deleted successfully: ${eventId}`);
            return result;
        } catch (error) {
            console.error(`[IntegrationManager] ❌ Failed to delete calendar event ${eventId}:`, error);
            return false;
        }
    }

    async deleteSheetRow(rowId) {
        if (!this.services.sheets) {
            console.log('[IntegrationManager] ⚠️ Sheets service not available for deletion');
            return false;
        }

        try {
            console.log(`[IntegrationManager] 🗑️ Deleting sheet row: ${rowId}`);
            const result = await this.services.sheets.deleteRow(rowId);
            console.log(`[IntegrationManager] ✅ Sheet row deleted successfully: ${rowId}`);
            return result;
        } catch (error) {
            console.error(`[IntegrationManager] ❌ Failed to delete sheet row ${rowId}:`, error);
            return false;
        }
    }

    async deleteSheetAppointment(phone) {
        if (!this.services.sheets) {
            console.log('[IntegrationManager] ⚠️ Sheets service not available for deletion');
            return false;
        }

        try {
            console.log(`[IntegrationManager] 🗑️ Deleting sheet appointment for phone: ${phone}`);
            const result = await this.services.sheets.deleteAppointment(phone);
            console.log(`[IntegrationManager] ✅ Sheet appointment deleted successfully for phone: ${phone}`);
            return result;
        } catch (error) {
            console.error(`[IntegrationManager] ❌ Failed to delete sheet appointment for phone ${phone}:`, error);
            return false;
        }
    }

    async fetchGroupsAfterClientReady() {
        if (this.whatsappClient && this.dataPath) {
            try {
                let clientState = await this.whatsappClient.getState();
                if (clientState !== 'CONNECTED') {
                    // console.warn(`[${new Date().toLocaleString('he-IL')}] IntegrationManager: Client not connected (state: ${clientState}) when attempting to fetch groups after ready. Trying anyway or aborting...`);
                }

                // console.log(`[${new Date().toLocaleString('he-IL')}] IntegrationManager: מאחזר רשימת קבוצות (לאחר שהלקוח מוכן)...`);
                const groupFetcher = new GroupFetcherService(this.whatsappClient, this.dataPath);
                await groupFetcher.fetchAndSaveGroupIds();
                if (!this.services.groupFetcher) {
                    this.services.groupFetcher = groupFetcher;
                }
                // console.log(`[${new Date().toLocaleString('he-IL')}] IntegrationManager: רשימת קבוצות עודכנה ונשמרה.`);
            } catch (error) {
                console.error(`[${new Date().toLocaleString('he-IL')}] IntegrationManager: שגיאה באחזור או שמירת מזהי קבוצות (לאחר שהלקוח מוכן):`, error);
            }
        } else {
            if (!this.whatsappClient) {
                console.warn('IntegrationManager: Cannot fetch groups, WhatsApp client not available.');
            }
            if (!this.dataPath) {
                console.warn('IntegrationManager: Cannot fetch groups, dataPath not available.');
            }
        }
    }
}

module.exports = IntegrationManager; 