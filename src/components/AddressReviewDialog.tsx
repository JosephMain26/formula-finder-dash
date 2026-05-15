import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AddressReviewMode = "suggestion" | "unresolved";

interface AddressReviewDialogProps {
  open: boolean;
  mode: AddressReviewMode;
  originalAddress: string;
  suggestion?: string;
  onUseSuggested?: () => void;
  onKeepOriginal: () => void;
  onCancel: () => void;
}

export function AddressReviewDialog({
  open,
  mode,
  originalAddress,
  suggestion,
  onUseSuggested,
  onKeepOriginal,
  onCancel,
}: AddressReviewDialogProps) {
  const isSuggestion = mode === "suggestion" && !!suggestion;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isSuggestion ? "Did you mean this address instead?" : "We couldn't verify this address"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <span className="block text-xs uppercase tracking-wide text-muted-foreground">Entered address</span>
            <span className="block rounded-md border p-3 text-sm text-foreground break-words">{originalAddress}</span>
            {isSuggestion ? (
              <>
                <span className="block text-xs uppercase tracking-wide text-muted-foreground">Suggested address</span>
                <span className="block rounded-md border p-3 text-sm text-foreground break-words">{suggestion}</span>
              </>
            ) : (
              <span className="block text-sm">
                The map may not be able to pin this job. You can keep the original address or cancel and edit it.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onKeepOriginal} className="sm:ml-0">
            Keep original
          </AlertDialogAction>
          {isSuggestion && onUseSuggested ? (
            <AlertDialogAction onClick={onUseSuggested}>Use suggested address</AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}