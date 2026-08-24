export function Card({ title, children }) {
  return (
    <section style={{ border: "1px solid #d8dbe0", borderRadius: 8, padding: 20, background: "#ffffff" }}>
      <h3 style={{ margin: "0 0 12px", fontFamily: "'Public Sans', system-ui, sans-serif", fontSize: 16, fontWeight: 600, color: "#171a1f" }}>{title}</h3>
      <div style={{ fontFamily: "'Public Sans', system-ui, sans-serif", fontSize: 14, lineHeight: 1.55, color: "#3d434c" }}>{children}</div>
    </section>
  );
}
