// app/page.js
"use client";

import { useState } from "react";

const COLORS = {
  primaryDark: "#0F4C5C",
  primary: "#13687D",
  accent: "#F08C2C",
  accentHover: "#D6771F",
  bg: "#FAFBFB",
  cardBg: "#FFFFFF",
  text: "#1A2E32",
  textLight: "#5C7378",
  border: "#E2E8F0",
};

export default function Home() {
  const [activeFaq, setActiveFaq] = useState(null);

  const sampleQuestions = [
    "পলিটেকনিকে ভর্তির জন্য ন্যূনতম কী যোগ্যতা লাগে?",
    "ডিপ্লোমা ইঞ্জিনিয়ারিং পড়ার মূল সুবিধাগুলো কী কী?",
    "ভর্তির চয়েস লিস্ট কীভাবে সাজালে চান্স পাওয়ার সম্ভাবনা বাড়ে?",
    "ভর্তির আবেদনের জন্য কী কী কাগজপত্র প্রয়োজন?",
  ];

  const faqs = [
    {
      q: "পলিটেকনিক গাইড AI কীভাবে কাজ করে?",
      a: "এটি একটি বুদ্ধিমান এআই সহায়ক। বাংলাদেশ কারিগরি শিক্ষা বোর্ডের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং ভর্তি প্রক্রিয়া, চয়েস লিস্ট সাজানো, প্রয়োজনীয় কাগজপত্র এবং অন্যান্য সাধারণ প্রশ্নের সঠিক গাইডলাইন দিতে এটি ডিজাইন করা হয়েছে।"
    },
    {
      q: "এর তথ্যের উৎস কী?",
      a: "আমাদের এআই বাংলাদেশ কারিগরি শিক্ষা বোর্ডের অফিসিয়াল নীতিমালা এবং আমাদের অ্যাডমিন প্যানেলের দেওয়া সর্বশেষ নোটিশ ও আপডেটের তথ্যের ওপর ভিত্তি করে উত্তর দেয়।"
    },
    {
      q: "এটি কি অফিসিয়াল কোনো অ্যাসিস্ট্যান্ট?",
      a: "না, এটি একটি অনানুষ্ঠানিক ফ্রি সহায়ক টুল যা ছাত্রছাত্রীদের ভর্তি প্রক্রিয়া সহজ করতে সাহায্য করার জন্য তৈরি করা হয়েছে। কোনো জটিল সমস্যায় সরাসরি অ্যাডমিনদের সাথে যোগাযোগ করার পরামর্শ দেওয়া হয়।"
    }
  ];

  return (
    <main style={styles.container}>
      <style>{`
        @media (max-width: 768px) {
          .header-container {
            padding: 15px 16px !important;
            flex-direction: column !important;
            gap: 10px !important;
            text-align: center !important;
          }
          .logo-text {
            font-size: 18px !important;
          }
          .hero-section {
            grid-template-columns: 1fr !important;
            gap: 30px !important;
            padding: 40px 16px !important;
            text-align: center !important;
          }
          .hero-content {
            align-items: center !important;
          }
          .hero-title {
            font-size: 28px !important;
            line-height: 1.3 !important;
          }
          .hero-subtitle {
            font-size: 15px !important;
            margin-bottom: 24px !important;
          }
          .cta-group {
            justify-content: center !important;
            width: 100% !important;
          }
          .hero-visual {
            width: 100% !important;
            margin-top: 10px !important;
          }
        }
      `}</style>

      {/* Header / Navbar */}
      <header className="header-container" style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🎓</span>
          <span className="logo-text" style={styles.logoText}>পলিটেকনিক গাইড <span style={styles.logoBadge}>AI</span></span>
        </div>
        <div style={styles.headerLinks}>
          <a href="https://www.facebook.com/groups/1834671093536020" target="_blank" rel="noopener noreferrer" style={styles.navLink}>
            ফেসবুক গ্রুপ
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section" style={styles.hero}>
        <div className="hero-content" style={styles.heroContent}>
          <span style={styles.badge}>ভর্তি সহায়িকা ২০২৬</span>
          <h1 className="hero-title" style={styles.heroTitle}>
            পলিটেকনিক ভর্তি নিয়ে যেকোনো দ্বিধা? <br />
            <span style={styles.highlight}>সমাধান দেবে কৃত্রিম বুদ্ধিমত্তা!</span>
          </h1>
          <p className="hero-subtitle" style={styles.heroSubtitle}>
            আমাদের এআই অ্যাসিস্ট্যান্টের সাথে সরাসরি চ্যাট করে জেনে নিন আবেদনের নিয়ম, প্রয়োজনীয় কাগজপত্র এবং চয়েস লিস্ট সাজানোর সেরা ট্রিকস।
          </p>

          <div className="cta-group" style={styles.ctaGroup}>
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent("open-chat"));
              }} 
              style={styles.primaryBtn}
            >
              সরাসরি চ্যাট করুন 💬
            </button>
            <a href="#samples" style={styles.secondaryBtn}>
              নমুনা প্রশ্নসমূহ
            </a>
          </div>
        </div>

        <div className="hero-visual" style={styles.heroVisual}>
          <div style={styles.sparkleCard}>
            <div style={styles.sparkleHeader}>
              <div style={styles.sparkleDot}></div>
              <span style={styles.sparkleTitle}>পলিটেকনিক গাইড এআই</span>
            </div>
            <div style={styles.sparkleBody}>
              <div style={styles.sparkleMsgUser}>ডিপ্লোমা করার সুবিধা কী কী?</div>
              <div style={styles.sparkleMsgBot}>
                ডিপ্লোমা ইঞ্জিনিয়ারিং হলো একটি <strong>কর্মমুখী শিক্ষা ব্যবস্থা</strong>। এর প্রধান সুবিধাগুলো হলো:<br />
                ১. কম সময়ে সরাসরি প্র্যাক্টিক্যাল কাজ শেখা যায়।<br />
                ২. সরকারি ও বেসরকারি খাতে দ্রুত চাকরি পাওয়ার সুযোগ।<br />
                ৩. ডুয়েট (DUET) সহ বিভিন্ন প্রযুক্তি বিশ্ববিদ্যালয়ে উচ্চশিক্ষার সুযোগ।
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Prompt Cards */}
      <section id="samples" style={styles.samplesSection}>
        <h2 style={styles.sectionTitle}>আমাদের এআই-কে জিজ্ঞেস করতে পারেন</h2>
        <p style={styles.sectionSubtitle}>নিচের প্রশ্নগুলো অথবা আপনার মনের যেকোনো প্রশ্ন নিচে-ডানদিকের চ্যাট উইজেটে লিখে পাঠান।</p>
        
        <div style={styles.grid}>
          {sampleQuestions.map((q, idx) => (
            <div 
              key={idx} 
              style={styles.card} 
              onClick={() => {
                window.dispatchEvent(new CustomEvent("open-chat", { detail: { question: q } }));
              }}
            >
              <div style={styles.cardIcon}>❓</div>
              <p style={styles.cardText}>{q}</p>
              <span style={styles.cardAction}>জিজ্ঞেস করুন →</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section style={styles.faqSection}>
        <h2 style={styles.sectionTitle}>সাধারণ জিজ্ঞাসা (FAQ)</h2>
        <div style={styles.faqContainer}>
          {faqs.map((faq, idx) => (
            <div key={idx} style={styles.faqItem}>
              <button 
                style={styles.faqQuestion} 
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
              >
                <span>{faq.q}</span>
                <span style={styles.faqArrow}>{activeFaq === idx ? "▲" : "▼"}</span>
              </button>
              {activeFaq === idx && (
                <div style={styles.faqAnswer}>
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>© ২০২৬ পলিটেকনিক গাইড AI. সর্বস্বত্ব সংরক্ষিত।</p>
        <p style={styles.footerSub}>কারিগরি শিক্ষার্থীদের সহায়তায় একটি স্বেচ্ছাসেবামূলক উদ্যোগ</p>
      </footer>
    </main>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    color: COLORS.text,
    background: `radial-gradient(circle at 10% 20%, rgba(19, 104, 125, 0.05) 0%, rgba(255, 255, 255, 1) 90%)`,
    fontFamily: "'Hind Siliguri', sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 5%",
    borderBottom: `1px solid ${COLORS.border}`,
    background: "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(8px)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    fontSize: 28,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: COLORS.primaryDark,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  logoBadge: {
    fontSize: 11,
    background: COLORS.accent,
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 6,
    fontWeight: 600,
  },
  headerLinks: {
    display: "flex",
    gap: 20,
  },
  navLink: {
    color: COLORS.primary,
    textDecoration: "none",
    fontWeight: 500,
    fontSize: 15,
    transition: "color 0.2s",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 40,
    padding: "60px 8%",
    alignItems: "center",
    maxWidth: 1200,
    margin: "0 auto",
    flex: 1,
  },
  heroContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  badge: {
    background: "rgba(19, 104, 125, 0.1)",
    color: COLORS.primary,
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 42,
    lineHeight: 1.3,
    fontWeight: 700,
    margin: "0 0 20px 0",
    color: COLORS.primaryDark,
  },
  highlight: {
    color: COLORS.primary,
    background: "linear-gradient(120deg, rgba(240, 140, 44, 0.15) 0%, rgba(240, 140, 44, 0.05) 100%)",
    padding: "0 4px",
  },
  heroSubtitle: {
    fontSize: 17,
    lineHeight: 1.6,
    color: COLORS.textLight,
    margin: "0 0 30px 0",
    maxWidth: 600,
  },
  ctaGroup: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  },
  primaryBtn: {
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    color: "#fff",
    border: "none",
    padding: "14px 28px",
    borderRadius: 30,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(19, 104, 125, 0.25)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  secondaryBtn: {
    background: "transparent",
    color: COLORS.primary,
    border: `2px solid ${COLORS.primary}`,
    padding: "12px 26px",
    borderRadius: 30,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center",
    transition: "background-color 0.2s, color 0.2s",
  },
  heroVisual: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  sparkleCard: {
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
    border: `1px solid ${COLORS.border}`,
    width: "100%",
    maxWidth: 380,
    overflow: "hidden",
  },
  sparkleHeader: {
    background: COLORS.primaryDark,
    color: "#fff",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sparkleDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#10B981",
  },
  sparkleTitle: {
    fontSize: 14,
    fontWeight: 600,
  },
  sparkleBody: {
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    fontSize: 13.5,
    lineHeight: 1.5,
  },
  sparkleMsgUser: {
    alignSelf: "flex-end",
    background: COLORS.primary,
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "12px 12px 2px 12px",
    maxWidth: "80%",
  },
  sparkleMsgBot: {
    alignSelf: "flex-start",
    background: "#F1F5F4",
    color: COLORS.text,
    padding: "10px 14px",
    borderRadius: "12px 12px 12px 2px",
    maxWidth: "90%",
  },
  samplesSection: {
    padding: "80px 5%",
    backgroundColor: "#F8FAFC",
    borderTop: `1px solid ${COLORS.border}`,
    borderBottom: `1px solid ${COLORS.border}`,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: COLORS.primaryDark,
    margin: "0 0 10px 0",
  },
  sectionSubtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    margin: "0 0 40px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 24,
    maxWidth: 1100,
    margin: "0 auto",
  },
  card: {
    background: COLORS.cardBg,
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)",
    border: `1px solid ${COLORS.border}`,
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 160,
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  cardIcon: {
    fontSize: 24,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14.5,
    fontWeight: 600,
    lineHeight: 1.5,
    margin: "0 0 16px 0",
    color: COLORS.text,
  },
  cardAction: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: 600,
  },
  faqSection: {
    padding: "80px 5%",
    maxWidth: 800,
    margin: "0 auto",
    width: "100%",
  },
  faqContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginTop: 30,
  },
  faqItem: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    background: "#fff",
    overflow: "hidden",
  },
  faqQuestion: {
    width: "100%",
    padding: "16px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "none",
    border: "none",
    fontSize: 16,
    fontWeight: 600,
    textAlign: "left",
    color: COLORS.text,
    cursor: "pointer",
    outline: "none",
  },
  faqArrow: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  faqAnswer: {
    padding: "0 20px 16px 20px",
    color: COLORS.textLight,
    fontSize: 14.5,
    lineHeight: 1.6,
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 16,
  },
  footer: {
    padding: "40px 5%",
    textAlign: "center",
    borderTop: `1px solid ${COLORS.border}`,
    marginTop: "auto",
    backgroundColor: "#fff",
  },
  footerSub: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 6,
  },
};
