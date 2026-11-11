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
/** Fond de la plaque : même teinte, opaque à 80 %. */
const GLASS_FILL = "rgba(10, 21, 17, 0.8)";
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

  // verre : fond sombre translucide (on devine la pièce derrière), texte et chiffres opaques
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = GLASS_FILL;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = GLASS_FILL;
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

/** Durée d'une boucle d'animation, en secondes, et cadence d'échantillonnage. */
const LOOP_SECONDS = 6;
const FPS = 24;
const FRAMES = LOOP_SECONDS * FPS;
/** Un échantillon toutes les 2 images : assez fin pour la rotation de l'anneau. */
const STEP = 2;

/** Adresses locales (blob:) des fichiers du panneau : GLB pour l'aperçu et Android, USDZ animé pour l'iPhone. */
export interface PanelModels {
  glb: string;
  usdz: string | null;
}

/** iPhone ou iPad : la réalité augmentée y passe par AR Quick Look, qui lit un fichier USDZ. */
const isAppleMobile = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Construit le panneau 3D et renvoie les adresses locales de ses fichiers.
 *
 * Trois mouvements en boucle : la plaque flotte de haut en bas, l'anneau de la note tourne sur lui-même,
 * le cercle de lumière du socle respire. Ils sont écrits dans le GLB (aperçu, Android) et dans le fichier
 * USDZ de l'iPhone : la conversion automatique de l'afficheur 3D ne garde pas les animations, on écrit donc
 * ce fichier nous-mêmes.
 *
 * Un socle « projecteur » cerclé de lumière, deux rayons, et au-dessus une plaque de verre sombre qui flotte.
 * La pastille de la note, son anneau, les barres d'impact et les coins lumineux sont en relief devant la
 * plaque : en tournant autour, ils se décalent comme de vrais objets.
 *
 * Matériaux « standard » (PBR) uniquement : seuls compris par l'export USDZ d'AR Quick Look.
 */
export async function buildPanelModels(p: Product): Promise<PanelModels> {
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
  // glass : le fond translucide du dessin laisse voir à travers (transparence portée par l'image)
  const face = (canvas: HTMLCanvasElement, glass = false) => {
    const map = texture(canvas);
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.95, metalness: 0, transparent: glass });
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
  panel.name = "vt_panel";
  // la plaque : deux faces de verre dos à dos, sans cœur opaque
  const recto = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT).translate(0, PANEL_HEIGHT / 2, SLAB / 2), face(front, true));
  recto.name = "recto";
  const verso = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT).rotateY(Math.PI).translate(0, PANEL_HEIGHT / 2, -SLAB / 2), face(back, true));
  verso.name = "verso";
  panel.add(recto, verso);

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
  // Les emplacements sont inscrits dans la forme elle-même (translate), pas dans la position de l'objet :
  // sur iPhone, AR Quick Look ignore la position des objets fixes placés sous un objet animé.
  const lift = 0.012;
  const r = layout.coin.r * px;
  const at = { x: mx(layout.coin.x), y: my(layout.coin.y), z: SLAB / 2 + lift };
  const coinBody = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.006, 48).rotateX(Math.PI / 2).translate(at.x, at.y, at.z), glow(hue, 0.4));
  coinBody.name = "note";
  const coinLetter = new THREE.Mesh(new THREE.CircleGeometry(r, 48).translate(at.x, at.y, at.z + 0.0034), face(coinFace));
  coinLetter.name = "lettre";
  // l'anneau tourne autour de son centre : il garde une position, portée par son animation
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.007, 0.0018, 12, 64), neon);
  ring.name = "vt_ring";
  ring.position.set(at.x, at.y, at.z);
  panel.add(coinBody, coinLetter, ring);

  // barres d'impact en relief, devant leur rail
  layout.bars.forEach((b, i) => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(b.w * px, b.h * px, 0.004).translate(mx(b.x + b.w / 2), my(b.y + b.h / 2), SLAB / 2 + 0.0045),
      glow(b.color, 0.6),
    );
    bar.name = `barre ${i + 1}`;
    panel.add(bar);
  });

  panel.position.y = BASE_HEIGHT + HOVER;
  panel.rotation.x = -TILT;

  // socle projecteur : disque sombre, cercle de lumière, deux rayons jusqu'à la plaque
  const socle = new THREE.Group();
  socle.name = "socle";
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.0025, 12, 96).rotateX(Math.PI / 2).translate(0, BASE_HEIGHT, 0), neon);
  halo.name = "vt_halo";
  socle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, BASE_HEIGHT, 64).translate(0, BASE_HEIGHT / 2, 0), dark), halo);
  for (const sx of [-1, 1]) {
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, HOVER, 8).translate(sx * 0.07, BASE_HEIGHT + HOVER / 2, 0), glow(hue, 0.75));
    ray.name = "rayon";
    socle.add(ray);
  }

  const root = new THREE.Group();
  root.name = `VeriTrace ${p.global_grade}`;
  root.add(socle, panel);

  // Les trois mouvements, en fonction de l'avancement u (0 → 1) dans la boucle
  const restY = panel.position.y;
  const pose = (u: number) => {
    panel.position.y = restY + 0.006 * Math.sin(2 * Math.PI * u);
    ring.rotation.y = 4 * Math.PI * u;
    const breath = 1 + 0.05 * Math.sin(4 * Math.PI * u);
    halo.scale.set(breath, 1, breath);
  };
  const times: number[] = [];
  const samples: Record<"vt_panel" | "vt_ring" | "vt_halo", string[]> = { vt_panel: [], vt_ring: [], vt_halo: [] };
  const positions: number[] = [];
  const turns: number[] = [];
  const scales: number[] = [];
  const row = (e: ArrayLike<number>, o: number) => `(${e[o]}, ${e[o + 1]}, ${e[o + 2]}, ${e[o + 3]})`;
  for (let f = 0; f <= FRAMES; f += STEP) {
    pose(f / FRAMES);
    times.push(f / FPS);
    positions.push(...panel.position.toArray());
    turns.push(...ring.quaternion.toArray());
    scales.push(...halo.scale.toArray());
    for (const [name, object] of [["vt_panel", panel], ["vt_ring", ring], ["vt_halo", halo]] as const) {
      object.updateMatrix();
      const e = object.matrix.elements;
      samples[name].push(`${f}: ( ${row(e, 0)}, ${row(e, 4)}, ${row(e, 8)}, ${row(e, 12)} )`);
    }
  }
  pose(0);
  for (const object of [panel, ring, halo]) object.updateMatrix();
  const clip = new THREE.AnimationClip("flottement", LOOP_SECONDS, [
    new THREE.VectorKeyframeTrack("vt_panel.position", times, positions),
    new THREE.QuaternionKeyframeTrack("vt_ring.quaternion", times, turns),
    new THREE.VectorKeyframeTrack("vt_halo.scale", times, scales),
  ]);

  const glb = (await new GLTFExporter().parseAsync(root, { binary: true, maxTextureSize: 2048, animations: [clip] })) as ArrayBuffer;
  const models: PanelModels = { glb: URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })), usdz: null };

  if (isAppleMobile()) {
    try {
      models.usdz = URL.createObjectURL(new Blob([await animatedUsdz(root, samples)], { type: "model/vnd.usdz+zip" }));
    } catch (err) {
      // en cas d'échec, l'afficheur 3D convertit lui-même le GLB (panneau fixe)
      console.warn("Fichier USDZ animé indisponible", err);
    }
  }
  return models;
}

