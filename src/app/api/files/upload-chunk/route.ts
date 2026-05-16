import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { storageService } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const fileId = formData.get('file_id') as string;
    const chunkIndex = parseInt(formData.get('chunk_index') as string);
    const totalChunks = parseInt(formData.get('total_chunks') as string);
    const bucket = (formData.get('bucket') as string) || 'default';
    const fileName = (formData.get('file_name') as string) || 'chunk';

    if (!chunk || !fileId || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const arrayBuffer = await chunk.arrayBuffer();
    const result = await storageService.uploadChunk(user.id, bucket, fileId, chunkIndex, totalChunks, arrayBuffer, fileName);

    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ chunk_index: chunkIndex, total_chunks: totalChunks, uploaded: true });
  } catch (error) {
    console.error('Chunk upload error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Chunk upload failed' }, { status: 500 });
  }
}
