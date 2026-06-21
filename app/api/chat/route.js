// app/api/chat/route.js
//
// এই ফাইলটা Next.js App Router-এর একটা সার্ভারলেস API রুট।
// ফ্রন্টএন্ড (ChatWidget.js) এখানে মেসেজ পাঠাবে, এটা Gemini API কল করে উত্তর ফেরত পাঠাবে।
// প্রজেক্টের উচ্চ ট্রাফিক সামলানোর জন্য এতে ক্যাশিং, কী-রোটেশন এবং ফেলাইওভার মেকানিজম যুক্ত করা হয়েছে।

import { buildSystemPrompt } from "../../../lib/systemPrompt";
import { isQueryDynamic, findPersistentAnswer, savePersistentAnswer } from "../../../lib/qaStore";

// Configuration for Gemini API key rotation
const apiConfig = {
  keys: [],
  currentIndex: 0
};

// Load API Keys: GEMINI_KEY_1 to GEMINI_KEY_22 plus fallbacks
const loadApiKeys = () => {
  const loadedKeys = [];
  
  // Skip GEMINI_KEY_1 as it is verified to be invalid (401 Unauthorized)
  for (let i = 2; i <= 22; i++) {
    const key = process.env[`GEMINI_KEY_${i}`];
    if (key) {
      loadedKeys.push(key);
    }
  }

  // Fallback to GEMINI_API_KEY
  if (process.env.GEMINI_API_KEY) {
    loadedKeys.push(process.env.GEMINI_API_KEY);
  }

  // Hardcoded fallback key
  loadedKeys.push("AQ.Ab8RN6K3SHM-kHU4RPC_rhoW8OEO5TCxj70Zj0e13xWO1pWUEQ");

  // Remove empty keys and duplicates
  apiConfig.keys = Array.from(new Set(loadedKeys.filter(Boolean)));

  // Randomize initial index to load balance requests across all keys in serverless containers
  if (apiConfig.keys.length > 0) {
    apiConfig.currentIndex = Math.floor(Math.random() * apiConfig.keys.length);
  }
};

// Initialize the keys array
loadApiKeys();

/**
 * Tracks and returns the current active Gemini API key.
 * Rotates to the next key if forceRotate is true.
 */
function getValidApiKey(forceRotate = false) {
  if (apiConfig.keys.length === 0) return null;
  if (forceRotate) {
    apiConfig.currentIndex = (apiConfig.currentIndex + 1) % apiConfig.keys.length;
    console.warn(`[Gemini API Key Rotation] Rotated to key index ${apiConfig.currentIndex}`);
  }
  return apiConfig.keys[apiConfig.currentIndex];
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

// Helper to normalize user questions
function getNormalizedQuestion(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content.toLowerCase().trim();
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

    // 1. Cache & Persistent Storage Lookup (Deflects duplicate queries)
    const normQuestion = getNormalizedQuestion(messages);
    if (normQuestion) {
      // Step A: Check fast In-Memory Cache first
      const cachedEntry = cache.get(normQuestion);
      if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
        console.log(`[In-Memory Cache Hit] Serving response for: "${normQuestion}"`);
        return Response.json({ reply: cachedEntry.reply });
      }

      // Step B: Check MongoDB persistent cache for static queries
      if (!isQueryDynamic(normQuestion)) {
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
        const currentKey = getValidApiKey();
        if (!currentKey) break;

        console.log(`[Gemini API] Attempt ${attempt + 1}/${totalKeys} using key index ${apiConfig.currentIndex}`);

        // Step A: Attempt with Google Search enabled
        let response = await makeRequest(currentKey, true);

        // Step B: Fallback (Retry same key WITHOUT search if Step A fails)
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error(`[Gemini API] Search request failed on key index ${apiConfig.currentIndex}:`, errData);

          console.log(`[Gemini API] Retrying same key index ${apiConfig.currentIndex} WITHOUT Google Search...`);
          response = await makeRequest(currentKey, false);
        }

        // Process successful response
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
          console.error(`[Gemini API] Fallback request also failed on key index ${apiConfig.currentIndex}:`, errData);
        }

        // Step C: If both steps failed on current key, rotate index and continue loop
        getValidApiKey(true);
      }

      if (success && replyText) {
        // Cache the successful response
        if (normQuestion) {
          cache.set(normQuestion, {
            reply: replyText,
            timestamp: Date.now()
          });

          // Save to persistent database (MongoDB) if question is static
          if (!isQueryDynamic(normQuestion)) {
            savePersistentAnswer(normQuestion, replyText).catch((err) => {
              console.error("[MongoDB Async Save Error]:", err);
            });
          }
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
