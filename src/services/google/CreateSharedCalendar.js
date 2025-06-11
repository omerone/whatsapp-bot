const { google } = require('googleapis');
const path = require('path');
const fs = require('fs').promises;

class CreateSharedCalendar {
    constructor() {
        this.calendar = null;
    }

    async createSharedCalendar(userEmail, calendarName = 'פגישות בוט WhatsApp - משאבים LTD') {
        try {
            // Load credentials
            const credentialsPath = path.join(__dirname, '..', 'credentials', 'google-calendar-credentials.json');
            const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

            // Create JWT client
            const auth = new google.auth.JWT(
                credentials.client_email,
                null,
                credentials.private_key,
                ['https://www.googleapis.com/auth/calendar']
            );

            // Create calendar client
            this.calendar = google.calendar({ version: 'v3', auth });

            // Create new calendar
            const calendarResponse = await this.calendar.calendars.insert({
                requestBody: {
                    summary: calendarName,
                    timeZone: 'Asia/Jerusalem'
                }
            });

            const calendarId = calendarResponse.data.id;
            console.log('Created calendar:', calendarId);

            // Set calendar sharing permissions
            await this.calendar.acl.insert({
                calendarId: calendarId,
                requestBody: {
                    role: 'owner',
                    scope: {
                        type: 'user',
                        value: userEmail
                    }
                }
            });

            // Make calendar public
            await this.calendar.acl.insert({
                calendarId: calendarId,
                requestBody: {
                    role: 'reader',
                    scope: {
                        type: 'default'
                    }
                }
            });

            console.log('Calendar shared successfully with:', userEmail);
            return calendarId;
        } catch (error) {
            console.error('Error creating shared calendar:', error);
            throw error;
        }
    }

    static async create(userEmail, calendarName) {
        const creator = new CreateSharedCalendar();
        return await creator.createSharedCalendar(userEmail, calendarName);
    }
}

// If running directly, create calendar
if (require.main === module) {
    const serviceAccountEmail = 'whatsapp-bot-calendar@whatsapp-bot-automate.iam.gserviceaccount.com';
    CreateSharedCalendar.create(serviceAccountEmail)
        .then(calendarId => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = CreateSharedCalendar; 