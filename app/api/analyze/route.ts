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

    let base64Image = '';
    let mimeType = 'image/webp';

    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const imageRes = await fetch(url);
        if (!imageRes.ok) {
          throw new Error(`Failed to fetch image from URL: ${imageRes.statusText}`);
        }
        
        const contentType = imageRes.headers.get('content-type');
        if (contentType) {
          mimeType = contentType;
        }
        
        const arrayBuffer = await imageRes.arrayBuffer();
        base64Image = Buffer.from(arrayBuffer).toString('base64');
      } catch (err: any) {
        console.error('Error fetching external image:', err);
        return NextResponse.json({ error: 'Failed to access the external image URL' }, { status: 400 });
      }
    } else {
      const filename = url.replace('/uploads/', '');
      const filePath = path.join(process.cwd(), 'public', 'uploads', filename);

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Image file not found on server' }, { status: 404 });
      }

      const buffer = fs.readFileSync(filePath);
      base64Image = buffer.toString('base64');
      mimeType = getMimeType(filename);
    }

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
