import { useEffect } from "react";
import { parseRoute, useRoute } from "./lib/router";
import { AlternativesScreen } from "./screens/AlternativesScreen";
import { DetailsScreen } from "./screens/DetailsScreen";
import { NotFoundScreen } from "./screens/NotFoundScreen";
import { ProductScreen } from "./screens/ProductScreen";
import { ScanScreen } from "./screens/ScanScreen";

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
    default:
      return <ScanScreen />;
  }
}
