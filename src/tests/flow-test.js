const assert = require('assert');
const FlowEngine = require('../engine/FlowEngine');
const RulesManager = require('../engine/RulesManager');
const path = require('path');

async function testFlowConfiguration() {
    console.log('🧪 Starting flow configuration tests...\n');

    const flowPath = path.join(__dirname, '../../data/flow.json');
    const messagesPath = path.join(__dirname, '../../data/messages');
    const leadsPath = path.join(__dirname, '../../data/leads.json');

    // Mock WhatsApp client
    const mockWhatsAppClient = {
        sendMessage: async (to, message) => {
            console.log(`📱 Mock WhatsApp: Sending message to ${to}: ${message}`);
            return true;
        }
    };

    // Initialize FlowEngine
    const flowEngine = new FlowEngine(flowPath, messagesPath, leadsPath, mockWhatsAppClient);
    const initialized = await flowEngine.initialize();
    assert(initialized, 'FlowEngine should initialize successfully');
    console.log('✅ FlowEngine initialized successfully');

    // Test configuration structure
    assert(flowEngine.flow.metadata, 'Flow should have metadata section');
    assert(flowEngine.flow.configuration, 'Flow should have configuration section');
    assert(flowEngine.flow.configuration.rules, 'Flow should have rules configuration');
    assert(flowEngine.flow.configuration.client_management, 'Flow should have client management configuration');
    console.log('✅ Configuration structure is valid');

    // Test freeze functionality
    const testUserId = '972501234567@c.us';
    await flowEngine.freezeClient(testUserId, 'test_step');
    const lead = await flowEngine.leadsManager.getLead(testUserId);
    assert(lead.frozenUntil, 'Lead should be frozen');
    assert(lead.lastFreezeReason === 'test_step', 'Freeze reason should be set');
    console.log('✅ Freeze functionality works correctly');

    // Test reset functionality
    const resetResult = await flowEngine.handleResetKeyword(testUserId);
    assert(resetResult && resetResult.messages && resetResult.messages.length > 0, 'Reset should return messages');
    assert(resetResult.waitForUser === true, 'Reset should wait for user input');
    console.log('✅ Reset functionality works correctly');

    // Test RulesManager with new configuration
    const rulesManager = new RulesManager(flowEngine.flow);
    
    // Test conversation rules
    const mockMessage = {
        from: testUserId,
        body: 'test message',
        getContact: async () => ({ isMyContact: false }),
        getChat: async () => ({ archived: false })
    };

    const shouldProcess = await rulesManager.shouldProcessMessage(mockMessage);
    assert(shouldProcess === true, 'Valid message should be processed');
    console.log('✅ RulesManager conversation rules work correctly');

    // Test activation keywords
    const activationMessage = {
        ...mockMessage,
        body: 'תספורת test'
    };
    const hasKeywords = rulesManager.hasActivationKeywords(activationMessage.body);
    assert(hasKeywords === true, 'Activation keywords should be detected');
    console.log('✅ Activation keywords detection works correctly');

    console.log('\n🎉 All tests passed successfully!');
}

testFlowConfiguration().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 