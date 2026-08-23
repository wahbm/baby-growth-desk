import { checkDatabase } from "@/db";
import { apiError } from "../_lib/http";

export async function GET() {
  try {
    await checkDatabase();
    return Response.json({ status: "ok", database: "mariadb" });
  } catch (error) {
    return apiError(error);
  }
}
