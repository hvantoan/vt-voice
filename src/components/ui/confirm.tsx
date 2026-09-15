import React from "react";
import { confirmable, createConfirmation, type ConfirmDialogProps } from "react-confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export const ConfirmationDialog: React.FC<ConfirmDialogProps<ConfirmOptions, boolean>> = ({
  show,
  proceed,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}) => {
  return (
    <Dialog open={show} onOpenChange={(open) => !open && proceed(false)}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-zinc-100">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => proceed(false)}
            className="h-8 px-3 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant}
            size="sm"
            onClick={() => proceed(true)}
            className={
              variant === "destructive"
                ? "h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs"
                : "h-8 px-3 text-xs"
            }
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const confirm = createConfirmation(confirmable(ConfirmationDialog), 300);
