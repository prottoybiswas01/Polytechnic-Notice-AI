// app/api/chat/route.js
//
// এই ফাইলটা Next.js App Router-এর একটা সার্ভারলেস API রুট।
// ফ্রন্টএন্ড (ChatWidget.js) এখানে মেসেজ পাঠাবে, এটা Gemini API কল করে উত্তর ফেরত পাঠাবে।
// প্রজেক্টের উচ্চ ট্রাফিক সামলানোর জন্য এতে ক্যাশিং, কী-রোটেশন এবং ফেলাইওভার মেকানিজম যুক্ত করা হয়েছে।

import { buildSystemPrompt } from "../../../lib/systemPrompt";
import { isQueryDynamic, findPersistentAnswer, savePersistentAnswer } from "../../../lib/qaStore";
import { recordMessage, blockApiKey, unblockApiKey, getBlockedKeys } from "../../../lib/apiTracker";

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

// Initialize the keys array (runs once on compile, and will be re-run inside POST at runtime)
loadApiKeys();

// Map to track blocked keys: keyName -> unblockTimestamp
const blockedKeys = new Map();
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 Minutes block duration for exhausted/rate-limited keys

/**
 * Tracks and returns the current active Gemini API key using Round-Robin.
 * Rotates to the next key on each call to distribute the concurrent request load,
 * and automatically skips any blocked keys.
 */
function getValidApiKey(forceRotate = false) {
  if (apiConfig.keys.length === 0) return null;

  const now = Date.now();

  // Find the next non-blocked key using Round-Robin (always incrementing on each call)
  let attempts = 0;
  while (attempts < apiConfig.keys.length) {
    // Round-Robin: Rotate to distribute load across keys
    apiConfig.currentIndex = (apiConfig.currentIndex + 1) % apiConfig.keys.length;

    const candidateKey = apiConfig.keys[apiConfig.currentIndex];
    const candidateName = keyMap.get(candidateKey) || "UNKNOWN_KEY";
    const blockUntil = blockedKeys.get(candidateName);

    if (!blockUntil || now > blockUntil) {
      // If it was blocked but block expired, remove it from blockedKeys and DB
      if (blockUntil) {
        blockedKeys.delete(candidateName);
        unblockApiKey(candidateName).catch(err => console.error("DB unblock error:", err));
      }
      return candidateKey;
    }

    // Key is blocked, move to next key
    attempts++;
  }

  // If ALL keys are blocked, fall back to trying the current index anyway (unblocking it)
  const fallbackKey = apiConfig.keys[apiConfig.currentIndex];
  const fallbackName = keyMap.get(fallbackKey) || "UNKNOWN_KEY";
  blockedKeys.delete(fallbackName);
  unblockApiKey(fallbackName).catch(err => console.error("DB unblock error:", err));
  console.warn(`[Gemini API] All keys are currently blocked. Unblocking ${fallbackName} as fallback.`);
  return fallbackKey;
}

// In-Memory Cache for Duplicate Queries
const cache = new Map();
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 Minutes TTL

// Periodically clean up expired cache entries to prevent memory leaks
if (global.cacheCleanupInterval) {
  clearInterval(global.cacheCleanupInterval);
}
global.cacheCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}, 10 * 60 * 1000); // runs every 10 minutes

// Helper to normalize user questions for maximum cache matching
function getNormalizedQuestion(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      let text = messages[i].content.toLowerCase();
      // Remove common Bengali and English punctuation marks and normalize whitespaces
      text = text.replace(/[?!\.,।\-\s]+/g, " ");
      return text.trim();
    }
  }
  return "";
}

