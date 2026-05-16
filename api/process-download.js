import supabase from './_supabase.js';

export const config = {
  maxDuration: 300, // 5 min for pro, 60s for hobby
};

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.find(b => b.name === 'telecloud');
  if (!exists) {
    await supabase.storage.createBucket('telecloud', {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024 * 1024,
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
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'File ID required' });

    // Get file record
    const { data: file, error: fetchErr } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !file) return res.status(404).json({ error: 'File not found' });
    if (file.status === 'complete') return res.status(200).json({ status: 'complete', download_url: file.download_url });

    // Update status to downloading
    await supabase.from('files').update({ status: 'downloading', progress: 5 }).eq('id', id);

    await ensureBucket();

    // Download the file from URL
    const response = await fetch(file.original_url, { redirect: 'follow' });
    if (!response.ok) {
      await supabase.from('files').update({ status: 'error', error_message: `Download failed: ${response.status}` }).eq('id', id);
      return res.status(400).json({ error: `Download failed: ${response.status}` });
    }

    // Get actual content length from response
    const actualSize = parseInt(response.headers.get('content-length') || '0');
    const contentType = response.headers.get('content-type') || file.content_type || 'application/octet-stream';
    
    // For files that fit in memory (under ~500MB on serverless), buffer and upload
    // For larger files we'll stream in chunks
    const CHUNK_LIMIT = 450 * 1024 * 1024; // ~450MB safe buffer limit
    
    if (actualSize > 0 && actualSize <= CHUNK_LIMIT) {
      // Buffer approach for smaller files
      await supabase.from('files').update({ progress: 20 }).eq('id', id);
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      await supabase.from('files').update({ progress: 60 }).eq('id', id);

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from('telecloud')
        .upload(file.storage_path, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadErr) {
        await supabase.from('files').update({ status: 'error', error_message: uploadErr.message }).eq('id', id);
        return res.status(500).json({ error: uploadErr.message });
      }
    } else {
      // Stream approach: collect chunks and upload
      await supabase.from('files').update({ progress: 10 }).eq('id', id);
      
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      let lastProgress = 10;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        
        // Update progress periodically
        const newProgress = Math.min(70, Math.floor(10 + (received / (actualSize || received)) * 60));
        if (newProgress > lastProgress + 5) {
          lastProgress = newProgress;
          await supabase.from('files').update({ progress: newProgress }).eq('id', id);
        }
      }
      
      // Combine chunks
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)), totalLength);
      
      await supabase.from('files').update({ progress: 75 }).eq('id', id);

      const { error: uploadErr } = await supabase.storage
        .from('telecloud')
        .upload(file.storage_path, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadErr) {
        await supabase.from('files').update({ status: 'error', error_message: uploadErr.message }).eq('id', id);
        return res.status(500).json({ error: uploadErr.message });
      }
    }

    await supabase.from('files').update({ progress: 90 }).eq('id', id);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('telecloud')
      .getPublicUrl(file.storage_path);

    const downloadUrl = urlData?.publicUrl || '';
    const finalSize = actualSize || file.file_size;

    // Update record as complete
    await supabase.from('files').update({
      status: 'complete',
      progress: 100,
      download_url: downloadUrl,
      file_size: finalSize,
      content_type: contentType,
    }).eq('id', id);

    return res.status(200).json({ status: 'complete', download_url: downloadUrl });
  } catch (err) {
    console.error('Process download error:', err);
    // Try to update the record with error
    try {
      const { id } = req.body;
      if (id) {
        await supabase.from('files').update({ status: 'error', error_message: err.message }).eq('id', id);
      }
    } catch {}
    res.status(500).json({ error: err.message });
  }
}
