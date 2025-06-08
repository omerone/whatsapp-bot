const axios = require('axios');

/**
 * iPlan Service for synchronizing meetings, contacts, and tasks
 */
class iPlanService {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
        this.client = null;
    }

    async initialize() {
        try {
            if (!this.config.enabled) {
                console.log('iPlanService: Service disabled');
                return false;
            }

            if (!this.config.apiUrl || !this.config.apiKey || !this.config.companyId) {
                console.error('iPlanService: Missing required configuration (apiUrl, apiKey, companyId)');
                return false;
            }

            // Create axios client with base configuration
            this.client = axios.create({
                baseURL: this.config.apiUrl,
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            // Test connection
            const response = await this.client.get('/api/health');
            if (response.status === 200) {
                this.isInitialized = true;
                console.log('✅ iPlanService: Service initialized successfully');
                return true;
            } else {
                console.error('iPlanService: Health check failed');
                return false;
            }

        } catch (error) {
            console.error('iPlanService: Failed to initialize:', error.message);
            return false;
        }
    }

    async createMeeting(meetingData) {
        try {
            if (!this.isInitialized) {
                console.warn('iPlanService: Service not initialized');
                return { success: false, error: 'Service not initialized' };
            }

            if (!this.config.syncMeetings) {
                return { success: false, error: 'Meeting sync disabled' };
            }

            const payload = {
                companyId: this.config.companyId,
                title: `פגישה עם ${meetingData.full_name}`,
                description: `פגישה עם ${meetingData.full_name}\nטלפון: ${meetingData.phone}\nעיר: ${meetingData.city_name}\nניידות: ${meetingData.mobility}`,
                startDate: this._formatDateTime(meetingData.meeting_date, meetingData.meeting_time),
                duration: 60, // minutes
                clientName: meetingData.full_name,
                clientPhone: meetingData.phone,
                clientCity: meetingData.city_name,
                tags: ['whatsapp-bot', meetingData.mobility]
            };

            const response = await this.client.post('/api/meetings', payload);
            
            if (response.status === 201) {
                console.log(`✅ iPlanService: Meeting created for ${meetingData.full_name}`);
                return {
                    success: true,
                    meetingId: response.data.id,
                    data: response.data
                };
            } else {
                console.error('iPlanService: Failed to create meeting:', response.data);
                return { success: false, error: response.data };
            }

        } catch (error) {
            console.error('iPlanService: Error creating meeting:', error.message);
            return { success: false, error: error.message };
        }
    }

    async createContact(contactData) {
        try {
            if (!this.isInitialized) {
                console.warn('iPlanService: Service not initialized');
                return { success: false, error: 'Service not initialized' };
            }

            if (!this.config.syncContacts) {
                return { success: false, error: 'Contact sync disabled' };
            }

            const payload = {
                companyId: this.config.companyId,
                name: contactData.full_name,
                phone: contactData.phone,
                city: contactData.city_name,
                source: 'whatsapp-bot',
                tags: [contactData.mobility],
                notes: `Added via WhatsApp Bot\nMobility: ${contactData.mobility}`
            };

            const response = await this.client.post('/api/contacts', payload);
            
            if (response.status === 201) {
                console.log(`✅ iPlanService: Contact created for ${contactData.full_name}`);
                return {
                    success: true,
                    contactId: response.data.id,
                    data: response.data
                };
            } else {
                console.error('iPlanService: Failed to create contact:', response.data);
                return { success: false, error: response.data };
            }

        } catch (error) {
            console.error('iPlanService: Error creating contact:', error.message);
            return { success: false, error: error.message };
        }
    }

    async createTask(taskData) {
        try {
            if (!this.isInitialized) {
                console.warn('iPlanService: Service not initialized');
                return { success: false, error: 'Service not initialized' };
            }

            if (!this.config.syncTasks) {
                return { success: false, error: 'Task sync disabled' };
            }

            const payload = {
                companyId: this.config.companyId,
                title: taskData.title,
                description: taskData.description,
                priority: taskData.priority || 'medium',
                dueDate: taskData.dueDate,
                assignedTo: taskData.assignedTo,
                tags: ['whatsapp-bot']
            };

            const response = await this.client.post('/api/tasks', payload);
            
            if (response.status === 201) {
                console.log(`✅ iPlanService: Task created: ${taskData.title}`);
                return {
                    success: true,
                    taskId: response.data.id,
                    data: response.data
                };
            } else {
                console.error('iPlanService: Failed to create task:', response.data);
                return { success: false, error: response.data };
            }

        } catch (error) {
            console.error('iPlanService: Error creating task:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getMeetings(dateRange = null) {
        try {
            if (!this.isInitialized) {
                console.warn('iPlanService: Service not initialized');
                return [];
            }

            let url = `/api/meetings?companyId=${this.config.companyId}`;
            if (dateRange) {
                url += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
            }

            const response = await this.client.get(url);
            return response.data || [];

        } catch (error) {
            console.error('iPlanService: Error getting meetings:', error.message);
            return [];
        }
    }

    async deleteMeeting(meetingId) {
        try {
            if (!this.isInitialized) {
                console.warn('iPlanService: Service not initialized');
                return { success: false, error: 'Service not initialized' };
            }

            const response = await this.client.delete(`/api/meetings/${meetingId}`);
            
            if (response.status === 200) {
                console.log(`✅ iPlanService: Meeting deleted: ${meetingId}`);
                return { success: true };
            } else {
                console.error('iPlanService: Failed to delete meeting:', response.data);
                return { success: false, error: response.data };
            }

        } catch (error) {
            console.error('iPlanService: Error deleting meeting:', error.message);
            return { success: false, error: error.message };
        }
    }

    _formatDateTime(date, time) {
        // Convert DD/MM/YYYY and HH:MM to ISO format
        const [day, month, year] = date.split('/');
        const [hour, minute] = time.split(':');
        return new Date(year, month - 1, day, hour, minute).toISOString();
    }

    replacePlaceholders(template, data) {
        let result = template;
        const placeholders = {
            '{full_name}': data.full_name || '',
            '{phone}': data.phone || '',
            '{city_name}': data.city_name || '',
            '{mobility}': data.mobility || '',
            '{meeting_date}': data.meeting_date || '',
            '{meeting_time}': data.meeting_time || ''
        };

        for (const [placeholder, value] of Object.entries(placeholders)) {
            result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }

        return result;
    }
}

module.exports = iPlanService; 