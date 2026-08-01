"use client";

// components/ChatWidget.js
//
// ডিপ্লোমা ভর্তি সহায়িকার চ্যাট উইজেট।
// সম্পূর্ণ বাংলায় ইউজার-ফ্রেন্ডলি চ্যাট অভিজ্ঞতা ও সুন্দর ভিজ্যুয়াল কমফোর্ট।

import { useState, useRef, useEffect } from "react";

const COLORS = {
  primaryDark: "#0F4C5C",
  primary: "#13687D",
  primaryLight: "#E6F4F8",
  accent: "#F08C2C",
  accentHover: "#D6771F",
  bg: "#FFFFFF",
  chatBg: "#F4F7F6",
  bubbleUser: "#13687D",
  bubbleBot: "#FFFFFF",
  text: "#1E293B",
  textLight: "#64748B",
  border: "#E2E8F0",
};

function parseMarkdownToReact(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let currentList = null; // 'ul' or 'ol'
  let listItems = [];

  const renderTextWithBold = (txt) => {
    const parts = txt.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} style={{ color: COLORS.primaryDark }}>{part.slice(2, -2)}</strong>;
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
        ? { margin: "6px 0", paddingLeft: "20px", listStyleType: "disc" }
        : { margin: "6px 0", paddingLeft: "20px", listStyleType: "decimal" };
        
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
        <h4 key={index} style={{ margin: "10px 0 5px 0", fontWeight: "700", fontSize: "14px", color: COLORS.primaryDark }}>
          {renderTextWithLinksAndBold(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      flushList(index);
      elements.push(
        <h3 key={index} style={{ margin: "12px 0 6px 0", fontWeight: "700", fontSize: "15px", color: COLORS.primaryDark }}>
          {renderTextWithLinksAndBold(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      flushList(index);
      elements.push(
        <h2 key={index} style={{ margin: "14px 0 8px 0", fontWeight: "700", fontSize: "16px", color: COLORS.primaryDark }}>
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
        <li key={`li-${index}`} style={{ margin: "4px 0", lineHeight: "1.5" }}>
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
        <li key={`li-${index}`} style={{ margin: "4px 0", lineHeight: "1.5" }}>
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
        <div key={index} style={{ margin: "4px 0", lineHeight: "1.5" }}>
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
  const WELCOME_MSG = "আসসালামু আলাইকুম! আমি পলিটেকনিক গাইড 🎓\nতোমার বা আপনাদের পলিটেকনিক ভর্তি, চয়েস লিস্ট বা সিট সম্পর্কিত যেকোনো প্রশ্ন করতে পারো — আমি সহজ ভাষায় বিস্তারিত বুঝিয়ে দেব।";
  
  const [messages, setMessages] = useState([{ role: "assistant", content: WELCOME_MSG }]);
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth <= 600;
      if (isOpen && isMobile) {
        const scrollY = window.scrollY;
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";
        document.body.dataset.scrollY = scrollY.toString();
      } else {
        const scrollY = parseInt(document.body.dataset.scrollY || "0", 10);
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        if (scrollY > 0) {
          window.scrollTo(0, scrollY);
        }
      }
    }
    return () => {
      if (typeof window !== "undefined") {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
      }
    };
  }, [isOpen]);

  const getOrCreateVisitorId = () => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("visitor_id");
    if (!id) {
      id = "visitor_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("visitor_id", id);
    }
    return id;
  };

  async function sendMessage(textToSend) {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoadingRef.current) return;

    const updatedMessages = [...messagesRef.current, { role: "user", content: trimmed }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const visitorId = getOrCreateVisitorId();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, visitorId }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error occurred");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পর আবার চেষ্টা করুন।",
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
        @keyframes pulseDot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .dot1 { animation: pulseDot 1.4s infinite 0s; }
        .dot2 { animation: pulseDot 1.4s infinite 0.2s; }
        .dot3 { animation: pulseDot 1.4s infinite 0.4s; }

        @media (max-width: 600px) {
          .chat-wrapper-open {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            right: 0 !important;
            width: 100vw !important;
            height: auto !important;
            max-width: 100vw !important;
            max-height: 100% !important;
            z-index: 99999 !important;
            margin: 0 !important;
          }
          .chat-panel {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            right: 0 !important;
            width: 100vw !important;
            height: auto !important;
            max-width: 100vw !important;
            max-height: 100% !important;
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
            <div style={styles.headerAvatarContainer}>
              <div style={styles.avatarCircle}>🎓</div>
              <div>
                <div style={styles.headerTitle}>পলিটেকনিক গাইড AI</div>
                <div style={styles.headerSubtitle}>
                  <span style={styles.onlineDot} /> অনলাইন সাহায্যকারী
                </div>
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

          {/* Messages Container */}
          <div style={styles.messages} ref={scrollRef}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  ...styles.msgRow,
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {m.role === "assistant" && (
                  <div style={styles.msgBotAvatar}>🎓</div>
                )}
                <div
                  style={{
                    ...styles.bubble,
                    background:
                      m.role === "user" ? COLORS.bubbleUser : COLORS.bubbleBot,
                    color: m.role === "user" ? "#FFFFFF" : COLORS.text,
                    border: m.role === "user" ? "none" : `1px solid ${COLORS.border}`,
                    borderBottomRightRadius: m.role === "user" ? 4 : 16,
                    borderBottomLeftRadius: m.role === "user" ? 16 : 4,
                    boxShadow: m.role === "user" ? "0 2px 8px rgba(19,104,125,0.25)" : "0 2px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  {m.role === "user" ? m.content : parseMarkdownToReact(m.content)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ ...styles.msgRow, justifyContent: "flex-start" }}>
                <div style={styles.msgBotAvatar}>🎓</div>
                <div style={{ ...styles.bubble, background: COLORS.bubbleBot, border: `1px solid ${COLORS.border}`, padding: "12px 18px" }}>
                  <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                    <span className="dot1" style={styles.typingDot}></span>
                    <span className="dot2" style={styles.typingDot}></span>
                    <span className="dot3" style={styles.typingDot}></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div style={styles.inputRow}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="পলিটেকনিক বা ভর্তি নিয়ে প্রশ্ন লিখুন..."
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

          {/* Disclaimer Footer */}
          <div style={styles.disclaimer}>
            অফিশিয়াল ভর্তি সহায়তার জন্য আমাদের{" "}
            <a
              href="https://www.facebook.com/groups/1834671093536020"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.disclaimerLink}
            >
              ফেসবুক গ্রুপে
            </a>{" "}
            যুক্ত থাকুন।
          </div>
        </div>
      )}

      {/* Floating Chat Launcher Button */}
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
    bottom: 24,
    right: 24,
    zIndex: 9999,
    fontFamily:
      "'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif",
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    border: "none",
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    color: "#fff",
    fontSize: 26,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(15,76,92,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s ease, boxShadow 0.2s ease",
  },
  panel: {
    width: 375,
    maxWidth: "calc(100vw - 32px)",
    height: 540,
    maxHeight: "calc(100vh - 100px)",
    background: COLORS.bg,
    borderRadius: 20,
    boxShadow: "0 12px 48px rgba(0,0,0,0.18)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    marginBottom: 12,
    border: `1px solid ${COLORS.border}`,
  },
  header: {
    background: `linear-gradient(135deg, ${COLORS.primaryDark}, ${COLORS.primary})`,
    color: "#fff",
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerAvatarContainer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
  },
  headerTitle: { fontWeight: 700, fontSize: 16, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 12, opacity: 0.9, marginTop: 2, display: "flex", alignItems: "center", gap: 5 },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#10B981",
    display: "inline-block",
  },
  closeBtn: {
    background: "rgba(255,255,255,0.15)",
    border: "none",
    color: "#fff",
    fontSize: 16,
    width: 32,
    height: 32,
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: COLORS.chatBg,
  },
  msgRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  msgBotAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: COLORS.primaryLight,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: "82%",
    padding: "10px 14px",
    borderRadius: 16,
    fontSize: 14,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: COLORS.primary,
    display: "inline-block",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 14px",
    background: "#FFFFFF",
    borderTop: `1px solid ${COLORS.border}`,
  },
  textarea: {
    flex: 1,
    resize: "none",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 16, // Prevents iOS/Android input zoom
    fontFamily: "inherit",
    outline: "none",
    maxHeight: 90,
    background: "#F8FAFC",
    color: COLORS.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "none",
    background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`,
    color: "#fff",
    fontSize: 16,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 3px 10px rgba(240,140,44,0.3)",
  },
  disclaimer: {
    fontSize: 11.5,
    color: COLORS.textLight,
    textAlign: "center",
    padding: "6px 14px 10px 14px",
    background: "#FFFFFF",
    lineHeight: "1.4",
  },
  disclaimerLink: {
    color: COLORS.primary,
    fontWeight: "600",
    textDecoration: "underline",
  },
};
