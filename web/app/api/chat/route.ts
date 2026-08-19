import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { streamChat } from "../../../../lib/chat-agent.js";
import { resolveChatProviderId, resolveProviderConfig } from "../../../../lib/chat-providers.js";
import { appendConversationTurn } from "../../../../lib/conversation-persist.js";
import { getThreadMeta, ensureSessionForThread, nextTurnNumber, registerThread } from "../../../../lib/thread-registry.js";

export const runtime = "nodejs";

type ChatRequestBody = {
  thread_id?: string;
  provider?: string;
  messages?: UIMessage[];
};

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function lastUserMessage(messages: UIMessage[]): UIMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      return messages[i];
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const threadId = body.thread_id;
  if (!threadId || typeof threadId !== "string") {
    return new Response("thread_id is required", { status: 400 });
  }

  const uiMessages = body.messages ?? [];
  const userMessage = lastUserMessage(uiMessages);
  if (!userMessage) {
    return new Response("A user message is required", { status: 400 });
  }

  const userText = messageText(userMessage);
  if (!userText.trim()) {
    return new Response("A user message is required", { status: 400 });
  }

  const meta = await ensureSessionForThread(threadId);
  if (!meta?.sessionPath || !meta.sessionSlug) {
    return new Response("Unknown thread_id", { status: 400 });
  }
  registerThread(threadId, meta);

  let provider: string;
  try {
    provider = resolveChatProviderId(body.provider);
    resolveProviderConfig(provider);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid provider";
    return new Response(message, { status: 400 });
  }

  try {
    const langchainMessages = await toBaseMessages([userMessage]);
    const graphStream = await streamChat(langchainMessages, threadId, undefined, {
      sessionPath: meta.sessionPath,
      provider,
    });

    let assistantText = "";

    return createUIMessageStreamResponse({
      stream: toUIMessageStream(graphStream, {
        onFinal: (completion) => {
          assistantText = completion;
        },
        onFinish: async () => {
          if (!assistantText.trim()) {
            return;
          }
          const turnNumber = nextTurnNumber(threadId);
          if (!turnNumber) {
            return;
          }
          await appendConversationTurn({
            sessionSlug: meta.sessionSlug,
            turnNumber,
            userText,
            assistantText,
          });
        },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat stream failed";
    return new Response(message, { status: 500 });
  }
}
