export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is missing in Vercel."
      });
    }

    let lastError = "Gemini is temporarily unavailable.";

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();

        const timeout = setTimeout(
          () => controller.abort(),
          30000
        );

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
            apiKey,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: message }]
                }
              ]
            }),
            signal: controller.signal
          }
        );

        clearTimeout(timeout);

        const data = await response.json();

        if (response.ok) {
          const reply =
            data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (reply) {
            return res.status(200).json({ reply });
          }

          lastError = "Gemini returned an empty response.";
        } else {
          lastError =
            data.error?.message || "Gemini API error";

          if (
            response.status !== 429 &&
            response.status !== 500 &&
            response.status !== 503
          ) {
            return res.status(response.status).json({
              error: lastError
            });
          }
        }
      } catch (error) {
        lastError =
          error.name === "AbortError"
            ? "Gemini response timed out."
            : "Connection to Gemini failed.";
      }

      if (attempt < 2) {
        await new Promise(resolve =>
          setTimeout(resolve, 2000)
        );
      }
    }

    return res.status(503).json({
      error: lastError
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}