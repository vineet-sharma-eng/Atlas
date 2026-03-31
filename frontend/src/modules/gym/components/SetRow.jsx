function NumericField({
  field,
  label,
  value,
  disabled,
  step = '1',
  min = '0',
  max,
  onChange,
  onAdvance,
  registerInput,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
        {label}
      </span>
      <input
        ref={(node) => registerInput(field, node)}
        className="w-full rounded-2xl border border-atlas-line bg-atlas-night px-3 py-3 text-base text-atlas-ink"
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
            onAdvance(field);
          }
        }}
      />
    </label>
  );
}

export function SetRow({
  row,
  disabled,
  saveDisabled,
  isCommitted,
  previousWeight,
  timeBased,
  registerInput,
  onChange,
  onAdvance,
  onApplyWeightDelta,
  onCopyPreviousWeight,
  onSave,
}) {
  const isEditable = !disabled && !row.saving;
  const statusLabel = row.saving
    ? 'Saving...'
    : isCommitted
      ? 'Saved'
      : row.saved
        ? 'Needs save'
        : 'Ready to log';
  const saveLabel = row.saving ? 'Saving...' : isCommitted ? 'Saved' : row.saved ? 'Update' : 'Save';

  return (
    <article
      className={`rounded-[22px] border px-4 py-4 ${
        isCommitted
          ? 'border-green-500/30 bg-green-500/10'
          : row.saved
            ? 'border-atlas-accent/40 bg-atlas-accentSoft/40'
          : 'border-atlas-line bg-atlas-panel'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-atlas-slate">
            Set {row.setNumber}
          </div>
          <div className="mt-2 text-sm text-atlas-slate">
            {statusLabel}
          </div>
        </div>

        <button
          type="button"
          className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
            isCommitted
              ? 'bg-green-500/15 text-green-200'
              : row.saved
                ? 'bg-atlas-accentSoft text-blue-100'
              : 'bg-atlas-accent text-white'
          }`}
          onClick={onSave}
          disabled={saveDisabled}
        >
          {saveLabel}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <NumericField
          field="weight"
          label="Weight"
          value={row.weight}
          step="0.5"
          disabled={!isEditable}
          registerInput={registerInput}
          onChange={(value) => onChange('weight', value)}
          onAdvance={onAdvance}
        />
        <NumericField
          field="reps"
          label={timeBased ? 'Time' : 'Reps'}
          value={row.reps}
          disabled={!isEditable}
          registerInput={registerInput}
          onChange={(value) => onChange('reps', value)}
          onAdvance={onAdvance}
        />
        <NumericField
          field="rir"
          label="RIR"
          value={row.rir}
          min="0"
          max="4"
          disabled={!isEditable}
          registerInput={registerInput}
          onChange={(value) => onChange('rir', value)}
          onAdvance={onAdvance}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {previousWeight !== '' && previousWeight !== null && previousWeight !== undefined ? (
          <button
            type="button"
            className="rounded-full border border-atlas-line bg-atlas-night px-3 py-2 text-sm text-atlas-ink disabled:opacity-50"
            disabled={!isEditable}
            onClick={onCopyPreviousWeight}
          >
            Copy {previousWeight}
          </button>
        ) : null}
        {[2.5, 5, 10].map((delta) => (
          <button
            key={delta}
            type="button"
            className="rounded-full border border-atlas-line bg-atlas-night px-3 py-2 text-sm text-atlas-ink disabled:opacity-50"
            disabled={!isEditable}
            onClick={() => onApplyWeightDelta(delta)}
          >
            +{delta}
          </button>
        ))}
      </div>

      {row.error ? (
        <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-200">
          {row.error}
        </div>
      ) : null}
    </article>
  );
}
