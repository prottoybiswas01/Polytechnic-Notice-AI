// app/api/chat/route.js
//
// এই ফাইলটা Next.js App Router-এর একটা সার্ভারলেস API রুট।
// ফ্রন্টএন্ড (ChatWidget.js) এখানে মেসেজ পাঠাবে, এটা Claude API কল করে উত্তর ফেরত পাঠাবে।
// আপনার API key ব্রাউজারে কখনো যাবে না — এটা সবসময় সার্ভার সাইডে থাকে, এটাই নিরাপদ পদ্ধতি।

import { buildSystemPrompt } from "../../../lib/systemPrompt";

// Configuration for Gemini API key rotation
const apiConfig = {
  keys: [],
  currentIndex: 0
};

// Dynamically scan and load all GEMINI keys from environment variables
const loadApiKeys = () => {
  const loadedKeys = [];
  
  // Find all keys matching GEMINI_KEY_1, GEMINI_KEY_2, etc., dynamically
  const envKeys = Object.keys(process.env)
    .filter((key) => key.startsWith("GEMINI_KEY_"))
    .sort((a, b) => {
      const numA = parseInt(a.replace("GEMINI_KEY_", ""), 10) || 0;
      const numB = parseInt(b.replace("GEMINI_KEY_", ""), 10) || 0;
      return numA - numB;
    })
    .map((key) => process.env[key]);

  loadedKeys.push(...envKeys);

  // Fallback to GEMINI_API_KEY
  if (process.env.GEMINI_API_KEY) {
    loadedKeys.push(process.env.GEMINI_API_KEY);
  }

  // Hardcoded fallback key
  loadedKeys.push("AQ.Ab8RN6K3SHM-kHU4RPC_rhoW8OEO5TCxj70Zj0e13xWO1pWUEQ");

  // Filter out any empty/undefined keys and remove duplicates
  apiConfig.keys = Array.from(new Set(loadedKeys.filter(Boolean)));
};

// Initialize the keys array
loadApiKeys();

/**
 * Tracks and returns the current active Gemini API key.
 * Rotates to the next key if forceRotate is true (e.g., when a request fails with 429).
 */
function getValidApiKey(forceRotate = false) {
  if (apiConfig.keys.length === 0) return null;
  if (forceRotate) {
    apiConfig.currentIndex = (apiConfig.currentIndex + 1) % apiConfig.keys.length;
    console.warn(`[Gemini API Key Rotation] Rotated to key index ${apiConfig.currentIndex}`);
  }
  return apiConfig.keys[apiConfig.currentIndex];
}

export async function POST(req) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages আবশ্যক" }, { status: 400 });
    }

    // 4. Token Management: Truncate history before sending to the Gemini API.
    // Include user's latest query + previous 5 turns of conversation (10 messages).
    // Total max messages: 11.
    const maxHistoryCount = 11;
    const truncatedHistory = messages.slice(-maxHistoryCount);

    // ১. যদি Gemini API Keys থাকে, তাহলে সেটি ব্যবহার করুন (Google Gemini API - ফ্রি টায়ারে পাওয়া যায়)
    if (apiConfig.keys.length > 0) {
      const systemPrompt = buildSystemPrompt();

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
          // 1. Model Optimization: Use gemini-1.5-flash and configure for extreme efficiency.
          generationConfig: {
            maxOutputTokens: 800,
            temperature: 0.4, // Lower temperature keeps model responses focused and efficient
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
        const currentKey = getValidApiKey();
        if (!currentKey) break;

        console.log(`[Gemini API] Attempt ${attempt + 1}/${totalKeys} using key index ${apiConfig.currentIndex}`);

        // Step 1: Attempt call with google_search tool enabled (using current key)
        let response = await makeRequest(currentKey, true);

        // Step 2 (Tool-Fallback): If Step 1 returns a 429 or error, retry with same key but WITHOUT tools array
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error(`[Gemini API] Step 1 (Search) failed on key index ${apiConfig.currentIndex}:`, errData);

          console.log(`[Gemini API] Retrying without Google Search tool using key index ${apiConfig.currentIndex} (Step 2)...`);
          response = await makeRequest(currentKey, false);
        }

        // Process response if successful
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            replyText = text;
            success = true;
            break; // Break out of the key loop on success
          } else {
            console.warn(`[Gemini API] Success code but candidates text empty on key index ${apiConfig.currentIndex}.`);
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error(`[Gemini API] Step 2 (No-Search Fallback) failed on key index ${apiConfig.currentIndex}:`, errData);
        }

        // Step 3 (Key-Fallback): If Step 2 fails, log a "Key exhausted" warning, pick NEXT API key and retry
        console.warn(`[Gemini API] Key exhausted warning: API key index ${apiConfig.currentIndex} failed.`);
        getValidApiKey(true); // Rotate to next API key
      }

      if (success) {
        return Response.json({ reply: replyText });
      }

      // If we fall through the loop, Gemini fails. Since the system expects step 4 to return Service temporarily unavailable:
      // Step 4 (Final Stop): If all keys fail, return a clean { error: "Service temporarily unavailable" } response
      console.error("[Gemini API] All Gemini API keys failed or were exhausted.");
      return Response.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }

    // ২. যদি ANTHROPIC_API_KEY থাকে, তাহলে সেটি ব্যবহার করুন (Claude API)
    if (process.env.ANTHROPIC_API_KEY) {
      const trimmedHistory = messages.slice(-10).map((m) => ({
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

    // ৩. কোনো API Key না থাকলে এরর ফেরত দিন
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
