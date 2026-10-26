import { useRef, useState } from "react";

// Loupe for the defect-inspection view: QA reviewers move the pointer over
// a weld photo to inspect it at 3x. The highlight IS the tool: it is off
// until the reviewer toggles "Loupe", and arrow keys move it as well.
export function InspectionLoupe({ src, alt }) {
  const frameRef = useRef(null);
  const [lens, setLens] = useState(null);

  function handleMouseMove(event) {
    const rect = frameRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setLens({ x, y });
  }

  return (
    <figure
      ref={frameRef}
      className="loupe-frame"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setLens(null)}
      style={{ position: "relative", background: "#0d0f12" }}
    >
      <img src={src} alt={alt} draggable={false} />
      {lens && (
        <div
          aria-hidden="true"
          className="loupe-lens"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: `url(${src}), radial-gradient(circle at ${lens.x}% ${lens.y}%, transparent 80px, rgba(0, 0, 0, 0.55) 81px)`,
            backgroundSize: "300%, 100%",
            backgroundPosition: `${lens.x}% ${lens.y}%, 0 0`,
            clipPath: `circle(80px at ${lens.x}% ${lens.y}%)`,
          }}
        />
      )}
      <figcaption>Loupe 3x. Arrow keys move the lens; Esc closes it.</figcaption>
    </figure>
  );
}
