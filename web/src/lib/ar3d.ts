// Panneau 3D de la note d'un vêtement, pour la réalité augmentée ancrée dans l'espace.
// Le panneau (recto : note et chiffres, verso : VeriTrace) est dessiné dans un canvas, posé sur un petit
// socle, puis exporté au format glTF (GLB). <model-viewer> l'affiche en 3D et l'ouvre en RA :
// AR Quick Look sur iPhone (fichier USDZ créé à la volée), WebXR sur Android.

import { GRADE_COLOR, GRADE_TINT, LEVEL_COLOR, VERDICT } from "./grades";
import { CONFIDENCE_LABEL, formatNumber, SOURCE_LABEL } from "./reliability";
import type { Grade, Product } from "./types";

/** Taille réelle du panneau, en mètres (lisible à 50 cm environ). */
export const PANEL_WIDTH = 0.24;
export const PANEL_HEIGHT = 0.33;
const BASE_HEIGHT = 0.014;
const TILT = (8 * Math.PI) / 180;

const W = 1024;
const H = Math.round((W * PANEL_HEIGHT) / PANEL_WIDTH); // 1408
const INK = "#0F1A14";
const MUTED = "#3F4D45";
const GREEN = "#1F6B4A";
const FONT = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
const DISPLAY = '"Space Grotesk", "DM Sans", system-ui, sans-serif';

export interface PanelData {
  grade: Grade;
  title: string;
  name: string;
  brand: string;
  cost: string | null;
  climate: string | null;
  bars: { label: string; share: number; color: string }[];
  footer: string;
  demo: boolean;
}

/** Contenu du panneau à partir de la fiche du vêtement. */
export function panelData(p: Product): PanelData {
  const grade = p.global_grade;
  const cost = formatNumber(p.eco_cost, 0);
  const climate = formatNumber(p.climate_kg, 1);
  const top = [...p.carbon_breakdown].sort((a, b) => b.share - a.share).slice(0, 4);
  const reliability = p.data_source === "registre" ? "officielle" : p.confidence ? CONFIDENCE_LABEL[p.confidence].toLowerCase() : null;
  return {
    grade,
    title: VERDICT[grade].title,
    name: p.name,
    brand: p.brand.name,
    cost,
    climate,
    bars: top.map((b) => ({ label: b.label, share: Math.max(0, Math.min(100, b.share)), color: LEVEL_COLOR[b.level] })),
    footer: [SOURCE_LABEL[p.data_source], reliability && `fiabilité ${reliability}`].filter(Boolean).join(" · "),
    demo: p.data_source === "demo",
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Coupe un texte trop long (« … ») pour qu'il tienne dans la largeur donnée. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Recto du panneau : note, verdict, vêtement, chiffres Ecobalyse et répartition de l'impact. */
export function drawFront(canvas: HTMLCanvasElement, d: PanelData): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const pad = 72;

  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 18, 18, W - 36, H - 36, 44);
  ctx.fill();

  // En-tête teinté à la couleur de la note
  ctx.save();
  roundRect(ctx, 18, 18, W - 36, H - 36, 44);
  ctx.clip();
  ctx.fillStyle = GRADE_TINT[d.grade];
  ctx.fillRect(18, 18, W - 36, 420);
  ctx.restore();

  // Pastille de la note
  const cx = pad + 130;
  const cy = 228;
  ctx.fillStyle = GRADE_COLOR[d.grade];
  ctx.beginPath();
  ctx.arc(cx, cy, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `700 170px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(d.grade, cx, cy + 8);

  // Verdict et échelle A–E
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const tx = cx + 170;
  ctx.fillStyle = INK;
  ctx.font = `700 62px ${DISPLAY}`;
  ctx.fillText(fit(ctx, d.title, W - tx - pad), tx, 200);
  ctx.fillStyle = MUTED;
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText("Note VeriTrace", tx, 254);
  const grades: Grade[] = ["A", "B", "C", "D", "E"];
  const sw = (W - tx - pad - 4 * 10) / 5;
  grades.forEach((g, i) => {
    const on = g === d.grade;
    ctx.globalAlpha = on ? 1 : 0.32;
    ctx.fillStyle = GRADE_COLOR[g];
    roundRect(ctx, tx + i * (sw + 10), on ? 286 : 292, sw, on ? 34 : 22, 8);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Vêtement
  let y = 520;
  ctx.fillStyle = MUTED;
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(fit(ctx, d.brand.toUpperCase(), W - 2 * pad), pad, y);
  y += 66;
  ctx.fillStyle = INK;
  ctx.font = `700 56px ${FONT}`;
  ctx.fillText(fit(ctx, d.name, W - 2 * pad), pad, y);

  // Chiffres
  y += 70;
  ctx.strokeStyle = "#E3E8E4";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  y += 92;
  if (d.cost || d.climate) {
    const col = (W - 2 * pad) / 2;
    const metric = (x: number, value: string, unit: string, label: string) => {
      ctx.fillStyle = INK;
      ctx.font = `700 84px ${DISPLAY}`;
      ctx.fillText(value, x, y);
      const vw = ctx.measureText(value).width;
      ctx.font = `700 40px ${FONT}`;
      ctx.fillText(unit, x + vw + 12, y);
      ctx.fillStyle = MUTED;
      ctx.font = `500 34px ${FONT}`;
      ctx.fillText(label, x, y + 52);
    };
    if (d.cost) metric(pad, d.cost, "pts", "coût environnemental");
    if (d.climate) metric(d.cost ? pad + col + 24 : pad, d.climate, "kg CO₂e", "impact climat");
    y += 130;
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = `500 38px ${FONT}`;
    ctx.fillText(d.demo ? "Produit fictif de démonstration" : "Coût environnemental non communiqué", pad, y);
    y += 70;
  }

  // Répartition de l'impact climat
  if (d.bars.length > 0) {
    ctx.fillStyle = INK;
    ctx.font = `700 38px ${FONT}`;
    ctx.fillText("D'où vient l'impact climat", pad, y);
    y += 30;
    for (const b of d.bars) {
      y += 58;
      ctx.fillStyle = INK;
      ctx.font = `500 36px ${FONT}`;
      ctx.fillText(fit(ctx, b.label, W - 2 * pad - 130), pad, y);
      ctx.fillStyle = MUTED;
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(b.share)} %`, W - pad, y);
      ctx.textAlign = "left";
      y += 18;
      ctx.fillStyle = "#E3E8E4";
      roundRect(ctx, pad, y, W - 2 * pad, 18, 9);
      ctx.fill();
      ctx.fillStyle = b.color;
      roundRect(ctx, pad, y, Math.max(18, ((W - 2 * pad) * b.share) / 100), 18, 9);
      ctx.fill();
    }
  }

  // Pied : source, fiabilité, méthode
  ctx.fillStyle = MUTED;
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(fit(ctx, d.footer, W - 2 * pad), pad, H - 120);
  ctx.fillStyle = GREEN;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText("VeriTrace · méthode officielle Ecobalyse", pad, H - 70);
}

