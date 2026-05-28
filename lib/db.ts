import fs from 'fs';
import path from 'path';

export interface Screenshot {
  id: string;
  url: string;
  text?: string;
  tags: string[];
  category?: string;
  summary?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
}

const dbDirectory = path.join(process.cwd(), 'data');
const dbFilePath = path.join(dbDirectory, 'screenshots.json');

function initDb() {
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }
  if (!fs.existsSync(dbFilePath)) {
    fs.writeFileSync(dbFilePath, JSON.stringify([], null, 2), 'utf-8');
  }
}

export async function getScreenshots(): Promise<Screenshot[]> {
  initDb();
  try {
    const data = fs.readFileSync(dbFilePath, 'utf-8');
    return JSON.parse(data) as Screenshot[];
  } catch (error) {
    console.error('Error reading JSON DB', error);
    return [];
  }
}

export async function saveScreenshots(screenshots: Screenshot[]): Promise<void> {
  initDb();
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(screenshots, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to JSON DB', error);
  }
}

export async function addScreenshot(screenshot: Omit<Screenshot, 'createdAt' | 'updatedAt'>): Promise<Screenshot> {
  const current = await getScreenshots();
  const now = new Date().toISOString();
  const newScreenshot: Screenshot = {
    ...screenshot,
    createdAt: now,
    updatedAt: now,
  };
  current.unshift(newScreenshot);
  await saveScreenshots(current);
  return newScreenshot;
}

export async function updateScreenshot(id: string, updates: Partial<Screenshot>): Promise<Screenshot | null> {
  const current = await getScreenshots();
  const index = current.findIndex(s => s.id === id);
  if (index === -1) return null;
  const now = new Date().toISOString();
  const updated = {
    ...current[index],
    ...updates,
    updatedAt: now,
  };
  current[index] = updated;
  await saveScreenshots(current);
  return updated;
}

export async function deleteScreenshotFromDb(id: string): Promise<boolean> {
  const current = await getScreenshots();
  const filtered = current.filter(s => s.id !== id);
  if (filtered.length === current.length) return false;
  await saveScreenshots(filtered);
  return true;
}
