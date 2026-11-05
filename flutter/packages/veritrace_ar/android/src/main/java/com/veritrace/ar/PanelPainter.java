package com.veritrace.ar;

import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.fonts.Font;
import android.graphics.fonts.FontFamily;
import android.os.Build;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextDirectionHeuristics;
import android.text.TextPaint;
import android.text.TextUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;

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

    // Polices de la marque (DM Sans, Space Grotesk), embarquées dans le module ; police du système à défaut
    private static Typeface regular = Typeface.DEFAULT;
    private static Typeface bold = Typeface.DEFAULT_BOLD;
    private static Typeface display = Typeface.DEFAULT_BOLD;
    // Lettres arabes : Noto Sans Arabic de l'app Flutter (chemins dans ses ressources), sinon police du système
    private static String arabicRegular;
    private static String arabicBold;

    /** Chemins de la police arabe de l'app (null : police arabe du système). */
    static void arabicFonts(String regularPath, String boldPath) {
        arabicRegular = regularPath;
        arabicBold = boldPath;
    }

    /** À appeler une fois (thread principal) avant de dessiner les panneaux. */
    static void loadFonts(AssetManager assets) {
        try {
            regular = withArabic(assets, "fonts/DMSans-Regular.ttf", arabicRegular);
            bold = withArabic(assets, "fonts/DMSans-Bold.ttf", arabicBold);
            display = withArabic(assets, "fonts/SpaceGrotesk-Bold.ttf", arabicBold);
        } catch (RuntimeException e) {
            regular = Typeface.DEFAULT;
            bold = Typeface.DEFAULT_BOLD;
            display = Typeface.DEFAULT_BOLD;
        }
    }

    /** Police latine de la marque, puis Noto Sans Arabic pour les lettres arabes (Android 10 et plus récent ;
     *  avant : police arabe du système). */
    private static Typeface withArabic(AssetManager assets, String latin, String arabic) {
        if (Build.VERSION.SDK_INT >= 29 && arabic != null) {
            try {
                FontFamily main = new FontFamily.Builder(new Font.Builder(read(assets, latin)).build()).build();
                FontFamily ar = new FontFamily.Builder(new Font.Builder(read(assets, arabic)).build()).build();
                return new Typeface.CustomFallbackBuilder(main).addCustomFallback(ar).setSystemFallback("sans-serif").build();
            } catch (IOException | RuntimeException e) {
                // police arabe illisible : police du système pour les lettres arabes
            }
        }
        return Typeface.createFromAsset(assets, latin);
    }

    private static ByteBuffer read(AssetManager assets, String path) throws IOException {
        try (InputStream in = assets.open(path)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[16384];
            int n;
            while ((n = in.read(chunk)) > 0) out.write(chunk, 0, n);
            byte[] bytes = out.toByteArray();
            ByteBuffer buffer = ByteBuffer.allocateDirect(bytes.length);
            buffer.put(bytes);
            buffer.flip();
            return buffer;
        }
    }

    /** Abscisse retournée dans l'interface en arabe (panneau en miroir). */
    private static float x(float v) {
        return Texts.rtl() ? WIDTH - v : v;
    }

    /** Alignement « début de ligne » d'un texte (à droite en arabe), quel que soit son propre sens de lecture. */
    private static Layout.Alignment start(String s) {
        boolean textRtl = TextDirectionHeuristics.FIRSTSTRONG_LTR.isRtl(s, 0, s.length());
        return textRtl == Texts.rtl() ? Layout.Alignment.ALIGN_NORMAL : Layout.Alignment.ALIGN_OPPOSITE;
    }

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
        // interface en arabe : panneau en miroir (note à droite, textes alignés à droite)
        boolean rtl = Texts.rtl();
        Paint.Align startAlign = rtl ? Paint.Align.RIGHT : Paint.Align.LEFT;

        // Pastille de la note
        float left = CARD_LEFT + PAD;
        float top = CARD_TOP + PAD;
        float cx = x(left + CIRCLE / 2f);
        float cy = top + CIRCLE / 2f;
        canvas.drawCircle(cx, cy, CIRCLE / 2f, fill(g >= 0 ? GRADE_COLOR[g] : NO_GRADE));
        String letter = found ? d.grade : d.state == PanelData.State.LOADING ? "…" : d.state == PanelData.State.UNKNOWN ? "?" : "!";
        TextPaint big = text(84f, INK, true);
        big.setTypeface(display);
        big.setTextAlign(Paint.Align.CENTER);
        canvas.drawText(letter, cx, cy - (big.descent() + big.ascent()) / 2f, big);
        if (found && best) drawCrown(canvas, cx, top - 2f);

        // Marque et nom
        float textLeft = left + CIRCLE + 28f;
        float textWidth = CARD_RIGHT - PAD - textLeft;
        float textStart = x(textLeft);
        String code = Texts.get("code", "Code") + " " + Texts.ltr(PanelData.formatEan(d.ean));
        String overline;
        String title;
        switch (d.state) {
            case FOUND:
                overline = (d.brand == null ? Texts.get("noBrand", "Marque non indiquée") : d.brand)
                        + (d.sample ? " · " + Texts.get("sample", "fictif") : "");
                title = d.name == null ? Texts.get("garment", "Vêtement") : d.name;
                break;
            case LOADING:
                overline = Texts.get("searching", "Recherche…");
                title = code;
                break;
            case UNKNOWN:
                overline = Texts.get("newGarment", "Nouveau vêtement");
                title = code;
                break;
            default:
                overline = Texts.get("noConnection", "Connexion impossible");
                title = code;
                break;
        }
        TextPaint over = text(24f, MUTED2, true);
        // l'arabe est une écriture liée : pas d'espacement entre les lettres ; ligne lue de droite à gauche
        over.setLetterSpacing(rtl ? 0f : 0.06f);
        over.setTextAlign(startAlign);
        String overText = ellipsize(overline.toUpperCase(java.util.Locale.FRANCE), over, textWidth);
        canvas.drawText(rtl ? "\u200F" + overText : overText, textStart, top + 26f, over);
        StaticLayout name = StaticLayout.Builder
                .obtain(title, 0, title.length(), text(32f, INK, true), (int) textWidth)
                .setMaxLines(2)
                .setEllipsize(TextUtils.TruncateAt.END)
                .setAlignment(start(title))
                .build();
        canvas.save();
        canvas.translate(rtl ? textStart - textWidth : textLeft, top + 40f);
        name.draw(canvas);
        canvas.restore();
        if (found && best) {
            TextPaint pill = text(20f, GREEN, true);
            String label = Texts.get("bestHere", "Le mieux noté ici");
            float pillTop = Math.min(top + 46f + name.getHeight(), 192f);
            float pillWidth = pill.measureText(label) + 28f;
            float pillLeft = rtl ? textStart - pillWidth : textLeft;
            RectF r = new RectF(pillLeft, pillTop, pillLeft + pillWidth, pillTop + 32f);
            canvas.drawRoundRect(r, 16f, 16f, fill(MINT_TINT));
            canvas.drawText(label, r.left + 14f, r.bottom - 9f, pill);
        }

        // Verdict
        String verdict;
        switch (d.state) {
            case FOUND:
                verdict = d.verdict == null ? Texts.format("grade", "Note {grade}", "grade", d.grade) : d.verdict;
                break;
            case LOADING:
                verdict = Texts.get("loadingSheet", "Recherche de la fiche…");
                break;
            case UNKNOWN:
                verdict = Texts.get("notRated", "Pas encore noté");
                break;
            default:
                verdict = Texts.get("notLoaded", "Fiche non chargée");
                break;
        }
        RectF banner = new RectF(left, 232f, CARD_RIGHT - PAD, 296f);
        canvas.drawRoundRect(banner, 18f, 18f, fill(g >= 0 ? GRADE_TINT[g] : LINE));
        TextPaint vp = text(30f, INK, true);
        vp.setTypeface(display);
        vp.setTextAlign(startAlign);
        canvas.drawText(ellipsize(verdict, vp, banner.width() - 40f), rtl ? banner.right - 20f : banner.left + 20f,
                banner.bottom - 21f, vp);

        // Chiffres (ou consigne)
        float boxTop = 312f;
        float boxBottom = 404f;
        if (found) {
            String l1;
            String v1;
            String l2;
            String v2;
            if (d.ecoCost != null) {
                l1 = Texts.get("cost", "Coût environnemental");
                v1 = PanelData.points(d.ecoCost);
                l2 = Texts.get("climate", "Climat");
                v2 = d.climateKg == null ? "—" : PanelData.climate(d.climateKg);
            } else {
                l1 = Texts.get("carbon", "Carbone");
                v1 = d.carbonGrade == null ? "—" : d.carbonGrade;
                l2 = Texts.get("social", "Social");
                v2 = d.socialGrade == null ? Texts.get("notEvaluated", "Non évalué") : d.socialGrade;
            }
            float mid = (left + CARD_RIGHT - PAD) / 2f;
            RectF first = new RectF(left, boxTop, mid - 8f, boxBottom);
            RectF second = new RectF(mid + 8f, boxTop, CARD_RIGHT - PAD, boxBottom);
            // en arabe, le premier chiffre est à droite
            drawMetric(canvas, rtl ? second : first, l1, v1);
            drawMetric(canvas, rtl ? first : second, l2, v2);
        } else if (d.state != PanelData.State.LOADING) {
            String body = d.state == PanelData.State.UNKNOWN
                    ? Texts.get("readLabel", "Lisez son étiquette pour obtenir sa note.")
                    : Texts.get("checkInternet", "Vérifiez la connexion Internet.");
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
        // « › » est retourné automatiquement dans une phrase arabe
        String footer = found ? Texts.get("tapSheet", "Touchez pour la fiche") + "  ›"
                : d.state == PanelData.State.UNKNOWN ? Texts.get("tapContinue", "Touchez pour continuer") + "  ›"
                : d.state == PanelData.State.ERROR ? Texts.get("tapRetry", "Touchez pour réessayer") + "  ›" : null;
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
        boolean rtl = Texts.rtl();
        lp.setTextAlign(rtl ? Paint.Align.RIGHT : Paint.Align.LEFT);
        vp.setTextAlign(rtl ? Paint.Align.RIGHT : Paint.Align.LEFT);
        float tx = rtl ? r.right - 16f : r.left + 16f;
        canvas.drawText(ellipsize(label, lp, r.width() - 32f), tx, r.top + 34f, lp);
        canvas.drawText(ellipsize(value, vp, r.width() - 32f), tx, r.top + 76f, vp);
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
        p.setTypeface(bold ? PanelPainter.bold : regular);
        return p;
    }

    private static String ellipsize(String s, TextPaint p, float width) {
        return TextUtils.ellipsize(s, p, width, TextUtils.TruncateAt.END).toString();
    }
}
