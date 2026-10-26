export function LoadingState() {
  return (
    <main className="content" aria-busy="true" aria-label="Chargement de la fiche">
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
      <p className="state-title">Connexion impossible</p>
      <p className="muted">Vérifiez votre connexion internet, puis réessayez.</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Réessayer
      </button>
    </main>
  );
}
