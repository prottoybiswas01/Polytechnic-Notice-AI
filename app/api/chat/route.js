// app/api/chat/route.js
//
// এই ফাইলটা Next.js App Router-এর একটা সার্ভারলেস API রুট।
// ফ্রন্টএন্ড (ChatWidget.js) এখানে মেসেজ পাঠাবে, এটা Claude API কল করে উত্তর ফেরত পাঠাবে।
// আপনার API key ব্রাউজারে কখনো যাবে না — এটা সবসময় সার্ভার সাইডে থাকে, এটাই নিরাপদ পদ্ধতি।

import { buildSystemPrompt } from "../../../lib/systemPrompt";

export async function POST(req) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages আবশ্যক" }, { status: 400 });
    }

    // ১. যদি GEMINI_API_KEY থাকে, তাহলে সেটি ব্যবহার করুন (Google Gemini API - ফ্রি টায়ারে পাওয়া যায়)
    const geminiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6K3SHM-kHU4RPC_rhoW8OEO5TCxj70Zj0e13xWO1pWUEQ";
    if (geminiKey) {
      const contents = messages.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const makeRequest = async (useSearch) => {
        const bodyObj = {
          contents: contents,
          systemInstruction: {
            parts: [{ text: buildSystemPrompt() }],
          },
          generationConfig: {
            maxOutputTokens: 800,
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
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            body: JSON.stringify(bodyObj),
          }
        );
      };

      let response = await makeRequest(true);

      // যদি প্রথমবার ফেইল করে (যেমন গুগল সার্চ টুলের লিমিট/কোটার কারণে), তাহলে সার্চ ছাড়া আবার চেষ্টা করুন
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("Gemini API error (with search):", errData);
        
        console.log("Retrying Gemini API request without Google Search...");
        response = await makeRequest(false);
      }

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return Response.json({ reply: text });
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error("Gemini API fallback error:", errData);
        if (response.status === 429 || errData.error?.status === "RESOURCE_EXHAUSTED") {
          return Response.json({
            reply: "দুঃখিত, এআই সার্ভিসের ফ্রি কোটা সাময়িকভাবে শেষ হয়ে গেছে। অনুগ্রহ করে ১ মিনিট পর আবার চেষ্টা করুন।"
          });
        }
        return Response.json({
          reply: "দুঃখিত, এআই সার্ভিসে একটি সমস্যা হয়েছে। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।"
        });
      }
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
