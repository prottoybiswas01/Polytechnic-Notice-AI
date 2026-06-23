export async function POST(req) {
  try {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    
    if (password === adminPassword) {
      return Response.json({ success: true, token: password });
    }
    
    return Response.json({ error: "ভুল পাসওয়ার্ড" }, { status: 401 });
  } catch (err) {
    console.error("Admin Auth route error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
