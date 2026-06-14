const mongoose = require('mongoose');

/**
 * Single-document runtime configuration store (key: 'llm').
 * Holds the active LLM provider/model and any admin-supplied API keys.
 * API keys override the corresponding env vars when present.
 */
const AppSettingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    provider: { type: String, default: 'mistral' },
    model: { type: String, default: 'mistral-medium-latest' },
    // { mistral: '...', nim: '...', openai: '...' } — secrets, never returned raw.
    apiKeys: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSetting', AppSettingSchema);
