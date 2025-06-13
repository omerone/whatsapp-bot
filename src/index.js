const path = require('path');
const FlowEngine = require('./engine/FlowEngine');
const WhatsAppManager = require('./WhatsAppManager');
const ValidatorRegistry = require('./engine/ValidatorRegistry');

async function main() {
    try {
        const now = new Date();
        console.log(`[${now.toLocaleString('he-IL')}] מפעיל את הבוט...`);

        // Register validators
        ValidatorRegistry.registerStandardValidators();

        // 1. Create WhatsAppManager instance - it creates the client object internally.
        // Pass null for flowEngine initially; it will be set later.
        const whatsappManager = new WhatsAppManager(null);

        // 2. Create FlowEngine instance, passing whatsappManager.client to its constructor.
        const flowEngine = new FlowEngine(
            path.join(__dirname, '../data/flow.json'),
            path.join(__dirname, '../data/messages'),
            path.join(__dirname, '../data/leads.json'),
            whatsappManager.client // Pass the actual client instance
        );

        // 3. Set the created flowEngine instance on whatsappManager.
        // This requires adding a setFlowEngine method to WhatsAppManager.
        whatsappManager.setFlowEngine(flowEngine);

        // 4. Initialize FlowEngine.
        // It will use the whatsappClient (passed in constructor) to initialize IntegrationManager.
        const flowInitialized = await flowEngine.initialize();
        if (!flowInitialized) {
            throw new Error('אתחול ה-FlowEngine נכשל');
        }

        // 4b. Initialize RulesManager in WhatsAppManager now that flowEngine is fully initialized.
        whatsappManager.initializeRulesManager();

        // 5. Initialize WhatsAppManager.
        // It needs flowEngine to be initialized for its own readiness checks and message handling.
        const whatsappInitialized = await whatsappManager.initialize();
        if (!whatsappInitialized) {
            throw new Error('אתחול ה-WhatsApp נכשל');
        }

        // קריאה לאחזור קבוצות לאחר שהכל מוכן
        if (flowEngine && flowEngine.integrationManager) {
            await flowEngine.integrationManager.fetchGroupsAfterClientReady();
        }

        console.log(`[${new Date().toLocaleString('he-IL')}] הבוט מאותחל ומוכן לקבלת הודעות.`);

        // Handle process termination
        process.on('SIGTERM', async () => {
            const now = new Date();
            console.log(`[${now.toLocaleString('he-IL')}] מכבה את הבוט...`);
            try {
                await whatsappManager.client.destroy();
            } catch (error) {}
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            const now = new Date();
            console.log(`[${now.toLocaleString('he-IL')}] מכבה את הבוט...`);
            try {
                await whatsappManager.client.destroy();
            } catch (error) {}
            process.exit(0);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            const now = new Date();
            console.log(`[${now.toLocaleString('he-IL')}] שגיאה קריטית. מכבה את הבוט...`);
            try {
                await whatsappManager.client.destroy();
            } catch (cleanupError) {}
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', async (reason, promise) => {
            const now = new Date();
            console.log(`[${now.toLocaleString('he-IL')}] שגיאה לא מטופלת. מכבה את הבוט...`);
            try {
                await whatsappManager.client.destroy();
            } catch (cleanupError) {}
            process.exit(1);
        });

    } catch (error) {
        const now = new Date();
        console.log(`[${now.toLocaleString('he-IL')}] שגיאה באתחול הבוט: ${error.message}`);
        process.exit(1);
    }
}

main(); 