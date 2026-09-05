import { allowedSizes } from "@fashion-mvp/shared";
import type { Step } from "../types.js";

export function EmptyState({ title }: { title: string }) {
  return <div className="panel empty-state">{title}</div>;
}

export function Text({ label, value, onChange, type = "text" }: { label: string; value: string; type?: string; onChange: (v: string) => void }) {
  return <label>{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

export function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["photo", "data", "saved"];
  const labels = ["Fotó", "Adatok", "Mentve"];
  const index = order.indexOf(step);
  return <ol className="stepper">{labels.map((label, i) => <li className={i <= index ? "done" : ""} key={label}>{label}</li>)}</ol>;
}

export function SizePicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  return (
    <fieldset className="size-picker wide">
      <legend>Méretek</legend>
      {allowedSizes.map((size) => (
        <label key={size} className={value.includes(size) ? "selected" : ""}>
          <input
            type="checkbox"
            checked={value.includes(size)}
            onChange={() => onChange(value.includes(size) ? value.filter((item) => item !== size) : [...value, size])}
          />
          {size}
        </label>
      ))}
    </fieldset>
  );
}

export function ReservationDeadlinePicker({ durationHours, customDate, noExpiry, onDuration, onCustomDate, onNoExpiry }: {
  durationHours: string;
  customDate: string;
  noExpiry: boolean;
  onDuration: (hours: string) => void;
  onCustomDate: (date: string) => void;
  onNoExpiry: (enabled: boolean) => void;
}) {
  const options = ["2", "4", "6", "12", "24", "36", "48"];
  return (
    <fieldset className="deadline-picker wide">
      <legend>Foglalható eddig</legend>
      <p>A gyorsgombos határidő a honlapra megosztás pillanatától indul.</p>
      <label className="checkbox-line">
        <input type="checkbox" checked={noExpiry} onChange={(event) => onNoExpiry(event.target.checked)} />
        Lejárat nélkül
      </label>
      <div className="deadline-buttons">
        {options.map((hours) => (
          <button
            type="button"
            className={!noExpiry && !customDate && durationHours === hours ? "active" : ""}
            disabled={noExpiry}
            onClick={() => {
              onNoExpiry(false);
              onDuration(hours);
            }}
            key={hours}
          >
            +{hours} óra
          </button>
        ))}
      </div>
      <label>
        Egyedi dátum és idő
        <input
          type="datetime-local"
          value={customDate}
          disabled={noExpiry}
          onChange={(event) => {
            onNoExpiry(false);
            onCustomDate(event.target.value);
          }}
        />
      </label>
    </fieldset>
  );
}
