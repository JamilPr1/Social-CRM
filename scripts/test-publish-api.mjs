const BASE = process.env.APP_URL || "http://localhost:3000";

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@metacrm.local", password: "admin123" }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) {
    console.error("Login failed:", loginBody);
    process.exit(1);
  }

  const cookie = loginRes.headers.get("set-cookie");
  if (!cookie) {
    console.error("No session cookie returned");
    process.exit(1);
  }

  const sessionCookie = cookie.split(";")[0];
  const message = `CRM multi-platform test — ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}

Testing publish to Facebook, Instagram, and LinkedIn from Social CRM. #automation #crm`;

  const publishRes = await fetch(`${BASE}/api/posts/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      postToAll: true,
      message,
      platform: "all",
      includeLinkedIn: true,
      imageUrl:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1080&q=80",
    }),
  });

  const publishBody = await publishRes.json();
  console.log("Status:", publishRes.status);
  console.log(JSON.stringify(publishBody, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
