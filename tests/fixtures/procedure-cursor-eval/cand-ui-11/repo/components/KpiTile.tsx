export function KpiTile(props: { label: string; value: number }) {
  return <div className="kpitile">{JSON.stringify(props)}</div>;
}
