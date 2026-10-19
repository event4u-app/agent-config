import { InvoiceForm } from "./InvoiceForm";
import { InvoiceTable } from "./InvoiceTable";
import { ConfirmVoidModal } from "./ConfirmVoidModal";

export function BillingPage() {
  return (
    <>
      <InvoiceForm onSubmit={() => undefined} />
      <InvoiceTable rows={[]} />
      <ConfirmVoidModal open={false} onConfirm={() => undefined} />
    </>
  );
}
