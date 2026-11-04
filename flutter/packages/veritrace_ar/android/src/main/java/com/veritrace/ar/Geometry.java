package com.veritrace.ar;

/**
 * Calculs de la réalité augmentée, sans dépendance Android (vérifiés sur ordinateur) :
 * position 3D d'un code-barres vu par la caméra, panneau tourné vers l'utilisateur, toucher.
 *
 * Conventions : matrices 4 × 4 rangées par colonnes (OpenGL) ; repère de la caméra ARCore
 * (x à droite, y en haut, la caméra regarde vers -z) ; pixels de l'image : u vers la droite, v vers le bas.
 */
final class Geometry {
    private Geometry() {}

    /** Largeur habituelle d'un code EAN-13 imprimé sur une étiquette de vêtement (mètres). */
    static final float BARCODE_WIDTH_M = 0.031f;
    static final float MIN_DEPTH_M = 0.08f;
    static final float MAX_DEPTH_M = 2.5f;

    static float clamp(float v, float min, float max) {
        return Math.max(min, Math.min(max, v));
    }

    static float distance(float[] a, float[] b) {
        float dx = a[0] - b[0];
        float dy = a[1] - b[1];
        float dz = a[2] - b[2];
        return (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /** Plus long côté d'un quadrilatère (coins x0, y0, … x3, y3 dans l'ordre) : la largeur du code-barres. */
    static float longEdge(float[] q) {
        float best = 0f;
        for (int i = 0; i < 4; i++) {
            int j = (i + 1) % 4;
            float dx = q[2 * j] - q[2 * i];
            float dy = q[2 * j + 1] - q[2 * i + 1];
            best = Math.max(best, (float) Math.sqrt(dx * dx + dy * dy));
        }
        return best;
    }

    static float[] centroid(float[] q) {
        return new float[] {(q[0] + q[2] + q[4] + q[6]) / 4f, (q[1] + q[3] + q[5] + q[7]) / 4f};
    }

    /** Quadrilatère agrandi (ou réduit) autour de son centre. */
    static float[] expand(float[] q, float factor) {
        float[] c = centroid(q);
        float[] out = new float[8];
        for (int i = 0; i < 4; i++) {
            out[2 * i] = c[0] + (q[2 * i] - c[0]) * factor;
            out[2 * i + 1] = c[1] + (q[2 * i + 1] - c[1]) * factor;
        }
        return out;
    }

    /** Point dans un quadrilatère convexe, quel que soit le sens des coins. */
    static boolean inside(float px, float py, float[] q) {
        boolean positive = false;
        boolean negative = false;
        for (int i = 0; i < 4; i++) {
            int j = (i + 1) % 4;
            float cross = (q[2 * j] - q[2 * i]) * (py - q[2 * i + 1]) - (q[2 * j + 1] - q[2 * i + 1]) * (px - q[2 * i]);
            if (cross > 0) positive = true;
            else if (cross < 0) negative = true;
            if (positive && negative) return false;
        }
        return true;
    }

    /** Distance du code-barres d'après sa taille à l'image (focale en pixels). */
    static float depthFromSize(float focalPx, float edgePx) {
        if (!(edgePx > 1f) || !(focalPx > 1f)) return 0.35f;
        return clamp(focalPx * BARCODE_WIDTH_M / edgePx, MIN_DEPTH_M, MAX_DEPTH_M);
    }

    static float median(float[] values, int count) {
        float[] v = java.util.Arrays.copyOf(values, count);
        java.util.Arrays.sort(v);
        return count % 2 == 1 ? v[count / 2] : (v[count / 2 - 1] + v[count / 2]) / 2f;
    }

    /**
     * Distance retenue : celle des points suivis par ARCore sur le code-barres (médiane) si elle est cohérente
     * avec la taille du code à l'image, sinon l'estimation par la taille.
     */
    static float chooseDepth(float sizeDepth, float[] pointDepths, int count) {
        if (count >= 2) {
            float m = median(pointDepths, count);
            if (m > sizeDepth * 0.5f && m < sizeDepth * 2f) return m;
        }
        return sizeDepth;
    }

    /** Pixel de l'image → point 3D dans le repère de la caméra, à la profondeur donnée (le long de l'axe). */
    static float[] cameraPoint(float u, float v, float fx, float fy, float cx, float cy, float depth) {
        return new float[] {(u - cx) / fx * depth, -(v - cy) / fy * depth, -depth};
    }

    /** Point 3D du repère de la caméra → pixel de l'image ; null s'il est derrière ou trop près. */
    static float[] imagePoint(float[] p, float fx, float fy, float cx, float cy) {
        float depth = -p[2];
        if (depth < 0.02f) return null;
        return new float[] {cx + fx * p[0] / depth, cy - fy * p[1] / depth};
    }

    /**
     * Axes d'un panneau tourné vers la caméra et aussi droit que possible : x (droite), y (haut), z (vers la
     * caméra). L'axe vertical du monde ARCore est y.
     */
    static float[][] facingAxes(float[] position, float[] camera) {
        float zx = camera[0] - position[0];
        float zy = camera[1] - position[1];
        float zz = camera[2] - position[2];
        float zl = (float) Math.sqrt(zx * zx + zy * zy + zz * zz);
        if (zl < 1e-4f) {
            zx = 0f;
            zy = 0f;
            zz = 1f;
        } else {
            zx /= zl;
            zy /= zl;
            zz /= zl;
        }
        // x = haut du monde × z
        float xx = zz;
        float xz = -zx;
        float xl = (float) Math.sqrt(xx * xx + xz * xz);
        if (xl < 1e-3f) {
            xx = 1f;
            xz = 0f;
        } else {
            xx /= xl;
            xz /= xl;
        }
        float xy = 0f;
        // y = z × x
        float yx = zy * xz - zz * xy;
        float yy = zz * xx - zx * xz;
        float yz = zx * xy - zy * xx;
        return new float[][] {{xx, xy, xz}, {yx, yy, yz}, {zx, zy, zz}};
    }

    /** Matrice modèle d'un carré unité (-0,5 … 0,5) placé en `center`, orienté par `axes`, de taille w × h. */
    static void panelModel(float[] out, float[] center, float[][] axes, float w, float h) {
        out[0] = axes[0][0] * w;
        out[1] = axes[0][1] * w;
        out[2] = axes[0][2] * w;
        out[3] = 0f;
        out[4] = axes[1][0] * h;
        out[5] = axes[1][1] * h;
        out[6] = axes[1][2] * h;
        out[7] = 0f;
        out[8] = axes[2][0];
        out[9] = axes[2][1];
        out[10] = axes[2][2];
        out[11] = 0f;
        out[12] = center[0];
        out[13] = center[1];
        out[14] = center[2];
        out[15] = 1f;
    }

    /** out = a × b (le tableau out doit être distinct de a et b). */
    static void multiplyMM(float[] out, float[] a, float[] b) {
        for (int col = 0; col < 4; col++) {
            for (int row = 0; row < 4; row++) {
                float sum = 0f;
                for (int k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
                out[col * 4 + row] = sum;
            }
        }
    }

    /** Point 3D du monde → pixel de l'écran (vue de w × h) ; null s'il est derrière la caméra. */
    static float[] toScreen(float[] viewProjection, float x, float y, float z, int w, int h) {
        float[] m = viewProjection;
        float cx = m[0] * x + m[4] * y + m[8] * z + m[12];
        float cy = m[1] * x + m[5] * y + m[9] * z + m[13];
        float cw = m[3] * x + m[7] * y + m[11] * z + m[15];
        if (cw <= 1e-4f) return null;
        return new float[] {(cx / cw + 1f) / 2f * w, (1f - cy / cw) / 2f * h};
    }

    /** Point au centre + sx·largeur·x + sy·hauteur·y (coins d'un panneau). */
    static float[] onPanel(float[] center, float[][] axes, float w, float h, float sx, float sy) {
        return new float[] {
            center[0] + axes[0][0] * w * sx + axes[1][0] * h * sy,
            center[1] + axes[0][1] * w * sx + axes[1][1] * h * sy,
            center[2] + axes[0][2] * w * sx + axes[1][2] * h * sy,
        };
    }
}