/**
 * Fichier USDZ du panneau pour AR Quick Look, avec ses animations.
 * L'export de three.js écrit une scène fixe : on rouvre l'archive, on remplace la position fixe des objets
 * animés par leurs positions au fil du temps, puis on la referme comme l'exige le format
 * (sans compression, données alignées sur 64 octets).
 */
async function animatedUsdz(root: import("three").Object3D, samples: Record<string, string[]>): Promise<Uint8Array<ArrayBuffer>> {
  const [{ USDZExporter }, { strFromU8, strToU8, unzipSync, zipSync }] = await Promise.all([
    import("three/examples/jsm/exporters/USDZExporter.js"),
    import("three/examples/jsm/libs/fflate.module.js"),
  ]);
  const fixed = await new USDZExporter().parseAsync(root, { quickLookCompatible: true, maxTextureSize: 2048 });
  const entries = unzipSync(new Uint8Array(fixed));
  const modelName = Object.keys(entries).find((n) => n.endsWith("model.usda"));
  if (!modelName) throw new Error("model.usda absent");

  let usda = strFromU8(entries[modelName]);
  usda = usda.replace("defaultPrim = ", `startTimeCode = 0\n\tendTimeCode = ${FRAMES}\n\ttimeCodesPerSecond = ${FPS}\n\tframesPerSecond = ${FPS}\n\tdefaultPrim = `);
  for (const [name, frames] of Object.entries(samples)) {
    const at = usda.indexOf(`def Xform "${name}"`);
    if (at < 0) throw new Error(`objet ${name} absent`);
    const start = usda.indexOf("matrix4d xformOp:transform = ", at);
    const end = usda.indexOf("\n", start);
    if (start < 0 || end < 0) throw new Error(`position de ${name} absente`);
    usda = `${usda.slice(0, start)}matrix4d xformOp:transform.timeSamples = { ${frames.join(", ")} }${usda.slice(end)}`;
  }
  entries[modelName] = strToU8(usda);

  // le modèle en premier, puis alignement de chaque fichier sur 64 octets (comme l'export d'origine)
  const files: Record<string, Uint8Array | [Uint8Array, { extra: Record<number, Uint8Array> }]> = {};
  let offset = 0;
  for (const name of [modelName, ...Object.keys(entries).filter((n) => n !== modelName)]) {
    const file = entries[name];
    offset += 34 + name.length;
    const mod = offset & 63;
    files[name] = mod !== 4 ? [file, { extra: { 12345: new Uint8Array(64 - mod) } }] : file;
    offset = file.length;
  }
  return zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>;
}
