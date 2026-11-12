
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authorization.slice(7);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    const { callId } = await request.json();

    if (
      typeof callId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)
    ) {
      return NextResponse.json(
        { error: "Invalid call ID" },
        { status: 400 }
      );
    }

    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("id, caller_id, receiver_id, status")
      .eq("id", callId)
      .maybeSingle();

    if (
      callError ||
      !call ||
      (call.caller_id !== user.id && call.receiver_id !== user.id) ||
      !["ringing", "accepted"].includes(call.status)
    ) {
      return NextResponse.json(
        { error: "You are not authorized to join this call" },
        { status: 403 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit is not configured" },
        { status: 500 }
      );
    }

    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      ttl: "10m",
    });

    accessToken.addGrant({
      roomJoin: true,
      room: `call_${call.id}`,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await accessToken.toJwt();

    return NextResponse.json({
  token: jwt,
  roomName: `call_${call.id}`,
  serverUrl: process.env.LIVEKIT_URL,
});
  } catch (error) {
    console.error("LiveKit token error:", error);

    return NextResponse.json(
      { error: "Could not generate call token" },
      { status: 500 }
    );
  }
}
