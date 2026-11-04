import { lazy, Suspense, useEffect } from "react";
import { parseScannedCode } from "./lib/outils";
import { parseRoute, useRoute } from "./lib/router";
import { AlternativesScreen } from "./screens/AlternativesScreen";
import { ContributeScreen } from "./screens/ContributeScreen";
import { DetailsScreen } from "./screens/DetailsScreen";
import { FabricantsScreen } from "./screens/FabricantsScreen";
import { LabelScreen } from "./screens/LabelScreen";
import { NotFoundScreen } from "./screens/NotFoundScreen";
import { PassportScreen } from "./screens/PassportScreen";
import { ProductScreen } from "./screens/ProductScreen";
import { ScanScreen } from "./screens/ScanScreen";
// styles de la réalité augmentée (écran caméra et aperçu de l'accueil)
import "./ar.css";

// L'écran caméra (avec le décodeur de codes-barres) est chargé à part.
const ArScanScreen = lazy(() => import("./screens/ArScanScreen"));
// Lecture de l'étiquette en direct dans la caméra (moteur de lecture chargé à la demande)
const LabelLiveScreen = lazy(() => import("./screens/LabelLiveScreen"));

// QR code imprimé sur une étiquette (GS1 Digital Link : https://…/01/<GTIN>?passeport=…), ouvert avec
// l'appareil photo du téléphone : on redirige vers la page du passeport ou la fiche du vêtement.
if (/^\/01\/\d{8,14}/.test(window.location.pathname)) {
  const scanned = parseScannedCode(window.location.href);
  const target = scanned?.kind === "passport" ? `/passeport/${scanned.id}` : scanned?.kind === "gtin" ? `/p/${scanned.gtin}` : "/";
  window.history.replaceState(null, "", `/#${target}`);
}

export default function App() {
  const path = useRoute();
  const route = parseRoute(path);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  switch (route.name) {
    case "product":
      return <ProductScreen key={route.ean} ean={route.ean} />;
    case "details":
      return <DetailsScreen key={path} ean={route.ean} initialTab={route.tab} />;
    case "alternatives":
      return <AlternativesScreen key={route.ean} ean={route.ean} />;
    case "notFound":
      return <NotFoundScreen key={route.ean} ean={route.ean} />;
    case "contribute":
      return <ContributeScreen key={route.ean} ean={route.ean} />;
    case "label":
      return <LabelScreen key={route.ean ?? "sans-code"} ean={route.ean} />;
    case "labelLive":
      return (
        <Suspense fallback={<div className="ar"><p className="ar-status">Ouverture de la caméra…</p></div>}>
          <LabelLiveScreen key={route.ean ?? "sans-code"} ean={route.ean} />
        </Suspense>
      );
    case "makers":
      return <FabricantsScreen />;
    case "passport":
      return <PassportScreen key={route.id} id={route.id} />;
    case "ar":
      return (
        <Suspense fallback={<div className="ar"><p className="ar-status">Ouverture de la caméra…</p></div>}>
          <ArScanScreen />
        </Suspense>
      );
    default:
      return <ScanScreen />;
  }
}
