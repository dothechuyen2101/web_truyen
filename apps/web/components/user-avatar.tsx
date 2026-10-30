import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      {image && <AvatarImage src={image} alt={name} />}
      <AvatarFallback className="bg-brand text-xs font-semibold text-white">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
