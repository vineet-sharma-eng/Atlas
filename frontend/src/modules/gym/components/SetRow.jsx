function NumberInput({ value, onChange, onSave, min = '0', max, step = '1', disabled }) {
  return (
    <input
      className="w-full min-w-24 rounded-xl border border-atlas-line bg-white px-3 py-2.5 shadow-sm disabled:bg-atlas-mist"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSave();
        }
      }}
    />
  );
}

export function SetRow({ row, disabled, onChange, onSave }) {
  return (
    <>
      <tr className={`${row.saved ? 'bg-white' : 'bg-atlas-accentSoft/70'} shadow-sm`}>
        <td className="rounded-l-2xl px-4 py-3 font-semibold text-atlas-ink">{row.setNumber}</td>
        <td className="px-4 py-3">
          <NumberInput
            value={row.weight}
            step="0.5"
            disabled={disabled || row.saved || row.saving}
            onChange={(value) => onChange('weight', value)}
            onSave={onSave}
          />
        </td>
        <td className="px-4 py-3">
          <NumberInput
            value={row.reps}
            disabled={disabled || row.saved || row.saving}
            onChange={(value) => onChange('reps', value)}
            onSave={onSave}
          />
        </td>
        <td className="px-4 py-3">
          <NumberInput
            value={row.rir}
            min="0"
            max="4"
            disabled={disabled || row.saved || row.saving}
            onChange={(value) => onChange('rir', value)}
            onSave={onSave}
          />
        </td>
        <td className="rounded-r-2xl px-4 py-3">
          <button
            type="button"
            className="rounded-xl bg-atlas-night px-4 py-2.5 font-medium text-white transition-colors hover:bg-atlas-ink disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onSave}
            disabled={disabled || row.saved || row.saving}
          >
            {row.saved ? 'Saved' : row.saving ? 'Saving...' : 'Save Set'}
          </button>
        </td>
      </tr>
      {row.error ? (
        <tr>
          <td colSpan={5} className="px-4 pt-1 text-sm text-red-700">
            {row.error}
          </td>
        </tr>
      ) : null}
    </>
  );
}
