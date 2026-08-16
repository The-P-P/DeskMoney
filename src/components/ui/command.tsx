import * as React from "react";
import { type DialogProps } from "@radix-ui/react-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";

const Command = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-2xl bg-transparent text-popover-foreground",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

const CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogPortal>
        <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[15vh] z-50 w-[calc(100%-1.5rem)] max-w-xl translate-x-[-50%] translate-y-0 overflow-hidden p-0",
            "rounded-2xl border border-black/5 bg-card/80 shadow-2xl shadow-black/20 backdrop-blur-2xl",
            "dark:border-white/10 dark:bg-card/70 dark:shadow-black/50",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-4",
            "focus:outline-none",
          )}
        >
          <DialogTitle className="sr-only">Busca rápida</DialogTitle>
          <Command className="[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2">
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

const CommandInput = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div
    className="flex items-center gap-3 border-b border-border/50 px-3.5"
    cmdk-input-wrapper=""
  >
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
      <Search className="size-4" />
    </span>
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
    <kbd className="pointer-events-none hidden h-6 shrink-0 select-none items-center rounded-md border border-border/60 bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
      Esc
    </kbd>
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      "cmdk-list max-h-[min(60vh,420px)] overflow-y-auto overflow-x-hidden py-2",
      className,
    )}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, children, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn(
      "flex flex-col items-center justify-center gap-2 py-10 text-center",
      className,
    )}
    {...props}
  >
    <span className="flex size-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
      <Search className="size-5" />
    </span>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">
        {children ?? "Nenhum resultado encontrado."}
      </p>
      <p className="text-xs text-muted-foreground">
        Tente buscar uma conta, categoria ou lançamento.
      </p>
    </div>
  </CommandPrimitive.Empty>
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground",
      "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-2",
      "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium",
      "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider",
      "[&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border/60", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-3 rounded-xl px-2.5 py-2 text-sm outline-none transition-colors",
      "data-[selected=true]:bg-primary/12 data-[selected=true]:text-foreground",
      "data-[selected=true]:ring-1 data-[selected=true]:ring-inset data-[selected=true]:ring-primary/25",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <kbd
      className={cn(
        "ml-auto inline-flex h-5 shrink-0 items-center rounded-md border border-border/60 bg-muted/50 px-1.5 font-mono text-[10px] font-medium tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
};
CommandShortcut.displayName = "CommandShortcut";

const CommandFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-border/50 px-3.5 py-2.5 text-[11px] text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-1.5">
        <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border/60 bg-muted/50 px-1 font-mono text-[10px]">
          ↑
        </kbd>
        <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border/60 bg-muted/50 px-1 font-mono text-[10px]">
          ↓
        </kbd>
        <span>navegar</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border/60 bg-muted/50 px-1 font-mono text-[10px]">
          ↵
        </kbd>
        <span>abrir</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <kbd className="inline-flex h-5 items-center justify-center rounded-md border border-border/60 bg-muted/50 px-1.5 font-mono text-[10px]">
          esc
        </kbd>
        <span>fechar</span>
      </span>
    </div>
  );
};
CommandFooter.displayName = "CommandFooter";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
  CommandFooter,
};
