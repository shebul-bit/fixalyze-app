const express = require('express');
const path = require('path');

// Initialise Express FIRST before anything else
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Analyse endpoint
app.post('/analyze', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'No URL provided' });
  }

  const apiKey = process.env.GEN_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  const prompt = `You are an expert Shopify UX and conversion rate optimisation consultant.

Audit the following Shopify store URL: ${url}

Based on the URL and your knowledge of Shopify store best practices, provide a structured audit covering:

1. CONVERSION HEALTH SCORE (out of 100)
   Give an estimated score and explain why.

2. CRITICAL ISSUES (things costing sales right now)
   List up to 3 critical problems with:
   - What the issue is
   - Why it matters (in plain English, no jargon)
   - Exactly how to fix it in Shopify without a developer

3. MAJOR ISSUES (significant improvements needed)
   List up to 4 major issues with the same format.

4. QUICK WINS (easy fixes with high impact)
   List 3 things they can do today in under 30 minutes.

5. THIS WEEK'S CRO TASK
   Give one specific, actionable task to do this week that will have the most impact.

Write in plain English. Be specific and practical. No waffle. Every recommendation must be achievable in Shopify without hiring a developer.`;

  // Gemini API endpoint - using gemini-2.0-flash
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
        }
      })
    });

    // Read raw text first before trying to parse
    const rawText = await response.text();

    // Check if we got anything back
    if (!rawText || rawText.trim() === '') {
      return res.status(500).json({ error: 'Gemini returned an empty response. Check your API key.' });
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response:', rawText.substring(0, 500));
      return res.status(500).json({ error: 'Could not parse Gemini response. Raw: ' + rawText.substring(0, 200) });
    }

    // Check for API-level errors
    if (data.error) {
      console.error('Gemini API error:', data.error);
      return res.status(500).json({
        error: `Gemini error ${data.error.code}: ${data.error.message}`
      });
    }

    // Extract the text from the response
    const auditText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!auditText) {
      console.error('Unexpected Gemini response structure:', JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'Gemini response had no content. Unexpected structure.' });
    }

    res.json({ result: auditText });

  } catch (err) {
    console.error('Fetch error calling Gemini:', err.message);
    res.status(500).json({ error: 'Failed to reach Gemini API: ' + err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Fixalyze server running on port ${PORT}`);
});
