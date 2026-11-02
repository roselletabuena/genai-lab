import { NextRequest, NextResponse } from "next/server";
import {
  chatPayloadSchema,
  ChatPayload,
  formatZodError,
  INVALID_PAYLOAD_ERROR,
  toSessionHeaders,
} from "@genai-lab/contracts";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const result = chatPayloadSchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json(
        {
          error: INVALID_PAYLOAD_ERROR,
          details: formatZodError(result.error),
        },
        { status: 400 }
      );
    }

    const payload: ChatPayload = result.data;
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:3001";
    const internalApiKey = process.env.INTERNAL_API_KEY;

    // Convert visitor headers using contracts helper
    const sessionHeaders = toSessionHeaders({
      visitorId: payload.visitorId ?? req.headers.get("x-visitor-id") ?? undefined,
      clientIp: req.headers.get("x-client-ip") ?? req.headers.get("x-forwarded-for") ?? undefined,
      internalApiKey,
    });

    const backendResponse = await fetch(`${backendUrl}/portfolio/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...sessionHeaders,
      },
      body: JSON.stringify(payload),
    });

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
