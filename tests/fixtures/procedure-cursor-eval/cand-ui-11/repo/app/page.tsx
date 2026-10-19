import { KpiTile } from "@/components/KpiTile";
import { RevenueChart } from "@/components/RevenueChart";

export default function Page() {
  return (
    <main>
      <KpiTile label="Active users" value={1280} />
      <RevenueChart points={[3, 5, 8]} />
    </main>
  );
}
