const assert = require('assert');
const LeadsManager = require('../engine/LeadsManager');
const path = require('path');

async function testLeadsManager() {
    console.log('🧪 Starting leads manager tests...\n');

    const testLeadsPath = path.join(__dirname, '../../data/test-leads.json');
    const leadsManager = new LeadsManager(testLeadsPath);
    await leadsManager.initialize();

    const testUserId = '972501234567@c.us';

    // Test 1: Bot sends first message (intro)
    console.log('\n📝 Test 1: Bot sends intro message');
    await leadsManager.createOrUpdateLead(testUserId, {
        current_step: 'intro',
        last_sent_message: 'bot'
    });
    let lead = await leadsManager.getLead(testUserId);
    assert(lead.last_sent_message === 'bot', 'Last message should be from bot');
    console.log('✅ Bot intro message recorded correctly');

    // Test 2: Client responds
    console.log('\n📝 Test 2: Client responds');
    await leadsManager.updateLastMessage(testUserId, 'client', 'שלום');
    lead = await leadsManager.getLead(testUserId);
    assert(lead.last_sent_message === 'client', 'Last message should be from client');
    assert(lead.last_client_message === 'שלום', 'Client message content should be recorded');
    console.log('✅ Client response recorded correctly');

    // Test 3: Bot sends menu
    console.log('\n📝 Test 3: Bot sends menu');
    await leadsManager.updateLastMessage(testUserId, 'bot');
    lead = await leadsManager.getLead(testUserId);
    assert(lead.last_sent_message === 'bot', 'Last message should be from bot');
    console.log('✅ Bot menu message recorded correctly');

    // Test 4: Client selects option
    console.log('\n📝 Test 4: Client selects menu option');
    await leadsManager.updateLastMessage(testUserId, 'client', '1');
    lead = await leadsManager.getLead(testUserId);
    assert(lead.last_sent_message === 'client', 'Last message should be from client');
    assert(lead.last_client_message === '1', 'Client message content should be recorded');
    console.log('✅ Client menu selection recorded correctly');

    // Test 5: Test invalid sender type
    console.log('\n📝 Test 5: Test invalid sender type');
    try {
        await leadsManager.updateLastMessage(testUserId, 'invalid');
        assert(false, 'Should have thrown error for invalid sender type');
    } catch (error) {
        assert(error.message.includes('Invalid sender type'), 'Should throw proper error message');
        console.log('✅ Invalid sender type handled correctly');
    }

    // Test 6: Test message sequence in flow
    console.log('\n📝 Test 6: Test message sequence in flow');
    const sequence = [
        { sender: 'bot', message: null, step: 'ask_name' },
        { sender: 'client', message: 'ישראל ישראלי', step: 'ask_name' },
        { sender: 'bot', message: null, step: 'confirm_full_name' },
        { sender: 'client', message: '1', step: 'confirm_full_name' },
        { sender: 'bot', message: null, step: 'ask_city' }
    ];

    for (const item of sequence) {
        await leadsManager.createOrUpdateLead(testUserId, {
            current_step: item.step,
            last_sent_message: item.sender
        });
        if (item.sender === 'client' && item.message) {
            await leadsManager.updateLastMessage(testUserId, 'client', item.message);
        }
        lead = await leadsManager.getLead(testUserId);
        assert(lead.last_sent_message === item.sender, `Last message should be from ${item.sender}`);
        if (item.sender === 'client' && item.message) {
            assert(lead.last_client_message === item.message, 'Client message content should be recorded');
        }
    }
    console.log('✅ Message sequence recorded correctly');

    // Cleanup test file
    await leadsManager.deleteLead(testUserId);
    console.log('\n🎉 All leads manager tests passed successfully!');
}

testLeadsManager().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 