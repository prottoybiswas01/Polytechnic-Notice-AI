import clientPromise from "./mongodb";

/**
 * Returns the current date in Bangladesh (UTC+6) time zone in YYYY-MM-DD format.
 */
export function getBDDateString() {
  const d = new Date();
  const options = { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

/**
 * Records a visitor session for the current day.
 * Increments daily visitors if the visitor is new today.
 */
export async function recordVisit(visitorId) {
  if (!visitorId) return;
  try {
    const client = await clientPromise;
    if (!client) return;
    const db = client.db("polytechnic_qa");
    const todayStr = getBDDateString();
    
    const sessionCol = db.collection("visitor_sessions");
    // Ensure index exists to prevent duplicate entries for the same visitor on the same day
    await sessionCol.createIndex({ date: 1, visitorId: 1 }, { unique: true }).catch(() => {});
    
    try {
      await sessionCol.insertOne({ date: todayStr, visitorId, timestamp: new Date() });
      
      // If insertion succeeded, it means it is a unique visitor for today
      await db.collection("daily_stats").updateOne(
        { date: todayStr },
        { 
          $inc: { visitors: 1 },
          $setOnInsert: { messages: 0 }
        },
        { upsert: true }
      );
      console.log(`[Tracker] New visitor recorded: ${visitorId} on ${todayStr}`);
    } catch (err) {
      // 11000 is the duplicate key error code in MongoDB (already visited today)
      if (err.code !== 11000) {
        console.error("[Tracker Error] Failed to write visitor session:", err);
      }
    }
  } catch (err) {
    console.error("[Tracker Error] recordVisit failed:", err);
  }
}

/**
 * Records a message event for the current day by incrementing the message count.
 */
export async function recordMessage() {
  try {
    const client = await clientPromise;
    if (!client) return;
    const db = client.db("polytechnic_qa");
    const todayStr = getBDDateString();
    
    await db.collection("daily_stats").updateOne(
      { date: todayStr },
      { 
        $inc: { messages: 1 },
        $setOnInsert: { visitors: 0 }
      },
      { upsert: true }
    );
    console.log(`[Tracker] Message logged on ${todayStr}`);
  } catch (err) {
    console.error("[Tracker Error] recordMessage failed:", err);
  }
}

/**
 * Marks an API key as blocked until a specific timestamp.
 */
export async function blockApiKey(keyName, durationMs) {
  if (!keyName) return;
  try {
    const client = await clientPromise;
    if (!client) return;
    const db = client.db("polytechnic_qa");
    const blockedUntil = new Date(Date.now() + durationMs);
    
    await db.collection("key_status").updateOne(
      { keyName },
      { 
        $set: { 
          status: "blocked", 
          blockedUntil, 
          updatedAt: new Date() 
        } 
      },
      { upsert: true }
    );
    console.log(`[Tracker] API Key blocked in DB: ${keyName} until ${blockedUntil}`);
  } catch (err) {
    console.error("[Tracker Error] blockApiKey failed:", err);
  }
}

/**
 * Marks an API key as active/unblocked.
 */
export async function unblockApiKey(keyName) {
  if (!keyName) return;
  try {
    const client = await clientPromise;
    if (!client) return;
    const db = client.db("polytechnic_qa");
    
    await db.collection("key_status").updateOne(
      { keyName },
      { 
        $set: { 
          status: "active", 
          blockedUntil: null, 
          updatedAt: new Date() 
        } 
      },
      { upsert: true }
    );
    console.log(`[Tracker] API Key unblocked in DB: ${keyName}`);
  } catch (err) {
    console.error("[Tracker Error] unblockApiKey failed:", err);
  }
}

/**
 * Manually unblocks all keys in the database.
 */
export async function unblockAllApiKeys() {
  try {
    const client = await clientPromise;
    if (!client) return;
    const db = client.db("polytechnic_qa");
    
    await db.collection("key_status").updateMany(
      { status: "blocked" },
      { 
        $set: { 
          status: "active", 
          blockedUntil: null, 
          updatedAt: new Date() 
        } 
      }
    );
    console.log(`[Tracker] All API keys manually unblocked in DB`);
  } catch (err) {
    console.error("[Tracker Error] unblockAllApiKeys failed:", err);
  }
}

/**
 * Retrieves all currently blocked keys that have not expired yet.
 */
export async function getBlockedKeys() {
  try {
    const client = await clientPromise;
    if (!client) return [];
    const db = client.db("polytechnic_qa");
    
    const docs = await db.collection("key_status").find({
      status: "blocked",
      blockedUntil: { $gt: new Date() }
    }).toArray();
    return docs;
  } catch (err) {
    console.error("[Tracker Error] getBlockedKeys failed:", err);
    return [];
  }
}
