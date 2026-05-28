import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    const all = searchParams.get('all');

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

    if (all === 'true') {
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(uploadsDir, file));
          } catch (e) {
            console.error('Error deleting file:', e);
          }
        }
      }
      return NextResponse.json({ success: true, message: 'All local screenshot files cleared successfully' });
    }

    if (!url) {
      return NextResponse.json({ error: 'File URL is required' }, { status: 400 });
    }

    const filename = url.replace('/uploads/', '');
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return NextResponse.json({ success: true, message: 'Physical file deleted' });
      } catch (err) {
        console.error('Error deleting physical file:', err);
        return NextResponse.json({ error: 'Failed to delete physical file' }, { status: 200 }); // Graceful
      }
    }

    return NextResponse.json({ success: true, message: 'File did not exist, skipped' });
  } catch (error) {
    console.error('Cleanup handler error:', error);
    return NextResponse.json({ error: 'Cleanup handle failed' }, { status: 500 });
  }
}
