import { useState } from "react";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  return (
    <div style={{ background: "#0f1115", color: "#e8e6e3", minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "'Instrument Serif', Georgia, serif" }}>
      <form style={{ display: "flex", gap: 8 }} onSubmit={e => e.preventDefault()}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
               style={{ background: "transparent", border: "1px solid #2a2e35", borderRadius: 999, padding: "10px 16px", color: "inherit" }} />
        <button style={{ borderRadius: 999, border: 0, padding: "10px 20px", background: "#e8e6e3", color: "#0f1115" }}>Join</button>
      </form>
    </div>
  );
}
