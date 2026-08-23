import { parseDeskData } from "@/app/lib/records";
import { listRecords, mergeRecords, replaceRecords } from "@/db/records";
import { apiError, apiSessionError } from "../_lib/http";

export async function GET(request: Request) {
  const unauthorized = apiSessionError(request);
  if (unauthorized) return unauthorized;
  try {
    return Response.json(await listRecords());
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const unauthorized = apiSessionError(request);
  if (unauthorized) return unauthorized;
  try {
    const data = parseDeskData(await request.json());
    await replaceRecords(data);
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const unauthorized = apiSessionError(request);
  if (unauthorized) return unauthorized;
  try {
    const data = parseDeskData(await request.json());
    await mergeRecords(data);
    return Response.json(await listRecords());
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const unauthorized = apiSessionError(request);
  if (unauthorized) return unauthorized;
  try {
    const data = { study: [], health: [] };
    await replaceRecords(data);
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}
