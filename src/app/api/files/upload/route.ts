import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { storageService } from '@/lib/storage';

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as string || 'default';
    const key = formData.get('key') as string || file?.name;
    const url = formData.get('url') as string;
    const metadataStr = formData.get('metadata') as string;
    let parsedMetadata: Record<string, string> | undefined;
    let customMetadata: Record<string, unknown> | undefined;
    if (metadataStr) {
      try {
        const parsed = JSON.parse(metadataStr);
        if (parsed.description) {
          customMetadata = { description: parsed.description };
        }
        parsedMetadata = parsed;
      } catch { /* ignore */ }
    }

    // Handle URL upload
    if (url && !file) {
      const result = await storageService.uploadFromUrl(user.id, bucket, key, url, parsedMetadata, undefined, customMetadata);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ file: result.file });
    }

    // Handle file upload
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    const result = await storageService.uploadFile(
      user.id,
      bucket,
      key,
      arrayBuffer,
      file.type
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ file: result.file });
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
