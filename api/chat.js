export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Try Gemini first
  try {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
          geminiKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: message }] }]
          }),
          signal: AbortSignal.timeout(25000)
        }
      );

      const data = await response.json();

      if (response.ok) {
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (reply) {
          return res.status(200).json({
            reply,
            provider: "Gemini"
          });
        }
      }

      console.log("Gemini unavailable:", data.error?.message);
    }
  } catch (error) {
    console.log("Gemini failed:", error.message);
  }

  // If Gemini fails, try Groq
  try {
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
      return res.status(500).json({
        error: "Groq API key is missing in Vercel."
      });
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + groqKey
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "user",
              content: message
            }
          ]
        }),
        signal: AbortSignal.timeout(25000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Groq API error"
      });
    }

    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(503).json({
        error: "No response received from Groq."
      });
    }

    return res.status(200).json({
      reply,
      provider: "Groq"
    });

  } catch (error) {
    return res.status(503).json({
      error: "Both AI providers are temporarily unavailable."
    });
  }
}