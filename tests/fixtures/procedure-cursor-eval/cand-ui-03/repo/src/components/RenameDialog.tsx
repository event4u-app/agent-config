import * as Dialog from "@radix-ui/react-dialog";

export function RenameDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>Rename project</Dialog.Title>
          <input name="projectName" aria-label="Project name" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
