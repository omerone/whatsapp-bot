const { google } = require('googleapis');
const path = require('path');

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

            // Load Google credentials from centralized credentials directory
            const credentialsPath = path.join(__dirname, '..', 'credentials', 'google-calendar-credentials.json');
            const auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/calendar']
            });

            const authClient = await auth.getClient();
            this.calendar = google.calendar({ version: 'v3', auth: authClient });

            // Test the connection
            await this.calendar.calendarList.list();
            
    
            this.initialized = true;
            return true;

        } catch (error) {
            console.error('GoogleCalendarService: Failed to initialize:', error.message);
            this.initialized = false;
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

            // Check for conflicting events
            const response = await this.calendar.events.list({
                calendarId: this.config.calendarId,
                timeMin: startDateTime.toISOString(),
                timeMax: endDateTime.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });

            const existingEvents = response.data.items || [];
            
            // Check if we have maxParticipantsPerSlot configured
            const maxParticipants = this.config.maxParticipantsPerSlot || 1;
            
            // Count events that have our specific title pattern (our meetings)
            const ourMeetings = existingEvents.filter(event => 
                event.summary && event.summary.includes('פגישה עם')
            );

            const currentParticipants = ourMeetings.length;
            const slotAvailable = currentParticipants < maxParticipants;

            if (!slotAvailable) {
                // console.log(`GoogleCalendarService: Time slot ${date} ${time} is full - found ${currentParticipants}/${maxParticipants} meetings`);
            } else {
                // console.log(`GoogleCalendarService: Time slot ${date} ${time} has space - ${currentParticipants}/${maxParticipants} meetings`);
            }

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
            // Parse the date and time
            const [day, month, year] = meetingData.meeting_date.split('/');
            const [hour, minute] = meetingData.meeting_time.split(':');
            
            const startDateTime = new Date(year, month - 1, day, hour, minute);
            const endDateTime = new Date(startDateTime.getTime() + (this.config.eventDurationMinutes * 60 * 1000));

            // Check for existing event with same details
            const existingEvent = await this._findExistingEvent(meetingData, startDateTime, endDateTime);
            if (existingEvent) {
                console.log(`📅 Google Calendar: אירוע קיים כבר נמצא עבור ${meetingData.full_name} בתאריך ${meetingData.meeting_date} ${meetingData.meeting_time}`);
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
                // Removed attendees - Service accounts can't invite attendees without Domain-Wide Delegation
            };

            const response = await this.calendar.events.insert({
                calendarId: this.config.calendarId,
                resource: event
            });

            console.log(`📅 Google Calendar: אירוע חדש נוצר בהצלחה עבור ${meetingData.full_name}`);
            return {
                success: true,
                eventId: response.data.id,
                eventLink: response.data.htmlLink,
                wasExisting: false
            };

        } catch (error) {
            console.error('GoogleCalendarService: Error creating event:', error.message);
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