export async function POST(req) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages আবশ্যক" }, { status: 400 });
    }

    // Record message count in DB (async, do not block response)
    recordMessage().catch((err) => console.error("[Tracker Error]:", err));

    // Re-evaluate environment keys dynamically at runtime to prevent serverless build-time environment variable caching
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

    // 1. Cache & Persistent Storage Lookup (Deflects duplicate queries, but bypasses for dynamic/live questions)
    const normQuestion = getNormalizedQuestion(messages);
    const isDynamic = normQuestion && isQueryDynamic(normQuestion);

    if (normQuestion && !isDynamic) {
      // Step A: Check fast In-Memory Cache first
      const cachedEntry = cache.get(normQuestion);
      if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
        console.log(`[In-Memory Cache Hit] Serving response for: "${normQuestion}"`);
        return Response.json({ reply: cachedEntry.reply });
      }

      // Step B: Check MongoDB persistent cache
      const persistentReply = await findPersistentAnswer(normQuestion);
      if (persistentReply) {
        // Warm up in-memory cache for subsequent quick hits
        cache.set(normQuestion, {
          reply: persistentReply,
          timestamp: Date.now()
        });
        return Response.json({ reply: persistentReply });
      }
    }

    // 2. Token & History Optimization: Slice to include ONLY the last 4 messages.
    // Extremely critical to prevent TPM throttling under high traffic.
    const truncatedHistory = messages.slice(-4);

    if (apiConfig.keys.length > 0) {
      const systemPrompt = buildSystemPrompt();

      // Function to trigger generateContent request
      const makeRequest = async (apiKey, useSearch) => {
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
            maxOutputTokens: 800,
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
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
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

      // 3. Multi-Layered Resilient Retry Loop
      for (let attempt = 0; attempt < totalKeys; attempt++) {
        const currentKey = getValidApiKey(attempt > 0);
        if (!currentKey) break;

        console.log(`[Gemini API] Attempt ${attempt + 1}/${totalKeys} using key index ${apiConfig.currentIndex}`);

        // Step A: Attempt with Google Search enabled
        let response = await makeRequest(currentKey, true);
        let status = response.status;

        // Step B: Fallback (Retry same key WITHOUT search if Step A fails)
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error(`[Gemini API] Search request failed on key index ${apiConfig.currentIndex} (status ${status}):`, errData);

          // If the key is rate limited (429) or unauthorized/forbidden (401/403), block it and rotate immediately
          if (status === 429 || status === 401 || status === 403) {
            const keyName = keyMap.get(currentKey) || "UNKNOWN_KEY";
            blockedKeys.set(keyName, Date.now() + BLOCK_DURATION_MS);
            blockApiKey(keyName, BLOCK_DURATION_MS).catch(err => console.error("DB block error:", err));
            console.warn(`[Gemini API] Key ${keyName} blocked due to status ${status} for ${BLOCK_DURATION_MS / 1000}s`);
            continue; // Skip retry without search, move to next key
          }

          console.log(`[Gemini API] Retrying same key index ${apiConfig.currentIndex} WITHOUT Google Search...`);
          response = await makeRequest(currentKey, false);
          status = response.status;
        }

        // Process response
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            replyText = text;
            success = true;
            break; // Break the key loop on success
          } else {
            console.warn(`[Gemini API] Response OK but content empty on key index ${apiConfig.currentIndex}.`);
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error(`[Gemini API] Fallback request also failed on key index ${apiConfig.currentIndex} (status ${status}):`, errData);

          // Block key if fallback also failed due to rate limits/auth issues
          if (status === 429 || status === 401 || status === 403) {
            const keyName = keyMap.get(currentKey) || "UNKNOWN_KEY";
            blockedKeys.set(keyName, Date.now() + BLOCK_DURATION_MS);
            blockApiKey(keyName, BLOCK_DURATION_MS).catch(err => console.error("DB block error:", err));
            console.warn(`[Gemini API] Key ${keyName} blocked due to fallback status ${status} for ${BLOCK_DURATION_MS / 1000}s`);
          }
        }
      }

      if (success && replyText) {
        // Cache the successful response (only if the query is NOT dynamic)
        if (normQuestion && !isDynamic) {
          cache.set(normQuestion, {
            reply: replyText,
            timestamp: Date.now()
          });

          // Save to persistent database (MongoDB)
          savePersistentAnswer(normQuestion, replyText).catch((err) => {
            console.error("[MongoDB Async Save Error]:", err);
          });
        }
        return Response.json({ reply: replyText });
      }

      console.error("[Gemini API] All API keys failed or were exhausted.");
      return Response.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }

    // Fallback block for Anthropic API
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
          system: buildSystemPrompt(),
          messages: trimmedHistory,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const textBlock = data.content?.find((c) => c.type === "text");
        if (textBlock?.text) {
          // Save response to in-memory cache and MongoDB (only if the query is NOT dynamic)
          if (normQuestion && !isDynamic) {
            cache.set(normQuestion, {
              reply: textBlock.text,
              timestamp: Date.now()
            });
            savePersistentAnswer(normQuestion, textBlock.text).catch((err) => {
              console.error("[MongoDB Async Save Error - Anthropic]:", err);
            });
          }
          return Response.json({ reply: textBlock.text });
        }
      } else {
        const errText = await response.text();
        console.error("Anthropic API error:", errText);
        return Response.json({
          reply: "দুঃখিত, এআই সার্ভিসে একটি সমস্যা হয়েছে। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।"
        });
      }
    }

    return Response.json({
      reply: "দুঃখিত, কোনো এআই সার্ভিস চ্যাটবটের সাথে সংযুক্ত নেই। অনুগ্রহ করে আপনার API Key কনফিগার করুন।"
    });
  } catch (err) {
    console.error("Chat route error:", err);
    return Response.json({
      reply: "দুঃখিত, সার্ভারে একটি কারিগরি ত্রুটি ঘটেছে। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।"
    });
  }
}