/** Verso du panneau : marque VeriTrace. */
export function drawBack(canvas: HTMLCanvasElement): void {
  canvas.width = 512;
  canvas.height = Math.round(H / 2);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#3DDC97";
  ctx.beginPath();
  ctx.arc(256, 270, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GREEN;
  ctx.font = `700 70px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("V", 256, 274);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 64px ${DISPLAY}`;
  ctx.fillText("VeriTrace", 256, 410);
  ctx.font = `500 26px ${FONT}`;
  ctx.fillStyle = "#C9D4CD";
  ctx.fillText("Le vrai impact de vos vêtements", 256, 466);
}

async function fontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 62px ${DISPLAY}`),
      document.fonts.load(`500 32px ${FONT}`),
      document.fonts.load(`700 32px ${FONT}`),
    ]);
  } catch {
    // polices système en repli
  }
}

/**
 * Construit le panneau 3D et renvoie l'adresse locale (blob:) du fichier GLB.
 * Matériaux « standard » (PBR) : seuls compris par l'export USDZ d'AR Quick Look.
 */
export async function buildPanelGlb(p: Product): Promise<string> {
  await fontsReady();
  const [THREE, { GLTFExporter }] = await Promise.all([import("three"), import("three/examples/jsm/exporters/GLTFExporter.js")]);

  const texture = (canvas: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const face = (canvas: HTMLCanvasElement) => {
    const map = texture(canvas);
    // légère émission : panneau lisible même dans un magasin peu éclairé
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.85, metalness: 0 });
  };

  const front = document.createElement("canvas");
  drawFront(front, panelData(p));
  const back = document.createElement("canvas");
  drawBack(back);

  const panel = new THREE.Group();
  panel.name = "panneau";
  const recto = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT).translate(0, PANEL_HEIGHT / 2, 0.0006), face(front));
  recto.name = "recto";
  const verso = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT).rotateY(Math.PI).translate(0, PANEL_HEIGHT / 2, -0.0006), face(back));
  verso.name = "verso";
  panel.add(recto, verso);
  panel.position.y = BASE_HEIGHT;
  panel.rotation.x = -TILT;

  const socle = new THREE.Mesh(
    new THREE.BoxGeometry(PANEL_WIDTH + 0.02, BASE_HEIGHT, 0.09).translate(0, BASE_HEIGHT / 2, -0.01),
    new THREE.MeshStandardMaterial({ color: 0x1f6b4a, roughness: 0.6, metalness: 0 }),
  );
  socle.name = "socle";

  const root = new THREE.Group();
  root.name = `VeriTrace ${p.global_grade}`;
  root.add(socle, panel);

  const glb = (await new GLTFExporter().parseAsync(root, { binary: true, maxTextureSize: 2048 })) as ArrayBuffer;
  return URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
}
