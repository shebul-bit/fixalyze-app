const express = require(‘express’);

const path = require(‘path’);

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(express.static(‘public’));

app.get(’/’, (req, res) => {

res.sendFile(path.join(__dirname, ‘public’, ‘index.html’));

});

app.post(’/analyze’, async (req, res) => {

const { url } = req.body;

if (!url) {

return res.status(400).json({ error: ‘No URL provided’ });

}

const apiKey = process.env.GEN_API_KEY;

if (!apiKey) {

return res.status(500).json({ error: ‘API key not configured on server’ });

}

const prompt = `You are an expert Shopify UX and conversion rate optimisation consultant with 10 years experience and deep knowledge of Baymard Institute research.

Audit the following Shopify store URL: ${url}

Based on the URL and your knowledge of Shopify store best practices, provide a structured audit covering ALL of the following sections in full. Do not cut off or summarise early. Complete every section.

1. CONVERSION HEALTH SCORE (out of 100)

   Give a score and explain in 2-3 sentences exactly why you gave that score.

1. CRITICAL ISSUES (things costing sales right now)

   List exactly 3 critical problems. For each one write:

- Issue: what the problem is

- Why it matters: the revenue impact in plain English

- Fix: exactly how to fix it in Shopify without a developer

1. MAJOR ISSUES (significant improvements needed)

   List exactly 4 major issues. For each one write:

- Issue: what the problem is

- Why it matters: the revenue impact in plain English

- Fix: exactly how to fix it in Shopify without a developer

1. QUICK WINS (easy fixes with high impact)

   List exactly 3 things they can do today in under 30 minutes. Be very specific.

1. THIS WEEK’S CRO TASK

   Give one single specific actionable task to do this week that will have the biggest impact on conversions. Include step by step instructions.

Rules:

- Write in plain English, no jargon

- Be specific and practical

- Every fix must be achievable in Shopify without hiring a developer

- Do not cut the response short

- Complete all 5 sections fully`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {

  const response = await fetch(geminiUrl, {

  method: ‘POST’,

  headers: { ‘Content-Type’: ‘application/json’ },

  body: JSON.stringify({

  contents: [{ parts: [{ text: prompt }] }],

  generationConfig: {

  temperature: 0.7,

  maxOutputTokens: 8192,

  }

  })

  });

  const rawText = await response.text();

  if (!rawText || rawText.trim() === ‘’) {

  return res.status(500).json({ error: ‘Gemini returned an empty response.’ });

  }

  let data;

  try {

  data = JSON.parse(rawText);

  } catch (parseErr) {

  return res.status(500).json({ error: ‘Could not parse Gemini response.’ });

  }

  if (data.error) {

  return res.status(500).json({ error: `Gemini error ${data.error.code}: ${data.error.message}` });

  }

  const auditText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!auditText) {

  return res.status(500).json({ error: ‘Gemini response had no content.’ });

  }

  res.json({ result: auditText });

  } catch (err) {

  res.status(500).json({ error: ’Failed to reach Gemini API: ’ + err.message });

  }

  });

app.listen(PORT, () => {

console.log(`Fixalyze server running on port ${PORT}`);

});
 
