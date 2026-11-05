import { t } from "../lib/i18n";

export function LoadingState() {
  return (
    <main className="content" aria-busy="true" aria-label={t("state.loading")}>
      <div className="card skeleton" style={{ height: 96 }} />
      <div className="card skeleton" style={{ height: 100 }} />
      <div className="grid-2">
        <div className="card skeleton" style={{ height: 130 }} />
        <div className="card skeleton" style={{ height: 130 }} />
      </div>
      <div className="card skeleton" style={{ height: 150 }} />
    </main>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="content center-state" role="alert">
      <p className="state-title">{t("state.offlineTitle")}</p>
      <p className="muted">{t("state.offlineText")}</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        {t("common.retry")}
      </button>
    </main>
  );
}
