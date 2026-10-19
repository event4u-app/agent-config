export function AlbumCard({ title, onOpen }) {
  return (
    <div className="album-card" onClick={onOpen}>
      {title}
    </div>
  );
}
