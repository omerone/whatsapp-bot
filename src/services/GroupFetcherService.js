const fs = require('fs').promises;
const path = require('path');

class GroupFetcherService {
    /**
     * @param {import('whatsapp-web.js').Client} whatsappClient
     * @param {string} dataPath
     */
    constructor(whatsappClient, dataPath) {
        if (!whatsappClient) {
            throw new Error('WhatsApp client (whatsappClient) is required for GroupFetcherService.');
        }
        if (!dataPath) {
            throw new Error('Data path (dataPath) is required for GroupFetcherService.');
        }
        this.whatsappClient = whatsappClient;
        this.dataPath = dataPath;
        this.groupsFilePath = path.join(this.dataPath, 'group_ids.json');
    }

    /**
     * Fetches all group chats and saves their names and IDs to a JSON file.
     * This method should be called after the WhatsApp client is initialized and authenticated.
     */
    async fetchAndSaveGroupIds() {
        try {
            // Ensure client is ready
            let clientState = null;
            try {
                clientState = await this.whatsappClient.getState();
            } catch (e) {
                console.error('GroupFetcherService: WhatsApp client is not connected or ready. Cannot fetch chats.');
                // Depending on the desired behavior, you might want to throw this error
                // or handle it by not attempting to fetch chats.
                // For now, we log and return, assuming the client might connect later.
                return;
            }
            
            if (clientState !== 'CONNECTED' && clientState !== null) { // null can sometimes mean ready before first QR
                 console.warn(`GroupFetcherService: WhatsApp client state is "${clientState}". May not be able to fetch all chats.`);
            }


            const chats = await this.whatsappClient.getChats();
            if (!chats) {
                console.warn('GroupFetcherService: No chats found or client not ready.');
                return;
            }

            const groups = chats.filter(chat => chat.isGroup).map(group => ({
                name: group.name,
                id: group.id._serialized
            }));

            if (groups.length === 0) {
                // console.log('GroupFetcherService: No groups found for this WhatsApp account.');
            } else {
                // console.log(`GroupFetcherService: Found ${groups.length} groups.`);
            }

            await fs.writeFile(this.groupsFilePath, JSON.stringify(groups, null, 2));
            // console.log(`GroupFetcherService: Group IDs saved to ${this.groupsFilePath}`);

        } catch (error) {
            console.error('GroupFetcherService: Error fetching or saving group IDs:', error);
        }
    }

    /**
     * Loads the group IDs from the JSON file.
     * @returns {Promise<Array<{name: string, id: string}>>} A promise that resolves to an array of group objects, or an empty array if the file doesn't exist or an error occurs.
     */
    async loadGroupIds() {
        try {
            const data = await fs.readFile(this.groupsFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // console.log(`GroupFetcherService: Group IDs file not found at ${this.groupsFilePath}. You may need to run fetchAndSaveGroupIds first.`);
            } else {
                console.error('GroupFetcherService: Error loading group IDs from file:', error);
            }
            return [];
        }
    }
}

module.exports = GroupFetcherService; 