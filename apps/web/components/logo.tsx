import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { SITE_NAME } from "@/lib/site";

export function Logo() {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label={`${SITE_NAME} — trang chủ`}>
      <span className="grid size-8 place-items-center rounded-lg bg-brand text-white shadow-md shadow-primary/25 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
        <BookOpenText className="size-4.5" strokeWidth={2.25} />
      </span>
      <span className="hidden text-lg font-bold tracking-tight sm:inline">
        <span className="text-brand">{SITE_NAME}</span>
      </span>
    </Link>
  );
}
