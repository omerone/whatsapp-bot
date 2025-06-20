const fs = require('fs');
const path = require('path');

const DEFAULT_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

class ReminderService {
    constructor(remindersSettings, leadsManager, whatsappClient, messagesBasePath, integrationManager) {
        this.remindersEnabled = remindersSettings && remindersSettings.enabled !== undefined ? remindersSettings.enabled : false;
        this.reminderConfigurations = remindersSettings && remindersSettings.configurations ? remindersSettings.configurations : [];
        this.leadsManager = leadsManager;
        this.whatsappClient = whatsappClient;
        this.messagesBasePath = messagesBasePath;
        this.integrationManager = integrationManager;
        this.intervalId = null;

        if (!this.leadsManager) {
            console.error('ReminderService: LeadsManager is required.');
            throw new Error('LeadsManager is required for ReminderService.');
        }
        if (!this.whatsappClient) {
            console.error('ReminderService: WhatsApp client is required.');
            throw new Error('WhatsApp client is required for ReminderService.');
        }
        if (!this.messagesBasePath) {
            console.warn('ReminderService: messagesBasePath is not provided. Message loading might fail.');
        }
        if (!this.integrationManager) {
            console.error('ReminderService: IntegrationManager is required.');
            throw new Error('IntegrationManager is required for ReminderService.');
        }
        if (!this.integrationManager.services || !this.integrationManager.services.sheets) {
            console.warn('ReminderService: GoogleSheetService via IntegrationManager might not be available. Reminder functionality relying on Sheets may fail.');
        }
    }

