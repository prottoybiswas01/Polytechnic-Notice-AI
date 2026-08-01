// app/api/chat/route.js
//
// এই ফাইলটা Next.js App Router-এর একটা সার্ভারলেস API রুট।
// ফ্রন্টএন্ড (ChatWidget.js) থেকে ইউজার মেসেজ গ্রহণ করে সরাসরি এআই ইঞ্জিনে পাঠাবে।
// ক্যাশিং তুলে দেওয়া হয়েছে যাতে প্রতিটি উত্তর রিয়েল-টাইম এবং লেটেস্ট গুগল সার্চের মাধ্যমে জেনারেট হয়।

import { buildSystemPrompt } from "../../../lib/systemPrompt";
import { recordMessage, blockApiKey, unblockApiKey, getBlockedKeys } from "../../../lib/apiTracker";
import { callCloudflareAI } from "../../../lib/cloudflareAI";

// Configuration for Gemini API key rotation
const apiConfig = {
  keys: [],
  currentIndex: 0,
  isInitialized: false
};

const keyMap = new Map(); // keyString -> keyName

// Load API Keys: GEMINI_KEY_1 to GEMINI_KEY_100 plus fallbacks dynamically at runtime
const loadApiKeys = () => {
  const loadedKeys = [];
  keyMap.clear();
  
  // Load keys GEMINI_KEY_1 to GEMINI_KEY_100 dynamically
  for (let i = 1; i <= 100; i++) {
    const keyName = `GEMINI_KEY_${i}`;
    const key = process.env[keyName];
    if (key) {
      loadedKeys.push(key);
      keyMap.set(key, keyName);
    }
  }

  // Fallback to GEMINI_API_KEY
  const fallback = process.env.GEMINI_API_KEY;
  if (fallback) {
    loadedKeys.push(fallback);
    if (!keyMap.has(fallback)) {
      keyMap.set(fallback, "GEMINI_API_KEY");
    }
  }

  // Remove empty keys and duplicates
  apiConfig.keys = Array.from(new Set(loadedKeys.filter(Boolean)));

  // Initialize index to 0 so we always start with the first key (sequential order)
  if (!apiConfig.isInitialized && apiConfig.keys.length > 0) {
    apiConfig.currentIndex = 0;
    apiConfig.isInitialized = true;
  }
};

// Initialize the keys array
loadApiKeys();

// Map to track blocked keys: keyName -> unblockTimestamp
const blockedKeys = new Map();
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 Minutes block duration for exhausted/rate-limited keys

/**
 * Tracks and returns the current active Gemini API key using Round-Robin.
 */
function getValidApiKey(forceRotate = false) {
  if (apiConfig.keys.length === 0) return null;

  const now = Date.now();

  let attempts = 0;
  while (attempts < apiConfig.keys.length) {
    if (forceRotate && attempts === 0) {
      apiConfig.currentIndex = (apiConfig.currentIndex + 1) % apiConfig.keys.length;
    }
    const candidateKey = apiConfig.keys[apiConfig.currentIndex];
    const candidateName = keyMap.get(candidateKey) || "UNKNOWN_KEY";
    const blockUntil = blockedKeys.get(candidateName);

    if (!blockUntil || now > blockUntil) {
      if (blockUntil) {
        blockedKeys.delete(candidateName);
        unblockApiKey(candidateName).catch(err => console.error("DB unblock error:", err));
      }
      return candidateKey;
    }

    // Key is blocked, move to next key
    apiConfig.currentIndex = (apiConfig.currentIndex + 1) % apiConfig.keys.length;
    attempts++;
  }

  // Fallback if all keys blocked
  const fallbackKey = apiConfig.keys[apiConfig.currentIndex];
  const fallbackName = keyMap.get(fallbackKey) || "UNKNOWN_KEY";
  blockedKeys.delete(fallbackName);
  unblockApiKey(fallbackName).catch(err => console.error("DB unblock error:", err));
  console.warn(`[Gemini API] All keys are currently blocked. Unblocking ${fallbackName} as fallback.`);
  return fallbackKey;
}

