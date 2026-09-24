import type { DateRange } from '../derive';

export function DateFilter({
  range,
  bounds,
  onChange,
  filtered,
  total,
}: {
  range: DateRange;
  bounds: { min: string; max: string } | null;
  onChange: (r: DateRange) => void;
  filtered: number;
  total: number;
}) {
  const active = !!(range.from || range.to);
  return (
    <div className="daterange">
      <span className="drlabel">Range</span>
      <input
        type="date"
        value={range.from ?? ''}
        min={bounds?.min}
        max={range.to ?? bounds?.max}
        onChange={(e) => onChange({ ...range, from: e.target.value || undefined })}
        aria-label="From date"
      />
      <span className="drto">to</span>
      <input
        type="date"
        value={range.to ?? ''}
        min={range.from ?? bounds?.min}
        max={bounds?.max}
        onChange={(e) => onChange({ ...range, to: e.target.value || undefined })}
        aria-label="To date"
      />
      {active ? (
        <>
          <button className="pill" onClick={() => onChange({})}>
            Clear
          </button>
          <span className="drcount">
            {filtered} of {total} events
          </span>
        </>
      ) : null}
    </div>
  );
}
