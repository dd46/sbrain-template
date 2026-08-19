import { listChatProviders } from "../../../../lib/chat-providers.js";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ providers: listChatProviders() });
}
