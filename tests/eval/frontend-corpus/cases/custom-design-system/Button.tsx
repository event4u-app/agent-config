export function Button({ tone = "accent", ...p }) {
  return <button data-tone={tone} className="btn" {...p} />;
}
