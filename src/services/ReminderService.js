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
            leadObject.meeting.date = apptData.meeting_date;
            leadObject.meeting.time = apptData.meeting_time;
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
        let message = template;
        const placeholders = {
            '{full_name}': lead.data?.full_name || '',
            '{meeting_date}': lead.meeting?.date || '',
            '{meeting_time}': lead.meeting?.time || ''
            // Add more placeholders as needed
        };

        for (const placeholder in placeholders) {
            message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\\\]]/g, '\\\\$&'), 'g'), placeholders[placeholder]);
        }
        return message;
    }
}

module.exports = ReminderService; 