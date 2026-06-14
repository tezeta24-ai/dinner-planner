export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, url } = req.body || {};
  if (!name && !url) return res.status(400).json({ error: 'Provide name or url' });

  const query = url
    ? `A user shared this restaurant URL: ${url}. Identify the restaurant and look up its details for a group engagement dinner for 15-20 people in the DMV (DC/MD/VA) area.`
    : `Look up "${name}" restaurant in the DMV (DC/MD/VA) area for a group engagement dinner for 15-20 people.`;

  const prompt = `${query}

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "name": "Official restaurant name",
  "area": "Neighborhood and city",
  "cuisine": "Cuisine type in 2-4 words",
  "capacity": "one of: ✅ Yes | ⚠️ Tight | ❌ No — can they seat 15-20 in a private room?",
  "seatCap": "actual private room capacity e.g. 'up to 30' or '~14 max'",
  "cost": "estimated cost per person e.g. '$80–120+'",
  "seafood": "one of: Yes | Some | No",
  "website": "the restaurant's official website URL e.g. https://www.example.com, or empty string if unknown",
  "notes": "2-3 sentences on private dining options, vibe, and key considerations for an engagement celebration"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: 'You are a restaurant research assistant. Always respond with ONLY valid JSON. No markdown. No explanation.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data?.error?.message || 'API error' });

    const text = data.content?.[0]?.text || '';
    const match = text.replace(/```json|```/gi, '').trim().match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'No JSON in response', raw: text.slice(0, 200) });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
