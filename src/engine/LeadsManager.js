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
        return date.toLocaleString('he-IL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    isValidPhoneNumber(phoneNumber) {
        // Remove any WhatsApp suffixes
        const cleanNumber = phoneNumber.split('@')[0];
        
        // Check if it's a valid Israeli phone number format
        // Should start with 972 or 0 followed by valid Israeli prefixes
        const israeliPattern = /^(972|0)(5[0-9]|[23489])\d{7}$/;
        
        return israeliPattern.test(cleanNumber);
    }

    async initialize() {
        try {
            await this.loadLeads();
            this.initialized = true;
            return true;
        } catch (error) {
            return false;
        }
    }

    async loadLeads() {
        try {
            const content = await fs.readFile(this.leadsFilePath, 'utf8');
            this.leads = JSON.parse(content || '{}');
            
            // Migrate old format to new format if needed
            for (const [phoneNumber, lead] of Object.entries(this.leads)) {
                // Move any data from step_data to data
                if (lead.step_data) {
                    lead.data = {
                        ...lead.data,
                        ...lead.step_data
                    };
                    delete lead.step_data;
                }
            }
            
            await this.saveLeads();
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, create it
                this.leads = {};
                await this.saveLeads();
            } else {
                throw error;
            }
        }
    }

    async saveLeads() {
        try {
            // Create a new object with reordered fields AND include any extra fields
            const leadsToSave = {};
            for (const [phoneNumber, lead] of Object.entries(this.leads)) {
                leadsToSave[phoneNumber] = {
                    current_step: lead.current_step,
                    data: lead.data || {},
                    is_schedule: lead.is_schedule || false,
                    meeting: lead.meeting,
                    last_sent_message: lead.last_sent_message || "none",
                    last_client_message: lead.last_client_message || "",
                    relevant: lead.relevant !== false, // Default to true if undefined
                    last_interaction: lead.last_interaction,
                    date_and_time_conversation_started: lead.date_and_time_conversation_started,
                    blocked: lead.blocked || false,
                    blocked_reason: lead.blocked_reason,
                    // Spread any other properties from the lead object
                    ...lead 
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

        // Block status@broadcast and validate phone number
        if (phoneNumber === 'status@broadcast' || !this.isValidPhoneNumber(phoneNumber)) {
            console.log(`[LeadsManager] Blocked invalid phone number from being added to leads: ${phoneNumber}`);
            return null;
        }

        const now = new Date();
        const newLead = {
            current_step: null,
            data: {},
            is_schedule: false,
            meeting: null,
            last_sent_message: 'none',
            last_client_message: "",
            relevant: true,
            last_interaction: this.formatDate(now),
            date_and_time_conversation_started: this.formatDate(now),
            blocked: false,
            blocked_reason: null
        };

        // Special handling for reset operations
        const isReset = data.blocked === false && data.blocked_reason === null;

        // If this is a reset or new lead, use the newLead as base
        if (!this.leads[phoneNumber] || (data && Object.keys(data).length > 0)) {
            // If this is a reset operation, force all reset-related fields
            if (isReset) {
                this.leads[phoneNumber] = {
                    ...newLead,
                    ...data,
                    blocked: false,
                    blocked_reason: null,
                    data: data.data || {}
                };
            } else {
                // If updating blocked status, respect the explicit setting
                if ('blocked' in data) {
                    // If explicitly setting blocked to false, also clear the reason
                    if (data.blocked === false) {
                        data.blocked_reason = null;
                    }
                } else if (this.leads[phoneNumber]?.blocked) {
                    // If not explicitly setting blocked and lead was blocked, maintain blocked status
                    data.blocked = true;
                    data.blocked_reason = this.leads[phoneNumber].blocked_reason;
                }

                this.leads[phoneNumber] = {
                    ...newLead,
                    ...data,
                    data: data.data || {}
                };
            }
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
        return this.leads[phoneNumber] || null;
    }

    async updateLeadData(phoneNumber, data) {
        if (!this.initialized) {
            throw new Error('LeadsManager not initialized');
        }

        if (!this.leads[phoneNumber]) {
            return await this.createOrUpdateLead(phoneNumber, { data });
        }

        this.leads[phoneNumber].data = {
            ...this.leads[phoneNumber].data,
            ...data
        };

        // Update last interaction time
        this.leads[phoneNumber].last_interaction = this.formatDate(new Date());

        await this.saveLeads();
        return this.leads[phoneNumber];
    }

    async updateLeadStatus(phoneNumber, status) {
        if (!this.initialized) {
            throw new Error('LeadsManager not initialized');
        }

        if (!this.leads[phoneNumber]) {
            return await this.createOrUpdateLead(phoneNumber, status);
        }

        const now = new Date();
        this.leads[phoneNumber] = {
            ...this.leads[phoneNumber],
            ...status,
            last_interaction: this.formatDate(now)
        };

        await this.saveLeads();
        return this.leads[phoneNumber];
    }

    async updateLeadStep(phoneNumber, stepId) {
        if (!this.initialized) {
            throw new Error('LeadsManager not initialized');
        }

        if (!this.leads[phoneNumber]) {
            return await this.createOrUpdateLead(phoneNumber, {
                current_step: stepId
            });
        }

        this.leads[phoneNumber].current_step = stepId;
        this.leads[phoneNumber].last_interaction = this.formatDate(new Date());

        await this.saveLeads();
        return this.leads[phoneNumber];
    }

    async markLeadScheduled(phoneNumber, meetingDetails) {
        return await this.updateLeadStatus(phoneNumber, {
            is_schedule: true,
            meeting: meetingDetails
        });
    }

    async blockLead(phoneNumber) {
        return await this.updateLeadStatus(phoneNumber, {
            blocked: true,
            relevant: false
        });
    }

    async updateLastMessage(phoneNumber, sender, messageInfo = null) {
        if (!this.VALID_SENDER_TYPES.includes(sender)) {
            console.error(`Invalid sender type: ${sender}. Must be one of: ${this.VALID_SENDER_TYPES.join(', ')}`);
            sender = 'none';
        }

        const now = new Date();
        const updateData = {
            last_sent_message: sender,
            last_interaction: this.formatDate(now)
        };

        if (sender === 'client' && messageInfo) {
            updateData.last_client_message = messageInfo;
        }

        return await this.updateLeadStatus(phoneNumber, updateData);
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

        if (this.leads[phoneNumber]) {
            delete this.leads[phoneNumber];
            await this.saveLeads();
        }
    }
}

module.exports = LeadsManager; 