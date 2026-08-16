import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyCtaProps {
  message: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}

export function EmptyCta({ message, actionLabel, actionTo, onAction }: EmptyCtaProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        {actionLabel && actionTo && (
          <Button asChild variant="outline" size="sm">
            <Link to={actionTo} viewTransition>
              {actionLabel}
            </Link>
          </Button>
        )}
        {actionLabel && onAction && (
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
