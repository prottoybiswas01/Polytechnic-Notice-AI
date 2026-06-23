import { recordVisit } from "../../../../lib/apiTracker";

export async function POST(req) {
  try {
    const { visitorId } = await req.json();
    if (!visitorId) {
      return Response.json({ error: "visitorId is required" }, { status: 400 });
    }
    
    await recordVisit(visitorId);
    return Response.json({ success: true });
  } catch (err) {
    console.error("Analytics track route error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
