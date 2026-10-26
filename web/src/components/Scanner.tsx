import { useEffect, useRef, useState } from "react";
import { BarcodeDetector as BarcodeDetectorPonyfill, prepareZXingModule } from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { isValidGtin, normalizeGtin } from "../lib/barcode";

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

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

async function createDetector(): Promise<Detector> {
  // Détecteur natif quand il existe (Chrome Android) : plus rapide.
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
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

function cameraErrorMessage(error: unknown): string {
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

export function CameraScanner({ onDetected, onError }: { onDetected: (code: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const onErrorRef = useRef(onError);
  onDetectedRef.current = onDetected;
  onErrorRef.current = onError;
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer = 0;

    const stopStream = () => stream?.getTracks().forEach((t) => t.stop());

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        onErrorRef.current("La caméra nécessite une connexion sécurisée (https). Saisissez le code à la main.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (error) {
        if (!cancelled) onErrorRef.current(cameraErrorMessage(error));
        return;
      }
      if (cancelled) {
        stopStream();
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // la lecture démarre au prochain geste sur certains navigateurs
      }
      const detector = await createDetector();
      if (cancelled) return;
      setRunning(true);

      const tick = async () => {
        if (cancelled) return;
        if (video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            const hit = codes.map((c) => normalizeGtin(c.rawValue)).find((c) => isValidGtin(c));
            if (hit && !cancelled) {
              cancelled = true;
              navigator.vibrate?.(60);
              stopStream();
              onDetectedRef.current(hit);
              return;
            }
          } catch {
            // image illisible : on passe à la suivante
          }
        }
        timer = window.setTimeout(tick, 100);
      };
      void tick();
    }

    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopStream();
    };
  }, []);

  return (
    <div className="camera">
      <video ref={videoRef} className="camera-video" playsInline muted autoPlay aria-label="Image de la caméra" />
      <div className="camera-frame" aria-hidden="true">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner br" />
        <span className="corner bl" />
        {running && <span className="scan-line" />}
      </div>
      {!running && <p className="camera-status">Ouverture de la caméra…</p>}
    </div>
  );
}
