// Panneau 3D de la note d'un vêtement, pour la réalité augmentée ancrée dans l'espace.
// Le panneau (recto : note et chiffres, verso : VeriTrace) est dessiné dans un canvas, complété d'éléments en
// relief, posé au-dessus d'un socle lumineux, puis exporté au format glTF (GLB). <model-viewer> l'affiche en 3D et l'ouvre en RA :
// AR Quick Look sur iPhone (fichier USDZ créé à la volée), WebXR sur Android.

import { GRADE_COLOR, LEVEL_COLOR, VERDICT } from "./grades";
import { isRtl, t } from "./i18n";
import { CONFIDENCE_LABEL, formatNumber, SOURCE_LABEL } from "./reliability";
import type { Grade, Product } from "./types";

/** Taille réelle du panneau, en mètres (lisible à 50 cm environ). */
export const PANEL_WIDTH = 0.24;
export const PANEL_HEIGHT = 0.33;
const BASE_HEIGHT = 0.012;
/** Espace entre le socle et la plaque, qui flotte au-dessus. */
const HOVER = 0.035;
/** Épaisseur de la plaque. */
const SLAB = 0.006;
const TILT = (6 * Math.PI) / 180;

const W = 1024;
const H = Math.round((W * PANEL_HEIGHT) / PANEL_WIDTH); // 1408
const INK = "#0F1A14";
const GLASS = "#0A1511";
const SOFT = "#C9D4CD";
const LINE = "#26342D";
const MINT = "#3DDC97";
// « Noto Sans Arabic » : lettres arabes (chargée seulement quand l'interface est en arabe)
const FONT = '"DM Sans", "Noto Sans Arabic", system-ui, -apple-system, "Segoe UI", sans-serif';
const DISPLAY = '"Space Grotesk", "DM Sans", "Noto Sans Arabic", system-ui, sans-serif';

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
  const reliability = p.data_source === "registre" ? t("panel.official") : p.confidence ? CONFIDENCE_LABEL[p.confidence].toLowerCase() : null;
  return {
    grade,
    title: VERDICT[grade].title,
    name: p.name,
    brand: p.brand.name,
    cost,
    climate,
    bars: top.map((b) => ({ label: b.label, share: Math.max(0, Math.min(100, b.share)), color: LEVEL_COLOR[b.level] })),
    footer: [SOURCE_LABEL[p.data_source], reliability && t("panel.reliability", { level: reliability })].filter(Boolean).join(" · "),
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

/** Emplacements (en pixels du recto) des éléments posés en relief devant le panneau. */
export interface PanelLayout {
  coin: { x: number; y: number; r: number };
  bars: { x: number; y: number; w: number; h: number; color: string }[];
}

/**
 * Recto du panneau, en verre sombre : verdict, vêtement, chiffres Ecobalyse et répartition de l'impact.
 * La pastille de la note et les barres sont ajoutées en relief par-dessus (voir buildPanelGlb) ;
 * la fonction renvoie leur emplacement.
 */
export function drawFront(canvas: HTMLCanvasElement, d: PanelData): PanelLayout {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const pad = 72;
  const hue = GRADE_COLOR[d.grade];
  // En arabe, le panneau est dessiné en miroir (lecture de droite à gauche) : X() retourne les abscisses,
  // et les textes sont alignés sur leur début (« start »), qui est à droite en arabe.
  const rtl = isRtl();
  const X = (x: number) => (rtl ? W - x : x);
  const left = (x: number, w: number) => (rtl ? W - x - w : x);
  const box = (x: number, y: number, w: number, h: number, r: number) => roundRect(ctx, left(x, w), y, w, h, r);
  ctx.direction = rtl ? "rtl" : "ltr";

  ctx.fillStyle = GLASS;
  ctx.fillRect(0, 0, W, H);

  // Pastille de la note : halo à la couleur de la note, la pastille elle-même est en relief
  const cx = pad + 128;
  const cy = 236;
  const r = 128;
  const halo = ctx.createRadialGradient(X(cx), cy, r * 0.6, X(cx), cy, 560);
  halo.addColorStop(0, `${hue}66`);
  halo.addColorStop(1, `${hue}00`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, 800);
  ctx.fillStyle = hue;
  ctx.beginPath();
  ctx.arc(X(cx), cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Verdict et échelle A–E
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  const tx = cx + 196;
  ctx.fillStyle = hue;
  ctx.font = `700 62px ${DISPLAY}`;
  ctx.fillText(fit(ctx, d.title, W - tx - pad), X(tx), 206);
  ctx.fillStyle = SOFT;
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText(t("panel.kicker"), X(tx), 260);
  const grades: Grade[] = ["A", "B", "C", "D", "E"];
  const sw = (W - tx - pad - 4 * 10) / 5;
  grades.forEach((g, i) => {
    const on = g === d.grade;
    ctx.globalAlpha = on ? 1 : 0.3;
    ctx.fillStyle = GRADE_COLOR[g];
    box(tx + i * (sw + 10), on ? 292 : 298, sw, on ? 34 : 22, 8);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Vêtement
  let y = 520;
  ctx.fillStyle = SOFT;
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(fit(ctx, d.brand, W - 2 * pad), X(pad), y);
  y += 66;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 56px ${FONT}`;
  ctx.fillText(fit(ctx, d.name, W - 2 * pad), X(pad), y);

  // Chiffres
  y += 70;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  y += 92;
  if (d.cost || d.climate) {
    const col = (W - 2 * pad) / 2;
    const metric = (x: number, value: string, unit: string, label: string) => {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 84px ${DISPLAY}`;
      // valeur et unité : chiffres et unités restent de gauche à droite, placés en miroir en arabe
      ctx.direction = "ltr";
      ctx.textAlign = rtl ? "right" : "left";
      ctx.fillText(value, X(x), y);
      const vw = ctx.measureText(value).width;
      ctx.font = `700 40px ${FONT}`;
      ctx.direction = rtl ? "rtl" : "ltr";
      ctx.textAlign = "start";
      ctx.fillText(unit, rtl ? X(x) - vw - 12 : x + vw + 12, y);
      ctx.fillStyle = SOFT;
      ctx.font = `500 34px ${FONT}`;
      ctx.fillText(label, X(x), y + 52);
    };
    if (d.cost) metric(pad, d.cost, rtl ? "نقطة" : "pts", t("panel.costLabel"));
    if (d.climate) metric(d.cost ? pad + col + 24 : pad, d.climate, "kg CO₂e", t("panel.climateLabel"));
    y += 130;
  } else {
    ctx.fillStyle = SOFT;
    ctx.font = `500 38px ${FONT}`;
    ctx.fillText(d.demo ? t("panel.demo") : t("panel.noCost"), X(pad), y);
    y += 70;
  }

  // Répartition de l'impact climat : libellés et rails ; les barres pleines sont en relief
  const bars: PanelLayout["bars"] = [];
  if (d.bars.length > 0) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 38px ${FONT}`;
    ctx.fillText(t("panel.where"), X(pad), y);
    y += 30;
    for (const b of d.bars) {
      y += 58;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `500 36px ${FONT}`;
      ctx.fillText(fit(ctx, b.label, W - 2 * pad - 130), X(pad), y);
      ctx.fillStyle = SOFT;
      ctx.textAlign = "end";
      ctx.fillText(`${Math.round(b.share)} %`, X(W - pad), y);
      ctx.textAlign = "start";
      y += 18;
      ctx.fillStyle = LINE;
      box(pad, y, W - 2 * pad, 18, 9);
      ctx.fill();
      const w = Math.max(18, ((W - 2 * pad) * b.share) / 100);
      ctx.fillStyle = b.color;
      box(pad, y, w, 18, 9);
      ctx.fill();
      bars.push({ x: left(pad, w), y, w, h: 18, color: b.color });
    }
  }

  // Pied : source, fiabilité, méthode
  ctx.fillStyle = SOFT;
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(fit(ctx, d.footer, W - 2 * pad), X(pad), H - 120);
  ctx.fillStyle = MINT;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(t("panel.footer"), X(pad), H - 70);

  return { coin: { x: X(cx), y: cy, r }, bars };
}

/** Face de la pastille : la lettre de la note. */
function drawCoin(canvas: HTMLCanvasElement, grade: Grade): void {
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = GRADE_COLOR[grade];
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = INK;
  ctx.font = `700 170px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(grade, 128, 138);
}

/** Verso du panneau : marque VeriTrace. */
export function drawBack(canvas: HTMLCanvasElement): void {
  canvas.width = 512;
  canvas.height = Math.round(H / 2);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = GLASS;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = MINT;
  ctx.beginPath();
  ctx.arc(256, 270, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GLASS;
  ctx.font = `700 70px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("V", 256, 274);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 64px ${DISPLAY}`;
  ctx.fillText("VeriTrace", 256, 410);
  ctx.font = `500 26px ${FONT}`;
  ctx.fillStyle = SOFT;
  ctx.direction = isRtl() ? "rtl" : "ltr";
  ctx.fillText(t("panel.tagline"), 256, 466);
}

async function fontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 62px ${DISPLAY}`),
      document.fonts.load(`500 32px ${FONT}`),
      document.fonts.load(`700 32px ${FONT}`),
      ...(isRtl() ? [document.fonts.load(`500 32px "Noto Sans Arabic"`, "ا"), document.fonts.load(`700 32px "Noto Sans Arabic"`, "ا")] : []),
    ]);
  } catch {
    // polices système en repli
  }
}

/**
 * Construit le panneau 3D et renvoie l'adresse locale (blob:) du fichier GLB.
 *
 * Un socle « projecteur » cerclé de lumière, deux rayons, et au-dessus une plaque de verre sombre qui flotte.
 * La pastille de la note, son anneau, les barres d'impact et les coins lumineux sont en relief devant la
 * plaque : en tournant autour, ils se décalent comme de vrais objets.
 *
 * Matériaux « standard » (PBR) opaques uniquement : seuls compris par l'export USDZ d'AR Quick Look
 * (pas de transparence ni d'animation sur iPhone).
 */
export async function buildPanelGlb(p: Product): Promise<string> {
  await fontsReady();
  const [THREE, { GLTFExporter }] = await Promise.all([import("three"), import("three/examples/jsm/exporters/GLTFExporter.js")]);
  const hue = GRADE_COLOR[p.global_grade];

  const texture = (canvas: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  // face imprimée : émission forte, le texte clair reste lisible dans un magasin peu éclairé
  const face = (canvas: HTMLCanvasElement) => {
    const map = texture(canvas);
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.95, metalness: 0 });
  };
  // matière lumineuse unie (néon)
  const glow = (color: string, intensity = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a1511, roughness: 0.65, metalness: 0.1 });

  const front = document.createElement("canvas");
  const layout = drawFront(front, panelData(p));
  const back = document.createElement("canvas");
  drawBack(back);
  const coinFace = document.createElement("canvas");
  drawCoin(coinFace, p.global_grade);

  // pixels du recto → mètres dans le repère du panneau (origine : milieu du bord bas)
  const px = PANEL_WIDTH / W;
  const mx = (x: number) => (x - W / 2) * px;
  const my = (y: number) => (H - y) * px;

  const panel = new THREE.Group();
  panel.name = "panneau";
  const slab = new THREE.Mesh(new THREE.BoxGeometry(PANEL_WIDTH, PANEL_HEIGHT, SLAB).translate(0, PANEL_HEIGHT / 2, 0), dark);
  slab.name = "plaque";
  const recto = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT).translate(0, PANEL_HEIGHT / 2, SLAB / 2 + 0.0004), face(front));
  recto.name = "recto";
  const verso = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT).rotateY(Math.PI).translate(0, PANEL_HEIGHT / 2, -SLAB / 2 - 0.0004), face(back));
  verso.name = "verso";
  panel.add(slab, recto, verso);

  // coins lumineux, comme le viseur du scan
  const neon = glow(hue, 0.75);
  const arm = 0.04;
  const thick = 0.004;
  const out = 0.007;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = sx * (PANEL_WIDTH / 2 + out);
      const y = PANEL_HEIGHT / 2 + sy * (PANEL_HEIGHT / 2 + out);
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(arm, thick, thick).translate(x - (sx * arm) / 2 + (sx * thick) / 2, y, 0), neon);
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(thick, arm, thick).translate(x, y - (sy * arm) / 2 + (sy * thick) / 2, 0), neon);
      horizontal.name = vertical.name = "coin lumineux";
      panel.add(horizontal, vertical);
    }
  }

  // pastille de la note, en avant de la plaque, cerclée d'un anneau
  const lift = 0.012;
  const r = layout.coin.r * px;
  const coin = new THREE.Group();
  coin.name = "note";
  coin.add(
    new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.006, 48).rotateX(Math.PI / 2), glow(hue, 0.4)),
    new THREE.Mesh(new THREE.CircleGeometry(r, 48).translate(0, 0, 0.0034), face(coinFace)),
    new THREE.Mesh(new THREE.TorusGeometry(r + 0.007, 0.0018, 12, 64), neon),
  );
  coin.position.set(mx(layout.coin.x), my(layout.coin.y), SLAB / 2 + lift);
  panel.add(coin);

  // barres d'impact en relief, devant leur rail
  layout.bars.forEach((b, i) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(b.w * px, b.h * px, 0.004), glow(b.color, 0.6));
    bar.name = `barre ${i + 1}`;
    bar.position.set(mx(b.x + b.w / 2), my(b.y + b.h / 2), SLAB / 2 + 0.0045);
    panel.add(bar);
  });

  panel.position.y = BASE_HEIGHT + HOVER;
  panel.rotation.x = -TILT;

  // socle projecteur : disque sombre, cercle de lumière, deux rayons jusqu'à la plaque
  const socle = new THREE.Group();
  socle.name = "socle";
  socle.add(
    new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, BASE_HEIGHT, 64).translate(0, BASE_HEIGHT / 2, 0), dark),
    new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.0025, 12, 96).rotateX(Math.PI / 2).translate(0, BASE_HEIGHT, 0), neon),
  );
  for (const sx of [-1, 1]) {
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, HOVER, 8).translate(sx * 0.07, BASE_HEIGHT + HOVER / 2, 0), glow(hue, 0.75));
    ray.name = "rayon";
    socle.add(ray);
  }

  const root = new THREE.Group();
  root.name = `VeriTrace ${p.global_grade}`;
  root.add(socle, panel);

  const glb = (await new GLTFExporter().parseAsync(root, { binary: true, maxTextureSize: 2048 })) as ArrayBuffer;
  return URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
}
