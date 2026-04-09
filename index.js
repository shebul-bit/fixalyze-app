const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper: normalise URL
function normaliseUrl(input) {
  let url = input.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

// Helper: scrape page content
async function scrapePage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Fixalyze/1.0; +https://fixalyze.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    if (!response.ok) {
      return { success: false, reason: `Site returned status ${response.status}` };
    }

    const html = await response.text();

    // Extract useful text content from HTML
    // Remove scripts, styles, comments
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

    // Extract meta description
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const metaDesc = metaMatch ? metaMatch[1].trim() : '';

    // Extract h1s
    const h1Matches = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)];
    const h1s = h1Matches.map(m => m[1].trim()).filter(Boolean).slice(0, 5);

    // Extract h2s
    const h2Matches = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)];
    const h2s = h2Matches.map(m => m[1].trim()).filter(Boolean).slice(0, 8);

    // Check for common ecommerce signals
    const hasCart = /cart|basket|bag/i.test(html);
    const hasCheckout = /checkout/i.test(html);
    const hasPrice = /£|\$|€|price|gbp|usd/i.test(html);
    const hasReviews = /review|rating|stars|trustpilot/i.test(html);
    const hasShipping = /shipping|delivery|dispatch/i.test(html);
    const hasReturns = /return|refund/i.test(html);
    const hasSearch = /search/i.test(html);
    const hasNewsletter = /newsletter|subscribe|email/i.test(html);
    const hasSocialProof = /customers|orders|sold|happy/i.test(html);
    const hasTrustBadges = /secure|ssl|guaranteed|verified/i.test(html);
    const hasVideo = /<video|youtube|vimeo/i.test(html);
    const hasChatWidget = /livechat|intercom|zendesk|tawk|crisp/i.test(html);
    const isShopify = /shopify/i.test(html);
    const hasProductImages = /<img[^>]+product/i.test(html);
    const hasAddToCart = /add.to.cart|add_to_cart/i.test(html);

    // Get a meaningful text excerpt (first 3000 chars of visible content)
    const excerpt = cleaned.substring(0, 3000);

    return {
      success: true,
      title,
      metaDesc,
      h1s,
      h2s,
      signals: {
        hasCart, hasCheckout, hasPrice, hasReviews, hasShipping,
        hasReturns, hasSearch, hasNewsletter, hasSocialProof,
        hasTrustBadges, hasVideo, hasChatWidget, isShopify,
        hasProductImages, hasAddToCart
      },
      excerpt,
      url
    };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// Helper: get screenshot URL using screenshotone (free tier)
