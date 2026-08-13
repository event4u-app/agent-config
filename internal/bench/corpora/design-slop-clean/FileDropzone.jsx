// clean: drop target that is also a real file input, with size and type validation stated up front
import { useRef, useState } from "react";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED = ["text/csv", "application/json"];

function describe(file) {
  const megabytes = (file.size / 1024 / 1024).toFixed(1);
  return `${file.name}, ${megabytes} MB`;
}

export function FileDropzone({ onAccept }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(null);

  function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setRejected(`${file.name} is not a CSV or JSON file.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setRejected(`${file.name} is larger than the 25 MB limit.`);
      return;
    }
    setRejected(null);
    onAccept(file);
  }

  return (
    <div
      className={dragging ? "dropzone dropzone--active" : "dropzone"}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <label className="dropzone__label" htmlFor="import-file">
        Drop a file here, or
      </label>
      <input
        ref={inputRef}
        className="dropzone__input"
        id="import-file"
        type="file"
        accept=".csv,.json"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <p className="dropzone__constraints">
        CSV or JSON, up to 25 MB. The first row must contain column names.
      </p>

      {rejected && (
        <p className="dropzone__error" role="alert">
          {rejected}
        </p>
      )}
    </div>
  );
}
