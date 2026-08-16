"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { preprocessWikiLinks } from "@/lib/markdown";

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

export function MarkdownMessage({ content, className = "" }: MarkdownMessageProps) {
  const processed = preprocessWikiLinks(content);

  return (
    <div className={`markdown-body text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("wiki://")) {
              const path = href.replace("wiki://", "");
              return (
                <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-xs dark:bg-zinc-800">
                  [[{path}]]
                </code>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline dark:text-blue-400"
              >
                {children}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-zinc-300 bg-zinc-100 px-2 py-1 font-semibold dark:border-zinc-700 dark:bg-zinc-800">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-zinc-300 px-2 py-1 dark:border-zinc-700">{children}</td>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
              {children}
            </h3>
          ),
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          p: ({ children }) => <p className="my-2">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
