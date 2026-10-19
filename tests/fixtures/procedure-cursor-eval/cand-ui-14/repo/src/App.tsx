import { PageShell } from "./components/PageShell";
import { OrdersTable } from "./components/OrdersTable";

export default function App() {
  return (
    <PageShell>
      <OrdersTable rows={[]} />
    </PageShell>
  );
}
