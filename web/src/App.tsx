import { lazy, Suspense, useEffect } from "react";
import { parseRoute, useRoute } from "./lib/router";
import { AlternativesScreen } from "./screens/AlternativesScreen";
import { ContributeScreen } from "./screens/ContributeScreen";
import { DetailsScreen } from "./screens/DetailsScreen";
import { NotFoundScreen } from "./screens/NotFoundScreen";
import { ProductScreen } from "./screens/ProductScreen";
import { ScanScreen } from "./screens/ScanScreen";
// styles de la réalité augmentée (écran caméra et aperçu de l'accueil)
import "./ar.css";

// L'écran caméra (avec le décodeur de codes-barres) est chargé à part.
const ArScanScreen = lazy(() => import("./screens/ArScanScreen"));

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
