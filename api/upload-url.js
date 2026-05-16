import supabase from './_supabase.js';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

// Ensure bucket exists
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.find(b => b.name === 'telecloud');
  if (!exists) {
    await supabase.storage.createBucket('telecloud', {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
    });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // HEAD request to get file info
    const headRes = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (!headRes.ok) {
      // Some servers don't support HEAD, try GET with range
      const getRes = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
      if (!getRes.ok) {
        return res.status(400).json({ error: `Cannot access URL: ${getRes.status} ${getRes.statusText}` });
      }
      // Abort the body
      try { await getRes.body?.cancel(); } catch {}
    }

    const contentLength = parseInt(headRes.headers.get('content-length') || '0');
    const contentType = headRes.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = headRes.headers.get('content-disposition') || '';
    
    // Extract filename
    let filename = '';
    const cdMatch = contentDisposition.match(/filename[*]?=['"]?([^'"\s;]+)/i);
    if (cdMatch) {
      filename = decodeURIComponent(cdMatch[1]);
    }
    if (!filename) {
      const pathParts = parsedUrl.pathname.split('/');
      filename = decodeURIComponent(pathParts[pathParts.length - 1] || 'download');
    }
    // Clean filename
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!filename || filename === '_') filename = 'file_' + Date.now();

    if (contentLength > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `File too large: ${(contentLength / (1024*1024*1024)).toFixed(2)}GB. Max is 2GB.` });
    }

    // Create DB record with 'pending' status
    const storagePath = `uploads/${Date.now()}_${filename}`;
    const { data: record, error: dbErr } = await supabase
      .from('files')
      .insert({
        filename,
        original_url: url,
        file_size: contentLength || 0,
        content_type: contentType,
        storage_path: storagePath,
        status: 'pending',
        progress: 0,
      })
      .select()
      .single();
    if (dbErr) throw dbErr;

    return res.status(200).json({
      id: record.id,
      filename,
      file_size: contentLength,
      content_type: contentType,
      status: 'pending',
    });
  } catch (err) {
    console.error('Upload URL error:', err);
    res.status(500).json({ error: err.message });
  }
}
