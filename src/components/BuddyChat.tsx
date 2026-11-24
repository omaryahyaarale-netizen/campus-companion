import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  BookOpen,
  CalendarCheck,
  HeartPulse,
  Salad,
  Sparkles,
  Square,
  RotateCcw,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS, type ChatMessage } from "@/lib/chat-limits";

const STARTERS = [
  { icon: CalendarCheck, label: "Plan my exam week", prompt: "I have three exams next week. Help me build a study plan and to-do list." },
  { icon: BookOpen, label: "Study smarter", prompt: "What are the most effective study techniques when I keep getting distracted?" },
  { icon: HeartPulse, label: "I'm stressed", prompt: "I'm feeling overwhelmed with everything right now. Can you help me calm down and sort out what matters?" },
  { icon: Salad, label: "Quick, healthy food", prompt: "Give me cheap, healthy snack and quick meal ideas for a busy student." },
  { icon: Users, label: "Meet people", prompt: "How do I find clubs and events on campus that fit me?" },
  { icon: Sparkles, label: "Motivate me", prompt: "I've lost my motivation this semester. Give me a pep talk and a small first step." },
];

function BuddyMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-buddy ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M8.5 10v1.5M15.5 10v1.5" />
        <path d="M8 15.2c1.1 1.2 2.4 1.8 4 1.8s2.9-.6 4-1.8" />
      </svg>
    </span>
  );
}

export function BuddyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!content || busy) return;
    setError(null);
    setInput("");
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let reply = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY_MESSAGES) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Buddy couldn't answer just now. Please try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        const current = reply;
        setMessages([...history, { role: "assistant", content: current }]);
      }
      if (!reply) throw new Error("Buddy couldn't answer just now. Please try again.");
    } catch (err) {
      const stopped = controller.signal.aborted;
      // Keep whatever was already written; drop the empty placeholder otherwise.
      setMessages(reply ? [...history, { role: "assistant", content: reply }] : history);
      if (!stopped) {
        setError(
          reply
            ? "The answer was cut short. You can ask Buddy to continue."
            : err instanceof Error && err.message && !/fetch|network/i.test(err.message)
              ? err.message
              : "Buddy couldn't answer just now. Please try again.",
        );
        if (!reply) setInput(content);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-campus">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <BuddyMark className="size-9" />
          <span className="font-display text-xl font-semibold tracking-tight">Campus Buddy</span>
        </div>
        {!empty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              abortRef.current?.abort();
              setMessages([]);
              setError(null);
            }}
          >
            <RotateCcw /> New chat
          </Button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pb-6 sm:px-6">
          {empty ? (
            <div className="my-auto py-8">
              <BuddyMark className="size-16 animate-buddy-bob" />
              <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl">
                Hey! What's on your plate today?
              </h1>
              <p className="mt-3 max-w-md text-base text-muted-foreground">
                Your friendly sidekick for study plans, deadlines, stress, food and everything in between.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {STARTERS.map(({ icon: Icon, label, prompt }) => (
                  <Button
                    key={label}
                    variant="chip"
                    size="chip"
                    onClick={() => void send(prompt)}
                  >
                    <Icon className="text-primary" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="flex flex-col gap-5 py-4">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <li key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-bubble px-4 py-2.5 text-bubble-foreground">
                    {m.content}
                  </li>
                ) : (
                  <li key={i} className="flex gap-3">
                    <BuddyMark className="mt-0.5 size-8 shrink-0" />
                    <div className="min-w-0 flex-1 pt-1">
                      {m.content ? (
                        <div className="buddy-prose">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="buddy-dots" role="status" aria-label="Buddy is thinking">
                          <i /><i /><i />
                        </span>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
          <div ref={endRef} />
        </div>
      </main>

      <footer className="px-4 pb-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {error && (
            <p role="alert" className="mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <form
            onSubmit={onSubmit}
            className="flex items-end gap-2 rounded-3xl border border-border bg-card p-2 pl-4 shadow-buddy focus-within:border-primary"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_MESSAGE_CHARS}
              placeholder="Ask Buddy anything about student life…"
              aria-label="Message Campus Buddy"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground [field-sizing:content]"
            />
            {busy ? (
              <Button type="button" size="icon" variant="secondary" className="rounded-full" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                <Square />
              </Button>
            ) : (
              <Button type="submit" size="icon" className="rounded-full" aria-label="Send" disabled={!input.trim()}>
                <ArrowUp />
              </Button>
            )}
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Buddy is an AI and can get things wrong. Chats aren't saved.
          </p>
        </div>
      </footer>
    </div>
  );
}
