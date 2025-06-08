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
        try {
            // Create unique meeting ID for duplicate prevention
            const meetingId = `${data.phone}-${data.meeting_date}-${data.meeting_time}`;
            
            // Skip if this meeting is already being processed
            if (this.processingMeetings.has(meetingId)) {
                console.log(`⚠️ DUPLICATE PREVENTED: Meeting ${meetingId} is already being processed!`);
                return true;
            }
            
            // COMPREHENSIVE duplicate prevention checks
            
            // Check 1: Calendar event already exists for this exact meeting
            if (currentLead?.calendarEventId && 
                currentLead?.meeting?.date === data.meeting_date && 
                currentLead?.meeting?.time === data.meeting_time &&
                currentLead?.is_schedule === true) {
                console.log(`⚠️ DUPLICATE PREVENTED: Meeting already exists with calendar event ${currentLead.calendarEventId}!`);
                return true;
            }

            // Check 2: Phone number already has a scheduled appointment in Google Sheets
            if (this.services.sheets) {
                const hasExistingAppointment = await this.services.sheets.hasScheduledAppointment(data.phone, 'futureAndPresent');
                if (hasExistingAppointment) {
                    console.log(`⚠️ DUPLICATE PREVENTED: Phone ${data.phone} already has a scheduled appointment in Google Sheets!`);
                    return true;
                }
            }

            // Check 3: Same event already exists in Google Calendar with same details
            if (this.services.calendar) {
                const [day, month, year] = data.meeting_date.split('/');
                const [hour, minute] = data.meeting_time.split(':');
                const startDateTime = new Date(year, month - 1, day, hour, minute);
                const endDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000)); // 1 hour duration
                
                try {
                    const existingEvents = await this.services.calendar.calendar.events.list({
                        calendarId: this.services.calendar.config.calendarId,
                        timeMin: startDateTime.toISOString(),
                        timeMax: endDateTime.toISOString(),
                        singleEvents: true,
                        orderBy: 'startTime'
                    });

                    const events = existingEvents.data.items || [];
                    const expectedTitle = this.services.calendar.replacePlaceholders(this.services.calendar.config.eventTitle, data);
                    
                    for (const event of events) {
                        if (event.summary === expectedTitle && event.description && event.description.includes(data.phone)) {
                            console.log(`⚠️ DUPLICATE PREVENTED: Event already exists in calendar for ${data.full_name} on ${data.meeting_date} ${data.meeting_time}!`);
                            return true;
                        }
                    }
                } catch (error) {
                    console.error('Error checking for duplicate calendar events:', error.message);
                }
            }

            // Add to processing set
            this.processingMeetings.add(meetingId);
            console.log(`✅ Processing meeting: ${meetingId}`);
            
            // Clean up processing flag after 30 seconds
            setTimeout(() => {
                this.processingMeetings.delete(meetingId);
            }, 30000);

            // Add to Google Sheets if enabled
            if (this.services.sheets) {
                const integrationData = {
                    meeting_date: data.meeting_date,
                    meeting_time: data.meeting_time,
                    full_name: data.full_name,
                    city_name: data.city_name,
                    phone: data.phone,
                    mobility: data.mobility
                };

                // Add any additional fields from lead data that match column configuration
                if (this.services.sheets.config.columns) {
                    const columns = this.services.sheets.config.columns;
                    for (const [key, _] of Object.entries(columns)) {
                        // For fields that are at the root of the lead object
                        if (key in currentLead) {
                            integrationData[key] = currentLead[key];
                        }
                        // For fields that are in the data object
                        else if (currentLead?.data && key in currentLead.data) {
                            integrationData[key] = currentLead.data[key];
                        }
                        // For fields that are defined in the flow but not yet in the data
                        else if (this.flowKeys.includes(key)) {
                            integrationData[key] = null; // Add placeholder for future data
                        }
                    }
                }

                const sheetsResult = await this.services.sheets.addRow(integrationData);
                if (sheetsResult) {
                    console.log(`📊 IntegrationManager: נתונים נוספו/עודכנו בגוגל שיטס עבור ${data.full_name}`);
                }
            }

            // Add to Google Calendar if enabled
            if (this.services.calendar) {
                const calendarResult = await this.services.calendar.createEvent(data);
                if (calendarResult.success) {
                    if (calendarResult.wasExisting) {
                        console.log(`📅 IntegrationManager: אירוע קיים נמצא בקלנדר עבור ${data.full_name}`);
                    } else {
                        console.log(`📅 IntegrationManager: אירוע חדש נוצר בקלנדר עבור ${data.full_name}`);
                    }
                    
                    // Store the calendar event ID in the lead for future reference
                    if (this.flowEngine?.leadsManager) {
                        // Find the user ID more reliably
                        const userId = data.phone + '@c.us'; // Reconstruct from phone number
                        
                        // Validate the userId before saving
                        if (userId && userId !== 'undefined@c.us' && userId !== 'status@broadcast' && userId.includes('@c.us')) {
                            await this.flowEngine.leadsManager.createOrUpdateLead(userId, {
                                calendarEventId: calendarResult.eventId,
                                calendarEventLink: calendarResult.eventLink
                            });
                        } else {
                            console.warn(`IntegrationManager: Invalid userId for calendar event storage: ${userId}`);
                        }
                    }
                } else {
                    console.error('IntegrationManager: Failed to create calendar event:', calendarResult.error);
                }
            }

            // Add to iPlan if enabled
            if (this.services.iPlan) {
                const iPlanResult = await this.services.iPlan.createMeeting(data);
                if (iPlanResult.success) {
                    console.log(`📋 IntegrationManager: Meeting created in iPlan for ${data.full_name}`);
                    
                    // Store the iPlan meeting ID in the lead for future reference
                    if (this.flowEngine?.leadsManager) {
                        const userId = data.phone + '@c.us';
                        if (userId && userId !== 'undefined@c.us' && userId !== 'status@broadcast' && userId.includes('@c.us')) {
                            await this.flowEngine.leadsManager.createOrUpdateLead(userId, {
                                iPlanMeetingId: iPlanResult.meetingId
                            });
                        }
                    }

                    // Create contact in iPlan if enabled
                    if (this.services.iPlan.config.syncContacts) {
                        const contactResult = await this.services.iPlan.createContact(data);
                        if (contactResult.success) {
                            console.log(`📋 IntegrationManager: Contact created in iPlan for ${data.full_name}`);
                        }
                    }
                } else {
                    console.error('IntegrationManager: Failed to create iPlan meeting:', iPlanResult.error);
                }
            }

            // --- הוספת לוגיקה לשליחת הודעת עדכון על פגישה ---
            const { config: integrationsConfig, isNew: isNewStructure } = this._getIntegrationsConfig();
            const notificationsConfig = this._getNotificationsConfig(isNewStructure, integrationsConfig);
            
            if (notificationsConfig && 
                notificationsConfig.enabled &&
                notificationsConfig.recipients &&
                notificationsConfig.recipients.length > 0 &&
                notificationsConfig.messageTemplateFile) {

                const settings = notificationsConfig;
                let messageContent = null;
                try {
                    // הנתיב לקובץ ההודעות הוא בתוך תיקיית ההודעות שהוגדרה ל-FlowEngine
                    const templateFileName = settings.messageTemplateFile;
                    
                    if (this.flowEngine && typeof this.flowEngine.loadMessageFile === 'function') {
                        messageContent = await this.flowEngine.loadMessageFile(templateFileName);
                        if (messageContent && messageContent.startsWith(' #1מצטערים')) { // בדיקה אם טעינת הקובץ נכשלה
                            console.error(`IntegrationManager: Failed to load meeting notification template '${templateFileName}' via flowEngine (returned error message).`);
                            messageContent = null;
                        }
                    } else if (this.flowEngine && this.flowEngine.messagesPath) {
                        // Fallback אם flowEngine.loadMessageFile לא זמין אבל messagesPath כן
                        const fs = require('fs').promises; // ייבוא מקומי של fs
                        const templatePath = path.join(this.flowEngine.messagesPath, templateFileName);
                        try {
                            messageContent = await fs.readFile(templatePath, 'utf8');
                        } catch (fileReadError) {
                            console.error(`IntegrationManager: Error directly reading meeting notification template '${templatePath}':`, fileReadError);
                            messageContent = null;
                        }
                    } else {
                        console.error('IntegrationManager: Cannot load message template - flowEngine.loadMessageFile and flowEngine.messagesPath are unavailable.');
                    }

                } catch (e) {
                    console.error(`IntegrationManager: General error loading meeting notification template '${settings.messageTemplateFile}':`, e);
                    messageContent = null; // ודא ש-messageContent הוא null במקרה של שגיאה כללית
                }

                if (messageContent && this.whatsappClient) {
                    let formattedMessage = messageContent;
                    
                    // עיצוב ניידות
                    let mobilityDisplay = data.mobility || '';
                    if (data.mobility === 'car') {
                        mobilityDisplay = 'רכב';
                    } else if (data.mobility === 'bike') {
                        mobilityDisplay = 'אופנוע';
                    } else if (data.mobility === 'none') {
                        mobilityDisplay = 'לא נייד/ת'; // או כל טקסט אחר שתבחר
                    }

                    // עיצוב מספר טלפון
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
                        // הוסף placeholders נוספים לפי הצורך מהאובייקט data
                    };

                    for (const placeholder in placeholders) {
                        formattedMessage = formattedMessage.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), placeholders[placeholder]);
                    }
                    
                    let groupIds = [];
                    if (this.services.groupFetcher && typeof this.services.groupFetcher.loadGroupIds === 'function') {
                        groupIds = await this.services.groupFetcher.loadGroupIds();
                    } else {
                        // Fallback: נסה לקרוא ישירות מהקובץ אם השירות לא נטען כראוי
                        try {
                            const fs = require('fs').promises; // ייבוא מקומי של fs
                            const groupsFilePath = path.join(this.dataPath, 'group_ids.json');
                            const groupsData = await fs.readFile(groupsFilePath, 'utf8');
                            groupIds = JSON.parse(groupsData);
                        } catch (e) {
                            console.warn('IntegrationManager: Could not load group_ids.json for name to ID mapping in meeting notifications.', e);
                        }
                    }

                    for (const recipient of settings.recipients) {
                        let targetId = recipient;
                        // בדוק אם ה-recipient הוא שם קבוצה ולא ID
                        if (!recipient.includes('@g.us') && !recipient.includes('@c.us')) {
                            const foundGroup = groupIds.find(g => g.name === recipient);
                            if (foundGroup) {
                                targetId = foundGroup.id;
                            } else {
                                console.warn(`IntegrationManager: Group name '${recipient}' not found in loaded group IDs for meeting notification. Skipping.`);
                                continue;
                            }
                        }

                        try {
                            await this.whatsappClient.sendMessage(targetId, formattedMessage);
                            // console.log(`IntegrationManager: Sent meeting scheduled notification to ${targetId}`);
                        } catch (e) {
                            console.error(`IntegrationManager: Failed to send meeting scheduled notification to ${targetId}:`, e);
                        }
                    }
                }
            }
            // --- סוף לוגיקה לשליחת הודעת עדכון ---

            // Clean up processing flag on success
            this.processingMeetings.delete(meetingId);
            
            return true;
        } catch (error) {
            // Clean up processing flag on error
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