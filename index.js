const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

// Homepage
app.get("/", (req, res) => {
  res.send(`
    <h1>Fixalyze</h1>
    <p>Enter your Shopify store URL below to get a free AI audit.</p>
    <form method="POST" action="/analyze">
      <input name="url" placeholder="Enter your Shopify store URL" style="width:300px;" required />
      <button type="submit">Analyse</button>
    </form>
  `);
});

// Analyze route
app.post("/analyze", async (req, res) => {
  const storeUrl = req.body.url;

  const prompt = `
You are a Shopify conversion expert.
Analyse this Shopify store: ${storeUrl}.
Output:
- High-impact issues
- Medium issues
- Quick wins
Include short explanation and suggested fix for each.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEN_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    console.log("Gemini response:", JSON.stringify(data, null, 2));

    const auditText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No audit returned";

    res.send(`
      <h2>Results for ${storeUrl}</h2>
      <pre style="white-space: pre-wrap;">${auditText}</pre>
      <a href="/">Run another audit</a>
    `);

  } catch (err) {
    console.error("ERROR:", err);

    res.send(`
      <h2>Results for ${storeUrl}</h2>
      <p>Error generating audit.</p>
      <a href="/">Run another audit</a>
    `);
  }
});

// Start server
app.listen(port, () => {
  console.log(`Fixalyze app running at port ${port}`);
});
