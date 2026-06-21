// app/api/chat/route.js
//
// এই ফাইলটা Next.js App Router-এর একটা সার্ভারলেস API রুট।
// ফ্রন্টএন্ড (ChatWidget.js) এখানে মেসেজ পাঠাবে, এটা Claude API কল করে উত্তর ফেরত পাঠাবে।
// আপনার API key ব্রাউজারে কখনো যাবে না — এটা সবসময় সার্ভার সাইডে থাকে, এটাই নিরাপদ পদ্ধতি।
// যদি কোনো API key না থাকে, এটি স্বয়ংক্রিয়ভাবে একটি ফ্রি অফলাইন এআই ইঞ্জিনে অফলোড হবে।

import { buildSystemPrompt } from "../../../lib/systemPrompt";
import { getFreeResponse } from "../../../lib/freeBot";

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

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            contents: contents,
            systemInstruction: {
              parts: [{ text: buildSystemPrompt() }],
            },
            generationConfig: {
              maxOutputTokens: 800,
            },
            tools: [
              {
                google_search: {},
              },
            ],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return Response.json({ reply: text });
        }
      } else {
        const errText = await response.text();
        console.error("Gemini API error:", errText);
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
      }
    }

    // ৩. কোনো API Key না থাকলে অফলাইন ফ্রি ইঞ্জিনে ফলব্যাক হবে
    const reply = getFreeResponse(messages);
    return Response.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    try {
      // যেকোনো এররে সেফটি ফলব্যাক
      const reply = getFreeResponse(messages);
      return Response.json({ reply });
    } catch (_) {
      return Response.json(
        { error: "সার্ভারে একটা সমস্যা হয়েছে। একটু পর আবার চেষ্টা করুন।" },
        { status: 500 }
      );
    }
  }
}
