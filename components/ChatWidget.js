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

function parseMarkdownToReact(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let currentList = null; // 'ul' or 'ol'
  let listItems = [];

  const renderTextWithBold = (txt) => {
    // Split by markdown bold format: **text**
    const parts = txt.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderTextWithLinksAndBold = (txt) => {
    if (!txt) return "";

    const regex = /(\[.*?\]\(.*?\)|https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.gov\.bd|[a-zA-Z0-9-]+\.gov\.bd)/g;
    const parts = txt.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      // 1. Markdown link [text](url)
      if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
          const anchorText = match[1];
          let url = match[2];
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
          }
          return (
            <a
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: COLORS.accent, fontWeight: "600", textDecoration: "underline" }}
            >
              {anchorText}
            </a>
          );
        }
      }
      // 2. Raw URL starting with http://, https://, or www.
      else if (part.startsWith("http://") || part.startsWith("https://") || part.startsWith("www.")) {
        let url = part;
        if (part.startsWith("www.")) {
          url = "https://" + part;
        }
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: COLORS.accent, fontWeight: "600", textDecoration: "underline" }}
          >
            {part}
          </a>
        );
      }
      // 3. Domain ending in .gov.bd
      else if (/\.gov\.bd/.test(part)) {
        const url = "https://" + part;
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: COLORS.accent, fontWeight: "600", textDecoration: "underline" }}
          >
            {part}
          </a>
        );
      }

      // 4. Default: render bold formatting
      return renderTextWithBold(part);
    });
  };

  const flushList = (key) => {
    if (currentList && listItems.length > 0) {
      const listStyle = currentList === "ul" 
        ? { margin: "4px 0", paddingLeft: "18px", listStyleType: "disc" }
        : { margin: "4px 0", paddingLeft: "18px", listStyleType: "decimal" };
        
      elements.push(
        currentList === "ul" ? (
          <ul key={`list-${key}`} style={listStyle}>
            {listItems}
          </ul>
        ) : (
          <ol key={`list-${key}`} style={listStyle}>
            {listItems}
          </ol>
        )
      );
      listItems = [];
      currentList = null;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith("### ")) {
      flushList(index);
      elements.push(
        <h4 key={index} style={{ margin: "8px 0 4px 0", fontWeight: "700", fontSize: "14px", color: COLORS.primaryDark }}>
          {renderTextWithLinksAndBold(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      flushList(index);
      elements.push(
        <h3 key={index} style={{ margin: "10px 0 5px 0", fontWeight: "700", fontSize: "15px", color: COLORS.primaryDark }}>
          {renderTextWithLinksAndBold(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      flushList(index);
      elements.push(
        <h2 key={index} style={{ margin: "12px 0 6px 0", fontWeight: "700", fontSize: "16px", color: COLORS.primaryDark }}>
          {renderTextWithLinksAndBold(trimmed.slice(2))}
        </h2>
      );
    }
    // Unordered lists
    else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      if (currentList !== "ul") {
        flushList(index);
        currentList = "ul";
      }
      listItems.push(
        <li key={`li-${index}`} style={{ margin: "3px 0", lineHeight: "1.4" }}>
          {renderTextWithLinksAndBold(trimmed.slice(2))}
        </li>
      );
    }
    // Numbered lists (support both Bengali and English digits)
    else if (/^\d+\.\s/.test(trimmed) || /^[১২৩৪৫৬৭৮৯০]+\.\s/.test(trimmed)) {
      if (currentList !== "ol") {
        flushList(index);
        currentList = "ol";
      }
      const match = trimmed.match(/^([^\s]+)\s(.*)/);
      const contentText = match ? match[2] : trimmed;
      listItems.push(
        <li key={`li-${index}`} style={{ margin: "3px 0", lineHeight: "1.4" }}>
          {renderTextWithLinksAndBold(contentText)}
        </li>
      );
    }
    // Empty line
    else if (trimmed === "") {
      flushList(index);
      elements.push(<div key={index} style={{ height: "6px" }} />);
    }
    // Normal text line
    else {
      flushList(index);
      elements.push(
        <div key={index} style={{ margin: "3px 0", lineHeight: "1.45" }}>
          {renderTextWithLinksAndBold(line)}
        </div>
      );
    }
  });

  flushList(lines.length);
  return elements;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isLoading]);

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

  return (
    <div className={isOpen ? "chat-wrapper-open" : "chat-wrapper"} style={styles.wrapper}>
      <style>{`
        @media (max-width: 600px) {
          .chat-wrapper-open {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            z-index: 99999 !important;
            margin: 0 !important;
          }
          .chat-panel {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            margin: 0 !important;
            z-index: 99999 !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .chat-fab-hidden {
            display: none !important;
          }
        }
      `}</style>
      {isOpen && (
        <div className="chat-panel" style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <div>
              <div style={styles.headerTitle}>পলিটেকনিক গাইড</div>
              <div style={styles.headerSubtitle}>
                ডিপ্লোমা ভর্তি সহায়ক · ফ্রি
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={styles.closeBtn}
              aria-label="বন্ধ করুন"
            >
              ✕
            </button>
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
                <div
                  style={{
                    ...styles.bubble,
                    background:
                      m.role === "user" ? COLORS.bubbleUser : COLORS.bubbleBot,
                    color: m.role === "user" ? "#fff" : COLORS.text,
                    borderBottomRightRadius: m.role === "user" ? 4 : 16,
                    borderBottomLeftRadius: m.role === "user" ? 16 : 4,
                    whiteSpace: m.role === "user" ? "pre-wrap" : "normal",
                  }}
                >
                  {m.role === "user" ? m.content : parseMarkdownToReact(m.content)}
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
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="আপনার প্রশ্ন লিখুন..."
              style={styles.textarea}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              style={{
                ...styles.sendBtn,
                opacity: isLoading || !input.trim() ? 0.5 : 1,
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
        className={isOpen ? "chat-fab-hidden" : "chat-fab"}
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
  msgRow: { display: "flex" },
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
