import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const flowsDir = '/Users/omermaoz/whatssapp-bot/data/flows';
    const files = fs.readdirSync(flowsDir);
    
    // סינון רק קבצי JSON
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    return res.status(200).json(jsonFiles);
  } catch (error) {
    console.error('Error reading flows directory:', error);
    return res.status(500).json({ message: 'Error reading flows directory' });
  }
} 