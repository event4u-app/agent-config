export function StatusDot({ ok }) {
  return <span style={{ background: ok ? "var(--color-kelp-green)" : "var(--color-sunset-orange)" }} />;
}
