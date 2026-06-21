// app/layout.js
import ChatWidget from "../components/ChatWidget";

export const metadata = {
  title: "পলিটেকনিক গাইড - ডিপ্লোমা ভর্তি ও নোটিশ অ্যাসিস্ট্যান্ট",
  description: "পলিটেকনিক ও কারিগরি শিক্ষা ভর্তি বিষয়ক সকল তথ্যের সমাধান ও এআই চ্যাটবট সহায়ক।",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Hind Siliguri', sans-serif", backgroundColor: "#f9fcfc" }}>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
