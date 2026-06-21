// app/api/chat/route.js
//
// এই ফাইলটা Next.js App Router-এর একটা সার্ভারলেস API রুট।
// ফ্রন্টএন্ড (ChatWidget.jsx) এখানে মেসেজ পাঠাবে, এটা Claude API কল করে উত্তর ফেরত পাঠাবে।
// আপনার API key ব্রাউজারে কখনো যাবে না — এটা সবসময় সার্ভার সাইডে থাকে, এটাই নিরাপদ পদ্ধতি।

import { buildSystemPrompt } from "../../../lib/systemPrompt";

export async function POST(req) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages আবশ্যক" }, { status: 400 });
    }

    // সর্বশেষ ১০টা মেসেজ পাঠাচ্ছি (টোকেন খরচ কম রাখতে)
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
        model: "claude-haiku-4-5-20251001", // সাশ্রয়ী মডেল — চ্যাট গাইডলাইনের জন্য যথেষ্ট
        max_tokens: 800,
        system: buildSystemPrompt(),
        messages: trimmedHistory,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return Response.json(
        { error: "AI সার্ভিসে সমস্যা হয়েছে, একটু পর আবার চেষ্টা করুন।" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const textBlock = data.content?.find((c) => c.type === "text");

    return Response.json({
      reply: textBlock?.text || "দুঃখিত, উত্তর তৈরি করা যায়নি।",
    });
  } catch (err) {
    console.error("Chat route error:", err);
    return Response.json(
      { error: "সার্ভারে একটা সমস্যা হয়েছে। একটু পর আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
