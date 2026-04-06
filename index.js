const express = require("express");
const app = express();
const port = 3000;

// Middleware to parse form data
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

// Form submission
app.post("/analyze", (req, res) => {
  const url = req.body.url;
  res.send(`
    <h2>Results for ${url}</h2>
    <p>Coming soon: AI audit...</p>
    <a href="/">Run another audit</a>
  `);
});

// Start server
app.listen(port, () => {
  console.log(`Fixalyze app running at http://localhost:${port}`);
});
