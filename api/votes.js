import supabase from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'POST') {
      const { idea_id, vote_type } = req.body;
      // Update the idea's vote count
      const { data: idea, error: fetchErr } = await supabase
        .from('fortune_ideas')
        .select('upvotes, downvotes')
        .eq('id', idea_id)
        .single();
      if (fetchErr) throw fetchErr;

      const updates = vote_type === 'up'
        ? { upvotes: (idea.upvotes || 0) + 1 }
        : { downvotes: (idea.downvotes || 0) + 1 };

      const { data, error } = await supabase
        .from('fortune_ideas')
        .update(updates)
        .eq('id', idea_id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
