import { AiActivity } from "@/features/ai-activity/models/ai-activity.model";

export type AiActivityRow = {
  id: string;
  type: "generate" | "scan";
  status: "success" | "failed";
  inputSummary: string;
  durationMs: number;
  error: string;
  createdAt: string;
};

function buildFilter(query: {
  type?: "generate" | "scan" | "failed";
  from?: Date;
  to?: Date;
}) {
  const filter: Record<string, unknown> = {};
  if (query.type === "generate" || query.type === "scan") {
    filter.type = query.type;
  } else if (query.type === "failed") {
    filter.status = "failed";
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) (filter.createdAt as Record<string, Date>).$gte = query.from;
    if (query.to) (filter.createdAt as Record<string, Date>).$lte = query.to;
  }

  return filter;
}

export async function logAiActivity(input: {
  type: "generate" | "scan";
  status: "success" | "failed";
  inputSummary: string;
  durationMs: number;
  error?: string;
  adminId?: string;
}) {
  const doc = await AiActivity.create({
    type: input.type,
    status: input.status,
    inputSummary: input.inputSummary.slice(0, 500),
    durationMs: input.durationMs,
    error: input.error?.slice(0, 500) ?? "",
    adminId: input.adminId || undefined,
  });
  return doc._id.toString();
}

export async function listAiActivities(query: {
  type?: "generate" | "scan" | "failed";
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
}) {
  const filter = buildFilter(query);
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await Promise.all([
    AiActivity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.pageSize).lean(),
    AiActivity.countDocuments(filter),
  ]);

  const rows: AiActivityRow[] = items.map((item) => ({
    id: item._id.toString(),
    type: item.type as "generate" | "scan",
    status: item.status as "success" | "failed",
    inputSummary: item.inputSummary,
    durationMs: item.durationMs,
    error: item.error ?? "",
    createdAt: item.createdAt?.toISOString?.() ?? new Date().toISOString(),
  }));

  return { rows, total, page: query.page, pageSize: query.pageSize };
}

export type AiActivityDailyPoint = {
  date: string;
  total: number;
  generate: number;
  scan: number;
  failed: number;
  avgDurationMs: number;
};

export type AiActivitySummary = {
  totals: {
    total: number;
    success: number;
    failed: number;
    generate: number;
    scan: number;
    avgDurationMs: number;
    successRate: number;
  };
  daily: AiActivityDailyPoint[];
};

function eachDay(from: Date, to: Date) {
  const days: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export async function summarizeAiActivities(query: {
  type?: "generate" | "scan" | "failed";
  from?: Date;
  to?: Date;
}): Promise<AiActivitySummary> {
  const filter = buildFilter(query);
  const [rollup, dailyRows] = await Promise.all([
    AiActivity.aggregate<{
      _id: null;
      total: number;
      success: number;
      failed: number;
      generate: number;
      scan: number;
      avgDurationMs: number;
    }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          success: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          generate: { $sum: { $cond: [{ $eq: ["$type", "generate"] }, 1, 0] } },
          scan: { $sum: { $cond: [{ $eq: ["$type", "scan"] }, 1, 0] } },
          avgDurationMs: { $avg: "$durationMs" },
        },
      },
    ]),
    AiActivity.aggregate<{
      _id: string;
      total: number;
      generate: number;
      scan: number;
      failed: number;
      avgDurationMs: number;
    }>([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 },
          generate: { $sum: { $cond: [{ $eq: ["$type", "generate"] }, 1, 0] } },
          scan: { $sum: { $cond: [{ $eq: ["$type", "scan"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          avgDurationMs: { $avg: "$durationMs" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const totalsRow = rollup[0];
  const total = totalsRow?.total ?? 0;
  const success = totalsRow?.success ?? 0;
  const byDay = new Map(dailyRows.map((row) => [row._id, row]));

  const from = query.from ?? new Date(Date.now() - 6 * 86_400_000);
  const to = query.to ?? new Date();
  const daily = eachDay(from, to).map((date) => {
    const row = byDay.get(date);
    return {
      date,
      total: row?.total ?? 0,
      generate: row?.generate ?? 0,
      scan: row?.scan ?? 0,
      failed: row?.failed ?? 0,
      avgDurationMs: Math.round(row?.avgDurationMs ?? 0),
    };
  });

  return {
    totals: {
      total,
      success,
      failed: totalsRow?.failed ?? 0,
      generate: totalsRow?.generate ?? 0,
      scan: totalsRow?.scan ?? 0,
      avgDurationMs: Math.round(totalsRow?.avgDurationMs ?? 0),
      successRate: total ? Math.round((success / total) * 100) : 0,
    },
    daily,
  };
}

export async function exportAiActivitiesCsv(query: {
  type?: "generate" | "scan" | "failed";
  from?: Date;
  to?: Date;
}) {
  const header = "Type,Time,Input summary,Status,Duration (ms)\n";
  const lines: string[] = [];
  let page = 1;
  const pageSize = 500;

  while (true) {
    const batch = await listAiActivities({ ...query, page, pageSize });
    for (const row of batch.rows) {
      const escaped = `"${row.inputSummary.replace(/"/g, '""')}"`;
      lines.push(`${row.type},${row.createdAt},${escaped},${row.status},${row.durationMs}`);
    }
    if (page * pageSize >= batch.total) break;
    page += 1;
  }

  return header + lines.join("\n");
}