export async function POST(req) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages আবশ্যক" }, { status: 400 });
    }

    // Record message count in DB (async)
    recordMessage().catch((err) => console.error("[Tracker Error]:", err));

    // Load API Keys dynamically
    loadApiKeys();

    // Sync blocked keys from DB to memory
    try {
      const dbBlocked = await getBlockedKeys();
      blockedKeys.clear();
      for (const doc of dbBlocked) {
        blockedKeys.set(doc.keyName, doc.blockedUntil.getTime());
      }
    } catch (err) {
      console.error("[Tracker Sync Error]:", err);
    }

    // History Optimization: Slice to include ONLY the last 4 messages.
    const truncatedHistory = messages.slice(-4);
    const systemPrompt = buildSystemPrompt();

    // 1. Primary Engine: Gemini API with Live Google Search enabled
    if (apiConfig.keys.length > 0) {
      const makeRequest = async (apiKey, useSearch = true) => {
        const contents = truncatedHistory.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const bodyObj = {
          contents: contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            maxOutputTokens: 2500,
            temperature: 0.4,
            topP: 0.95,
          },
        };

        if (useSearch) {
          bodyObj.tools = [
            {
              google_search: {},
            },
          ];
        }

        return fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(bodyObj),
          }
        );
      };

      let success = false;
      let replyText = null;
      const totalKeys = apiConfig.keys.length;

      for (let attempt = 0; attempt < totalKeys; attempt++) {
        const currentKey = getValidApiKey(attempt > 0);
        if (!currentKey) break;

        // Try with Google Search first for fresh live data
        let response = await makeRequest(currentKey, true);
        let status = response.status;

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error(`[Gemini API] Search request failed on key index ${apiConfig.currentIndex} (status ${status}):`, errData);

          if (status === 429 || status === 401 || status === 403) {
            const keyName = keyMap.get(currentKey) || "UNKNOWN_KEY";
            blockedKeys.set(keyName, Date.now() + BLOCK_DURATION_MS);
            blockApiKey(keyName, BLOCK_DURATION_MS).catch(err => console.error("DB block error:", err));
            continue;
          }

          // Retry without search tool if search call had an issue
          response = await makeRequest(currentKey, false);
          status = response.status;
        }

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            replyText = text;
            success = true;
            break;
          }
        }
      }

      if (success && replyText) {
        return Response.json({ reply: replyText });
      }
    }

    // 2. Fallback Engine: Cloudflare Workers AI
    try {
      const cfResult = await callCloudflareAI(truncatedHistory, systemPrompt);
      if (cfResult.success && cfResult.reply) {
        console.log("[Cloudflare Workers AI] Successfully answered chat query.");
        return Response.json({ reply: cfResult.reply });
      }
    } catch (cfErr) {
      console.error("[Cloudflare Workers AI Error]:", cfErr);
    }

    // 3. Fallback Engine: Anthropic Claude
    if (process.env.ANTHROPIC_API_KEY) {
      const trimmedHistory = messages.slice(-4).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          system: systemPrompt,
          messages: trimmedHistory,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const textBlock = data.content?.find((c) => c.type === "text");
        if (textBlock?.text) {
          return Response.json({ reply: textBlock.text });
        }
      }
    }

    return Response.json({
      reply: "দুঃখিত, এই মুহূর্তে চ্যাটবট সার্ভিসে কোনো সাড়াশব্দ পাওয়া যাচ্ছে না। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।"
    });
  } catch (err) {
    console.error("Chat route error:", err);
    return Response.json({
      reply: "দুঃখিত, সার্ভারে একটি কারিগরি ত্রুটি ঘটেছে। অনুগ্রহ করে একটু পর চেষ্টা করুন।"
    });
  }
}
