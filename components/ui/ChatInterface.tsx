"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function ChatInterface({
  messages,
  onSend,
  isLoading,
  placeholder = "Typ een bericht...",
  className,
  disabled = false,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isLoading, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-label="Chatberichten"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate text-sm">Start een gesprek…</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded bg-ai-blue/20 border border-ai-blue/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-blue-light text-[10px] font-mono font-bold">AI</span>
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-card px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-ai-blue/20 border border-ai-blue/30 text-off-white"
                  : "bg-surface border border-border text-off-white"
              )}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-slate text-[10px] font-mono">U</span>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded bg-ai-blue/20 border border-ai-blue/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-blue-light text-[10px] font-mono font-bold">AI</span>
            </div>
            <div className="bg-surface border border-border rounded-card px-3 py-2">
              <LoadingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            rows={1}
            aria-label="Berichtinvoer"
            className={cn(
              "flex-1 resize-none bg-surface border border-border rounded-card px-3 py-2 text-sm text-off-white placeholder-slate",
              "focus:outline-none focus:border-ai-blue/60 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[38px] max-h-[160px]"
            )}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || disabled}
            aria-label="Verstuur bericht"
            className="btn-primary shrink-0 h-[38px] px-3"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M14 8L2 2l2.5 6L2 14l12-6z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <p className="text-slate text-[10px] mt-1.5 ml-1">Enter versturen · Shift+Enter nieuwe regel</p>
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1 items-center py-1" aria-label="Laden…">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
