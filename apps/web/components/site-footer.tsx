import Link from "next/link";
import { NAV_LINKS, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">{SITE_DESCRIPTION}</p>
          <p className="max-w-sm text-xs text-muted-foreground/80">
            {SITE_NAME} tổng hợp truyện từ nhiều nguồn trên Internet. Bản quyền thuộc về tác giả và nhóm dịch.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Khám phá</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-primary">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Hỗ trợ</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/lien-he-go-bo" className="transition-colors hover:text-primary">
                Yêu cầu gỡ nội dung
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
