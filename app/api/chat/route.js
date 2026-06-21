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

    // যদি ANTHROPIC_API_KEY এনভায়রনমেন্ট ভ্যারিয়েবল সেট করা না থাকে, তাহলে ফ্রি এআই ইঞ্জিন ব্যবহার করুন
    if (!process.env.ANTHROPIC_API_KEY) {
      const reply = getFreeResponse(messages);
      return Response.json({ reply });
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
      
      // Claude API তে কোনো সমস্যা হলে ফ্রি ইঞ্জিনে ফলব্যাক হবে যাতে সার্ভিস বন্ধ না হয়
      const reply = getFreeResponse(messages);
      return Response.json({ reply });
    }

    const data = await response.json();
    const textBlock = data.content?.find((c) => c.type === "text");

    return Response.json({
      reply: textBlock?.text || "দুঃখিত, উত্তর তৈরি করা যায়নি।",
    });
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