    start(checkInterval = DEFAULT_CHECK_INTERVAL_MS) {
        if (this.intervalId) {
            console.warn('ReminderService is already running.');
            return;
        }
        if (!this.remindersEnabled) {
            console.log('ReminderService: Reminders are globally disabled.');
            return;
        }
        if (this.reminderConfigurations.length === 0) {
            console.log('ReminderService: No reminders configured or configurations array is empty.');
            return;
        }
        console.log(`ReminderService started. Checking every ${checkInterval / 1000 / 60} minutes.`);
        this.intervalId = setInterval(async () => {
            try {
                await this.checkAndSendReminders();
            } catch (error) {
                console.error('ReminderService: Error during checkAndSendReminders:', error);
            }
        }, checkInterval);
        // Optionally, run once on start
        this.checkAndSendReminders().catch(error => console.error('ReminderService: Initial check failed:', error));
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('ReminderService stopped.');
        }
    }

    async checkAndSendReminders() {
        if (!this.remindersEnabled) {
            return;
        }

        // Check step-level reminders (always check these)
        await this.checkStepReminders();

        // Check global reminder configurations
        if (!this.reminderConfigurations || this.reminderConfigurations.length === 0) {
            return;
        }

        const activeSources = new Set();
        this.reminderConfigurations.forEach(rc => {
            if (rc.enabled && rc.source) {
                activeSources.add(rc.source);
            }
        });

        if (activeSources.has('google_sheet')) {
            await this._fetchAndProcessGoogleSheetReminders();
        }
        if (activeSources.has('iplan')) {
            await this._fetchAndProcessIPlanReminders();
        }
        // Add other sources here as they are implemented
    }

    async _prepareLeadDataFromAppointment(apptData, sourceName) {
        if (!apptData.phone || !apptData.meeting_date || !apptData.meeting_time) {
            console.warn(`ReminderService: Skipping appointment from ${sourceName} due to missing phone, date, or time.`, apptData);
            return null;
        }

        // Format phone number to 972XXXXXXXXX
        let rawPhone = String(apptData.phone);
        let numericPhone = rawPhone.replace(/\D/g, ''); // Remove non-digits

        if (numericPhone.startsWith('0')) {
            numericPhone = numericPhone.substring(1); // Remove leading 0, e.g., 050 -> 50
        }
        
        // Ensure it has 972 prefix
        if (numericPhone.length === 9 && !numericPhone.startsWith('972')) { // Common Israeli local number like 50XXXXXXX
            numericPhone = '972' + numericPhone;
        } else if (numericPhone.startsWith('972') && numericPhone.length > 12) { // like 972050... remove the 0 after 972
             if (numericPhone.charAt(3) === '0') {
                numericPhone = '972' + numericPhone.substring(4);
             }
        } else if (!numericPhone.startsWith('972')) {
            // If it doesn't start with 972 and isn't a 9-digit local number, this might be an issue or an international number
            // For now, we'll assume we need to prefix if not already prefixed. 
            // More robust international formatting might be needed if you handle non-Israeli numbers.
            numericPhone = '972' + numericPhone; // Fallback, might need refinement for other countries
        }
        
        // Final check for common Israeli number length (972 + 9 digits = 12)
        if (!numericPhone.startsWith('972') || numericPhone.length !== 12) {
             console.warn(`ReminderService: Potentially invalid phone number after formatting from ${sourceName}: ${rawPhone} -> ${numericPhone}. Expected 972XXXXXXXXX.`);
             // We might still try to send if it looks plausible, or return null here.
             // For now, let's allow it to proceed and see if WhatsApp handles it.
        }

        const leadId = `${numericPhone}@c.us`;

        let existingLead = await this.leadsManager.getLead(leadId);
        let leadObject;

        if (!existingLead) {
            leadObject = {
                id: leadId, // Important for consistency if leadsManager doesn't set it from key
                blocked: false,
                is_schedule: true,
                meeting: {
                    date: apptData.meeting_date,
                    time: apptData.meeting_time,
                    reminders_sent: []
                },
                data: {
                    full_name: apptData.full_name || '',
                    city_name: apptData.city_name || '',
                    mobility: apptData.mobility || ''
                    // Add other relevant fields from apptData if available and mapped
                },
                current_step: null,
                relevant: true,
                last_interaction: this.leadsManager.formatDate(new Date()),
                date_and_time_conversation_started: this.leadsManager.formatDate(new Date()),
                blocked_reason: null,
                last_sent_message: null
            };
        } else {
            leadObject = { ...existingLead, id: leadId }; // Ensure id is present

            if (leadObject.blocked) {
                return null; 
            }

            if (!leadObject.meeting) leadObject.meeting = {};
            // Update lead data instead of meeting object
            leadObject.data = leadObject.data || {};
            leadObject.data.meeting_date = apptData.meeting_date;
            leadObject.data.meeting_time = apptData.meeting_time;
            if (!leadObject.meeting.reminders_sent) leadObject.meeting.reminders_sent = [];
            leadObject.is_schedule = true;

            if (!leadObject.data) leadObject.data = {};
            if (apptData.full_name) leadObject.data.full_name = apptData.full_name;
            if (apptData.city_name) leadObject.data.city_name = apptData.city_name;
            if (apptData.mobility) leadObject.data.mobility = apptData.mobility;
        }
        return leadObject;
    }

    async _sendReminderAndUpdateLead(leadData, reminderConfig, messageContent) {
        const leadId = leadData.id; // Assumes leadData.id is set by _prepareLeadDataFromAppointment
        if (!leadId) {
            console.error('ReminderService: _sendReminderAndUpdateLead called with leadData missing an id.', leadData);
            return;
        }
        try {
            const formattedMessage = this._formatMessage(messageContent, leadData);
            
            // Check client state before sending
            let clientState = null;
            try {
                clientState = await this.whatsappClient.getState();
            } catch (stateError) {
                console.error(`ReminderService: Error getting WhatsApp client state for ${leadId}:`, stateError);
            }

            await this.whatsappClient.sendMessage(leadId, formattedMessage);
            
            // Ensure reminders_sent is an array
            if (!leadData.meeting) leadData.meeting = {};
            if (!Array.isArray(leadData.meeting.reminders_sent)) {
                leadData.meeting.reminders_sent = [];
            }
            leadData.meeting.reminders_sent.push(reminderConfig.id);
            leadData.last_interaction = this.leadsManager.formatDate(new Date());
            
            // Prepare data for leadsManager, some managers might not want the 'id' field within the object itself.
            const { id, ...dataToSave } = leadData;
            await this.leadsManager.createOrUpdateLead(leadId, dataToSave);
        } catch (error) {
            console.error(`ReminderService: Error in _sendReminderAndUpdateLead for reminder ${reminderConfig.id} to lead ${leadId}:`, error);
        }
    }

    async _fetchAndProcessGoogleSheetReminders() {
        if (!this.integrationManager?.services?.sheets) {
            console.warn('ReminderService: GoogleSheetService is not available. Skipping Google Sheet reminders.');
            return;
        }

        let appointmentsFromSheet;
        try {
            appointmentsFromSheet = await this.integrationManager.services.sheets.getScheduledAppointmentsForReminders();
        } catch (error) {
            console.error('ReminderService: Error fetching appointments from Google Sheets:', error);
            return;
        }

        if (!appointmentsFromSheet || appointmentsFromSheet.length === 0) {
            return;
        }

        const now = new Date();

        for (const appt of appointmentsFromSheet) {
            const leadData = await this._prepareLeadDataFromAppointment(appt, 'google_sheet');
            if (!leadData) continue;

            const meetingDateTime = this._parseMeetingDateTime(leadData.meeting.date, leadData.meeting.time);
            if (!meetingDateTime) {
                console.warn(`ReminderService: Could not parse meeting date/time for lead ${leadData.id} from google_sheet data: ${leadData.meeting.date}, ${leadData.meeting.time}`);
                continue;
            }

            if (meetingDateTime < now) {
                continue;
            }

            for (const reminderConfig of this.reminderConfigurations) {
                if (!reminderConfig.enabled || reminderConfig.source !== 'google_sheet') {
                    continue;
                }

                if (!leadData.meeting || !Array.isArray(leadData.meeting.reminders_sent) || leadData.meeting.reminders_sent.includes(reminderConfig.id)) {
                    continue; 
                }

                const reminderSendTime = this._calculateReminderSendTime(meetingDateTime, reminderConfig.offset, reminderConfig.timeOfDay);
                if (!reminderSendTime) {
                    console.warn(`ReminderService: Could not calculate send time for reminder ${reminderConfig.id} for lead ${leadData.id}`);
                    continue;
                }

                if (now >= reminderSendTime) {
                    try {
                        const messageContent = await this._loadMessageContent(reminderConfig.messageFile);
                        if (!messageContent) {
                            console.error(`ReminderService: Failed to load message for reminder ${reminderConfig.id}`);
                            continue;
                        }
                        await this._sendReminderAndUpdateLead(leadData, reminderConfig, messageContent);
                    } catch (error) {
                        // Error is logged in _sendReminderAndUpdateLead or _loadMessageContent
                    }
                }
            }
        }
    }

    async _fetchAndProcessIPlanReminders() {
        console.log('ReminderService: _fetchAndProcessIPlanReminders called, but iPlan integration is not yet implemented.');
        // Placeholder for iPlan integration logic
        // 1. Fetch appointments from iPlan via this.integrationManager.services.iplan
        // 2. For each appointment:
        //    a. const leadData = await this._prepareLeadDataFromAppointment(iplanAppt, 'iplan');
        //    b. if (!leadData) continue;
        //    c. const meetingDateTime = this._parseMeetingDateTime(leadData.meeting.date, leadData.meeting.time);
        //    d. if (!meetingDateTime) continue;
        //    e. Loop through this.reminderConfigurations where source is 'iplan' and enabled.
        //    f. Check reminderSendTime, if not sent, etc.
        //    g. const messageContent = await this._loadMessageContent(reminderConfig.messageFile);
        //    h. await this._sendReminderAndUpdateLead(leadData, reminderConfig, messageContent);
        return Promise.resolve();
    }

    _parseMeetingDateTime(dateStr, timeStr) { // dateStr: "DD/MM/YYYY", timeStr: "HH:MM"
        try {
            const [day, month, year] = dateStr.split('/').map(Number);
            const [hours, minutes] = timeStr.split(':').map(Number);
            // JavaScript Date month is 0-indexed
            return new Date(year, month - 1, day, hours, minutes);
        } catch (error) {
            console.error('ReminderService: Error parsing meeting date/time:', dateStr, timeStr, error);
            return null;
        }
    }

    _calculateReminderSendTime(meetingDateTime, offsetStr, timeOfDayStr) {
        let sendTime = new Date(meetingDateTime.getTime());
        const offsetValue = parseInt(offsetStr); // e.g., -24 from "-24h"
        const offsetUnit = offsetStr.slice(-1); // e.g., "h" from "-24h"

        if (isNaN(offsetValue)) return null;

        if (offsetUnit === 'h') {
            sendTime.setHours(sendTime.getHours() + offsetValue);
        } else if (offsetUnit === 'd') { // Though not in current config, good to support
            sendTime.setDate(sendTime.getDate() + offsetValue);
        } else {
            console.warn(`ReminderService: Unsupported offset unit: ${offsetUnit}`);
            return null;
        }

        if (timeOfDayStr) { // e.g., "19:00"
            try {
                const [hours, minutes] = timeOfDayStr.split(':').map(Number);
                sendTime.setHours(hours, minutes, 0, 0); // Set to specific time of day
            } catch (error) {
                console.error('ReminderService: Error parsing timeOfDayStr:', timeOfDayStr, error);
                // Continue without setting time of day if parsing fails
            }
        }
        return sendTime;
    }

    async _loadMessageContent(messageFile) {
        if (!this.messagesBasePath) {
            console.error('ReminderService: messagesBasePath not configured, cannot load message file.');
            return null;
        }
        const filePath = path.join(this.messagesBasePath, messageFile);
        try {
            if (!fs.existsSync(filePath)) {
                 console.error(`ReminderService: Message file not found: ${filePath}`);
                 return null;
            }
            return await fs.promises.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error(`ReminderService: Error reading message file ${filePath}:`, error);
            return null;
        }
    }

    _formatMessage(template, lead) {
        if (!template || !lead) {
            return template || '';
        }

        let formattedMessage = template;

        // Replace meeting data placeholders using lead.data
        if (lead.data) {
            if (lead.data.meeting_date) {
                formattedMessage = formattedMessage.replace(/\{meeting_date\}/g, lead.data.meeting_date);
            }
            if (lead.data.meeting_time) {
                formattedMessage = formattedMessage.replace(/\{meeting_time\}/g, lead.data.meeting_time);
            }
            
            // Replace other lead data placeholders
            Object.keys(lead.data).forEach(key => {
                const placeholder = new RegExp(`\\{${key}\\}`, 'g');
                formattedMessage = formattedMessage.replace(placeholder, lead.data[key] || '');
            });
        }

        return formattedMessage;
    }

    // New method to process step-level reminders
    async processStepReminders(leadId, stepData) {
        try {
            if (!stepData || !stepData.integrations?.enabled) {
                return;
            }

            const lead = await this.leadsManager.getLead(leadId);
            if (!lead || lead.blocked) {
                return;
            }

            // Process notifications
            if (stepData.integrations.notifications && stepData.integration?.notifications) {
                await this._processStepNotifications(lead, stepData);
            }

            // Process reminders
            if (stepData.integrations.reminders && stepData.reminders?.enabled) {
                await this._processStepRemindersConfig(lead, stepData);
            }

            // Process Google Calendar
            if (stepData.integrations.googleCalendar && stepData.integration?.calendar) {
                await this._processStepGoogleCalendar(lead, stepData);
            }

            // Process Google Sheets
            if (stepData.integrations.googleSheets && stepData.integration?.sheets) {
                await this._processStepGoogleSheets(lead, stepData);
            }

            // Process iPlan
            if (stepData.integrations.iPlan && stepData.integration?.iplan) {
                await this._processStepIPlan(lead, stepData);
            }

        } catch (error) {
            console.error(`ReminderService: Error processing step integrations for ${leadId}:`, error);
        }
    }

    async _processStepNotifications(lead, stepData) {
        try {
            const notificationConfig = stepData.integration.notifications;
            if (!notificationConfig.recipients || !notificationConfig.message) {
                return;
            }

            const recipients = notificationConfig.recipients.split(',').map(r => r.trim());
            const message = this._formatMessage(notificationConfig.message, lead);

            for (const recipient of recipients) {
                if (recipient) {
                    try {
                        console.log(`ReminderService: Sending step notification to ${recipient}`);
                        await this.whatsappClient.sendMessage(recipient, message);
                    } catch (error) {
                        console.error(`ReminderService: Failed to send notification to ${recipient}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('ReminderService: Error processing step notifications:', error);
        }
    }

    async _processStepRemindersConfig(lead, stepData) {
        try {
            const remindersConfig = stepData.reminders;
            if (!remindersConfig.reminders || !Array.isArray(remindersConfig.reminders)) {
                return;
            }

            // Get meeting date and time from lead data
            const meetingDate = lead.data?.meeting_date;
            const meetingTime = lead.data?.meeting_time;
            
            if (!meetingDate || !meetingTime) {
                console.warn('ReminderService: No meeting date/time found for step reminders');
                return;
            }

            const meetingDateTime = this._parseMeetingDateTime(meetingDate, meetingTime);
            if (!meetingDateTime) {
                console.warn('ReminderService: Could not parse meeting date/time for step reminders');
                return;
            }

            const now = new Date();
            
            for (const reminder of remindersConfig.reminders) {
                const reminderTime = new Date(meetingDateTime.getTime() - (reminder.hours * 60 * 60 * 1000));
                
                if (now >= reminderTime && now < new Date(reminderTime.getTime() + (60 * 60 * 1000))) {
                    const reminderKey = `step_${stepData.id}_${reminder.id}_${reminder.hours}h`;
                    
                    if (!lead.meeting) lead.meeting = {};
                    if (!lead.meeting.reminders_sent) lead.meeting.reminders_sent = [];
                    
                    if (!lead.meeting.reminders_sent.includes(reminderKey)) {
                        const message = this._formatMessage(reminder.message, lead);
                        
                        try {
                            await this.whatsappClient.sendMessage(lead.id, message);
                            lead.meeting.reminders_sent.push(reminderKey);
                            await this.leadsManager.updateLead(lead.id, lead);
                            console.log(`ReminderService: Sent step reminder ${reminderKey} to ${lead.id}`);
                        } catch (error) {
                            console.error(`ReminderService: Failed to send step reminder to ${lead.id}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('ReminderService: Error processing step reminders:', error);
        }
    }

    async _processStepGoogleCalendar(lead, stepData) {
        try {
            if (!this.integrationManager?.services?.calendar) {
                console.warn('ReminderService: Google Calendar service not available');
                return;
            }

            const calendarConfig = stepData.integration.calendar;
            const meetingDate = lead.data?.meeting_date;
            const meetingTime = lead.data?.meeting_time;
            
            if (!meetingDate || !meetingTime) {
                console.warn('ReminderService: No meeting date/time for Google Calendar integration');
                return;
            }

            const eventData = {
                summary: calendarConfig.message || 'פגישה',
                description: this._formatMessage(calendarConfig.message || '', lead),
                start: {
                    dateTime: `${meetingDate}T${meetingTime}:00`,
                    timeZone: 'Asia/Jerusalem'
                },
                end: {
                    dateTime: `${meetingDate}T${meetingTime}:00`,
                    timeZone: 'Asia/Jerusalem'
                },
                attendees: [
                    {
                        email: lead.data?.email || '',
                        displayName: lead.data?.full_name || ''
                    }
                ]
            };

            await this.integrationManager.services.calendar.createEvent(eventData);
            console.log(`ReminderService: Created calendar event for ${lead.id}`);
        } catch (error) {
            console.error('ReminderService: Error processing Google Calendar integration:', error);
        }
    }

    async _processStepGoogleSheets(lead, stepData) {
        try {
            if (!this.integrationManager?.services?.sheets) {
                console.warn('ReminderService: Google Sheets service not available');
                return;
            }

            const sheetsConfig = stepData.integration.sheets;
            const data = {
                timestamp: new Date().toISOString(),
                name: lead.data?.full_name || '',
                phone: lead.id.replace('@c.us', ''),
                meeting_date: lead.data?.meeting_date || '',
                meeting_time: lead.data?.meeting_time || '',
                message: this._formatMessage(sheetsConfig.message || '', lead)
            };

            await this.integrationManager.services.sheets.appendRow(data);
            console.log(`ReminderService: Added data to Google Sheets for ${lead.id}`);
        } catch (error) {
            console.error('ReminderService: Error processing Google Sheets integration:', error);
        }
    }

    async _processStepIPlan(lead, stepData) {
        try {
            const iplanConfig = stepData.integration.iplan;
            const data = {
                name: lead.data?.full_name || '',
                phone: lead.id.replace('@c.us', ''),
                meeting_date: lead.data?.meeting_date || '',
                meeting_time: lead.data?.meeting_time || '',
                message: this._formatMessage(iplanConfig.message || '', lead)
            };

            // Here you would implement iPlan API integration
            console.log(`ReminderService: iPlan integration data for ${lead.id}:`, data);
        } catch (error) {
            console.error('ReminderService: Error processing iPlan integration:', error);
        }
    }

    // Method to check and send all step-level reminders
    async checkStepReminders() {
        const leads = await this.leadsManager.getAllLeads();
        
        for (const [leadId, lead] of Object.entries(leads)) {
            if (!lead.is_schedule || !lead.data.meeting_date || !lead.data.meeting_time) {
                continue;
            }

            // Get the flow configuration to check for step reminders
            try {
                const flowPath = path.join(process.cwd(), 'data', 'flows');
                const flowFiles = fs.readdirSync(flowPath).filter(f => f.endsWith('.json'));
                
                for (const flowFile of flowFiles) {
                    const flowData = JSON.parse(fs.readFileSync(path.join(flowPath, flowFile), 'utf8'));
                    
                    // Check each step for reminder configuration
                    for (const [stepId, stepData] of Object.entries(flowData.steps || {})) {
                        if (stepData.integration?.reminders?.enabled) {
                            await this.processStepReminders(leadId, stepData);
                        }
                    }
                }
            } catch (error) {
                console.error(`ReminderService: Error processing step reminders for ${leadId}:`, error);
            }
        }
    }
}

module.exports = ReminderService; 