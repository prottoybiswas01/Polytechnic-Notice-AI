import { unblockApiKey, unblockAllApiKeys } from "../../../../lib/apiTracker";

export async function POST(req) {
  try {
    // Auth Check
    const authHeader = req.headers.get("authorization");
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    if (authHeader !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { keyName, all } = await req.json();
    
    if (all) {
      await unblockAllApiKeys();
    } else if (keyName) {
      await unblockApiKey(keyName);
    } else {
      return Response.json({ error: "keyName or all is required" }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Unblock endpoint error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
