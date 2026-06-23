"use client";

import { useState, useEffect, useRef } from "react";

const COLORS = {
  primaryDark: "#0F4C5C",
  primary: "#13687D",
  accent: "#F08C2C",
  accentHover: "#D6771F",
  bg: "#F4F7F6",
  cardBg: "#FFFFFF",
  text: "#1A2E32",
  textLight: "#5C7378",
  border: "#E2E8F0",
  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
};

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [chartMode, setChartMode] = useState("visitors"); // "visitors" | "messages"
  const [dashboardError, setDashboardError] = useState("");
  const timerRef = useRef(null);

  // Check if token exists on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) {
      setIsAuthenticated(true);
      fetchDashboard(savedToken);
    }
  }, []);

  // Poll dashboard data and handle countdowns
  useEffect(() => {
    if (isAuthenticated) {
      // Fetch immediately
      const token = localStorage.getItem("admin_token");
      fetchDashboard(token);

      // Start periodic refresh every 10 seconds for real-time sync
      const interval = setInterval(() => {
        fetchDashboard(token, true); // silent refresh (no loading state)
      }, 10000);

      // Start local countdown timer (every 1 second)
      timerRef.current = setInterval(() => {
        setDashboardData((prev) => {
          if (!prev || !prev.keys) return prev;
          const updatedKeys = prev.keys.map((key) => {
            if (key.status === "blocked" && key.timeLeftMs > 0) {
              const newTimeLeft = Math.max(0, key.timeLeftMs - 1000);
              return {
                ...key,
                timeLeftMs: newTimeLeft,
                status: newTimeLeft === 0 ? "active" : "blocked",
              };
            }
            return key;
          });
          
          // Re-calculate blocked count if any key's block expired locally
          const blockedCount = updatedKeys.filter((k) => k.status === "blocked").length;
          const activeCount = updatedKeys.length - blockedCount;
          
          return {
            ...prev,
            keys: updatedKeys,
            metrics: {
              ...prev.metrics,
              activeKeysCount: activeCount,
              blockedKeysCount: blockedCount,
            },
          };
        });
      }, 1000);

      return () => {
        clearInterval(interval);
        clearInterval(timerRef.current);
      };
    }
  }, [isAuthenticated]);

  const fetchDashboard = async (token, isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard", {
        method: "GET",
        headers: {
          Authorization: token,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setDashboardData(data);
        setDashboardError("");
      } else {
        if (res.status === 401) {
          handleLogout();
        } else {
          setDashboardError(data.error || "ড্যাশবোর্ড লোড করতে সমস্যা হয়েছে।");
        }
      }
    } catch (err) {
      console.error("Dashboard error:", err);
      setDashboardError("সার্ভারের সাথে সংযোগ স্থাপন করা যাচ্ছে না।");
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setLoginError("পাসওয়ার্ড আবশ্যক!");
      return;
    }
    setLoginError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("admin_token", data.token);
        setIsAuthenticated(true);
        fetchDashboard(data.token);
      } else {
        setLoginError(data.error || "ভুল পাসওয়ার্ড!");
      }
    } catch (err) {
      setLoginError("সার্ভারের সাথে যোগাযোগ করতে ব্যর্থ হয়েছে।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setIsAuthenticated(false);
    setDashboardData(null);
    setPassword("");
    clearInterval(timerRef.current);
  };

  const handleUnblock = async (keyName) => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch("/api/admin/unblock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ keyName }),
      });
      if (res.ok) {
        // Optimistically update key status in UI
        setDashboardData((prev) => {
          if (!prev || !prev.keys) return prev;
          const updatedKeys = prev.keys.map((k) =>
            k.name === keyName
              ? { ...k, status: "active", blockedUntil: null, timeLeftMs: 0 }
              : k
          );
          const blockedCount = updatedKeys.filter((k) => k.status === "blocked").length;
          return {
            ...prev,
            keys: updatedKeys,
            metrics: {
              ...prev.metrics,
              activeKeysCount: updatedKeys.length - blockedCount,
              blockedKeysCount: blockedCount,
            },
          };
        });
      }
    } catch (err) {
      console.error("Unblock key error:", err);
    }
  };

  const handleUnblockAll = async () => {
    if (!confirm("আপনি কি নিশ্চিতভাবে সব এপিআই কী আনব্লক করতে চান?")) return;
    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch("/api/admin/unblock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        // Refresh immediately
        fetchDashboard(token);
      }
    } catch (err) {
      console.error("Unblock all error:", err);
    }
  };

  // Helper to format remaining time
  const formatTimeLeft = (ms) => {
    if (ms <= 0) return "সক্রিয় হচ্ছে...";
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins} মি. ${secs} সে.`;
  };

  // Filter keys list based on search
  const filteredKeys = dashboardData?.keys?.filter((k) =>
    k.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Custom Chart calculation
  const getChartData = () => {
    if (!dashboardData?.dailyStats || dashboardData.dailyStats.length === 0) return [];
    
    // Find max value to determine percentage heights
    const maxVal = Math.max(
      ...dashboardData.dailyStats.map((d) => (chartMode === "visitors" ? d.visitors : d.messages)),
      1 // Avoid divide by zero
    );

    return dashboardData.dailyStats.map((d) => {
      const val = chartMode === "visitors" ? d.visitors : d.messages;
      const heightPercent = Math.max(5, Math.min(100, (val / maxVal) * 100)); // clamp between 5% and 100%
      
      // Format YYYY-MM-DD to DD MMM
      let label = d.date;
      try {
        const [, m, day] = d.date.split("-");
        const months = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
        const monthIndex = parseInt(m, 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          label = `${day} ${months[monthIndex]}`;
        }
      } catch (e) {}

      return {
        dateStr: d.date,
        label,
        value: val,
        heightPercent: `${heightPercent}%`,
      };
    });
  };

  if (!isAuthenticated) {
    return (
      <main style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.loginHeader}>
            <span style={styles.loginIcon}>🔐</span>
            <h1 style={styles.loginTitle}>অ্যাডমিন প্যানেল লগইন</h1>
            <p style={styles.loginSubtitle}>
              পলিটেকনিক গাইড এআই ড্যাশবোর্ডে প্রবেশ করতে সিক্রেট পাসওয়ার্ড প্রদান করুন।
            </p>
          </div>

          <form onSubmit={handleLogin} style={styles.loginForm}>
            <div style={styles.inputGroup}>
              <label htmlFor="admin-password" style={styles.inputLabel}>
                অ্যাডমিন পাসওয়ার্ড
              </label>
              <div style={styles.passwordWrapper}>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="পাসওয়ার্ড লিখুন..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.loginInput}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  aria-label="পাসওয়ার্ড দেখান"
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
            </div>

            {loginError && <div style={styles.errorAlert}>⚠️ {loginError}</div>}

            <button type="submit" style={styles.loginButton} disabled={isLoading}>
              {isLoading ? "যাচাই করা হচ্ছে..." : "লগইন করুন 🚀"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.adminDashboard}>
      {/* Top Navbar */}
      <header style={styles.dashboardHeader}>
        <div style={styles.logoGroup}>
          <span style={styles.dashboardLogoIcon}>📊</span>
          <div>
            <h1 style={styles.dashboardLogoText}>
              পলিটেকনিক গাইড <span style={styles.logoBadge}>অ্যাডমিন</span>
            </h1>
            <p style={styles.dashboardLogoSub}>রিয়েল-টাইম এআই ট্র্যাকিং ও এপিআই কন্ট্রোল</p>
          </div>
        </div>
        <button onClick={handleLogout} style={styles.logoutButton}>
          লগআউট 🚪
        </button>
      </header>

      {dashboardError && (
        <div style={{ ...styles.errorAlert, margin: "20px auto", maxWidth: 1200 }}>
          ⚠️ {dashboardError}
        </div>
      )}

      {/* Main Container */}
      <div style={styles.dashboardContent}>
        {/* Stat Cards Row */}
        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconContainer, background: "rgba(19, 104, 125, 0.1)", color: COLORS.primary }}>
              👥
            </div>
            <div>
              <div style={styles.statLabel}>আজকের ইউনিক ভিজিটর</div>
              <div style={styles.statValue}>
                {dashboardData?.metrics?.todayVisitors ?? 0} <span style={styles.statUnit}>জন</span>
              </div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconContainer, background: "rgba(240, 140, 44, 0.1)", color: COLORS.accent }}>
              💬
            </div>
            <div>
              <div style={styles.statLabel}>আজকের মোট মেসেজ/চ্যাট</div>
              <div style={styles.statValue}>
                {dashboardData?.metrics?.todayMessages ?? 0} <span style={styles.statUnit}>টি</span>
              </div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconContainer, background: "rgba(16, 185, 129, 0.1)", color: COLORS.success }}>
              🟢
            </div>
            <div>
              <div style={styles.statLabel}>সক্রিয় এপিআই কী (Running)</div>
              <div style={styles.statValue}>
                {dashboardData?.metrics?.activeKeysCount ?? 0} / {dashboardData?.metrics?.totalKeys ?? 0}
              </div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconContainer, background: "rgba(239, 68, 68, 0.1)", color: COLORS.danger }}>
              🔴
            </div>
            <div>
              <div style={styles.statLabel}>লিমিট শেষ/ব্লকড কী</div>
              <div style={styles.statValue}>
                {dashboardData?.metrics?.blockedKeysCount ?? 0} <span style={styles.statUnit}>টি</span>
              </div>
            </div>
          </div>
        </section>

        {/* Analytics and API Status Split Grid */}
        <div style={styles.splitGrid}>
          {/* Left: Traffic Graph */}
          <section style={styles.dashboardSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>📅 বিগত ৭ দিনের ট্রাফিক রিপোর্ট</h2>
              <div style={styles.chartTabs}>
                <button
                  onClick={() => setChartMode("visitors")}
                  style={{
                    ...styles.chartTabBtn,
                    background: chartMode === "visitors" ? COLORS.primary : "transparent",
                    color: chartMode === "visitors" ? "#fff" : COLORS.text,
                    border: chartMode === "visitors" ? "none" : `1px solid ${COLORS.border}`,
                  }}
                >
                  ভিজিটর সংখ্যা
                </button>
                <button
                  onClick={() => setChartMode("messages")}
                  style={{
                    ...styles.chartTabBtn,
                    background: chartMode === "messages" ? COLORS.primary : "transparent",
                    color: chartMode === "messages" ? "#fff" : COLORS.text,
                    border: chartMode === "messages" ? "none" : `1px solid ${COLORS.border}`,
                  }}
                >
                  মেসেজ সংখ্যা
                </button>
              </div>
            </div>

            {/* Custom Bar Chart */}
            <div style={styles.chartWrapper}>
              <div style={styles.chartArea}>
                {getChartData().length === 0 ? (
                  <div style={styles.noData}>কোন ডাটা পাওয়া যায়নি।</div>
                ) : (
                  getChartData().map((bar, idx) => (
                    <div key={idx} style={styles.chartBarCol}>
                      <div style={styles.barTooltip}>{bar.value}</div>
                      <div style={styles.barTrack}>
                        <div
                          style={{
                            ...styles.barFill,
                            height: bar.heightPercent,
                            background: chartMode === "visitors" ? COLORS.primary : COLORS.accent,
                          }}
                        />
                      </div>
                      <div style={styles.barLabel}>{bar.label}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Raw Stats Table */}
            <div style={styles.tableResponsive}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableRowHead}>
                    <th style={styles.tableHeader}>তারিখ</th>
                    <th style={styles.tableHeader}>ভিজিটর সংখ্যা</th>
                    <th style={styles.tableHeader}>মেসেজ সংখ্যা</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData?.dailyStats && dashboardData.dailyStats.length > 0 ? (
                    dashboardData.dailyStats.slice().reverse().map((dayData, idx) => (
                      <tr key={idx} style={styles.tableRow}>
                        <td style={styles.tableCell}>{dayData.date}</td>
                        <td style={styles.tableCell}>{dayData.visitors} জন</td>
                        <td style={styles.tableCell}>{dayData.messages} টি</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={styles.noData}>কোন ডাটা নেই</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right: API Keys Control Center */}
          <section style={styles.dashboardSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>🔑 এপিআই কী কন্ট্রোল সেন্টার</h2>
              <button onClick={handleUnblockAll} style={styles.unblockAllBtn}>
                সব আনব্লক করুন ⚡
              </button>
            </div>

            {/* Search Bar */}
            <div style={styles.searchContainer}>
              <input
                type="text"
                placeholder="এপিআই কী সার্চ করুন (উদাঃ GEMINI_KEY_1)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            {/* Keys List Scrollable Grid */}
            <div style={styles.keysList}>
              {filteredKeys.length === 0 ? (
                <div style={styles.noKeysFound}>কোন এপিআই কী পাওয়া যায়নি।</div>
              ) : (
                filteredKeys.map((key) => {
                  const isBlocked = key.status === "blocked";
                  return (
                    <div
                      key={key.name}
                      style={{
                        ...styles.keyCard,
                        borderLeft: `5px solid ${isBlocked ? COLORS.danger : COLORS.success}`,
                      }}
                    >
                      <div style={styles.keyHeader}>
                        <span style={styles.keyNameText}>{key.name}</span>
                        <span
                          style={{
                            ...styles.statusBadge,
                            background: isBlocked ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                            color: isBlocked ? COLORS.danger : COLORS.success,
                          }}
                        >
                          {isBlocked ? "সীমা শেষ 🔴" : "রানিং 🟢"}
                        </span>
                      </div>

                      {isBlocked && (
                        <div style={styles.timerRow}>
                          <span style={styles.timerLabel}>পুনরায় চালু হবে:</span>
                          <span style={styles.timerValue}>{formatTimeLeft(key.timeLeftMs)}</span>
                        </div>
                      )}

                      <div style={styles.keyActions}>
                        <button
                          disabled={!isBlocked}
                          onClick={() => handleUnblock(key.name)}
                          style={{
                            ...styles.unblockBtn,
                            background: isBlocked ? COLORS.primary : "#ECECEC",
                            color: isBlocked ? "#fff" : COLORS.textLight,
                            cursor: isBlocked ? "pointer" : "not-allowed",
                          }}
                        >
                          {isBlocked ? "আনব্লক করুন 🔓" : "সক্রিয় আছে"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

const styles = {
  loginContainer: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    fontFamily: "'Hind Siliguri', sans-serif",
    padding: "20px",
  },
  loginCard: {
    background: COLORS.cardBg,
    borderRadius: "16px",
    boxShadow: "0 20px 40px rgba(15, 76, 92, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02)",
    border: `1px solid ${COLORS.border}`,
    width: "100%",
    maxWidth: "460px",
    padding: "40px",
  },
  loginHeader: {
    textAlign: "center",
    marginBottom: "32px",
  },
  loginIcon: {
    fontSize: "48px",
    display: "block",
    marginBottom: "16px",
  },
  loginTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: COLORS.primaryDark,
    marginBottom: "8px",
  },
  loginSubtitle: {
    fontSize: "14px",
    color: COLORS.textLight,
    lineHeight: "1.5",
  },
  loginForm: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  inputLabel: {
    fontSize: "14px",
    fontWeight: "600",
    color: COLORS.text,
  },
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  loginInput: {
    width: "100%",
    padding: "12px 48px 12px 14px",
    borderRadius: "8px",
    border: `1px solid ${COLORS.border}`,
    fontSize: "16px",
    outline: "none",
    transition: "border-color 0.2s",
  },
  eyeButton: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    padding: "4px",
  },
  errorAlert: {
    background: "rgba(239, 68, 68, 0.08)",
    color: COLORS.danger,
    border: `1px solid rgba(239, 68, 68, 0.2)`,
    padding: "12px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
  },
  loginButton: {
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    color: "#fff",
    border: "none",
    padding: "14px",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(19, 104, 125, 0.2)",
    transition: "transform 0.1s",
  },
  adminDashboard: {
    minHeight: "100vh",
    backgroundColor: COLORS.bg,
    fontFamily: "'Hind Siliguri', sans-serif",
    color: COLORS.text,
  },
  dashboardHeader: {
    background: COLORS.cardBg,
    borderBottom: `1px solid ${COLORS.border}`,
    padding: "16px 5%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  logoGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  dashboardLogoIcon: {
    fontSize: "32px",
  },
  dashboardLogoText: {
    fontSize: "18px",
    fontWeight: "700",
    color: COLORS.primaryDark,
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  logoBadge: {
    fontSize: "10px",
    background: COLORS.accent,
    color: "#fff",
    padding: "1px 5px",
    borderRadius: "4px",
    fontWeight: "700",
  },
  dashboardLogoSub: {
    fontSize: "12px",
    color: COLORS.textLight,
  },
  logoutButton: {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    color: COLORS.textLight,
    padding: "8px 16px",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  dashboardContent: {
    padding: "30px 5%",
    maxWidth: "1400px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "30px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
  },
  statCard: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
  },
  statIconContainer: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "22px",
  },
  statLabel: {
    fontSize: "13px",
    color: COLORS.textLight,
    fontWeight: "600",
    marginBottom: "4px",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  statUnit: {
    fontSize: "13px",
    fontWeight: "500",
    color: COLORS.textLight,
  },
  splitGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "30px",
  },
  dashboardSection: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  chartTabs: {
    display: "flex",
    gap: "8px",
  },
  chartTabBtn: {
    padding: "6px 12px",
    borderRadius: "14px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  chartWrapper: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: "12px",
    padding: "20px",
    background: "#FAFBFB",
  },
  chartArea: {
    height: "200px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: "20px",
    position: "relative",
  },
  chartBarCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
    position: "relative",
  },
  barTooltip: {
    position: "absolute",
    top: "-15px",
    fontSize: "11px",
    fontWeight: "700",
    color: COLORS.primaryDark,
    background: "rgba(255,255,255,0.9)",
    padding: "2px 6px",
    borderRadius: "4px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  barTrack: {
    flex: 1,
    width: "28px",
    backgroundColor: "#E2E8F0",
    borderRadius: "6px 6px 0 0",
    display: "flex",
    alignItems: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: "6px 6px 0 0",
    transition: "height 0.5s ease-out",
  },
  barLabel: {
    marginTop: "8px",
    fontSize: "11px",
    fontWeight: "600",
    color: COLORS.textLight,
  },
  noData: {
    width: "100%",
    textAlign: "center",
    color: COLORS.textLight,
    padding: "40px 0",
    fontSize: "14px",
  },
  tableResponsive: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "14px",
  },
  tableRowHead: {
    borderBottom: `2px solid ${COLORS.border}`,
  },
  tableHeader: {
    padding: "12px 8px",
    color: COLORS.primaryDark,
    fontWeight: "700",
  },
  tableRow: {
    borderBottom: `1px solid ${COLORS.border}`,
    transition: "background-color 0.2s",
  },
  tableCell: {
    padding: "12px 8px",
    color: COLORS.text,
  },
  unblockAllBtn: {
    background: COLORS.accent,
    color: "#fff",
    border: "none",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(240, 140, 44, 0.2)",
    transition: "background-color 0.2s",
  },
  searchContainer: {
    width: "100%",
  },
  searchInput: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: `1px solid ${COLORS.border}`,
    fontSize: "14px",
    outline: "none",
  },
  keysList: {
    maxHeight: "360px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    paddingRight: "4px",
  },
  noKeysFound: {
    textAlign: "center",
    color: COLORS.textLight,
    padding: "20px 0",
    fontSize: "14px",
  },
  keyCard: {
    background: "#FAFBFB",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "8px",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  keyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  keyNameText: {
    fontWeight: "700",
    fontSize: "14px",
    color: COLORS.primaryDark,
  },
  statusBadge: {
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
  },
  timerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(239, 68, 68, 0.04)",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
  },
  timerLabel: {
    color: COLORS.textLight,
    fontWeight: "500",
  },
  timerValue: {
    color: COLORS.danger,
    fontWeight: "700",
  },
  keyActions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  unblockBtn: {
    border: "none",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    transition: "background-color 0.2s",
  },
};
