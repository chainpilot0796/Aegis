/**
 * NVIDIA NIM Fallback Service
 *
 * Silent fallback for AI inference when 0G Compute is unavailable or returns
 * no TEE-verifiable response. Same `chatCompletion({systemPrompt, userPrompt})`
 * shape as zeroGComputeService — minus the TEE signature.
 *
 * Required env: NIM_API_KEY, NIM_BASE_URL, NIM_MODEL.
 * Default base URL: https://integrate.api.nvidia.com/v1
 */

const axios = require("axios");

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
// meta/llama-3.3-70b-instruct is the latest and tested-good on the integrate.api.nvidia.com
// surface. Older meta/llama-3.1-70b-instruct hangs on some accounts.
const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";
// NIM 70B cold-start can blow past 20s on first call. Configurable via NIM_TIMEOUT_MS.
const DEFAULT_TIMEOUT_MS = 90_000;

function isConfigured() {
  return Boolean(process.env.NIM_API_KEY);
}

function getInfo() {
  return {
    configured: isConfigured(),
    baseUrl: process.env.NIM_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.NIM_MODEL || DEFAULT_MODEL,
  };
}

async function chatCompletion({ systemPrompt, userPrompt, model: modelOverride, apiKey }) {
  const key = apiKey || process.env.NIM_API_KEY;
  if (!key) {
    throw new Error("NIM not configured - set NIM_API_KEY");
  }
  const baseUrl = process.env.NIM_BASE_URL || DEFAULT_BASE_URL;
  const model = modelOverride || process.env.NIM_MODEL || DEFAULT_MODEL;
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
      timeout: Number(process.env.NIM_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    }
  );

  const content = res.data?.choices?.[0]?.message?.content || "";
  return { content, model };
}

module.exports = { isConfigured, getInfo, chatCompletion };
