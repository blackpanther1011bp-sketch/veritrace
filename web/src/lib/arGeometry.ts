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
