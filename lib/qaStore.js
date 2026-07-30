import clientPromise from "./mongodb";

// List of keywords that indicate the user is asking for dynamic/live information.
// Questions matching these will NOT be cached in the persistent lifetime database.
const DYNAMIC_KEYWORDS = [
  "নোটিশ", "বিজ্ঞপ্তি", "রেজাল্ট", "তারিখ", "কবে", "সর্বশেষ", 
  "আপডেট", "নতুন", "আজকে", "আজকের", "রুটিন", "মেরিট", 
  "ফলাফল", "পরীক্ষা", "ফি", "টাকা", "পেমেন্ট", "ভর্তি", "সেশন", 
  "আবেদন", "সার্কুলার", "২০২৬", "২০২৭", "2026", "2027",
  "notice", "result", "date", "update", "routine", "merit", 
  "payment", "fee", "admission", "apply", "circular", "session"
];

/**
 * Helper to check if a reply is complete and not truncated mid-sentence.
 */
export function isAnswerComplete(reply) {
  if (!reply || typeof reply !== "string") return false;
  const trimmed = reply.trim();
  if (trimmed.length < 40) return false;
  const lastChar = trimmed.slice(-1);
  const validEndings = ["।", ".", "!", "?", ":", "]", ")", "`", "\n"];
  return validEndings.includes(lastChar);
}

/**
 * Returns true if the question requires live/dynamic lookup.
 */
export function isQueryDynamic(normalizedQuestion) {
  return DYNAMIC_KEYWORDS.some((keyword) => normalizedQuestion.includes(keyword));
}

/**
 * Finds a cached reply for a normalized question in MongoDB.
 * Fails silently by returning null if MongoDB is not configured or fails.
 */
export async function findPersistentAnswer(normalizedQuestion) {
  try {
    const client = await clientPromise;
    if (!client) return null;

    const db = client.db("polytechnic_qa");
    const collection = db.collection("cached_qa");

    const record = await collection.findOne({ question: normalizedQuestion });
    if (record && record.reply) {
      if (isAnswerComplete(record.reply)) {
        console.log(`[MongoDB Cache Hit] Found persistent answer for: "${normalizedQuestion}"`);
        return record.reply;
      } else {
        console.warn(`[MongoDB Cache Ignored] Truncated answer detected for: "${normalizedQuestion}". Will fetch fresh answer.`);
      }
    }
  } catch (error) {
    console.error("[MongoDB Cache Error] Failed to read from database:", error);
  }
  return null;
}

/**
 * Saves a question and its reply into MongoDB.
 * Fails silently on database errors to prevent API request crashes.
 */
export async function savePersistentAnswer(normalizedQuestion, reply) {
  if (!isAnswerComplete(reply)) {
    console.warn(`[MongoDB Cache Skip] Not saving incomplete/truncated answer for: "${normalizedQuestion}"`);
    return;
  }

  try {
    const client = await clientPromise;
    if (!client) return;

    const db = client.db("polytechnic_qa");
    const collection = db.collection("cached_qa");

    // Upsert the record (update if exists, insert if not)
    await collection.updateOne(
      { question: normalizedQuestion },
      { 
        $set: { 
          reply: reply,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    console.log(`[MongoDB Cache Save] Saved answer for: "${normalizedQuestion}"`);
  } catch (error) {
    console.error("[MongoDB Cache Error] Failed to write to database:", error);
  }
}
