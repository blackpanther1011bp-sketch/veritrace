package com.veritrace.ar;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.TextUtils;

/** Dessin des panneaux 3D (image appliquée sur un rectangle dans l'espace), aux couleurs de l'app. */
final class PanelPainter {
    private PanelPainter() {}

    static final int WIDTH = 640;
    static final int HEIGHT = 520;

    private static final int INK = 0xFF0F1A14;
    private static final int MUTED = 0xFF4A5A50;
    private static final int MUTED2 = 0xFF5E6B63;
    private static final int GREEN = 0xFF1F6B4A;
    private static final int MINT = 0xFF3DDC97;
    private static final int MINT_TINT = 0xFFDDF2E5;
    private static final int GROUND = 0xFFF4F6F3;
    private static final int LINE = 0xFFE3E8E4;
    private static final int NO_GRADE = 0xFFDDE3DE;
    private static final int[] GRADE_COLOR = {0xFF4FB37A, 0xFFA6CF5A, 0xFFF2C94C, 0xFFF09A4A, 0xFFE0614B};
    private static final int[] GRADE_TINT = {0xFFE3F4EA, 0xFFEEF6DF, 0xFFFDF6DC, 0xFFFFF1E4, 0xFFFCE6E1};

    private static final float CARD_LEFT = 12f;
    private static final float CARD_TOP = 40f;
    private static final float CARD_RIGHT = WIDTH - 12f;
    private static final float CARD_BOTTOM = 484f;
    private static final float PAD = 32f;
    private static final float CIRCLE = 140f;

    /** Panneau d'un vêtement ; `best` : couronne du comparateur en rayon. */
    static Bitmap panel(PanelData d, boolean best) {
        Bitmap bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        // Carte blanche avec ombre, pointe vers le code-barres
        Paint card = fill(Color.WHITE);
        card.setShadowLayer(14f, 0f, 4f, 0x55000000);
        Path shape = new Path();
        shape.addRoundRect(new RectF(CARD_LEFT, CARD_TOP, CARD_RIGHT, CARD_BOTTOM), 36f, 36f, Path.Direction.CW);
        Path pointer = new Path();
        pointer.moveTo(WIDTH / 2f - 28f, CARD_BOTTOM - 2f);
        pointer.lineTo(WIDTH / 2f + 28f, CARD_BOTTOM - 2f);
        pointer.lineTo(WIDTH / 2f, CARD_BOTTOM + 30f);
        pointer.close();
        shape.op(pointer, Path.Op.UNION);
        canvas.drawPath(shape, card);

        boolean found = d.state == PanelData.State.FOUND;
        int g = found ? d.gradeIndex() : -1;

        // Pastille de la note
        float left = CARD_LEFT + PAD;
        float top = CARD_TOP + PAD;
        float cx = left + CIRCLE / 2f;
        float cy = top + CIRCLE / 2f;
        canvas.drawCircle(cx, cy, CIRCLE / 2f, fill(g >= 0 ? GRADE_COLOR[g] : NO_GRADE));
        String letter = found ? d.grade : d.state == PanelData.State.LOADING ? "…" : d.state == PanelData.State.UNKNOWN ? "?" : "!";
        TextPaint big = text(84f, INK, true);
        big.setTextAlign(Paint.Align.CENTER);
        canvas.drawText(letter, cx, cy - (big.descent() + big.ascent()) / 2f, big);
        if (found && best) drawCrown(canvas, cx, top - 2f);

        // Marque et nom
        float textLeft = left + CIRCLE + 28f;
        float textWidth = CARD_RIGHT - PAD - textLeft;
        String overline;
        String title;
        switch (d.state) {
            case FOUND:
                overline = (d.brand == null ? "Marque non indiquée" : d.brand) + (d.sample ? " · fictif" : "");
                title = d.name == null ? "Vêtement" : d.name;
                break;
            case LOADING:
                overline = "Recherche…";
                title = "Code " + PanelData.formatEan(d.ean);
                break;
            case UNKNOWN:
                overline = "Nouveau vêtement";
                title = "Code " + PanelData.formatEan(d.ean);
                break;
            default:
                overline = "Connexion impossible";
                title = "Code " + PanelData.formatEan(d.ean);
                break;
        }
        TextPaint over = text(24f, MUTED2, true);
        over.setLetterSpacing(0.06f);
        canvas.drawText(ellipsize(overline.toUpperCase(java.util.Locale.FRANCE), over, textWidth), textLeft, top + 26f, over);
        StaticLayout name = StaticLayout.Builder
                .obtain(title, 0, title.length(), text(32f, INK, true), (int) textWidth)
                .setMaxLines(2)
                .setEllipsize(TextUtils.TruncateAt.END)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .build();
        canvas.save();
        canvas.translate(textLeft, top + 40f);
        name.draw(canvas);
        canvas.restore();
        if (found && best) {
            TextPaint pill = text(20f, GREEN, true);
            String label = "Le mieux noté ici";
            float pillTop = Math.min(top + 46f + name.getHeight(), 192f);
            RectF r = new RectF(textLeft, pillTop, textLeft + pill.measureText(label) + 28f, pillTop + 32f);
            canvas.drawRoundRect(r, 16f, 16f, fill(MINT_TINT));
            canvas.drawText(label, r.left + 14f, r.bottom - 9f, pill);
        }

        // Verdict
        String verdict;
        switch (d.state) {
            case FOUND:
                verdict = d.verdict == null ? "Note " + d.grade : d.verdict;
                break;
            case LOADING:
                verdict = "Recherche de la fiche…";
                break;
            case UNKNOWN:
                verdict = "Pas encore noté";
                break;
            default:
                verdict = "Fiche non chargée";
                break;
        }
        RectF banner = new RectF(left, 232f, CARD_RIGHT - PAD, 296f);
        canvas.drawRoundRect(banner, 18f, 18f, fill(g >= 0 ? GRADE_TINT[g] : LINE));
        TextPaint vp = text(30f, INK, true);
        canvas.drawText(ellipsize(verdict, vp, banner.width() - 40f), banner.left + 20f, banner.bottom - 21f, vp);

        // Chiffres (ou consigne)
        float boxTop = 312f;
        float boxBottom = 404f;
        if (found) {
            String l1;
            String v1;
            String l2;
            String v2;
            if (d.ecoCost != null) {
                l1 = "Coût environnemental";
                v1 = PanelData.points(d.ecoCost);
                l2 = "Climat";
                v2 = d.climateKg == null ? "—" : PanelData.climate(d.climateKg);
            } else {
                l1 = "Carbone";
                v1 = d.carbonGrade == null ? "—" : d.carbonGrade;
                l2 = "Social";
                v2 = d.socialGrade == null ? "Non évalué" : d.socialGrade;
            }
            float mid = (left + CARD_RIGHT - PAD) / 2f;
            drawMetric(canvas, new RectF(left, boxTop, mid - 8f, boxBottom), l1, v1);
            drawMetric(canvas, new RectF(mid + 8f, boxTop, CARD_RIGHT - PAD, boxBottom), l2, v2);
        } else if (d.state != PanelData.State.LOADING) {
            String body = d.state == PanelData.State.UNKNOWN
                    ? "Lisez son étiquette pour obtenir sa note."
                    : "Vérifiez la connexion Internet.";
            TextPaint bp = text(26f, MUTED, false);
            StaticLayout layout = StaticLayout.Builder
                    .obtain(body, 0, body.length(), bp, (int) (CARD_RIGHT - PAD - left))
                    .setMaxLines(2)
                    .setEllipsize(TextUtils.TruncateAt.END)
                    .build();
            canvas.save();
            canvas.translate(left, boxTop + 12f);
            layout.draw(canvas);
            canvas.restore();
        }

        // Action au toucher
        String footer = found ? "Touchez pour la fiche  ›"
                : d.state == PanelData.State.UNKNOWN ? "Touchez pour continuer  ›"
                : d.state == PanelData.State.ERROR ? "Touchez pour réessayer  ›" : null;
        if (footer != null) {
            TextPaint fp = text(25f, GREEN, true);
            fp.setTextAlign(Paint.Align.CENTER);
            canvas.drawText(footer, WIDTH / 2f, 448f, fp);
        }
        return bitmap;
    }

