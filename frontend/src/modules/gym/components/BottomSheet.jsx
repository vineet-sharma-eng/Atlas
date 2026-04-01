export function BottomSheet({ open, title, onClose, children }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <button
        type="button"
        aria-label="Close sheet"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section className="relative z-10 max-h-[85vh] w-full max-w-xl overflow-hidden rounded-[26px] border border-atlas-line/80 bg-atlas-panel shadow-panel">
        <div className="flex items-center justify-between border-b border-atlas-line/80 px-4 py-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
              Actions
            </div>
            <h3 className="mt-1 text-lg font-semibold text-atlas-ink">{title}</h3>
          </div>
          <button
            type="button"
            className="rounded-full border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-ink"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(85vh-76px)] overflow-y-auto px-4 py-4">
          {children}
        </div>
      </section>
    </div>
  );
}
