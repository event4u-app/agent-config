import { useEffect, useRef, useState } from "react";

// Long-form article view. IntersectionObserver is used for two functional
// jobs only: deferring offscreen image downloads, and updating the
// table-of-contents highlight for the section in view. Nothing fades or
// rises into view; content is visible as soon as it is scrolled to.
export function LazyFigure({ src, alt, width, height }) {
  const ref = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <figure ref={ref} style={{ aspectRatio: `${width} / ${height}` }}>
      {shouldLoad && <img src={src} alt={alt} width={width} height={height} />}
    </figure>
  );
}

export function useActiveSection(sectionIds) {
  const [activeId, setActiveId] = useState(sectionIds[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "0px 0px -70% 0px" }
    );
    sectionIds.forEach((id) => observer.observe(document.getElementById(id)));
    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}