    /** Point posé sur le code-barres (ancre) */
    static Bitmap dot() {
        int size = 96;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        float c = size / 2f;
        canvas.drawCircle(c, c, 44f, fill(0x55000000));
        canvas.drawCircle(c, c, 36f, fill(Color.WHITE));
        canvas.drawCircle(c, c, 26f, fill(MINT));
        canvas.drawCircle(c, c, 10f, fill(GREEN));
        return bitmap;
    }

    private static void drawMetric(Canvas canvas, RectF r, String label, String value) {
        canvas.drawRoundRect(r, 18f, 18f, fill(GROUND));
        TextPaint lp = text(21f, MUTED, false);
        TextPaint vp = text(32f, INK, true);
        canvas.drawText(ellipsize(label, lp, r.width() - 32f), r.left + 16f, r.top + 34f, lp);
        canvas.drawText(ellipsize(value, vp, r.width() - 32f), r.left + 16f, r.top + 76f, vp);
    }

    private static void drawCrown(Canvas canvas, float cx, float bottom) {
        Path crown = new Path();
        float w = 46f;
        crown.moveTo(cx - w, bottom);
        crown.lineTo(cx - w, bottom - 34f);
        crown.lineTo(cx - w / 2f, bottom - 14f);
        crown.lineTo(cx, bottom - 44f);
        crown.lineTo(cx + w / 2f, bottom - 14f);
        crown.lineTo(cx + w, bottom - 34f);
        crown.lineTo(cx + w, bottom);
        crown.close();
        Paint gold = fill(0xFFF2B705);
        gold.setShadowLayer(6f, 0f, 2f, 0x66000000);
        canvas.drawPath(crown, gold);
        Paint outline = new Paint(Paint.ANTI_ALIAS_FLAG);
        outline.setStyle(Paint.Style.STROKE);
        outline.setStrokeWidth(4f);
        outline.setStrokeJoin(Paint.Join.ROUND);
        outline.setColor(0xFF7A5B00);
        canvas.drawPath(crown, outline);
    }

    private static Paint fill(int color) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.FILL);
        p.setColor(color);
        return p;
    }

    private static TextPaint text(float size, int color, boolean bold) {
        TextPaint p = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        p.setTextSize(size);
        p.setColor(color);
        p.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        return p;
    }

    private static String ellipsize(String s, TextPaint p, float width) {
        return TextUtils.ellipsize(s, p, width, TextUtils.TruncateAt.END).toString();
    }
}
