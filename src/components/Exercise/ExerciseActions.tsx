"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ExerciseActionsProps {
  onSubmit: () => void;
  onSkip: () => void;
  onReset: () => void;
  disabled?: boolean;
  isPending?: boolean;
}

export default function ExerciseActions({
  onSubmit,
  onSkip,
  onReset,
  disabled = false,
  isPending = false,
}: ExerciseActionsProps) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-2 bg-muted/30">
      {/* Reset button with confirmation */}
      <Dialog>
        <DialogTrigger
          render={<Button variant="outline" size="sm" disabled={disabled || isPending} />}
        >
          Reset
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Code?</DialogTitle>
            <DialogDescription>Reset to starter code? Your changes will be lost.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <DialogClose render={<Button variant="destructive" onClick={onReset} />}>
              Reset
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2">
        {/* Skip button with confirmation */}
        <Dialog>
          <DialogTrigger
            render={<Button variant="secondary" size="sm" disabled={disabled || isPending} />}
          >
            Skip
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Skip Exercise?</DialogTitle>
              <DialogDescription>Skip this exercise? You can retry later.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <DialogClose render={<Button variant="secondary" onClick={onSkip} />}>
                Skip
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Submit button */}
        <Button variant="default" size="sm" onClick={onSubmit} disabled={disabled || isPending}>
          {isPending ? (
            <>
              <Spinner className="size-3" />
              <span>Submitting...</span>
            </>
          ) : (
            "Submit"
          )}
        </Button>
      </div>
    </div>
  );
}
