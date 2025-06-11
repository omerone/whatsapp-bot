const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleCalendarService {
    constructor(config) {
        this.config = config;
        this.calendar = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            if (!this.config.enabled) {
                console.log('GoogleCalendarService: Calendar integration disabled');
                return false;
            }

            // Load Google Calendar credentials
            const credentialsPath = path.join(__dirname, '..', 'credentials', 'google-calendar-credentials.json');
            
            // Check if credentials file exists
            try {
                await fs.promises.access(credentialsPath);
                console.log('GoogleCalendarService: Found credentials file at', credentialsPath);
            } catch (error) {
                console.error(`GoogleCalendarService: Credentials file not found at ${credentialsPath}`);
                console.error('Please make sure to add the google-calendar-credentials.json file with proper permissions.');
                return false;
            }

            // Initialize calendar client with dedicated credentials
            const auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/calendar']
            });

            // Test auth by getting the client email
            const client = await auth.getClient();
            const credentials = await auth.getCredentials();
            console.log('GoogleCalendarService: Authenticated as:', credentials.client_email);
            console.log('GoogleCalendarService: Using calendar ID:', this.config.calendarId);

            this.calendar = google.calendar({ version: 'v3', auth });

            // Test calendar access
            try {
                console.log('GoogleCalendarService: Testing calendar access...');
                const calendarInfo = await this.calendar.calendars.get({
                    calendarId: this.config.calendarId
                });
                console.log('GoogleCalendarService: Successfully accessed calendar:', calendarInfo.data.summary);
                console.log('GoogleCalendarService: Calendar details:', {
                    id: calendarInfo.data.id,
                    timeZone: calendarInfo.data.timeZone,
                    accessRole: calendarInfo.data.accessRole
                });
            } catch (error) {
                console.error('GoogleCalendarService: Failed to access calendar:', error.message);
                if (error.code === 404) {
                    console.error('Calendar not found. Please check the calendarId');
                } else if (error.code === 403) {
                    console.error('Permission denied. Please check service account permissions');
                }
                throw error;
            }

            this.initialized = true;
            console.log('GoogleCalendarService: Successfully initialized with calendar credentials');
            return true;
        } catch (error) {
            console.error('GoogleCalendarService: Failed to initialize:', error);
            return false;
        }
    }

    async isTimeSlotAvailable(date, time) {
        if (!this.initialized) {
            console.warn('GoogleCalendarService: Service not initialized, assuming slot is available');
            return true;
        }

        try {
            // Parse the date and time
            const [day, month, year] = date.split('/');
            const [hour, minute] = time.split(':');
            
            const startDateTime = new Date(year, month - 1, day, hour, minute);
            const endDateTime = new Date(startDateTime.getTime() + (this.config.eventDurationMinutes * 60 * 1000));

            console.log(`GoogleCalendarService: Checking availability for ${date} ${time}`, {
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString(),
                maxParticipants: this.config.maxParticipantsPerSlot || 1
            });

            // Check for conflicting events
            const response = await this.calendar.events.list({
                calendarId: this.config.calendarId,
                timeMin: startDateTime.toISOString(),
                timeMax: endDateTime.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });

            const existingEvents = response.data.items || [];
            console.log(`GoogleCalendarService: Found ${existingEvents.length} existing events in this time slot`);
            
            // Check if we have maxParticipantsPerSlot configured
            const maxParticipants = this.config.maxParticipantsPerSlot || 1;
            
            // Count events that have our specific title pattern (our meetings)
            const ourMeetings = existingEvents.filter(event => 
                event.summary && event.summary.includes('פגישה עם')
            );

            const currentParticipants = ourMeetings.length;
            const slotAvailable = currentParticipants < maxParticipants;

            console.log(`GoogleCalendarService: Time slot ${date} ${time} status:`, {
                currentParticipants,
                maxParticipants,
                available: slotAvailable,
                existingMeetings: ourMeetings.map(m => m.summary)
            });

            return slotAvailable;

        } catch (error) {
            console.error('GoogleCalendarService: Error checking availability:', error.message);
            // In case of error, assume slot is available to avoid blocking legitimate bookings
            return true;
        }
    }

    async createEvent(meetingData) {
        if (!this.initialized) {
            console.warn('GoogleCalendarService: Service not initialized, cannot create event');
            return false;
        }

        try {
            console.log(`GoogleCalendarService: Creating event for ${meetingData.full_name}`, {
                date: meetingData.meeting_date,
                time: meetingData.meeting_time,
                city: meetingData.city_name,
                mobility: meetingData.mobility
            });

            // Parse the date and time
            const [day, month, year] = meetingData.meeting_date.split('/');
            const [hour, minute] = meetingData.meeting_time.split(':');
            
            const startDateTime = new Date(year, month - 1, day, hour, minute);
            const endDateTime = new Date(startDateTime.getTime() + (this.config.eventDurationMinutes * 60 * 1000));

            console.log('GoogleCalendarService: Event time details:', {
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString(),
                timeZone: this.config.timeZone
            });

            // Check for existing event with same details
            const existingEvent = await this._findExistingEvent(meetingData, startDateTime, endDateTime);
            if (existingEvent) {
                console.log(`GoogleCalendarService: Found existing event for ${meetingData.full_name}`, {
                    eventId: existingEvent.id,
                    eventLink: existingEvent.htmlLink,
                    summary: existingEvent.summary
                });
                return {
                    success: true,
                    eventId: existingEvent.id,
                    eventLink: existingEvent.htmlLink,
                    wasExisting: true
                };
            }

            // Check current participants to add a number to the title
            const existingEvents = await this.calendar.events.list({
                calendarId: this.config.calendarId,
                timeMin: startDateTime.toISOString(),
                timeMax: endDateTime.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });

            const ourMeetings = (existingEvents.data.items || []).filter(event => 
                event.summary && event.summary.includes('פגישה עם')
            );
            
            const participantNumber = ourMeetings.length + 1;
            console.log(`GoogleCalendarService: Current participants in this time slot: ${participantNumber}`);

            // Replace placeholders in title and description
            const eventTitle = this.replacePlaceholders(this.config.eventTitle, meetingData);
            const eventDescription = this.replacePlaceholders(this.config.eventDescription, meetingData);

            const event = {
                summary: eventTitle,
                description: eventDescription,
                start: {
                    dateTime: startDateTime.toISOString(),
                    timeZone: this.config.timeZone
                },
                end: {
                    dateTime: endDateTime.toISOString(),
                    timeZone: this.config.timeZone
                }
            };

            console.log('GoogleCalendarService: Creating new event with details:', {
                summary: event.summary,
                description: event.description,
                start: event.start,
                end: event.end
            });

            const response = await this.calendar.events.insert({
                calendarId: this.config.calendarId,
                resource: event
            });

            console.log(`GoogleCalendarService: Event created successfully for ${meetingData.full_name}`, {
                eventId: response.data.id,
                eventLink: response.data.htmlLink
            });

            return {
                success: true,
                eventId: response.data.id,
                eventLink: response.data.htmlLink,
                wasExisting: false
            };

        } catch (error) {
            console.error('GoogleCalendarService: Error creating event:', error.message);
            if (error.response) {
                console.error('GoogleCalendarService: API Error Details:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            }
            return {
                success: false,
                error: error.message
            };
        }
    }

    async _findExistingEvent(meetingData, startDateTime, endDateTime) {
        try {
            // Get events in the same time slot
            const response = await this.calendar.events.list({
                calendarId: this.config.calendarId,
                timeMin: startDateTime.toISOString(),
                timeMax: endDateTime.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });

            const events = response.data.items || [];
            
            // Look for event with same title pattern and person name
            const expectedTitle = this.replacePlaceholders(this.config.eventTitle, meetingData);
            
            for (const event of events) {
                if (event.summary === expectedTitle) {
                    // Also check if the description contains the same phone number
                    if (event.description && event.description.includes(meetingData.phone)) {
                        return event;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('GoogleCalendarService: Error finding existing event:', error.message);
            return null;
        }
    }

    async deleteEvent(eventId) {
        if (!this.initialized || !eventId) {
            return false;
        }

        try {
            await this.calendar.events.delete({
                calendarId: this.config.calendarId,
                eventId: eventId
            });

            console.log(`GoogleCalendarService: Event deleted successfully - ${eventId}`);
            return true;

        } catch (error) {
            console.error('GoogleCalendarService: Error deleting event:', error.message);
            return false;
        }
    }

    replacePlaceholders(text, data) {
        if (!text || !data) return text;

        let result = text;
        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{${key}}`;
            result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value || '');
        }
        return result;
    }

    async filterAvailableTimes(date, availableTimes) {
        if (!this.initialized) {
            console.warn('GoogleCalendarService: Service not initialized, returning all times as available');
            return availableTimes;
        }

        if (!availableTimes || availableTimes.length === 0) {
            return [];
        }

        // console.log(`GoogleCalendarService: Filtering ${availableTimes.length} time slots for ${date}`);
        
        const availableTimesAfterCalendarCheck = [];
        
        for (const time of availableTimes) {
            const isAvailable = await this.isTimeSlotAvailable(date, time);
            if (isAvailable) {
                availableTimesAfterCalendarCheck.push(time);
            } else {
                // console.log(`GoogleCalendarService: Time slot ${date} ${time} is not available in Google Calendar`);
            }
        }

        // console.log(`GoogleCalendarService: ${availableTimesAfterCalendarCheck.length} out of ${availableTimes.length} time slots are available for ${date}`);
        return availableTimesAfterCalendarCheck;
    }

    async getUpcomingEvents(maxResults = 10) {
        if (!this.initialized) {
            return [];
        }

        try {
            const response = await this.calendar.events.list({
                calendarId: this.config.calendarId,
                timeMin: new Date().toISOString(),
                maxResults: maxResults,
                singleEvents: true,
                orderBy: 'startTime'
            });

            return response.data.items || [];

        } catch (error) {
            console.error('GoogleCalendarService: Error getting upcoming events:', error.message);
            return [];
        }
    }
}

module.exports = GoogleCalendarService; 