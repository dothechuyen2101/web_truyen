"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { toast } from "./toaster";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Form chạy Server Action của admin; kết quả hiện bằng toast (form có thể biến mất sau khi
 * trang làm mới, vd yêu cầu đã xử lý rời khỏi danh sách "chờ").
 * `confirm` hỏi lại trước các thao tác nguy hiểm (xoá, gộp, backfill…).
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  inline = false,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  inline?: boolean;
}) {
  const [, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result) toast(result.message, result.ok);
    return result;
  }, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={cn(inline ? "inline-flex flex-wrap items-center gap-2" : "space-y-2", className)}
    >
      {children}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "outline",
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  variant?: "default" | "outline" | "destructive" | "ghost" | "secondary";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending}
      name={name}
      value={value}
      className={cn("rounded-lg", variant === "default" && "bg-brand", className)}
    >
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
