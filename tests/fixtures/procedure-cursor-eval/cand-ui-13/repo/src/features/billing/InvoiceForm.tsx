import { useState } from "react";

export function InvoiceForm({ onSubmit }: { onSubmit: (amount: number) => void }) {
  const [amount, setAmount] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(Number(amount)); }}>
      <label htmlFor="amount">Amount</label>
      <input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button type="submit">Create invoice</button>
    </form>
  );
}
