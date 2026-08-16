import { createThread, listThreads } from "../../../../lib/thread-registry.js";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ threads: listThreads() });
}

export async function POST() {
  const thread = await createThread();
  return Response.json(thread, { status: 201 });
}
