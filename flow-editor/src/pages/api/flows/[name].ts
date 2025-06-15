import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { name } = req.query;
  
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: 'Flow name is required' });
  }

  // וידוא שאין ניסיון לגשת לקבצים מחוץ לתיקייה (path traversal)
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ message: 'Invalid flow name' });
  }

  const flowPath = `/Users/omermaoz/whatssapp-bot/data/flows/${name}`;

  // GET - קריאת תסריט
  if (req.method === 'GET') {
    try {
      if (!fs.existsSync(flowPath)) {
        return res.status(404).json({ message: 'Flow not found' });
      }

      const fileContent = fs.readFileSync(flowPath, 'utf-8');
      
      // בדיקה שזה JSON תקין
      try {
        JSON.parse(fileContent);
      } catch (e) {
        return res.status(500).json({ message: 'Invalid JSON file' });
      }

      // שליחת התוכן כמו שהוא
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(fileContent);
    } catch (error) {
      console.error(`Error reading flow ${name}:`, error);
      return res.status(500).json({ message: 'Error reading flow file' });
    }
  }
  
  // POST - שמירת תסריט
  else if (req.method === 'POST') {
    try {
      // וידוא שהתוכן הוא JSON תקין
      let content;
      try {
        content = typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2);
        JSON.parse(content); // בדיקה שזה JSON תקין
      } catch (e) {
        return res.status(400).json({ message: 'Invalid JSON content' });
      }
      
      // שמירת הקובץ
      fs.writeFileSync(flowPath, content, 'utf-8');
      
      return res.status(200).json({ message: 'Flow saved successfully' });
    } catch (error) {
      console.error(`Error saving flow ${name}:`, error);
      return res.status(500).json({ message: 'Error saving flow file' });
    }
  }
  
  // שיטות אחרות אינן נתמכות
  else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
} 