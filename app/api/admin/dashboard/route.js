import clientPromise from "../../../../lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    // Auth Check
    const authHeader = req.headers.get("authorization");
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    if (authHeader !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    if (!client) {
      return Response.json({ error: "Database connection failed" }, { status: 500 });
    }

    const db = client.db("polytechnic_qa");

    // 1. Get daily stats for the last 7 entries (sorted descending by date)
    const stats = await db.collection("daily_stats")
      .find()
      .sort({ date: -1 })
      .limit(7)
      .toArray();

    // 2. Load configured keys from env
    const configuredKeys = [];
    for (let i = 1; i <= 100; i++) {
      const keyName = `GEMINI_KEY_${i}`;
      if (process.env[keyName]) {
        configuredKeys.push(keyName);
      }
    }
    if (process.env.GEMINI_API_KEY) {
      configuredKeys.push("GEMINI_API_KEY");
    }

    // 3. Get currently blocked keys in database
    const blockedDocs = await db.collection("key_status")
      .find({
        status: "blocked",
        blockedUntil: { $gt: new Date() }
      })
      .toArray();

    const blockedMap = new Map(blockedDocs.map(d => [d.keyName, d.blockedUntil]));

    // 4. Map configured keys to their current status
    const keysStatus = configuredKeys.map(keyName => {
      const blockedUntil = blockedMap.get(keyName);
      const timeLeftMs = blockedUntil ? Math.max(0, blockedUntil.getTime() - Date.now()) : 0;
      return {
        name: keyName,
        status: blockedUntil ? "blocked" : "active",
        blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
        timeLeftMs: timeLeftMs
      };
    });

    // 5. Calculate summary metrics
    const totalKeys = configuredKeys.length;
    const blockedKeysCount = blockedDocs.length;
    const activeKeysCount = totalKeys - blockedKeysCount;

    // Get today's stats from Bangladesh date
    const todayStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const year = todayStr.find(p => p.type === 'year').value;
    const month = todayStr.find(p => p.type === 'month').value;
    const day = todayStr.find(p => p.type === 'day').value;
    const bdToday = `${year}-${month}-${day}`;

    const todayStat = stats.find(s => s.date === bdToday);
    const todayVisitors = todayStat ? todayStat.visitors : 0;
    const todayMessages = todayStat ? todayStat.messages : 0;

    return Response.json({
      metrics: {
        todayVisitors,
        todayMessages,
        totalKeys,
        activeKeysCount,
        blockedKeysCount
      },
      keys: keysStatus,
      dailyStats: stats.reverse() // Sort to chronological order (past to today) for chart display
    });
  } catch (err) {
    console.error("Dashboard endpoint error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
