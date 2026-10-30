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

    // FIRST: Try Gemini
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const controller = new AbortController();

        const timer = setTimeout(
          () => controller.abort(),
          20000
        );

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
            geminiKey,
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

        clearTimeout(timer);

        const data = await response.json();

        if (response.ok) {
          const reply =
            data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (reply) {
            return res.status(200).json({
              reply: reply,
              provider: "Gemini"
            });
          }
        }

        console.log("Gemini unavailable:", data.error);

      } catch (error) {
        console.log("Gemini failed:", error.message);
      }
    }

    // SECOND: Automatically try Groq
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
      return res.status(500).json({
        error: "Groq API key is missing."
      });
    }

    try {
      const controller = new AbortController();

      const timer = setTimeout(
        () => controller.abort(),
        25000
      );

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + groqKey
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [
              {
                role: "system",
                content:
                  "You are PV AI, a helpful multilingual assistant. " +
                  "Support Gujarati, Hindi and English. " +
                  "When helping with PV Property, assist with Indian real estate, " +
                  "property advertisements and buyer enquiries. " +
                  "Never invent property facts."
              },
              {
                role: "user",
                content: message
              }
            ]
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timer);

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || "Groq API error"
        });
      }

      const reply =
        data.choices?.[0]?.message?.content;

      if (!reply) {
        return res.status(503).json({
          error: "Groq returned an empty response."
        });
      }

      return res.status(200).json({
        reply: reply,
        provider: "Groq"
      });

    } catch (error) {
      return res.status(503).json({
        error: "Groq connection failed. Please try again."
      });
    }

  } catch (error) {
    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}