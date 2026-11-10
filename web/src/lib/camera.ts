import { BarcodeDetector as BarcodeDetectorPonyfill, prepareZXingModule } from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import type { Pt } from "./arGeometry";
import { t } from "./i18n";

// Le décodeur (ZXing, WebAssembly) est servi depuis notre domaine plutôt qu'un CDN.
const zxingOverrides = {
  locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
};
prepareZXingModule({ overrides: zxingOverrides });

/** Lance le téléchargement du décodeur en avance, pour un premier scan plus rapide. */
export function warmUpDecoder(): void {
  prepareZXingModule({ overrides: zxingOverrides, fireImmediately: true }).catch(() => undefined);
}

// QR code : passeports numériques (GS1 Digital Link) et passeports VeriTrace.
// Code 128 et Code 39 : codes internes des enseignes, fréquents sur les étiquettes de vêtements. Ils ne désignent pas
// un produit de façon universelle, mais les reconnaître permet de l'expliquer au lieu de ne rien afficher.
const FORMATS = ["ean_13", "ean_8", "upc_a", "qr_code", "code_128", "code_39"] as const;

export interface DetectedCode {
  rawValue: string;
  cornerPoints: ReadonlyArray<Pt>;
}

export interface Detector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>;
}

/** Détecteur natif quand il existe (Chrome Android, plus rapide), sinon décodeur intégré (iPhone). */
export async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } })
    .BarcodeDetector;
  if (Native && typeof Native.getSupportedFormats === "function") {
    try {
      const supported = await Native.getSupportedFormats();
      if (supported.includes("ean_13")) {
        return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
      }
    } catch {
      // on bascule sur le décodeur intégré
    }
  }
  return new BarcodeDetectorPonyfill({ formats: [...FORMATS] });
}

export class InsecureContextError extends Error {}

/**
 * Ouvre la caméra arrière en 1920 × 1080. En 1280 × 720, le code-barres d'une vraie étiquette (2 à 3 cm de large,
 * tenu à 15-20 cm) n'occupe que 1 à 2 pixels par barre : illisible dès que l'image est un peu floue.
 */
export async function openBackCamera(size: { width: number; height: number } = { width: 1920, height: 1080 }): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new InsecureContextError("La caméra nécessite une connexion sécurisée (https).");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: size.width }, height: { ideal: size.height } },
  });
}

export function cameraErrorMessage(error: unknown): string {
  if (error instanceof InsecureContextError) {
    return t("camera.insecure");
  }
  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return t("camera.denied");
    case "NotFoundError":
    case "OverconstrainedError":
      return t("camera.none");
    case "NotReadableError":
      return t("camera.busy");
    default:
      return t("camera.failed");
  }
}

type ZoomCapabilities = MediaTrackCapabilities & { zoom?: { min: number; max: number }; focusMode?: string[] };

/**
 * Règle la caméra pour les petits codes-barres : mise au point continue et zoom ×2 quand le téléphone le permet
 * (on tient alors le téléphone plus loin, là où l'objectif fait le point). Sans effet si ce n'est pas pris en charge.
 */
export async function tuneForBarcodes(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track || typeof track.getCapabilities !== "function") return;
  const caps = track.getCapabilities() as ZoomCapabilities;
  const advanced: Record<string, unknown>[] = [];
  if (caps.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" });
  if (caps.zoom && caps.zoom.max >= 1.5) advanced.push({ zoom: Math.min(2, caps.zoom.max) });
  for (const constraint of advanced) {
    try {
      await track.applyConstraints({ advanced: [constraint as MediaTrackConstraintSet] });
    } catch {
      // réglage refusé par ce téléphone : on garde l'image telle quelle
    }
  }
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/** La lampe n'est pilotable que sur certains téléphones (Android surtout, pas sur iPhone). */
export function torchAvailable(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0];
  if (!track || typeof track.getCapabilities !== "function") return false;
  return (track.getCapabilities() as TorchCapabilities).torch === true;
}

export async function setTorch(stream: MediaStream | null, on: boolean): Promise<void> {
  const track = stream?.getVideoTracks()[0];
  if (!track) return;
  await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}
