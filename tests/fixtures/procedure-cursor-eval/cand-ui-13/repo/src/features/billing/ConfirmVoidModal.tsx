export function ConfirmVoidModal({ open, onConfirm }: { open: boolean; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="void-title">
      <h2 id="void-title">Void this invoice?</h2>
      <button onClick={onConfirm}>Void invoice</button>
    </div>
  );
}
