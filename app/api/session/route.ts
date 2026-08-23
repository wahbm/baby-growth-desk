import { apiError, sessionCookieHeader, verifyAccessToken } from "../_lib/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!verifyAccessToken(body?.token)) return Response.json({ error: "家庭访问口令不正确" }, { status: 401 });
    return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookieHeader(request) } });
  } catch (error) {
    return apiError(error);
  }
}

export function DELETE(request: Request) {
  return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookieHeader(request, true) } });
}
