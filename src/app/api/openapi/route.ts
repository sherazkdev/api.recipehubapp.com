import { NextResponse } from "next/server";
import { swaggerSpec } from "@/shared/swagger/spec";

export async function GET() {
  return NextResponse.json(swaggerSpec);
}
