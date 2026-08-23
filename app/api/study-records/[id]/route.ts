import { parseStudyRecord } from "@/app/lib/records";
import { deleteStudy, updateStudy } from "@/db/records";
import { apiError, apiSessionError, validRecordId } from "../../_lib/http";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const unauthorized = apiSessionError(request);
  if (unauthorized) return unauthorized;
  try {
    const id = validRecordId((await context.params).id);
    const record = parseStudyRecord({ ...(await request.json()), id });
    return (await updateStudy(id, record))
      ? Response.json(record)
      : Response.json({ error: "学习记录不存在" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const unauthorized = apiSessionError(request);
  if (unauthorized) return unauthorized;
  try {
    const id = validRecordId((await context.params).id);
    return (await deleteStudy(id))
      ? Response.json({ ok: true })
      : Response.json({ error: "学习记录不存在" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
