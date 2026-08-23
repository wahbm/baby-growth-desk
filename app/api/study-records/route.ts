import { parseStudyRecord } from "@/app/lib/records";
import { createStudy } from "@/db/records";
import { apiError, apiSessionError } from "../_lib/http";

export async function POST(request: Request) {
  const unauthorized = apiSessionError(request);
  if (unauthorized) return unauthorized;
  try {
    return Response.json(await createStudy(parseStudyRecord(await request.json())), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
