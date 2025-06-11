const fs = require('fs').promises;
const path = require('path');

class LeadsManager {
    constructor(leadsFilePath) {
        this.leadsFilePath = leadsFilePath;
        this.leads = {};
        this.initialized = false;
        this.VALID_SENDER_TYPES = ['bot', 'client', 'none'];
    }

    formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        return date.toLocaleString('he-IL', {
            timeZone: 'Asia/Jerusalem',
            hour12: false
        });
    }

    isValidPhoneNumber(phoneNumber) {
        if (!phoneNumber) return false;
        
        // Block groups immediately
        if (phoneNumber.includes('@g.us')) {
            console.log(`[LeadsManager] 🚫 Blocking group from being added to leads: ${phoneNumber}`);
            return false;
        }

        // Block status messages immediately
        if (phoneNumber === 'status@broadcast') {
            console.log(`[LeadsManager] 🚫 Blocking status broadcast from being added to leads`);
            return false;
        }
        
        // Remove any non-digit characters except @ and .
        const cleanNumber = phoneNumber.replace(/[^\d@.]/g, '');
        
        // Check if it's a WhatsApp ID format (e.g., 972501234567@c.us)
        if (phoneNumber.includes('@')) {
            return /^\d+@c\.us$/.test(phoneNumber); // Only allow @c.us numbers
        }
        
        // For regular phone numbers, ensure it starts with 972 and has 11-12 digits
        return cleanNumber.startsWith('972') && cleanNumber.length >= 11 && cleanNumber.length <= 12;
    }

    async initialize() {
        try {
            await this.loadLeads();
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize LeadsManager:', error);
            return false;
        }
    }

    async loadLeads() {
        try {
            // Ensure the directory exists
            const dir = path.dirname(this.leadsFilePath);
            await fs.mkdir(dir, { recursive: true });

            try {
                const data = await fs.readFile(this.leadsFilePath, 'utf8');
                this.leads = JSON.parse(data);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // File doesn't exist, create it with empty object
                    this.leads = {};
                    await this.saveLeads();
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('Error loading leads:', error);
            throw error;
        }
    }

    async saveLeads() {
        try {
            // Create a new object with reordered fields AND include any extra fields
            const leadsToSave = {};
            for (const [phoneNumber, lead] of Object.entries(this.leads)) {
                // Format frozenUntil if it exists
                let formattedFrozenUntil = null;
                if (lead.frozenUntil) {
                    formattedFrozenUntil = this.formatDate(lead.frozenUntil);
                }

                // Format last_sent_message to be a simple string
                let lastSentMessage = 'none';
                if (lead.last_sent_message) {
                    if (typeof lead.last_sent_message === 'object' && lead.last_sent_message.sender) {
                        lastSentMessage = lead.last_sent_message.sender;
                    } else if (typeof lead.last_sent_message === 'string') {
                        lastSentMessage = lead.last_sent_message;
                    }
                }

                leadsToSave[phoneNumber] = {
                    current_step: lead.current_step,
                    data: lead.data || {},
                    is_schedule: lead.is_schedule || false,
                    meeting: lead.meeting,
                    last_sent_message: lastSentMessage,
                    last_client_message: lead.last_client_message || "",
                    relevant: lead.relevant !== false, // Default to true if undefined
                    last_interaction: lead.last_interaction,
                    date_and_time_conversation_started: lead.date_and_time_conversation_started,
                    blocked: lead.blocked || false,
                    blocked_reason: lead.blocked_reason,
                    // Add freeze-related fields with formatted dates
                    frozenUntil: formattedFrozenUntil,
                    lastFreezeReason: lead.lastFreezeReason,
                    // Remove lastFrozenAt and lastFreezeMessageSent
                    // Spread any remaining properties from the lead object
                    ...Object.fromEntries(
                        Object.entries(lead).filter(([key]) => 
                            !['frozenUntil', 'lastFreezeReason', 'lastFrozenAt', 'lastFreezeMessageSent', 'last_sent_message'].includes(key)
                        )
                    )
                };
            }
            await fs.writeFile(this.leadsFilePath, JSON.stringify(leadsToSave, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving leads:', error);
            throw error;
        }
    }

    async createOrUpdateLead(phoneNumber, data = {}) {
        if (!this.initialized) {
            throw new Error('LeadsManager not initialized');
        }

        if (!this.isValidPhoneNumber(phoneNumber)) {
            console.log(`[LeadsManager] ❌ Invalid or blocked phone number, rejecting: ${phoneNumber}`);
            return null;
        }

        const now = new Date();
        const isReset = data.current_step === 'main_menu' && (!data.data || Object.keys(data.data).length === 0);

        // For new leads
        if (!this.leads[phoneNumber]) {
            this.leads[phoneNumber] = {
                current_step: null,
                data: {},
                is_schedule: false,
                meeting: null,
                last_sent_message: "none",
                last_client_message: "",
                relevant: true,
                last_interaction: this.formatDate(now),
                date_and_time_conversation_started: this.formatDate(now),
                blocked: false,
                blocked_reason: null,
                ...data
            };
        } else {
            // Update existing lead
            if (isReset) {
                // For reset operations, force the reset values
                this.leads[phoneNumber] = {
                    ...this.leads[phoneNumber],
                    ...data,
                    blocked: false,
                    blocked_reason: null
                };
            } else {
                // If explicitly setting blocked to false, also clear the reason
                if ('blocked' in data && data.blocked === false) {
                    data.blocked_reason = null;
                }
                // If not explicitly setting blocked and lead was blocked, maintain blocked status
                else if (!('blocked' in data) && this.leads[phoneNumber].blocked) {
                    data.blocked = true;
                    data.blocked_reason = this.leads[phoneNumber].blocked_reason;
                }

                this.leads[phoneNumber] = {
                    ...this.leads[phoneNumber],
                    ...data
                };
            }
        }

        // Always update last interaction time
        this.leads[phoneNumber].last_interaction = this.formatDate(now);

        await this.saveLeads();
        return this.leads[phoneNumber];
    }

    async getLead(phoneNumber) {
        if (!this.initialized) {
            throw new Error('LeadsManager not initialized');
        }
        return this.leads[phoneNumber];
    }

    async updateLeadData(phoneNumber, data) {
        if (!this.initialized) {
            throw new Error('LeadsManager not initialized');
        }

        if (!this.leads[phoneNumber]) {
            throw new Error(`Lead not found: ${phoneNumber}`);
        }

        this.leads[phoneNumber].data = {
            ...this.leads[phoneNumber].data,
            ...data
        };

        await this.saveLeads();
        return this.leads[phoneNumber];
    }

    async updateLeadStatus(phoneNumber, status) {
        if (!this.initialized) {
            throw new Error('LeadsManager not initialized');
        }

        if (!this.leads[phoneNumber]) {
            throw new Error(`Lead not found: ${phoneNumber}`);
        }

        this.leads[phoneNumber].status = status;
        this.leads[phoneNumber].last_interaction = this.formatDate(new Date());

        await this.saveLeads();
        return this.leads[phoneNumber];
    }

    async updateLeadStep(phoneNumber, stepId) {
        if (!this.initialized) {
            throw new Error('LeadsManager not initialized');
        }

        if (!this.leads[phoneNumber]) {
            throw new Error(`Lead not found: ${phoneNumber}`);
        }

        this.leads[phoneNumber].current_step = stepId;
        this.leads[phoneNumber].last_interaction = this.formatDate(new Date());

        await this.saveLeads();
        return this.leads[phoneNumber];
    }

    async markLeadScheduled(phoneNumber, meetingDetails) {
        return this.createOrUpdateLead(phoneNumber, {
            is_schedule: true,
            meeting: meetingDetails
        });
    }

    async blockLead(phoneNumber) {
        return this.createOrUpdateLead(phoneNumber, {
            blocked: true
        });
    }

    async updateLastMessage(phoneNumber, sender, messageInfo = null) {
        if (!this.VALID_SENDER_TYPES.includes(sender)) {
            throw new Error(`Invalid sender type: ${sender}. Must be one of: ${this.VALID_SENDER_TYPES.join(', ')}`);
        }

        const updateData = {
            last_sent_message: sender
        };

        if (sender === 'client' && messageInfo) {
            updateData.last_client_message = messageInfo;
        }

        return this.createOrUpdateLead(phoneNumber, updateData);
    }

    isLeadActive(phoneNumber) {
        const lead = this.leads[phoneNumber];
        if (!lead || !lead.last_interaction) return false;

        // Parse the formatted date back to Date object
        const lastInteractionParts = lead.last_interaction.split(', ')[1].split(':');
        const lastInteractionDateParts = lead.last_interaction.split(', ')[0].split('.');
        
        const lastInteraction = new Date(
            lastInteractionDateParts[2],
            lastInteractionDateParts[1] - 1,
            lastInteractionDateParts[0],
            lastInteractionParts[0],
            lastInteractionParts[1],
            lastInteractionParts[2]
        );
        
        const now = new Date();
        const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);

        return lastInteraction > thirtyMinutesAgo;
    }

    async deleteLead(phoneNumber) {
        if (!this.initialized) {
            throw new Error('LeadsManager not initialized');
        }

        if (!this.leads[phoneNumber]) {
            return false;
        }

        delete this.leads[phoneNumber];
        await this.saveLeads();
        return true;
    }
}

module.exports = LeadsManager; 