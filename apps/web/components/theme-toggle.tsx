"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  function toggle() {
    const apply = () => {
      const dark = document.documentElement.classList.toggle("dark");
      try {
        localStorage.setItem("theme", dark ? "dark" : "light");
      } catch {}
    };
    // Chuyển màu mượt bằng View Transitions nếu trình duyệt hỗ trợ.
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Đổi giao diện sáng/tối"
      className="rounded-full"
    >
      <Sun className="hidden transition-transform duration-500 dark:block dark:rotate-90" />
      <Moon className="transition-transform duration-500 dark:hidden" />
    </Button>
  );
}
