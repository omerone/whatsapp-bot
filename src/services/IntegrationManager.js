const GoogleSheetsService = require('./google/sheets');
const GoogleCalendarService = require('./google/GoogleCalendarService');
const iPlanService = require('./google/iPlanService');
const ReminderService = require('./ReminderService');
const GroupFetcherService = require('./GroupFetcherService');
const path = require('path');
const fs = require('fs').promises;

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
            // Initialize Google Sheets
            if (this.flow?.integrations?.googleWorkspace?.sheets?.enabled) {
                const sheetsInitialized = await this.initializeGoogleSheets();
                if (!sheetsInitialized) {
                    console.error('Failed to initialize Google Sheets');
                }
            }

            // Initialize Google Calendar
            if (this.flow?.integrations?.googleWorkspace?.calendar?.enabled) {
                const calendarInitialized = await this.initializeGoogleCalendar();
                if (!calendarInitialized) {
                    console.error('Failed to initialize Google Calendar');
                }
            }

            // Initialize iPlan
            if (this.flow?.integrations?.iPlan?.enabled) {
                const iPlanInitialized = await this.initializeIPlan();
                if (!iPlanInitialized) {
                    console.error('Failed to initialize iPlan');
                }
            }

            // Initialize Reminder Service
            if (this.flow?.integrations?.reminders?.enabled) {
                const reminderServiceInitialized = await this.initializeReminderService();
                if (!reminderServiceInitialized) {
                    console.error('Failed to initialize Reminder Service');
                }
            }

            return true;
        } catch (error) {
            console.error('Error initializing IntegrationManager:', error);
            return false;
        }
    }

    async handleMeetingScheduled(data, currentLead) {
        try {
            const meetingId = `${data.phone}_${data.meeting_date}_${data.meeting_time}`;

            if (this.processingMeetings.has(meetingId)) {
                console.error(`Duplicate meeting processing prevented: ${meetingId}`);
                return false;
            }

            this.processingMeetings.add(meetingId);

            if (currentLead?.calendarEventId) {
                console.error(`Meeting already exists with calendar event ${currentLead.calendarEventId}`);
                this.processingMeetings.delete(meetingId);
                return false;
            }

            const existingMeeting = await this.googleSheetsService?.findExistingMeeting(data.phone);
            if (existingMeeting) {
                console.error(`Phone ${data.phone} already has a scheduled appointment in Google Sheets`);
                this.processingMeetings.delete(meetingId);
                return false;
            }

            const existingEvent = await this.googleCalendarService?.findExistingEvent(data);
            if (existingEvent) {
                console.error(`Event already exists in calendar for ${data.full_name} on ${data.meeting_date} ${data.meeting_time}`);
                this.processingMeetings.delete(meetingId);
                return false;
            }

            // Add to Google Sheets
            if (this.googleSheetsService) {
                await this.googleSheetsService.addMeeting(data);
            }

            // Add to Google Calendar
            let calendarEventId = null;
            if (this.googleCalendarService) {
                const calendarResult = await this.googleCalendarService.createEvent(data);
                if (calendarResult.success) {
                    calendarEventId = calendarResult.eventId;
                }
            }

            // Add to iPlan
            if (this.iPlanService) {
                await this.iPlanService.createMeeting(data);
                await this.iPlanService.createContact(data);
            }

            // Send notifications
            const settings = this.flow?.integrations?.notifications?.meetingScheduled;
            if (settings?.enabled && settings?.messageTemplateFile) {
                const messageContent = await this.loadMessageTemplate(settings.messageTemplateFile);

                if (messageContent && this.whatsappClient) {
                    let formattedMessage = messageContent;
                    
                    let mobilityDisplay = data.mobility || '';
                    if (data.mobility === 'car') {
                        mobilityDisplay = 'רכב';
                    } else if (data.mobility === 'bike') {
                        mobilityDisplay = 'אופנוע';
                    } else if (data.mobility === 'none') {
                        mobilityDisplay = 'לא נייד/ת';
                    }

                    let phoneDisplay = data.phone || '';
                    if (phoneDisplay.startsWith('972') && phoneDisplay.length === 12) {
                        phoneDisplay = '0' + phoneDisplay.substring(3);
                    } else if (phoneDisplay.startsWith('+972') && phoneDisplay.length === 13) {
                        phoneDisplay = '0' + phoneDisplay.substring(4);
                    }

                    const placeholders = {
                        '{full_name}': data.full_name || '',
                        '{city_name}': data.city_name || '',
                        '{phone}': phoneDisplay,
                        '{mobility}': mobilityDisplay,
                        '{meeting_date}': data.meeting_date || '',
                        '{meeting_time}': data.meeting_time || ''
                    };

                    for (const placeholder in placeholders) {
                        formattedMessage = formattedMessage.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), placeholders[placeholder]);
                    }
                    
                    let groupIds = [];
                    try {
                        const groupIdsPath = path.join(this.dataPath, 'group_ids.json');
                        const groupIdsContent = await fs.readFile(groupIdsPath, 'utf8');
                        groupIds = JSON.parse(groupIdsContent);
                    } catch (error) {
                        console.error('Error loading group IDs:', error);
                    }

                    for (const recipient of settings.recipients) {
                        let targetId = recipient;
                        if (!recipient.includes('@g.us') && !recipient.includes('@c.us')) {
                            const foundGroup = groupIds.find(g => g.name === recipient);
                            if (foundGroup) {
                                targetId = foundGroup.id;
                            } else {
                                console.error(`Group name '${recipient}' not found in loaded group IDs`);
                                continue;
                            }
                        }

                        try {
                            await this.whatsappClient.sendMessage(targetId, formattedMessage);
                        } catch (e) {
                            console.error(`Failed to send meeting notification to ${targetId}:`, e);
                        }
                    }
                }
            }

            this.processingMeetings.delete(meetingId);
            return true;
        } catch (error) {
            this.processingMeetings.delete(meetingId);
            console.error('Failed to handle meeting scheduled:', error);
            return false;
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