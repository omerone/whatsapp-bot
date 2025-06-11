const assert = require('assert');
const path = require('path');
const GoogleCalendarService = require('../services/google/GoogleCalendarService');

async function testGoogleCalendar() {
    try {
        console.log('🧪 Starting Google Calendar integration tests...\n');

        // Test configuration
        const config = {
            enabled: true,
            calendarId: "6c1877e19bcec67cf66fc0235c0420790d1534e7abea9b1dd64bd44d0a440dae@group.calendar.google.com",
            eventDurationMinutes: 60,
            timeZone: "Asia/Jerusalem",
            eventTitle: "פגישה עם {full_name}",
            eventDescription: "פגישה עם {full_name}\nטלפון: {phone}\nעיר: {city_name}\nניידות: {mobility}",
            maxParticipantsPerSlot: 3,
            preventDuplicates: true
        };

        // Initialize service
        const calendarService = new GoogleCalendarService(config);
        console.log('📅 Initializing Google Calendar service...');
        const initialized = await calendarService.initialize();
        if (!initialized) {
            throw new Error('Failed to initialize calendar service');
        }
        console.log('✅ Calendar service initialized successfully');

        // Create test event
        console.log('\n📝 Creating test event');
        const meetingData = {
            full_name: "בדיקת מערכת",
            phone: "0501234567",
            city_name: "תל אביב",
            mobility: "רכב",
            meeting_date: "30/07/2025",
            meeting_time: "10:00"
        };

        console.log("Creating test event with public visibility...");
        const result = await calendarService.createEvent(meetingData);
        console.log("Event creation result:", result);
        
        if (!result.success) {
            throw new Error('Failed to create event: ' + JSON.stringify(result));
        }
        
        console.log('✅ Event created successfully!');
        console.log('Event ID:', result.eventId);
        console.log('Event Link:', result.eventLink);

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

testGoogleCalendar().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 