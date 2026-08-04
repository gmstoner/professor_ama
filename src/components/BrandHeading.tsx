import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { amaTitle, professorAvatarUrl, professorInitials, professorName } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandHeadingProps = {
  title?: string;
  as?: "h1" | "h2";
  size?: "lg" | "md";
  className?: string;
};

export function BrandHeading({
  title = amaTitle,
  as: Tag = "h1",
  size = "lg",
  className,
}: BrandHeadingProps) {
  const avatarSize = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const textSize = size === "lg" ? "text-4xl" : "text-2xl";

  return (
    <Tag className={cn("flex items-center gap-3 font-bold leading-tight", textSize, className)}>
      <Avatar className={cn(avatarSize, "border border-border shadow-sm")}>
        {professorAvatarUrl ? (
          <AvatarImage src={professorAvatarUrl} alt={professorName} />
        ) : null}
        <AvatarFallback>{professorInitials()}</AvatarFallback>
      </Avatar>
      <span>{title}</span>
    </Tag>
  );
}
