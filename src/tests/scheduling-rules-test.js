const assert = require('assert');
const RulesManager = require('../engine/RulesManager');

async function testSchedulingRules() {
    console.log('🧪 Starting scheduling rules tests...\n');

    // Create test rules with scheduling configuration
    const rules = {
        configuration: {
            rules: {
                blockedSources: {
                    ignoreContacts: true,
                    ignoreArchived: true,
                    ignoreGroups: true,
                    ignoreStatus: true
                }
            },
            client_management: {
                blockScheduledClients: {
                    enabled: true,
                    blockPastAndPresent: true,
                    blockFutureAndPresent: false,
                    allowRescheduling: true,
                    rescheduleOnlyFuture: true
                }
            }
        }
    };

    console.log('[RulesManager] Initialized with rules:', JSON.stringify(rules, null, 2));
    console.log('\n📝 Test 1: Client with past appointment');

    // Create mock integration manager with mock sheets service
    const mockSheetsService = {
        hasScheduledAppointment: async (phone, checkType) => {
            // Simulate a past appointment
            if (checkType === 'pastAndPresent') {
                return true;
            }
            return false;
        }
    };

    const mockIntegrationManager = {
        sheetsService: mockSheetsService,
        flowEngine: {
            leadsManager: {
                createOrUpdateLead: async (userId, data) => {
                    console.log(`[Mock] Updating lead for ${userId}:`, data);
                    return true;
                },
                getLead: async (userId) => {
                    return {
                        current_step: 'main_menu',
                        blocked: false,
                        frozenUntil: null
                    };
                }
            }
        }
    };

    // Initialize rules manager with mock integration manager
    const rulesManager = new RulesManager(rules, mockIntegrationManager);

    // Create mock message
    const mockMessage = {
        from: '972501234567@c.us',
        body: 'שלום',
        getContact: async () => ({ isMyContact: false }),
        getChat: async () => ({ archived: false })
    };

    // Test blocking client with past appointment
    const shouldProcess = await rulesManager.shouldProcessMessage(mockMessage);
    assert(shouldProcess === false, 'Should block client with past appointment');

    // Test 2: Test blocking a contact
    console.log('\n📝 Test 2: Contact message');
    const mockContactMessage = {
        ...mockMessage,
        getContact: async () => ({ isMyContact: true })
    };
    const shouldProcessContact = await rulesManager.shouldProcessMessage(mockContactMessage);
    assert(shouldProcessContact === false, 'Should block contact message');

    // Test 3: Test blocking an archived chat
    console.log('\n📝 Test 3: Archived chat message');
    const mockArchivedMessage = {
        ...mockMessage,
        getChat: async () => ({ archived: true })
    };
    const shouldProcessArchived = await rulesManager.shouldProcessMessage(mockArchivedMessage);
    assert(shouldProcessArchived === false, 'Should block archived chat message');

    // Test 4: Test blocking a group message
    console.log('\n📝 Test 4: Group message');
    const mockGroupMessage = {
        ...mockMessage,
        from: '120363166768988542@g.us'
    };
    const shouldProcessGroup = await rulesManager.shouldProcessMessage(mockGroupMessage);
    assert(shouldProcessGroup === false, 'Should block group message');

    console.log('✅ All tests passed!');
}

testSchedulingRules().catch(console.error); 