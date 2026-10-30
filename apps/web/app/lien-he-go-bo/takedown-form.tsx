"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitTakedown } from "@/lib/actions";

export function TakedownForm() {
  const [state, action, pending] = useActionState(submitTakedown, null);

  if (state?.ok) {
    return (
      <div className="flex animate-in flex-col items-center rounded-2xl border bg-card p-8 text-center duration-500 fade-in zoom-in-95">
        <CheckCircle2 className="size-12 text-emerald-500" />
        <p className="mt-4 text-lg font-semibold">Đã nhận yêu cầu của bạn</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Chúng tôi sẽ xem xét và gỡ nội dung vi phạm sớm nhất có thể, thường trong vòng 72 giờ.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Họ tên / Tổ chức</Label>
          <Input id="name" name="name" required maxLength={200} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email liên hệ</Label>
          <Input id="email" name="email" type="email" required maxLength={200} className="rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="urls">Đường dẫn nội dung cần gỡ (mỗi dòng một URL)</Label>
        <Textarea id="urls" name="urls" required rows={4} placeholder="https://…/truyen/ten-truyen" className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Mô tả quyền sở hữu và yêu cầu</Label>
        <Textarea id="message" name="message" required rows={5} className="rounded-xl" />
      </div>
      {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="rounded-xl bg-brand">
        {pending && <Loader2 className="animate-spin" />} Gửi yêu cầu
      </Button>
    </form>
  );
}
