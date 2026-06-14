/**
 * WhatsApp webhook for Twilio.
 * Receives inbound SMS/WhatsApp, routes to Elsa agent, responds via TwiML or Twilio REST.
 * @see https://www.twilio.com/docs/whatsapp
 */

const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const elsaAgentService = require("../services/elsaAgentService");
const WalletLink = require("../models/WalletLink");

// Twilio expects application/x-www-form-urlencoded for webhooks
router.use(express.urlencoded({ extended: true }));

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const TWILIO_WHATSAPP_FROM =
  process.env.TWILIO_WHATSAPP_FROM ||
  (process.env.TWILIO_WHATSAPP_NUMBER
    ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER.replace(/^whatsapp:/i, "")}`
    : null);

function twimlResponse(message) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Send an outbound WhatsApp message via Twilio REST API.
 * Used for async follow-ups that come after the webhook has already responded.
 */
async function sendOutbound(to, body) {
  if (!twilioClient || !TWILIO_WHATSAPP_FROM) {
    console.warn(
      "[WhatsApp] Twilio not configured — cannot send outbound message",
    );
    return;
  }
  const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  await twilioClient.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: toWhatsApp,
    body: body.slice(0, 1600),
  });
}

/**
 * GET /api/whatsapp — health check (Twilio/browser may hit this)
 */
router.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "Aegis WhatsApp webhook",
    use: "POST with Twilio payload",
  });
});

/**
 * POST /api/whatsapp — Twilio webhook (inbound)
 * Body: Body, From, To, etc.
 */
router.post("/", async (req, res) => {
  // Always respond with TwiML so Twilio gets a valid response
  const send = (msg) => {
    res.type("text/xml").status(200).send(twimlResponse(msg));
  };

  try {
    const body = (req.body?.Body ?? req.body?.body ?? "").trim();
    const from = req.body?.From ?? req.body?.from;

    console.log("[WhatsApp] Incoming", {
      from: from?.slice(-4),
      body: body?.slice(0, 50),
    });

    if (!from) {
      console.warn("[WhatsApp] Missing From in webhook", {
        keys: req.body ? Object.keys(req.body) : "no body",
      });
    }

    if (!body) {
      send("Send a message to get started. Try: help");
      return;
    }

    // Normalize phone for WalletLink (strip whatsapp: prefix)
    const phone = from?.replace(/^whatsapp:/i, "") || from;

    // -----------------------------------------------------------------------
    // Shield / confirmation intents (ENS + Fileverse) can take > 15 seconds.
    // Twilio's webhook timeout is 15 s — if we wait for the full processing
    // Twilio drops the response and the user never sees the confirmation.
    //
    // Fix: when a YES-style reply arrives and there is a pending confirmation
    // stored for this phone number, respond to Twilio immediately with an
    // "Activating..." message, then process the shield asynchronously and
    // deliver the real result via the Twilio REST API (outbound message).
    // -----------------------------------------------------------------------
    const isYes =
      /^(yes|y|confirm|activate|ok|sure|do\s+it|proceed|go\s+ahead|approve)$/i.test(
        body.trim(),
      );

    if (isYes && elsaAgentService.hasPendingConfirmation(phone)) {
      // Respond to Twilio immediately (well within the 15-second window)
      send(
        "Activating your Yield Shield... ⏳\nYou'll receive a confirmation message shortly.",
      );

      // Process the shield creation in the background
      (async () => {
        try {
          const result = await elsaAgentService.processMessage(body, phone);
          const message =
            result.message ?? result.error ?? "Something went wrong.";
          const truncated =
            message.length > 1500 ? message.slice(0, 1500) + "\n..." : message;

          await sendOutbound(from, truncated);
        } catch (err) {
          console.error("[WhatsApp] Async shield activation error:", err);
          try {
            await sendOutbound(from, `Error activating shield: ${err.message}`);
          } catch (e) {
            console.error(
              "[WhatsApp] Failed to send error outbound:",
              e.message,
            );
          }
        }
      })();

      return;
    }

    // -----------------------------------------------------------------------
    // Normal (fast) intent flow — process synchronously and reply via TwiML
    // -----------------------------------------------------------------------

    // Handle link_wallet
    const result = await elsaAgentService.processMessage(body, phone);

    if (result.needsLink && result.address) {
      await WalletLink.findOneAndUpdate(
        { phone },
        { address: result.address.toLowerCase(), lastUsedAt: new Date() },
        { upsert: true },
      );
      send(`✅ Wallet linked: ${result.address.slice(0, 10)}...`);
      return;
    }

    const message = result.message ?? result.error ?? "Something went wrong.";

    // Truncate for SMS (1600 chars max for long segments)
    const truncated =
      message.length > 1500 ? message.slice(0, 1500) + "\n..." : message;

    send(truncated);
  } catch (err) {
    console.error("[WhatsApp] Error:", err);
    send(`Error: ${err.message}`);
  }
});

/**
 * POST /api/whatsapp/send — Send outbound message (e.g. for async confirmation)
 * Used when we need to send a follow-up (e.g. "Reply YES to confirm")
 */
router.post("/send", async (req, res) => {
  if (!twilioClient || !TWILIO_WHATSAPP_FROM) {
    return res.status(503).json({ error: "Twilio not configured" });
  }
  try {
    const { to, body } = req.body;
    if (!to || !body) {
      return res.status(400).json({ error: "Missing to or body" });
    }
    const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const msg = await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to: toWhatsApp,
      body: body.slice(0, 1600),
    });
    res.json({ success: true, sid: msg.sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
