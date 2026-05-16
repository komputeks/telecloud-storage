import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { storageService } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket') || 'default';
    const key = searchParams.get('key');
    const stream = searchParams.get('stream') === 'true';

    if (!key) return NextResponse.json({ error: 'Key is required' }, { status: 400 });

    const fileInfo = await storageService.getFileInfo(user.id, bucket, key);
    if (!fileInfo) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const isChunked = storageService.isChunkedFile(fileInfo);

    if (isChunked) {
      if (stream) {
        const result = await storageService.downloadChunkedFile(user.id, fileInfo.id);
        if (!result) return NextResponse.json({ error: 'Failed to download chunked file' }, { status: 500 });
        return new Response(result.stream, {
          headers: {
            'Content-Type': fileInfo.mime_type || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.file_name)}"`,
            'Content-Length': String(result.size),
          },
        });
      }
      return NextResponse.json({
        chunked: true,
        stream_url: `/api/files/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}&stream=true`,
        file: { name: fileInfo.file_name, size: fileInfo.size, mime_type: fileInfo.mime_type },
      });
    }

    const url = await storageService.getFileUrl(user.id, bucket, key);
    if (!url) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    return NextResponse.json({
      url,
      file: { name: fileInfo.file_name, size: fileInfo.size, mime_type: fileInfo.mime_type },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
