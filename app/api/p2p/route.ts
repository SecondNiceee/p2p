import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiKey = process.env.P2P_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "P2P_API_KEY not set" }, { status: 500 });
  }

  const res = await fetch("https://p2p.walletbot.me/p2p/integration-api/v1/item/online", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
