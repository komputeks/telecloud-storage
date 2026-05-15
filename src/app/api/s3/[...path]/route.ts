import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { storageService } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabase';

// S3-compatible API endpoint
// Supports: GET (download), PUT (upload), DELETE, HEAD

function parseS3Path(path: string): { bucket: string; key: string } {
  const parts = path.split('/').filter(Boolean);
  const bucket = parts[0] || 'default';
  const key = parts.slice(1).join('/') || '';
  return { bucket, key };
}

function xmlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const { bucket, key } = parseS3Path(pathStr);

    // List buckets request
    if (!bucket) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner>
    <ID>telecloud</ID>
    <DisplayName>TeleCloud</DisplayName>
  </Owner>
  <Buckets>
  </Buckets>
</ListAllMyBucketsResult>`);
    }

    // Get auth
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '') || 
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Access Denied</Message>
</Error>`, 403);
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InvalidToken</Code>
  <Message>Invalid authentication token</Message>
</Error>`, 403);
    }

    // List objects in bucket
    if (!key) {
      const files = await storageService.listFiles(user.id, bucket);
      
      let contents = '';
      for (const file of files) {
        contents += `
  <Contents>
    <Key>${file.key}</Key>
    <LastModified>${file.updated_at}</LastModified>
    <ETag>"${file.id}"</ETag>
    <Size>${file.size}</Size>
    <StorageClass>STANDARD</StorageClass>
  </Contents>`;
      }

      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${bucket}</Name>
  <Prefix></Prefix>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
  ${contents}
</ListBucketResult>`);
    }

    // Get object
    const url = await storageService.getFileUrl(user.id, bucket, key);
    if (!url) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>NoSuchKey</Code>
  <Message>The specified key does not exist.</Message>
  <Key>${key}</Key>
</Error>`, 404);
    }

    // Redirect to file URL
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('S3 GET error:', error);
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InternalError</Code>
  <Message>Internal Server Error</Message>
</Error>`, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const { bucket, key } = parseS3Path(pathStr);

    if (!key) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InvalidRequest</Code>
  <Message>Key is required</Message>
</Error>`, 400);
    }

    // Get auth
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '') ||
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Access Denied</Message>
</Error>`, 403);
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InvalidToken</Code>
  <Message>Invalid authentication token</Message>
</Error>`, 403);
    }

    // Get file data
    const arrayBuffer = await request.arrayBuffer();
    const contentType = request.headers.get('content-type') || 'application/octet-stream';

    const result = await storageService.uploadFile(user.id, bucket, key, arrayBuffer, contentType);

    if (!result.success) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InternalError</Code>
  <Message>${result.error || 'Upload failed'}</Message>
</Error>`, 500);
    }

    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<PutObjectResult>
  <ETag>"${result.file?.id}"</ETag>
</PutObjectResult>`, 200);
  } catch (error) {
    console.error('S3 PUT error:', error);
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InternalError</Code>
  <Message>Internal Server Error</Message>
</Error>`, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const { bucket, key } = parseS3Path(pathStr);

    if (!key) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InvalidRequest</Code>
  <Message>Key is required</Message>
</Error>`, 400);
    }

    // Get auth
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '') ||
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Access Denied</Message>
</Error>`, 403);
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InvalidToken</Code>
  <Message>Invalid authentication token</Message>
</Error>`, 403);
    }

    const success = await storageService.deleteFile(user.id, bucket, key);

    if (!success) {
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>NoSuchKey</Code>
  <Message>The specified key does not exist.</Message>
</Error>`, 404);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('S3 DELETE error:', error);
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InternalError</Code>
  <Message>Internal Server Error</Message>
</Error>`, 500);
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const { bucket, key } = parseS3Path(pathStr);

    // Get auth
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '') ||
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return new NextResponse(null, { status: 403 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return new NextResponse(null, { status: 403 });
    }

    const fileInfo = await storageService.getFileInfo(user.id, bucket, key);

    if (!fileInfo) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Length': fileInfo.size.toString(),
        'Content-Type': fileInfo.mime_type,
        'Last-Modified': fileInfo.updated_at,
        'ETag': `"${fileInfo.id}"`,
      },
    });
  } catch (error) {
    console.error('S3 HEAD error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
