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
        console.log('🔍 _getSheetsConfig called with:', {
            isNewStructure,
            hasIntegrationsConfig: !!integrationsConfig,
            hasGoogleWorkspace: !!integrationsConfig?.googleWorkspace,
            hasSheets: !!integrationsConfig?.googleWorkspace?.sheets,
            hasOldConfig: !!this.config.googleSheet
        });
        
        if (isNewStructure && integrationsConfig?.googleWorkspace?.sheets) {
            const config = integrationsConfig.googleWorkspace.sheets;
            console.log('📋 Using new structure sheets config:', config);
            return config;
        }
        // Fallback to old structure
        const oldConfig = this.config.googleSheet;
        console.log('📋 Using old structure sheets config:', oldConfig);
        return oldConfig;
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
            console.log('🔍 IntegrationManager: Google Sheets config:', {
                exists: !!sheetsConfig,
                enabled: sheetsConfig?.enabled,
                hasColumns: !!sheetsConfig?.columns,
                columnsCount: sheetsConfig?.columns ? Object.keys(sheetsConfig.columns).length : 0,
                structure: structureType
            });
            
            if (sheetsConfig?.enabled) {
                const sheetsService = new GoogleSheetsService(sheetsConfig);
                const initialized = await sheetsService.initialize();
                if (initialized) {
                    this.services.sheets = sheetsService;
                    console.log('✅ IntegrationManager: Google Sheets initialized');
                } else {
                    console.error('❌ IntegrationManager: Google Sheets failed to initialize');
                }
            } else {
                console.log('ℹ️ IntegrationManager: Google Sheets not enabled or config missing');
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

            // Initialize ReminderService if configured (but don't start it yet)
            const remindersConfig = this._getRemindersConfig(isNewStructure, integrationsConfig);
            if (remindersConfig && remindersConfig.enabled && remindersConfig.configurations && remindersConfig.configurations.length > 0) {
                // Store the config to initialize ReminderService later
                this.reminderServiceConfig = remindersConfig;
                console.log('✅ IntegrationManager: Reminder Service config prepared (will start after LeadsManager is ready)');
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

    async startReminderService() {
        if (this.reminderServiceConfig && this.flowEngine?.leadsManager && this.whatsappClient) {
            const messagesBasePath = path.join(__dirname, '..', '..', 'data', 'messages');
            const reminderService = new ReminderService(
                this.reminderServiceConfig,
                this.flowEngine.leadsManager,
                this.whatsappClient,
                messagesBasePath,
                this
            );
            reminderService.start();
            this.services.reminders = reminderService;
            console.log('✅ IntegrationManager: Reminder Service started after LeadsManager initialization');
            return true;
        }
        return false;
    }



    async handleCalendarIntegration(meetingData, currentLead) {
        try {
            if (this.services.calendar) {
                console.log('[IntegrationManager] 🔄 Creating Google Calendar event...');
                console.log('[IntegrationManager] 📊 Meeting data received:', meetingData);
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

    async handleStepSpecificCalendarIntegration(meetingData, currentLead, stepCalendarConfig) {
        console.log('[IntegrationManager] 🔄 Using step-specific Google Calendar configuration...');
        console.log('[IntegrationManager] 🔄 Processing step-specific Google Calendar integration...');
        
        console.log('[IntegrationManager] 🔍 Processing calendar config:', {
            stepCalendarConfig: stepCalendarConfig,
            leadData: currentLead?.data,
            meetingData: meetingData
        });

        try {
            // Validate step configuration
            if (!stepCalendarConfig?.calendarId && !stepCalendarConfig?.credentialsPath) {
                throw new Error('Google Calendar configuration incomplete - missing calendarId or credentialsPath');
            }

            // Initialize step-specific Google Calendar service
            const GoogleCalendarService = require('./google/GoogleCalendarService');
            const stepCalendarService = new GoogleCalendarService({
                calendarId: stepCalendarConfig.calendarId || 'primary',
                credentialsPath: stepCalendarConfig.credentialsPath,
                preventDuplicates: stepCalendarConfig.preventDuplicates || false,
                sendNotifications: stepCalendarConfig.sendNotifications !== false,
                useQuickAdd: stepCalendarConfig.useQuickAdd || false,
                maxAttendees: stepCalendarConfig.maxAttendees || 50,
                colorId: stepCalendarConfig.colorId || 1
            });

            const initialized = await stepCalendarService.initialize();
            if (!initialized) {
                throw new Error('Failed to initialize step-specific Google Calendar service');
            }

            // Process title and description with variables
            const processedTitle = this._replaceVariables(stepCalendarConfig.title || 'פגישה חדשה', currentLead, meetingData);
            const processedDescription = this._replaceVariables(stepCalendarConfig.description || '', currentLead, meetingData);

            // Prepare event data for calendar service
            const eventData = {
                ...meetingData,
                title: processedTitle,
                description: processedDescription,
                maxAttendees: stepCalendarConfig.maxAttendees || 50,
                colorId: stepCalendarConfig.colorId || 1,
                sendNotifications: stepCalendarConfig.sendNotifications !== false
            };

            console.log('[IntegrationManager] Creating calendar event:', {
                title: processedTitle,
                description: processedDescription,
                calendarId: stepCalendarConfig.calendarId || 'primary',
                meetingData: meetingData
            });

            const result = await stepCalendarService.createEvent(eventData);
            
            if (result && result.success) {
                console.log('[IntegrationManager] ✅ Successfully created step-specific Google Calendar event');
                return { success: true, result: result };
            } else {
                throw new Error('Failed to create calendar event');
            }

        } catch (error) {
            console.error('[IntegrationManager] ❌ Step-specific Calendar integration error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleSheetsIntegration(meetingData, currentLead, stepSheetsConfig = null) {
        try {
            // Use step-specific configuration if provided, otherwise use global service
            if (stepSheetsConfig) {
                console.log('[IntegrationManager] 🔄 Using step-specific Google Sheets configuration...');
                return await this.handleStepSpecificSheetsIntegration(meetingData, currentLead, stepSheetsConfig);
            }
            
            // Fallback to global sheets service
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

    async handleStepSpecificSheetsIntegration(meetingData, currentLead, stepSheetsConfig) {
        try {
            console.log('[IntegrationManager] 🔄 Processing step-specific Google Sheets integration...');
            
            // Validate step configuration
            if (!stepSheetsConfig?.sheetId) {
                throw new Error('Google Sheets sheetId not configured for this step');
            }

            if (!stepSheetsConfig?.columns || !Array.isArray(stepSheetsConfig.columns)) {
                throw new Error('Google Sheets columns not configured for this step');
            }

            // Create a dynamic sheets service for this specific step
            const GoogleSheetsService = require('./google/sheets');
            
            // Map array-based columns to object-based format expected by GoogleSheetsService
            const columnsMapping = {};
            
            // Map columns configuration (columns array contains values for A, B, C...)
            const columnData = [];
            const columnColors = [];
            stepSheetsConfig.columns.forEach((columnItem, index) => {
                let columnValue, backgroundColor;
                
                // Handle both string and object formats
                if (typeof columnItem === 'object') {
                    columnValue = columnItem.value;
                    backgroundColor = columnItem.backgroundColor;
                } else {
                    columnValue = columnItem;
                    backgroundColor = '#ffffff';
                }
                
                if (columnValue && columnValue.trim()) {
                    console.log(`[IntegrationManager] Processing column ${index}: "${columnValue}"`);
                    // Replace variables in column value using lead data
                    const processedValue = this._replaceVariables(columnValue, currentLead, meetingData);
                    console.log(`[IntegrationManager] Column ${index} processed: "${columnValue}" → "${processedValue}"`);
                    columnData[index] = processedValue;
                    columnColors[index] = backgroundColor;
                    // Create mapping for GoogleSheetsService compatibility
                    columnsMapping[`col_${index}`] = index + 1;
                }
            });

            // Create temporary config for this step's sheets integration
            const sheetsServiceConfig = {
                enabled: true,
                sheetId: stepSheetsConfig.sheetId,
                columns: columnsMapping,
                worksheetName: stepSheetsConfig.worksheetName || 'Sheet1',
                credentialsPath: stepSheetsConfig.credentialsPath || path.join(__dirname, 'credentials', 'google-sheets-credentials.json'),
                preventDuplicates: stepSheetsConfig.preventDuplicates || false,
                updateExistingRows: stepSheetsConfig.updateExistingRows || false,
                insertToNextRow: stepSheetsConfig.insertToNextRow !== false, // Default to true
                enableSorting: stepSheetsConfig.enableSorting || false,
                sortColumn: stepSheetsConfig.sortColumn || 1,
                sortType: stepSheetsConfig.sortType || 'date',
                sortDirection: stepSheetsConfig.sortDirection || 'asc'
            };

            console.log('[IntegrationManager] Column data after processing:', columnData);
            console.log('[IntegrationManager] Creating Google Sheets service with config:', {
                sheetId: sheetsServiceConfig.sheetId,
                columnsCount: Object.keys(sheetsServiceConfig.columns).length,
                worksheetName: sheetsServiceConfig.worksheetName,
                dataPreview: columnData.slice(0, 3)
            });

            // Create and initialize sheets service for this step
            const stepSheetsService = new GoogleSheetsService(sheetsServiceConfig);
            const initialized = await stepSheetsService.initialize();
            
            if (!initialized) {
                throw new Error('Failed to initialize step-specific Google Sheets service');
            }

            // Prepare data for sheets service
            const dataForSheets = {};
            columnData.forEach((value, index) => {
                if (value !== undefined) {
                    dataForSheets[`col_${index}`] = value;
                }
            });

            console.log('[IntegrationManager] Adding row to Google Sheets:', dataForSheets);
            console.log('[IntegrationManager] Column colors for sheets:', columnColors);

            const result = await stepSheetsService.addRow(dataForSheets, columnColors);
            
            if (result) {
                console.log('[IntegrationManager] ✅ Successfully added data to step-specific Google Sheets');
                return { success: true, result: result };
            } else {
                throw new Error('Failed to add data to Google Sheets');
            }

        } catch (error) {
            console.error('[IntegrationManager] ❌ Step-specific Sheets integration error:', error);
            return { success: false, error: error.message };
        }
    }

    _replaceVariables(template, lead, meetingData) {
        if (!template) return '';
        
        const leadData = lead?.data || {};
        
        // Extract phone from multiple possible sources - fix phone extraction
        let phoneNumber = '';
        if (lead?.id) {
            phoneNumber = this._formatPhone(lead.id);
        } else if (meetingData?.phone) {
            phoneNumber = this._formatPhone(meetingData.phone);
        }
        
        const variables = {
            full_name: leadData.full_name || meetingData?.full_name || '',
            phone: phoneNumber,
            meeting_date: leadData.meeting_date || meetingData?.meeting_date || '',
            meeting_time: leadData.meeting_time || meetingData?.meeting_time || '',
            city_name: leadData.city_name || meetingData?.city_name || '',
            mobility: leadData.mobility || meetingData?.mobility || '',
            display_name: leadData.display_name || leadData.full_name || meetingData?.full_name || '',
            timestamp: new Date().toISOString(),
            ...leadData // Include any additional lead data
        };

        console.log(`[IntegrationManager] _replaceVariables DEBUG:`, {
            template,
            variables,
            leadId: lead?.id
        });

        let result = template;
        
        // Check if template is just a variable name without braces
        if (variables.hasOwnProperty(template)) {
            const value = variables[template] || '';
            console.log(`[IntegrationManager] Variable found directly: "${template}" → "${value}"`);
            console.log(`[IntegrationManager] Final result: "${template}" → "${value}"`);
            return value;
        }
        
        // Replace variables with braces
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            const oldResult = result;
            result = result.replace(regex, variables[key] || '');
            if (oldResult !== result) {
                console.log(`[IntegrationManager] Replaced {${key}} with "${variables[key]}" in "${oldResult}" → "${result}"`);
            }
        });

        console.log(`[IntegrationManager] Final result: "${template}" → "${result}"`);
        return result;
    }

    // Helper function to format phone numbers consistently
    _formatPhone(phone) {
        if (!phone || typeof phone !== 'string') return '';
        
        let cleaned = phone.replace('@c.us', '').replace('@g.us', '');
        
        // Remove 972 prefix if exists
        if (cleaned.startsWith('972')) {
            cleaned = cleaned.substring(3);
        }
        
        return cleaned;
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
            
            // Parse recipients - they might be comma-separated
            let recipientsList = [];
            if (typeof notificationsConfig.recipients === 'string') {
                recipientsList = notificationsConfig.recipients.split(',').map(r => r.trim()).filter(r => r);
            } else if (Array.isArray(notificationsConfig.recipients)) {
                recipientsList = notificationsConfig.recipients;
            } else {
                recipientsList = [notificationsConfig.recipients];
            }
            
            // Load the notification message template
            let messageTemplate = '';
            if (notificationsConfig.messageTemplateFile) {
                const fs = require('fs');
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
            for (const recipient of recipientsList) {
                try {
                    // Format the recipient number properly
                    const formattedRecipient = this._formatPhoneNumber(recipient.trim());
                    console.log(`[IntegrationManager] 📤 Sending notification to ${formattedRecipient}...`);
                    await this.whatsappClient.sendMessage(formattedRecipient, formattedMessage);
                    results.push({ recipient: formattedRecipient, success: true });
                    console.log(`[IntegrationManager] ✅ Notification sent to ${formattedRecipient}`);
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

    /**
     * Format phone number for WhatsApp
     * Handles both individual contacts and groups
     * @param {string} phoneNumber - Raw phone number or group identifier
     * @returns {string} - Formatted phone number for WhatsApp
     */
    _formatPhoneNumber(phoneNumber) {
        if (!phoneNumber) return phoneNumber;
        
        // Remove all spaces and special characters except numbers, @, -, and .
        let cleaned = phoneNumber.replace(/[^\d@\-\.]/g, '');
        
        // If it contains @ or ends with specific patterns, it's likely already formatted
        if (cleaned.includes('@') || cleaned.includes('-group') || cleaned.includes('.us')) {
            return cleaned;
        }
        
        // If it's a pure number, format as individual contact
        if (/^\d+$/.test(cleaned)) {
            // Remove leading + if exists in original
            if (phoneNumber.startsWith('+')) {
                cleaned = phoneNumber.replace(/[^\d]/g, '');
            }
            
            // Add @c.us for individual contacts
            return `${cleaned}@c.us`;
        }
        
        // If it contains 'group' keyword, format as group
        if (phoneNumber.toLowerCase().includes('group')) {
            // Extract the number part
            const numberPart = cleaned.replace(/[^\d]/g, '');
            return `${numberPart}@g.us`;
        }
        
        // Default: assume it's an individual contact
        return `${cleaned}@c.us`;
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

    async sendStepNotification(meetingData, notificationConfig) {
        if (!notificationConfig || !notificationConfig.enabled) {
            console.log('[IntegrationManager] Step notifications not enabled');
            return false;
        }

        try {
            console.log('[IntegrationManager] 📢 Sending step-level notification...');
            
            const recipients = notificationConfig.recipients;
            let message = notificationConfig.message;

            // Replace placeholders in the message
            if (message) {
                for (const [key, value] of Object.entries(meetingData)) {
                    const placeholder = `{${key}}`;
                    message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), value || '');
                }
            }

            if (this.whatsappClient && recipients && message) {
                console.log(`[IntegrationManager] Sending notification to: ${recipients}`);
                console.log(`[IntegrationManager] Notification message: ${message}`);
                
                await this.whatsappClient.sendMessage(recipients, message);
                console.log('[IntegrationManager] ✅ Step notification sent successfully');
                return true;
            } else {
                console.log('[IntegrationManager] ❌ Missing WhatsApp client, recipients, or message for step notification');
                return false;
            }

        } catch (error) {
            console.error('[IntegrationManager] ❌ Error sending step notification:', error);
            return false;
        }
    }
}

module.exports = IntegrationManager; 