function getScreenshotUrl(url) {
  // Using a free screenshot service - no API key needed for basic use
  const encoded = encodeURIComponent(url);
  return `https://api.screenshotone.com/take?url=${encoded}&viewport_width=1280&viewport_height=800&format=jpg&image_quality=80&access_key=free`;
}

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

  const normalisedUrl = normaliseUrl(url);

  // Step 1: Scrape the page
  const scraped = await scrapePage(normalisedUrl);

  // Build context for AI
  let pageContext = '';
  if (scraped.success) {
    const s = scraped.signals;
    pageContext = `
REAL PAGE DATA scraped from ${normalisedUrl}:
- Page title: ${scraped.title}
- Meta description: ${scraped.metaDesc || 'MISSING - no meta description found'}
- H1 headings found: ${scraped.h1s.length > 0 ? scraped.h1s.join(' | ') : 'NONE FOUND'}
- H2 headings found: ${scraped.h2s.length > 0 ? scraped.h2s.join(' | ') : 'NONE FOUND'}
- Is built on Shopify: ${s.isShopify ? 'YES' : 'NOT DETECTED'}
- Has shopping cart: ${s.hasCart ? 'YES' : 'NOT DETECTED'}
- Has checkout flow: ${s.hasCheckout ? 'YES' : 'NOT DETECTED'}
- Has pricing visible: ${s.hasPrice ? 'YES' : 'NOT DETECTED'}
- Has customer reviews/ratings: ${s.hasReviews ? 'YES' : 'MISSING'}
- Has shipping information: ${s.hasShipping ? 'YES' : 'MISSING'}
- Has returns/refund info: ${s.hasReturns ? 'YES' : 'MISSING'}
- Has search functionality: ${s.hasSearch ? 'YES' : 'NOT DETECTED'}
- Has newsletter/email capture: ${s.hasNewsletter ? 'YES' : 'MISSING'}
- Has social proof (testimonials etc): ${s.hasSocialProof ? 'YES' : 'MISSING'}
- Has trust badges/security signals: ${s.hasTrustBadges ? 'YES' : 'MISSING'}
- Has product images: ${s.hasProductImages ? 'YES' : 'NOT DETECTED'}
- Has Add to Cart: ${s.hasAddToCart ? 'YES' : 'NOT DETECTED'}
- Has live chat: ${s.hasChatWidget ? 'YES' : 'NOT DETECTED'}
- Has video content: ${s.hasVideo ? 'YES' : 'NOT DETECTED'}

Page content excerpt: ${scraped.excerpt}
`;
  } else {
    pageContext = `Note: Could not scrape ${normalisedUrl} directly (reason: ${scraped.reason}). Base your audit on the URL, domain name, and common ecommerce UX patterns. Be transparent that this is based on typical patterns for this type of store.`;
  }

  const prompt = `You are an expert ecommerce UX and conversion rate optimisation consultant with 10 years experience, deep knowledge of established UX research and ecommerce conversion best practices.

${pageContext}

Based on the REAL DATA above, produce a thorough UX and CRO audit of ${normalisedUrl}.

You MUST respond ONLY with a valid JSON object. No markdown, no explanation, no text before or after. Just the raw JSON.

The JSON must follow this exact structure:

{
  "score": <number 0-100>,
  "scoreExplanation": "<2-3 sentences explaining the score based on real findings>",
  "totalIssuesFound": <number between 12 and 19>,
  "issues": [
    {
      "severity": "Critical",
      "title": "<short issue title>",
      "problem": "<what the problem is, referencing real page data where possible>",
      "impact": "<revenue impact in plain English>",
      "fix": "<exact step by step fix achievable without a developer>"
    }
  ],
  "quickWins": [
    "<specific quick win 1>",
    "<specific quick win 2>",
    "<specific quick win 3>"
  ],
  "weeklyTask": {
    "title": "<task title>",
    "steps": ["<step 1>", "<step 2>", "<step 3>", "<step 4>"]
  },
  "scrapedSuccessfully": ${scraped.success}
}

Rules:
- The issues array must contain EXACTLY 14 issues total
- Issues must be a mix of severities: at least 3 Critical, at least 4 Major, rest Minor
- Sort issues by severity: Critical first, then Major, then Minor
- Base every issue on the REAL DATA provided — reference actual missing elements detected
- Write in plain English, no jargon
- Every fix must be actionable without hiring a developer
- The score should reflect the real data: missing reviews, shipping info etc should lower it significantly
- Do not invent issues not supported by the data
- totalIssuesFound must match the issues array length exactly (14)`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        }
      })
    });

    const rawText = await response.text();

    if (!rawText || rawText.trim() === '') {
      return res.status(500).json({ error: 'Gemini returned an empty response.' });
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      return res.status(500).json({ error: 'Could not parse Gemini response.' });
    }

    if (data.error) {
      return res.status(500).json({ error: `Gemini error ${data.error.code}: ${data.error.message}` });
    }

    const auditText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!auditText) {
      return res.status(500).json({ error: 'Gemini response had no content.' });
    }

    // Parse the JSON from Gemini
    let auditData;
    try {
      // Strip any markdown code fences if present
      const cleaned = auditText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      auditData = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse audit JSON:', auditText.substring(0, 500));
      return res.status(500).json({ error: 'AI returned invalid format. Please try again.' });
    }

    // Screenshot URL
    const screenshotUrl = `https://image.thum.io/get/width/1280/crop/800/noanimate/${normalisedUrl}`;

    res.json({
      audit: auditData,
      screenshotUrl,
      scrapedUrl: normalisedUrl,
      scrapeSuccess: scraped.success
    });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Failed to reach Gemini API: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Fixalyze server running on port ${PORT}`);
});
