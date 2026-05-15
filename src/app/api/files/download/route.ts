import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { storageService } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket') || 'default';
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    // Get file URL
    const url = await storageService.getFileUrl(user.id, bucket, key);

    if (!url) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get file info for content type
    const fileInfo = await storageService.getFileInfo(user.id, bucket, key);

    if (!fileInfo) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Redirect to Telegram file URL
    return NextResponse.json({
      url,
      file: {
        name: fileInfo.file_name,
        size: fileInfo.size,
        mime_type: fileInfo.mime_type,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
