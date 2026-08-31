import { NextRequest } from "next/server";
import { z } from "zod";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/features/tokens/services/api-key.service";
import { connectDb } from "@/shared/db/connect";
import { badRequest, notFound, serverError, withAuth } from "@/shared/middleware/auth";
import { jsonOk } from "@/shared/utils/http";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth) => {
    try {
      await connectDb();
      const keys = await listApiKeys(auth.adminId);
      return jsonOk(
        keys.map((key) => ({
          id: key._id.toString(),
          name: key.name,
          prefix: key.prefix,
          isActive: key.isActive,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
          revokedAt: key.revokedAt,
        })),
      );
    } catch (error) {
      console.error("List API keys error:", error);
      return serverError();
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, req) => {
    try {
      await connectDb();
      const body = await req.json();
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) return badRequest("Name is required");

      const { doc, raw } = await createApiKey(auth.adminId, parsed.data.name);
      return jsonOk({
        id: doc._id.toString(),
        name: doc.name,
        prefix: doc.prefix,
        key: raw,
        createdAt: doc.createdAt,
      });
    } catch (error) {
      console.error("Create API key error:", error);
      return serverError();
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, async (auth, req) => {
    try {
      await connectDb();
      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");
      if (!id) return badRequest("id is required");

      const doc = await revokeApiKey(id, auth.adminId);
      if (!doc) return notFound("API key not found");
      return jsonOk({ revoked: true });
    } catch (error) {
      console.error("Revoke API key error:", error);
      return serverError();
    }
  });
}
