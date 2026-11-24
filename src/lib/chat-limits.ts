// Shared by the browser and the chat endpoint so both enforce the same bounds.
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_HISTORY_MESSAGES = 40;

export type ChatMessage = { role: "user" | "assistant"; content: string };
