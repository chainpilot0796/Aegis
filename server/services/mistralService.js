/**
 * Mistral AI Service
 *
 * Mistral exposes an OpenAI-compatible chat-completions endpoint, so the call
 * shape mirrors nimFallbackService: `chatCompletion({systemPrompt, userPrompt})`.
 *
 * The API key and model can be passed in per-call (used by the llmGateway when
 * an admin has set a runtime key/model), otherwise they fall back to env:
 *   MISTRAL_API_KEY, MISTRAL_BASE_URL, MISTRAL_MODEL.
 */

const axios = require("axios");

const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";
const DEFAULT_MODEL = "mistral-medium-latest";
const DEFAULT_TIMEOUT_MS = 60_000;

function isConfigured() {
  return Boolean(process.env.MISTRAL_API_KEY);
}

function getInfo() {
  return {
    configured: isConfigured(),
    baseUrl: process.env.MISTRAL_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.MISTRAL_MODEL || DEFAULT_MODEL,
  };
}

async function chatCompletion({ systemPrompt, userPrompt, model: modelOverride, apiKey }) {
  const key = apiKey || process.env.MISTRAL_API_KEY;
  if (!key) {
    throw new Error("Mistral not configured - set MISTRAL_API_KEY");
  }
  const baseUrl = process.env.MISTRAL_BASE_URL || DEFAULT_BASE_URL;
  const model = modelOverride || process.env.MISTRAL_MODEL || DEFAULT_MODEL;
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const res = await axios.post(
    url,
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      top_p: 0.95,
      max_tokens: 256,
      stream: false,
    },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: Number(process.env.MISTRAL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    }
  );

  const content = res.data?.choices?.[0]?.message?.content || "";
  return { content, model };
}

module.exports = { isConfigured, getInfo, chatCompletion, DEFAULT_MODEL };
