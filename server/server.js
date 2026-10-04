const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI, Type } = require("@google/genai");

dotenv.config();

const app = express();

app.use(cors());

// Allow larger JSON requests because crop images are sent as Base64.
app.use(express.json({ limit: "10mb" }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  res.json({
    message: "AgroNova AI server is running.",
  });
});

/*
|--------------------------------------------------------------------------
| Existing AI Problem Analysis
|--------------------------------------------------------------------------
*/

app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { category, type, title, description, imageBase64, imageMimeType } =
      req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: "Title and description are required.",
      });
    }

    const prompt = `
You are an agricultural support assistant for AgroNova.

Analyze the following agricultural problem carefully.

Category: ${category || "Not specified"}
Type: ${type || "Not specified"}
Title: ${title}
Description: ${description}

${
  imageBase64
    ? `
An image of the reported agricultural problem has also been provided.

Carefully examine the image for visible:
- plant symptoms
- leaf discoloration
- spots
- lesions
- damage patterns
- pest signs
- growth abnormalities
- other visible agricultural symptoms

Use the image as supporting evidence, but do not assume that the image alone proves a diagnosis.
`
    : `
No image was provided. Base the analysis on the written information only.
`
}

Return a complete analysis.

The analysis must contain:
1. Possible problem or disease
2. Likely causes
3. Recommended next steps
4. Warning signs that require help from a qualified agriculturist or veterinarian

Important:
- Do not claim certainty from limited information.
- Mention possibilities rather than presenting an unconfirmed diagnosis as fact.
- If an image is provided, mention relevant visible symptoms when appropriate.
- Give practical and understandable advice.
- Do not recommend specific pesticide, fungicide, medicine, chemical product, or dosage.
- Complete every requested section.
`;

    const contentParts = [
      {
        text: prompt,
      },
    ];

    /*
     * Add image to Gemini when provided.
     */
    if (imageBase64) {
      contentParts.push({
        inlineData: {
          mimeType: imageMimeType || "image/jpeg",
          data: imageBase64,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",

      contents: [
        {
          role: "user",
          parts: contentParts,
        },
      ],

      config: {
        maxOutputTokens: 2500,

        thinkingConfig: {
          thinkingLevel: "minimal",
        },

        responseMimeType: "application/json",

        responseSchema: {
          type: Type.OBJECT,

          properties: {
            possibleProblem: {
              type: Type.STRING,
            },

            likelyCauses: {
              type: Type.STRING,
            },

            recommendedNextSteps: {
              type: Type.STRING,
            },

            warningSigns: {
              type: Type.STRING,
            },
          },

          required: [
            "possibleProblem",
            "likelyCauses",
            "recommendedNextSteps",
            "warningSigns",
          ],
        },
      },
    });

    console.log("FINISH REASON:", response.candidates?.[0]?.finishReason);

    console.log("USAGE:", response.usageMetadata);

    const rawText = response.text;

    if (!rawText || rawText.trim() === "") {
      return res.status(500).json({
        success: false,
        error: "AI returned an empty response.",
      });
    }

    let analysis;

    try {
      analysis = JSON.parse(rawText);
    } catch (parseError) {
      console.error("AI JSON PARSE ERROR:", parseError);
      console.error("RAW AI RESPONSE:", rawText);

      return res.status(500).json({
        success: false,
        error: "AI returned an invalid structured response.",
      });
    }

    console.log("AI STRUCTURED RESPONSE:", analysis);

    res.json({
      success: true,
      analysis: analysis,
    });
  } catch (error) {
    console.error("GEMINI ERROR:", error);

    res.status(500).json({
      success: false,
      error: "AI analysis failed.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| AI Agricultural Assistant — Brick 33
|--------------------------------------------------------------------------
*/

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required.",
      });
    }

    const contents = [];

    if (Array.isArray(history)) {
      for (const item of history) {
        if (!item?.role || !item?.text) {
          continue;
        }

        contents.push({
          role: item.role === "assistant" ? "model" : "user",
          parts: [
            {
              text: String(item.text),
            },
          ],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [
        {
          text: message.trim(),
        },
      ],
    });

    const systemInstruction = `
You are AgroNova AI Agricultural Assistant.

AgroNova is an agricultural support platform for farmers and
agriculturists.

Your job is to help users understand agricultural problems in a
simple, practical and responsible way.

You can help with:
- Crop problems
- Plant symptoms
- Possible diseases
- Pest-related problems
- Soil and cultivation questions
- Weather-related agricultural concerns
- Crop care
- General farming practices
- Questions about crop growth
- Questions about prevention and monitoring

Conversation rules:
1. Use the previous conversation to understand follow-up questions.
2. If the user asks a follow-up question such as "What about during
   heavy rain?", understand what crop/problem they were previously
   discussing.
3. Do not unnecessarily ask the user to repeat information already
   provided in the conversation.
4. If important information is missing, ask a short clarifying question.
5. Do not present an uncertain diagnosis as a confirmed fact.
6. Clearly distinguish between possibilities and confirmed information.
7. Give practical and understandable guidance.
8. Consider Bangladesh agricultural conditions when relevant.
9. Do not recommend a specific pesticide, fungicide, medicine,
   chemical product, brand, or dosage.
10. If chemical treatment is discussed, advise the user to consult a
    qualified agriculturist and follow the officially approved product
    label.
11. Do not provide dangerous instructions.
12. Keep responses reasonably concise but useful.
13. Use headings or bullet points when they improve readability.
14. If symptoms could have multiple causes, explain the main
    possibilities and what information would help distinguish them.
15. If an issue appears serious or rapidly spreading, recommend
    consulting a qualified agriculturist.

Always behave as a helpful agricultural support assistant, not as a
replacement for a qualified agriculturist.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",

      contents: contents,

      config: {
        maxOutputTokens: 1800,

        thinkingConfig: {
          thinkingLevel: "minimal",
        },

        systemInstruction: systemInstruction,
      },
    });

    const responseText = response.text;

    if (!responseText || responseText.trim() === "") {
      return res.status(500).json({
        success: false,
        error: "AI returned an empty response.",
      });
    }

    console.log("AI CHAT RESPONSE:", responseText);
    console.log("CHAT USAGE:", response.usageMetadata);

    res.json({
      success: true,
      response: responseText.trim(),
    });
  } catch (error) {
    console.error("GEMINI CHAT ERROR:", error);

    res.status(500).json({
      success: false,
      error: "AI assistant failed to respond.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Gemini Connection Test
|--------------------------------------------------------------------------
*/

app.get("/api/ai/test", async (req, res) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: "Say hello to AgroNova in one short sentence.",
    });

    res.json({
      success: true,
      response: response.text,
    });
  } catch (error) {
    console.error("GEMINI TEST ERROR:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`AgroNova AI server running on port ${PORT}`);
});
