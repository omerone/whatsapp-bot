const FlowEngine = require('./engine/FlowEngine');

// Mock WhatsApp client
const mockClient = {
  sendMessage: async (to, message) => {
    console.log(`[Mock WhatsApp] Sending to ${to}:`, message);
    return true;
  }
};

async function simulateConversation() {
  console.log('\n=== Starting Simulation ===\n');
  
  const flowEngine = new FlowEngine(
    '../data/flow.json',
    '../data/messages',
    '../data/leads.json',
    mockClient
  );
  
  await flowEngine.initialize();
  
  const userId = '972503533373@c.us';
  
  // Simulate first message
  console.log('\n1. First message (היי):');
  let response = await flowEngine.processStep(userId, 'היי', true);
  console.log('Response:', response);
  
  // Simulate menu selection (1)
  console.log('\n2. Menu selection (1):');
  response = await flowEngine.processStep(userId, '1', false);
  console.log('Response:', response);
  
  // Simulate name (עומר מעוז)
  console.log('\n3. Enter name (עומר מעוז):');
  response = await flowEngine.processStep(userId, 'עומר מעוז', false);
  console.log('Response:', response);
  
  // Simulate name confirmation (1)
  console.log('\n4. Confirm name (1):');
  response = await flowEngine.processStep(userId, '1', false);
  console.log('Response:', response);
  
  // Simulate city (לוד)
  console.log('\n5. Enter city (לוד):');
  response = await flowEngine.processStep(userId, 'לוד', false);
  console.log('Response:', response);
  
  // Simulate mobility (1 - car)
  console.log('\n6. Select mobility (1):');
  response = await flowEngine.processStep(userId, '1', false);
  console.log('Response:', response);
  
  // Simulate month selection (1)
  console.log('\n7. Select month (1):');
  response = await flowEngine.processStep(userId, '1', false);
  console.log('Response:', response);
  
  // Simulate week selection (1)
  console.log('\n8. Select week (1):');
  response = await flowEngine.processStep(userId, '1', false);
  console.log('Response:', response);
  
  // Simulate day selection (1)
  console.log('\n9. Select day (1):');
  response = await flowEngine.processStep(userId, '1', false);
  console.log('Response:', response);
  
  // Simulate time selection (10:00)
  console.log('\n10. Select time (10:00):');
  response = await flowEngine.processStep(userId, '10:00', false);
  console.log('Response:', response);
  
  console.log('\n=== End Simulation ===\n');
}

simulateConversation().catch(console.error); 