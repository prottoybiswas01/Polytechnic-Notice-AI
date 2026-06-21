"use client";

// components/ChatWidget.js
//
// এই কম্পোনেন্টটা যেকোনো পেজে বসিয়ে দিলেই নিচে-ডানদিকে একটা চ্যাট বাবল দেখাবে।
// ব্যবহার: app/layout.js -এ <ChatWidget /> যোগ করুন, পুরো সাইটে দেখা যাবে।
//
// নোট: এই কম্পোনেন্ট কোনো ব্রাউজার স্টোরেজ (localStorage) ব্যবহার করে না —
// পেজ রিফ্রেশ করলে চ্যাট হিস্ট্রি মুছে যাবে। ভবিষ্যতে চাইলে ডাটাবেজে সেভ করা যাবে।

import { useState, useRef, useEffect } from "react";

const COLORS = {
  primaryDark: "#0F4C5C",
  primary: "#13687D",
  accent: "#F08C2C",
  bg: "#FFFFFF",
  bubbleUser: "#13687D",
  bubbleBot: "#F1F5F4",
  text: "#1A2E32",
  textLight: "#5C7378",
};

const WELCOME_MESSAGE = {
  role: "assistant",
  content:
    "আসসালামু আলাইকুম! আমি পলিটেকনিক গাইড 🎓\nডিপ্লোমা/পলিটেকনিক ভর্তি নিয়ে যেকোনো প্রশ্ন করতে পারেন — আমি ধাপে ধাপে বুঝিয়ে দেব।",
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const scrollRef = useRef(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const isVoiceModeRef = useRef(isVoiceMode);
  isVoiceModeRef.current = isVoiceMode;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isLoading]);

  // Clean-up synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.recognitionInstance) {
        window.recognitionInstance.stop();
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function speak(text, index) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      if (speakingIndex === index) {
        setSpeakingIndex(null);
        return;
      }
      
      const cleanText = text.replace(/[*#_`\-]/g, "").trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "bn-BD";

      // Try to find a Bengali voice
      const voices = window.speechSynthesis.getVoices();
      const bnVoice = voices.find(v => v.lang.includes("bn") || v.lang.includes("BN"));
      if (bnVoice) {
        utterance.voice = bnVoice;
      }

      utterance.onend = () => setSpeakingIndex(null);
      utterance.onerror = () => setSpeakingIndex(null);

      setSpeakingIndex(index);
      window.speechSynthesis.speak(utterance);
    }
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
    }
  }

  async function sendMessage(textToSend) {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoadingRef.current) return;

    const updatedMessages = [...messagesRef.current, { role: "user", content: trimmed }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "কিছু একটা সমস্যা হয়েছে");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);

      if (isVoiceModeRef.current) {
        speak(data.reply, updatedMessages.length);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পর আবার চেষ্টা করুন।",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    await sendMessage(trimmed);
  }

  useEffect(() => {
    const handleOpenChat = (e) => {
      setIsOpen(true);
      if (e.detail && e.detail.question) {
        sendMessage(e.detail.question);
      }
    };
    window.addEventListener("open-chat", handleOpenChat);
    return () => {
      window.removeEventListener("open-chat", handleOpenChat);
    };
  }, []);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function toggleListening() {
    if (isListening) {
      if (window.recognitionInstance) {
        window.recognitionInstance.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("দুঃখিত, আপনার ব্রাউজারে ভয়েস টাইপিং সমর্থিত নয়। অনুগ্রহ করে গুগল ক্রোম বা এজ ব্রাউজার ব্যবহার করুন।");
      return;
    }

    stopSpeaking();
    const recognition = new SpeechRecognition();
    recognition.lang = "bn-BD";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        await sendMessage(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    window.recognitionInstance = recognition;
    recognition.start();
  }

  return (
    <div style={styles.wrapper}>
      {/* Pulse Animation Style Injected */}
      <style>{`
        @keyframes voicePulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

      {isOpen && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <div>
              <div style={styles.headerTitle}>পলিটেকনিক গাইড</div>
              <div style={styles.headerSubtitle}>
                ডিপ্লোমা ভর্তি সহায়ক · ফ্রি
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => {
                  const nextVal = !isVoiceMode;
                  setIsVoiceMode(nextVal);
                  if (!nextVal) stopSpeaking();
                }}
                style={styles.headerActionBtn}
                title={isVoiceMode ? "ভয়েস রিডিং বন্ধ করুন" : "ভয়েস রিডিং চালু করুন"}
              >
                {isVoiceMode ? "🔊" : "🔇"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={styles.closeBtn}
                aria-label="বন্ধ করুন"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messages} ref={scrollRef}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  ...styles.msgRow,
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {m.role !== "user" && (
                  <button
                    onClick={() => speak(m.content, i)}
                    style={{
                      ...styles.speakMsgBtn,
                      color: speakingIndex === i ? COLORS.accent : COLORS.textLight,
                    }}
                    title="পড়ে শোনান"
                  >
                    {speakingIndex === i ? "🔊" : "🔈"}
                  </button>
                )}
                <div
                  style={{
                    ...styles.bubble,
                    background:
                      m.role === "user" ? COLORS.bubbleUser : COLORS.bubbleBot,
                    color: m.role === "user" ? "#fff" : COLORS.text,
                    borderBottomRightRadius: m.role === "user" ? 4 : 16,
                    borderBottomLeftRadius: m.role === "user" ? 16 : 4,
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ ...styles.msgRow, justifyContent: "flex-start" }}>
                <div style={{ ...styles.bubble, background: COLORS.bubbleBot, color: COLORS.textLight }}>
                  লিখছি...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={styles.inputRow}>
            <button
              onClick={toggleListening}
              style={{
                ...styles.micBtn,
                background: isListening ? "#EF4444" : "transparent",
                color: isListening ? "#fff" : COLORS.primary,
                animation: isListening ? "voicePulse 1.5s infinite" : "none",
                borderColor: isListening ? "#EF4444" : COLORS.border,
              }}
              title={isListening ? "শুনছি... বন্ধ করতে ক্লিক করুন" : "ভয়েস দিয়ে প্রশ্ন করুন"}
            >
              🎙️
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "শুনছি, কথা বলুন..." : "আপনার প্রশ্ন লিখুন..."}
              style={styles.textarea}
              rows={1}
              disabled={isListening}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || isListening}
              style={{
                ...styles.sendBtn,
                opacity: isLoading || !input.trim() || isListening ? 0.5 : 1,
              }}
              aria-label="পাঠান"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Floating bubble button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={styles.fab}
        aria-label="চ্যাট খুলুন"
      >
        {isOpen ? "✕" : "💬"}
      </button>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 9999,
    fontFamily:
      "'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif",
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: "50%",
    border: "none",
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    color: "#fff",
    fontSize: 24,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(15,76,92,0.35)",
  },
  panel: {
    width: 340,
    maxWidth: "calc(100vw - 40px)",
    height: 460,
    maxHeight: "calc(100vh - 120px)",
    background: COLORS.bg,
    borderRadius: 16,
    boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    marginBottom: 12,
  },
  header: {
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    color: "#fff",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontWeight: 700, fontSize: 15 },
  headerSubtitle: { fontSize: 12, opacity: 0.85, marginTop: 2 },
  headerActionBtn: {
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 16,
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 16,
    cursor: "pointer",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "#FAFBFB",
  },
  msgRow: { display: "flex", alignItems: "flex-end" },
  speakMsgBtn: {
    background: "transparent",
    border: "none",
    fontSize: 14,
    cursor: "pointer",
    marginRight: 6,
    padding: "4px",
    display: "flex",
    alignItems: "center",
    alignSelf: "center",
  },
  bubble: {
    maxWidth: "80%",
    padding: "9px 13px",
    borderRadius: 16,
    fontSize: 13.5,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTop: "1px solid #ECECEC",
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #DDE3E3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    cursor: "pointer",
    flexShrink: 0,
    transition: "all 0.2s",
  },
  textarea: {
    flex: 1,
    resize: "none",
    border: "1px solid #DDE3E3",
    borderRadius: 10,
    padding: "9px 11px",
    fontSize: 13.5,
    fontFamily: "inherit",
    outline: "none",
    maxHeight: 90,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "none",
    background: COLORS.accent,
    color: "#fff",
    fontSize: 15,
    cursor: "pointer",
    flexShrink: 0,
  },
};
