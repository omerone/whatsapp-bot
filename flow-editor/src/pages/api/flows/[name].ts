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
  const flowsDir = `/Users/omermaoz/whatssapp-bot/data/flows`;

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
  
  // PUT - עדכון שם של תסריט קיים
  else if (req.method === 'PUT') {
    try {
      const { oldName, newName } = req.body;
      
      if (!oldName || !newName || typeof oldName !== 'string' || typeof newName !== 'string') {
        return res.status(400).json({ message: 'Both oldName and newName are required' });
      }
      
      // בדיקת תקינות השמות
      if (oldName.includes('..') || oldName.includes('/') || oldName.includes('\\') ||
          newName.includes('..') || newName.includes('/') || newName.includes('\\')) {
        return res.status(400).json({ message: 'Invalid flow name' });
      }
      
      const oldPath = path.join(flowsDir, oldName);
      const newPath = path.join(flowsDir, newName);
      
      // בדיקה שהקובץ הישן קיים
      if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ message: `Original file ${oldName} not found` });
      }
      
      // בדיקה שהקובץ החדש לא קיים כבר
      if (fs.existsSync(newPath)) {
        return res.status(409).json({ message: `File with name ${newName} already exists` });
      }
      
      // שינוי שם הקובץ
      fs.renameSync(oldPath, newPath);
      
      return res.status(200).json({ message: `Flow renamed from ${oldName} to ${newName}` });
    } catch (error) {
      console.error(`Error renaming flow:`, error);
      return res.status(500).json({ message: 'Error renaming flow file' });
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
  
  // DELETE - מחיקת תסריט
  else if (req.method === 'DELETE') {
    try {
      // בדיקה אם הקובץ קיים
      if (!fs.existsSync(flowPath)) {
        return res.status(404).json({ message: 'Flow not found' });
      }
      
      // מחיקת הקובץ
      fs.unlinkSync(flowPath);
      
      return res.status(200).json({ message: 'Flow deleted successfully' });
    } catch (error) {
      console.error(`Error deleting flow ${name}:`, error);
      return res.status(500).json({ message: 'Error deleting flow file' });
    }
  }
  
  // שיטות אחרות אינן נתמכות
  else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
} 