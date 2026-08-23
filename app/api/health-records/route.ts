import { parseHealthRecord } from "@/app/lib/records";
import { createHealth } from "@/db/records";
import { apiError, apiSessionError } from "../_lib/http";

export async function POST(request: Request) {
  const unauthorized = apiSessionError(request);
  if (unauthorized) return unauthorized;
  try {
    return Response.json(await createHealth(parseHealthRecord(await request.json())), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
