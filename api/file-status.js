import supabase from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID required' });

    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', parseInt(id))
      .single();
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
