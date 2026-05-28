import { NextRequest, NextResponse } from 'next/server';
import { processScreenshotWithAI } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';

// Helper to map file extensions to image mime types
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

export async function POST(req: NextRequest) {
  try {
    const { url, model, language, customPrompt } = await req.json();

    const authHeader = req.headers.get('Authorization');
    const customApiKey = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;

    if (!url) {
      return NextResponse.json({ error: 'Screenshot URL is required' }, { status: 400 });
    }

    const filename = url.replace('/uploads/', '');
    const filePath = path.join(process.cwd(), 'public', 'uploads', filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Image file not found on server' }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const base64Image = buffer.toString('base64');
    const mimeType = getMimeType(filename);

    try {
      const aiResult = await processScreenshotWithAI(base64Image, mimeType, model, language || 'id', customApiKey, customPrompt);

      return NextResponse.json({ success: true, result: aiResult });
    } catch (aiError: any) {
      console.error(`AI Analysis failed:`, aiError);
      
      const errorMsg = aiError?.message || String(aiError);
      let status = 200;
      
      if (errorMsg.includes('API_KEY_INVALID')) {
        status = 401; // Unauthorized
      } else if (errorMsg.includes('API_KEY_MISSING')) {
        status = 403; // Forbidden
      }

      return NextResponse.json({ 
        success: false, 
        error: errorMsg 
      }, { status });
    }

  } catch (error: any) {
    console.error('Analyze handler error:', error);
    return NextResponse.json({ error: 'Internal handler error' }, { status: 500 });
  }
}
