import { Component, type ErrorInfo, type ReactNode } from "react";

/** Page de secours si un écran plante : plutôt qu'une page blanche, un message et un bouton pour recharger. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Écran en erreur :", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen">
        <main className="content center-state" role="alert">
          <h1 className="state-title">Un problème est survenu</h1>
          <p className="muted">Cet écran n'a pas pu s'afficher. Rechargez la page ; si le problème revient, revenez à l'accueil.</p>
          <div className="stack-8">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Recharger
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                window.location.hash = "/";
                window.location.reload();
              }}
            >
              Retour à l'accueil
            </button>
          </div>
        </main>
      </div>
    );
  }
}
