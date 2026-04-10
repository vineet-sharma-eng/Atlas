import { useEffect, useRef, useState } from 'react';
import { useFinanceDashboard } from '../../hooks/useFinanceDashboard';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function FinanceDashboardPage() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [localError, setLocalError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const {
    analysisDays,
    setAnalysisDays,
    analysis,
    isLoadingAnalysis,
    analysisError,
    transactions,
    isLoadingTransactions,
    transactionsError,
    pendingCategoryTransactionId,
    isUploading,
    uploadError,
    uploadResult,
    saveTransactionCategory,
    uploadStatement,
  } = useFinanceDashboard();

  useEffect(() => {
    if (uploadError) {
      setLocalError(uploadError);
    }
  }, [uploadError]);

  function handleFileSelection(file) {
    if (!file) {
      return;
    }

    const validationError = validatePdfFile(file);
    if (validationError) {
      setSelectedFile(null);
      setLocalError(validationError);
      return;
    }

    setSelectedFile(file);
    setLocalError('');
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile) {
      setLocalError('Choose a Google Pay PDF statement before importing.');
      return;
    }

    try {
      await uploadStatement(selectedFile);
      setLocalError('');
    } catch (_) {
      // Hook state already carries the error.
    }
  }

  function resetSelection() {
    setSelectedFile(null);
    setLocalError('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleCategoryChange(transactionId, category) {
    try {
      await saveTransactionCategory(transactionId, category);
    } catch (_) {
      // Hook state already carries the error.
    }
  }

  return (
    <main className="min-h-screen px-3 py-3 pb-24 sm:px-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
            Finance
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-atlas-ink sm:text-3xl">
            Google Pay PDF imports
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-atlas-slate">
            Upload a supported Google Pay statement PDF to import transactions, refresh your spend analysis, and keep Atlas context current.
          </p>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.25fr)]">
          <form
            className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel"
            onSubmit={handleUpload}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                  Import Statement
                </p>
                <h2 className="mt-2 text-xl font-semibold text-atlas-ink">
                  Upload transaction file
                </h2>
              </div>
              <span className="rounded-full border border-atlas-line/80 px-3 py-1 text-[11px] text-atlas-slate">
                PDF, up to 10 MB
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => handleFileSelection(event.target.files?.[0] || null)}
            />

            <button
              type="button"
              className={`mt-4 flex min-h-[220px] w-full flex-col items-center justify-center rounded-[22px] border border-dashed px-6 py-6 text-center transition ${
                isDragging
                  ? 'border-atlas-accent bg-atlas-accent/10'
                  : 'border-atlas-line/80 bg-atlas-night/40 hover:border-atlas-accent/40'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                handleFileSelection(event.dataTransfer.files?.[0] || null);
              }}
            >
              <span className="text-base font-semibold text-atlas-ink">
                {selectedFile ? selectedFile.name : 'Drop a Google Pay PDF here'}
              </span>
              <span className="mt-2 max-w-xs text-sm leading-6 text-atlas-slate">
                Or tap to browse. Atlas currently supports Google Pay statement PDFs only.
              </span>
              {selectedFile ? (
                <span className="mt-4 rounded-full border border-atlas-success/40 bg-atlas-success/10 px-3 py-1 text-xs font-medium text-green-200">
                  Ready to import
                </span>
              ) : null}
            </button>

            {localError ? (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {localError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isUploading}
                className="rounded-[16px] bg-atlas-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading ? 'Importing...' : 'Import PDF'}
              </button>
              <button
                type="button"
                className="rounded-[16px] border border-atlas-line/80 bg-atlas-night/40 px-4 py-3 text-sm font-medium text-atlas-slate"
                onClick={resetSelection}
              >
                Clear
              </button>
            </div>
          </form>

          <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                  Spend Overview
                </p>
                <h2 className="mt-2 text-xl font-semibold text-atlas-ink">
                  Current finance analysis
                </h2>
              </div>
              {isLoadingAnalysis ? (
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-atlas-slate">
                  Loading
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {ANALYSIS_PERIODS.map((period) => (
                <button
                  key={period.days}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                    analysisDays === period.days
                      ? 'border-atlas-accent bg-atlas-accent text-white'
                      : 'border-atlas-line/80 bg-atlas-night/40 text-atlas-slate'
                  }`}
                  onClick={() => setAnalysisDays(period.days)}
                >
                  {period.label}
                </button>
              ))}
            </div>

            {analysisError ? (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {analysisError}
              </div>
            ) : null}

            <article className="mt-4 rounded-[20px] border border-atlas-accent/30 bg-atlas-accent/10 px-4 py-4">
              <p className="text-sm leading-6 text-atlas-ink">
                {analysis.summary || 'No spending data is available yet. Import a Google Pay PDF to populate this dashboard.'}
              </p>
            </article>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total spent" value={formatCurrency(analysis.data?.totalSpent || 0)} />
              <MetricCard label="Top category" value={formatLabel(analysis.data?.topCategory)} />
              <MetricCard label="Transactions" value={String(analysis.meta?.transactionCount || 0)} />
              <MetricCard label="Trend" value={formatTrend(analysis.meta?.trend)} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
              <section className="rounded-[20px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                  Category breakdown
                </p>
                {analysis.data?.categoryBreakdown?.length ? (
                  <div className="mt-3 space-y-3">
                    {analysis.data.categoryBreakdown.map((item) => (
                      <div key={item.category} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-atlas-slate">{item.category}</span>
                        <span className="font-medium text-atlas-ink">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-atlas-slate">
                    Category totals will appear after the first successful import.
                  </p>
                )}
              </section>

              <section className="rounded-[20px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                  Largest transaction
                </p>
                {analysis.data?.largestTransaction ? (
                  <div className="mt-3">
                    <p className="text-xl font-semibold text-atlas-ink">
                      {formatCurrency(analysis.data.largestTransaction.amount)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-atlas-slate">
                      {analysis.data.largestTransaction.description}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-atlas-slate">
                      {analysis.data.largestTransaction.date}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-atlas-slate">
                    Largest expense details will show up once Atlas has enough imported data.
                  </p>
                )}
              </section>
            </div>
          </section>
        </section>

        <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                Transaction History
              </p>
              <h2 className="mt-2 text-xl font-semibold text-atlas-ink">
                Persisted imports
              </h2>
            </div>
            {isLoadingTransactions ? (
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-atlas-slate">
                Loading
              </span>
            ) : (
              <span className="rounded-full border border-atlas-line/80 px-3 py-1 text-[11px] text-atlas-slate">
                {transactions.length} shown
              </span>
            )}
          </div>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-atlas-slate">
            Imported transactions stay here after refresh, even if they are older than the current analysis window.
          </p>

          {transactionsError ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {transactionsError}
            </div>
          ) : null}

          {transactions.length ? (
            <div className="mt-4 overflow-hidden rounded-[20px] border border-atlas-line/70 bg-atlas-night/40">
              <div className="hidden grid-cols-[120px_minmax(0,1fr)_180px_140px] gap-3 border-b border-atlas-line/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate md:grid">
                <span>Date</span>
                <span>Description</span>
                <span>Category</span>
                <span className="text-right">Amount</span>
              </div>

              <div className="divide-y divide-atlas-line/60">
                {transactions.map((transaction) => (
                  <article
                    key={transaction.id}
                    className="grid gap-2 px-4 py-4 md:grid-cols-[120px_minmax(0,1fr)_180px_140px] md:items-center md:gap-3"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-atlas-slate">
                      {transaction.date}
                    </p>
                    <p className="text-sm font-medium text-atlas-ink">
                      {transaction.description}
                    </p>
                    <label className="block">
                      <span className="sr-only">Category</span>
                      <select
                        value={normalizeCategoryValue(transaction.category)}
                        disabled={pendingCategoryTransactionId === String(transaction.id)}
                        className="w-full rounded-[14px] border border-atlas-line/80 bg-atlas-panel px-3 py-2 text-sm text-atlas-ink outline-none transition focus:border-atlas-accent disabled:cursor-not-allowed disabled:opacity-60"
                        onChange={(event) => handleCategoryChange(transaction.id, event.target.value)}
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-sm font-semibold text-atlas-ink md:text-right">
                      {formatCurrency(transaction.amount)}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-atlas-slate">
              Imported transactions will appear here once a Google Pay statement has been processed.
            </p>
          )}
        </section>

        <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                Last import
              </p>
              <h2 className="mt-2 text-xl font-semibold text-atlas-ink">
                Import results
              </h2>
            </div>
            {uploadResult?.filename ? (
              <span className="rounded-full border border-atlas-success/40 bg-atlas-success/10 px-3 py-1 text-[11px] font-medium text-green-200">
                {uploadResult.filename}
              </span>
            ) : null}
          </div>

          {uploadResult ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Parsed" value={String(uploadResult.parsedCount || 0)} />
                <MetricCard label="Inserted" value={String(uploadResult.insertedCount || 0)} />
                <MetricCard label="Duplicates" value={String(uploadResult.duplicateCount || 0)} />
                <MetricCard label="Extracted chars" value={String(uploadResult.extractedCharacters || 0)} />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section className="rounded-[20px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                    Imported transaction preview
                  </p>
                  <div className="mt-3 space-y-3">
                    {(uploadResult.transactions || []).slice(0, 8).map((transaction, index) => (
                      <article
                        key={`${transaction.date}-${transaction.description}-${index}`}
                        className="rounded-[16px] border border-atlas-line/60 bg-atlas-panel/80 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-atlas-ink">
                            {transaction.description}
                          </p>
                          <span className="text-sm font-semibold text-atlas-ink">
                            {formatCurrency(transaction.amount)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-atlas-slate">
                          {transaction.date} - {transaction.category || 'uncategorized'}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-[20px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                    Duplicate preview
                  </p>
                  {uploadResult.duplicates?.length ? (
                    <div className="mt-3 space-y-3">
                      {uploadResult.duplicates.slice(0, 6).map((transaction, index) => (
                        <article
                          key={`${transaction.date}-${transaction.description}-duplicate-${index}`}
                          className="rounded-[16px] border border-atlas-line/60 bg-atlas-panel/80 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-atlas-ink">
                              {transaction.description}
                            </p>
                            <span className="text-sm font-semibold text-atlas-slate">
                              {formatCurrency(transaction.amount)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-atlas-slate">
                            {transaction.date}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-atlas-slate">
                      No duplicates were detected in the latest import.
                    </p>
                  )}
                </section>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-atlas-slate">
              Import a Google Pay PDF to see parsed counts, inserted transactions, and duplicate detection results here.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="rounded-[18px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold text-atlas-ink">
        {value}
      </p>
    </article>
  );
}

const ANALYSIS_PERIODS = [
  { label: '30D', days: 30 },
  { label: '60D', days: 60 },
  { label: '90D', days: 90 },
  { label: 'All', days: 'all' },
];

const CATEGORY_OPTIONS = [
  { value: 'uncategorized', label: 'Uncategorized' },
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'income', label: 'Income' },
  { value: 'health', label: 'Health' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'travel', label: 'Travel' },
  { value: 'bills', label: 'Bills' },
  { value: 'education', label: 'Education' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'other', label: 'Other' },
];

function validatePdfFile(file) {
  const typeLooksValid = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');

  if (!typeLooksValid) {
    return 'Only PDF files are supported right now.';
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'The selected file is larger than 10 MB.';
  }

  return '';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatLabel(value) {
  return value ? String(value) : 'Not available';
}

function formatTrend(trend) {
  if (!trend) {
    return 'No trend yet';
  }

  const percent = trend.changePercent === null || trend.changePercent === undefined
    ? 'N/A'
    : `${Number(trend.changePercent).toFixed(1)}%`;

  return `${trend.direction} ${percent}`;
}

function normalizeCategoryValue(value) {
  return value ? String(value).toLowerCase() : 'uncategorized';
}
