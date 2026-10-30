"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoredValue, writeStoredValue } from "@/lib/use-stored-value";
import { cn } from "@/lib/utils";

interface ReaderSettings {
  size: number;
  leading: number;
  font: "serif" | "sans";
  sepia: boolean;
}

const DEFAULTS: ReaderSettings = { size: 20, leading: 1.8, font: "serif", sepia: false };
const STORAGE_KEY = "reader-settings";

function parseSettings(raw: string | null | undefined): ReaderSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(raw ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function NovelReader({ html }: { html: string }) {
  const raw = useStoredValue(STORAGE_KEY);
  const settings = useMemo(() => parseSettings(raw), [raw]);
  const [open, setOpen] = useState(false);

  // Nền sepia áp dụng cho cả trang khi đang đọc.
  useEffect(() => {
    document.body.classList.toggle("reader-sepia", settings.sepia);
    return () => document.body.classList.remove("reader-sepia");
  }, [settings.sepia]);

  function update(patch: Partial<ReaderSettings>) {
    writeStoredValue(STORAGE_KEY, JSON.stringify({ ...settings, ...patch }));
  }

  const option = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-sm transition-colors",
      active ? "border-transparent bg-brand text-white" : "hover:border-primary/60 hover:text-primary",
    );

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <Settings2 className={cn("transition-transform duration-300", open && "rotate-90")} /> Tuỳ chỉnh
        </Button>
      </div>
      {open && (
        <div className="mb-6 animate-in space-y-3 rounded-2xl border bg-card p-4 text-sm shadow-sm duration-300 fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="w-24 text-muted-foreground">Cỡ chữ</span>
            <Button variant="outline" size="icon-sm" onClick={() => update({ size: Math.max(14, settings.size - 1) })} aria-label="Giảm cỡ chữ">
              <Minus />
            </Button>
            <span className="w-8 text-center tabular-nums">{settings.size}</span>
            <Button variant="outline" size="icon-sm" onClick={() => update({ size: Math.min(32, settings.size + 1) })} aria-label="Tăng cỡ chữ">
              <Plus />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 text-muted-foreground">Font</span>
            <button className={cn(option(settings.font === "serif"), "font-serif")} onClick={() => update({ font: "serif" })}>
              Có chân
            </button>
            <button className={cn(option(settings.font === "sans"), "font-sans")} onClick={() => update({ font: "sans" })}>
              Không chân
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 text-muted-foreground">Giãn dòng</span>
            {[1.5, 1.8, 2.1].map((l) => (
              <button key={l} className={option(settings.leading === l)} onClick={() => update({ leading: l })}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 text-muted-foreground">Nền</span>
            <button className={option(!settings.sepia)} onClick={() => update({ sepia: false })}>
              Mặc định
            </button>
            <button className={option(settings.sepia)} onClick={() => update({ sepia: true })}>
              Giấy cũ
            </button>
          </div>
        </div>
      )}
      <div
        className="reader-text"
        style={
          {
            "--reader-size": `${settings.size}px`,
            "--reader-leading": settings.leading,
            "--reader-font": settings.font === "serif" ? "var(--font-serif)" : "var(--font-sans)",
          } as React.CSSProperties
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
