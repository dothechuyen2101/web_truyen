import Form from "next/form";
import { Search } from "lucide-react";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl backdrop-saturate-150"
      style={{ viewTransitionName: "site-header" }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Logo />
        <NavLinks className="ml-2 hidden items-center gap-1 md:flex" />
        <Form action="/tim-kiem" className="ml-auto flex max-w-xs min-w-0 flex-1 items-center">
          <label className="group relative w-full">
            <span className="sr-only">Tìm truyện</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              name="q"
              type="search"
              placeholder="Tìm truyện, tác giả…"
              className="h-10 w-full rounded-full border bg-muted/60 pr-4 pl-9 text-sm transition-all outline-none placeholder:text-muted-foreground/80 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/15"
            />
          </label>
        </Form>
        <ThemeToggle />
        <UserMenu />
      </div>
      <NavLinks mobile className="scrollbar-none mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2.5 md:hidden" />
    </header>
  );
}
