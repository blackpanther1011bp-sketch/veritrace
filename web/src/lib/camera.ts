import { BarcodeDetector as BarcodeDetectorPonyfill, prepareZXingModule } from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import type { Pt } from "./arGeometry";

// Le décodeur (ZXing, WebAssembly) est servi depuis notre domaine plutôt qu'un CDN.
const zxingOverrides = {
  locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
};
prepareZXingModule({ overrides: zxingOverrides });

/** Lance le téléchargement du décodeur en avance, pour un premier scan plus rapide. */
export function warmUpDecoder(): void {
  prepareZXingModule({ overrides: zxingOverrides, fireImmediately: true }).catch(() => undefined);
}

const FORMATS = ["ean_13", "ean_8", "upc_a"] as const;

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

/** Ouvre la caméra arrière. */
export async function openBackCamera(): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new InsecureContextError("La caméra nécessite une connexion sécurisée (https).");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
}

export function cameraErrorMessage(error: unknown): string {
  if (error instanceof InsecureContextError) {
    return "La caméra nécessite une connexion sécurisée (https). Saisissez le code à la main.";
  }
  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur, ou saisissez le code à la main.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Aucune caméra disponible sur cet appareil. Saisissez le code à la main.";
    case "NotReadableError":
      return "La caméra est utilisée par une autre application. Fermez-la puis réessayez.";
    default:
      return "Impossible de démarrer la caméra. Saisissez le code à la main.";
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
