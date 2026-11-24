import { createFileRoute } from "@tanstack/react-router";
import { GatewayError, streamResponse } from "@lovable.dev/ai-gateway";
import { z } from "zod";

import { BUDDY_INSTRUCTIONS } from "@/lib/buddy-prompt.server";
import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS } from "@/lib/chat-limits";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS * 4),
      }),
    )
    .min(1)
    .max(MAX_HISTORY_MESSAGES),
});

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.safeParse(await request.json());
        } catch {
          return errorResponse(400, "Invalid request.");
        }
        if (!parsed.success) return errorResponse(400, "Invalid request.");
        const { messages } = parsed.data;
        const last = messages[messages.length - 1];
        if (!last || last.role !== "user" || last.content.length > MAX_MESSAGE_CHARS) {
          return errorResponse(400, "Invalid request.");
        }

        let stream;
        try {
          stream = await streamResponse(
            {
              model: "openai/gpt-6.1-sol",
              instructions: BUDDY_INSTRUCTIONS,
              input: messages.map((m) => ({ role: m.role, content: m.content })),
            },
            { signal: request.signal },
          );
        } catch (error) {
          console.error("chat start failed", error);
          if (error instanceof GatewayError) {
            if (error.httpStatus === 429)
              return errorResponse(429, "Buddy is a bit busy right now. Try again in a moment.");
            if (error.httpStatus === 402)
              return errorResponse(402, "Buddy has run out of AI credits. Please top up to keep chatting.");
          }
          return errorResponse(500, "Buddy couldn't answer just now. Please try again.");
        }

        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const event of stream) {
                if (event.type === "response.output_text.delta") {
                  controller.enqueue(encoder.encode(event.delta));
                }
              }
              controller.close();
            } catch (error) {
              console.error("chat stream failed", error);
              controller.error(error);
            }
          },
        });

        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
