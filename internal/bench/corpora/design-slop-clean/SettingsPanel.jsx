// clean: controlled form panel, CSS-module classes, save state announced to assistive tech
import { useState } from "react";
import styles from "./SettingsPanel.module.css";

const RETENTION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

export function SettingsPanel({ initial, onSave }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("idle");

  const update = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("saving");
    try {
      await onSave(form);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className={styles.panel} onSubmit={handleSubmit}>
      <h2 className={styles.title}>Data retention</h2>
      <p className={styles.hint}>
        Events older than the retention window are deleted nightly at 03:00 UTC.
        Deletion is permanent.
      </p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="retention">
          Keep events for
        </label>
        <select
          className={styles.select}
          id="retention"
          value={form.retentionDays}
          onChange={update("retentionDays")}
        >
          {RETENTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="export-bucket">
          Archive bucket, optional
        </label>
        <input
          className={styles.input}
          id="export-bucket"
          value={form.exportBucket}
          onChange={update("exportBucket")}
          placeholder="s3://acme-archive/events"
          aria-describedby="export-bucket-hint"
        />
        <p className={styles.fieldHint} id="export-bucket-hint">
          Events are copied here before deletion. Leave empty to skip archiving.
        </p>
      </div>

      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving" : "Save changes"}
        </button>
        <p className={styles.status} role="status">
          {status === "saved" && "Settings saved."}
          {status === "error" && "Save failed. Your changes are still here."}
        </p>
      </div>
    </form>
  );
}
