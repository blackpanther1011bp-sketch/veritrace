export interface Pt {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Convertit des points exprimés dans l'image de la caméra (taille intrinsèque
 * de la vidéo) en coordonnées à l'écran, pour une vidéo affichée en
 * `object-fit: cover` (mise à l'échelle puis recentrage).
 */
export function mapToView(points: ReadonlyArray<Pt>, source: Size, view: Size): Pt[] {
  if (source.width <= 0 || source.height <= 0 || view.width <= 0 || view.height <= 0) return [];
  const scale = Math.max(view.width / source.width, view.height / source.height);
  const dx = (view.width - source.width * scale) / 2;
  const dy = (view.height - source.height * scale) / 2;
  return points.map((p) => ({ x: p.x * scale + dx, y: p.y * scale + dy }));
}

/**
 * Agrandit verticalement un cadre trop fin, autour de son centre : pour un
 * code-barres classique, le décodeur ne repère souvent qu'une bande horizontale.
 */
export function expandThinBox(box: Box, minRatio = 0.45): Box {
  const minHeight = (box.right - box.left) * minRatio;
  if (box.bottom - box.top >= minHeight) return box;
  const cy = (box.top + box.bottom) / 2;
  return { ...box, top: cy - minHeight / 2, bottom: cy + minHeight / 2 };
}

/**
 * Choisit le code-barres visé : le plus proche du centre de la zone caméra.
 * Le code déjà choisi est gardé tant qu'il n'est pas nettement plus loin
 * (`stickiness` px), pour que le grand badge ne saute pas d'un code à l'autre.
 */
export function pickCentral<T extends { key: string; box: Box }>(items: ReadonlyArray<T>, center: Pt, currentKey: string | null, stickiness = 60): T | null {
  if (items.length === 0) return null;
  const dist = (b: Box) => Math.hypot((b.left + b.right) / 2 - center.x, (b.top + b.bottom) / 2 - center.y);
  let best = items[0];
  for (const it of items) if (dist(it.box) < dist(best.box)) best = it;
  const current = items.find((it) => it.key === currentKey);
  if (current && dist(current.box) <= dist(best.box) + stickiness) return current;
  return best;
}

/** Rectangle englobant une liste de points. */
export function boundsOf(points: ReadonlyArray<Pt>): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/**
 * Coin haut-gauche du badge : centré au-dessus du code-barres, ou en dessous
 * s'il manque de place, sans sortir de l'écran ni passer sous les barres du
 * haut (topLimit) et du bas (bottomReserved).
 */
export function badgeOrigin(opts: { box: Box; view: Size; badge: Size; topLimit: number; bottomReserved: number; margin?: number }): Pt {
  const { box, view, badge, topLimit, bottomReserved } = opts;
  const margin = opts.margin ?? 12;
  let top = box.top - badge.height - margin;
  if (top < topLimit) top = box.bottom + margin;
  const maxTop = Math.max(topLimit, view.height - badge.height - bottomReserved);
  top = Math.min(Math.max(top, topLimit), maxTop);
  const maxLeft = Math.max(margin, view.width - badge.width - margin);
  const centerX = (box.left + box.right) / 2;
  const left = Math.min(Math.max(centerX - badge.width / 2, margin), maxLeft);
  return { x: left, y: top };
}
