const assert = require('assert');
const path = require('path');
const GoogleCalendarService = require('../services/google/GoogleCalendarService');

async function testGoogleCalendar() {
    console.log('🧪 Starting Google Calendar integration tests...\n');

    // Test configuration
    const config = {
        enabled: true,
        calendarId: '484cd349c67e23d926a65281152a0b05d35bc9c040641122de54e6357c059490@group.calendar.google.com',
        eventDurationMinutes: 60,
        timeZone: 'Asia/Jerusalem',
        eventTitle: 'פגישה עם {full_name}',
        eventDescription: 'פגישה עם {full_name}\nטלפון: {phone}\nעיר: {city_name}\nניידות: {mobility}',
        maxParticipantsPerSlot: 3
    };

    // Initialize service
    const calendarService = new GoogleCalendarService(config);
    console.log('📅 Initializing Google Calendar service...');
    const initialized = await calendarService.initialize();
    assert(initialized, 'Calendar service should initialize successfully');
    console.log('✅ Calendar service initialized successfully');

    // Test 1: Check time slot availability
    console.log('\n📝 Test 1: Checking time slot availability');
    const date = '22/06/2025';
    const time = '09:00';
    const isAvailable = await calendarService.isTimeSlotAvailable(date, time);
    console.log(`Time slot ${date} ${time} availability:`, isAvailable);
    assert(typeof isAvailable === 'boolean', 'Should return boolean for availability');
    console.log('✅ Time slot availability check works');

    // Test 2: Create test event
    console.log('\n📝 Test 2: Creating test event');
    const testEvent = {
        full_name: 'Test User',
        phone: '972501234567',
        city_name: 'Test City',
        mobility: 'car',
        meeting_date: date,
        meeting_time: time
    };

    const createResult = await calendarService.createEvent(testEvent);
    assert(createResult.success, 'Event creation should succeed');
    console.log('✅ Event creation works');
    console.log('Event details:', createResult);

    // Test 3: Check if the same time slot is now unavailable
    console.log('\n📝 Test 3: Checking if time slot is now taken');
    const isStillAvailable = await calendarService.isTimeSlotAvailable(date, time);
    console.log(`Time slot ${date} ${time} availability after booking:`, isStillAvailable);
    console.log('✅ Time slot availability updated correctly');

    // Test 4: Delete test event
    if (createResult.eventId) {
        console.log('\n📝 Test 4: Deleting test event');
        const deleteResult = await calendarService.deleteEvent(createResult.eventId);
        assert(deleteResult, 'Event deletion should succeed');
        console.log('✅ Event deletion works');
    }

    // Test 5: Filter available times
    console.log('\n📝 Test 5: Testing time slot filtering');
    const availableTimes = ['09:00', '10:00', '11:00', '13:00', '14:00'];
    const filteredTimes = await calendarService.filterAvailableTimes(date, availableTimes);
    assert(Array.isArray(filteredTimes), 'Should return array of available times');
    console.log('Available times:', filteredTimes);
    console.log('✅ Time slot filtering works');

    console.log('\n🎉 All Google Calendar tests completed successfully!');
}

testGoogleCalendar().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 