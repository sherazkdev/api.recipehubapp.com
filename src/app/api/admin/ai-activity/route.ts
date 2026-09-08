import { NextRequest, NextResponse } from "next/server";
import {
  exportAiActivitiesCsv,
  listAiActivities,
  summarizeAiActivities,
} from "@/features/ai-activity/services/ai-activity.service";
import { connectDb } from "@/shared/db/connect";
import { badRequest, serverError, withAuth } from "@/shared/middleware/auth";
import { jsonOk } from "@/shared/utils/http";

function parseType(value: string | null): "generate" | "scan" | "failed" | undefined | null {
  if (!value || value === "all") return undefined;
  if (value === "generate" || value === "scan" || value === "failed") return value;
  return null;
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const { searchParams } = req.nextUrl;
      const typeParam = searchParams.get("type");
      const type = parseType(typeParam);
      if (typeParam && type === null) return badRequest("Invalid type filter");

      const from = parseDate(searchParams.get("from"));
      const to = parseDate(searchParams.get("to"), true);
      if (searchParams.get("from") && from === null) return badRequest("Invalid from date");
      if (searchParams.get("to") && to === null) return badRequest("Invalid to date");

      const query = {
        type: type ?? undefined,
        from: from ?? undefined,
        to: to ?? undefined,
      };

      if (searchParams.get("export") === "csv") {
        const csv = await exportAiActivitiesCsv(query);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="ai-activity.csv"',
          },
        });
      }

      if (searchParams.get("summary") === "1") {
        const summary = await summarizeAiActivities(query);
        return jsonOk(summary);
      }

      const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
      const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "10") || 10));
      const result = await listAiActivities({ ...query, page, pageSize });

      return jsonOk(result.rows, undefined, {
        pagination: {
          page: result.page,
          limit: result.pageSize,
          total: result.total,
          totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
          paged: true,
        },
      });
    } catch (error) {
      console.error("List AI activity error:", error);
      return serverError();
    }
  });
}
