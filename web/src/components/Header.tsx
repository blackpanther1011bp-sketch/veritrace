import type { ReactNode } from "react";
import { goBack } from "../lib/router";
import { IconBack } from "./Icons";

export function Header({ title, backTo, backLabel, right }: { title: string; backTo: string; backLabel: string; right?: ReactNode }) {
  return (
    <header className="topbar">
      <button type="button" className="icon-btn" aria-label={backLabel} onClick={() => goBack(backTo)}>
        <IconBack />
      </button>
      <h1 className="topbar-title">{title}</h1>
      {right}
    </header>
  );
}

export function SampleTag() {
  return (
    <span className="pill-muted" title="Données d'exemple">
      Exemple
    </span>
  );
}
