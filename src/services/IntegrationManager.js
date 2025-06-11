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
                        
                        // Update lead with calendar event details
                        if (currentLead) {
                            currentLead.calendarEventId = calendarResult.eventId;
                            currentLead.calendarEventLink = calendarResult.eventLink;
                        }
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

            // Send notifications
            if (this.services.reminders && this.whatsappClient) {
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
                console.log('[IntegrationManager] ℹ️ Notifications not enabled or WhatsApp client not available');
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

    // Method to stop services, e.g., on application shutdown
    async shutdown() {
        if (this.services.reminders) {
            this.services.reminders.stop();
            console.log('IntegrationManager: ReminderService stopped.');
        }
        // Add other service shutdowns if necessary
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