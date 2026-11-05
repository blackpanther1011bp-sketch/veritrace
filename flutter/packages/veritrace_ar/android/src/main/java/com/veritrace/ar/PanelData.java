package com.veritrace.ar;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Contenu d'un panneau 3D (fiche renvoyée par l'app Flutter) et comparateur en rayon.
 * Sans dépendance Android (vérifié sur ordinateur).
 */
final class PanelData {
    enum State { LOADING, FOUND, UNKNOWN, ERROR }

    static final String GRADES = "ABCDE";

    final State state;
    /** Code-barres lu par la caméra */
    final String code;
    /** Code-barres normalisé (EAN-13) renvoyé par l'app */
    final String ean;
    String name;
    String brand;
    String grade;
    String verdict;
    String carbonGrade;
    String socialGrade;
    String category;
    Double ecoCost;
    Double climateKg;
    boolean sample;

    private PanelData(State state, String code, String ean) {
        this.state = state;
        this.code = code;
        this.ean = ean == null ? code : ean;
    }

    static PanelData loading(String code) {
        return new PanelData(State.LOADING, code, null);
    }

    static PanelData error(String code) {
        return new PanelData(State.ERROR, code, null);
    }

    /** Réponse de l'app : {status: found|unknown|invalid|error, ean, name, brand, grade, …}. */
    static PanelData fromMap(String code, Map<?, ?> m) {
        if (m == null) return error(code);
        String status = str(m.get("status"));
        String ean = str(m.get("ean"));
        if ("found".equals(status)) {
            String grade = str(m.get("grade"));
            if (grade == null || grade.length() != 1 || GRADES.indexOf(grade.charAt(0)) < 0) {
                return new PanelData(State.ERROR, code, ean);
            }
            PanelData d = new PanelData(State.FOUND, code, ean);
            d.grade = grade;
            d.name = str(m.get("name"));
            d.brand = str(m.get("brand"));
            d.verdict = str(m.get("verdict"));
            d.carbonGrade = str(m.get("carbon"));
            d.socialGrade = str(m.get("social"));
            d.category = str(m.get("category"));
            d.ecoCost = num(m.get("ecoCost"));
            d.climateKg = num(m.get("climateKg"));
            d.sample = Boolean.TRUE.equals(m.get("sample"));
            return d;
        }
        if ("unknown".equals(status) || "invalid".equals(status)) return new PanelData(State.UNKNOWN, code, ean);
        return new PanelData(State.ERROR, code, ean);
    }

    private static String str(Object o) {
        if (!(o instanceof String)) return null;
        String s = ((String) o).trim();
        return s.isEmpty() ? null : s;
    }

    private static Double num(Object o) {
        if (!(o instanceof Number)) return null;
        double v = ((Number) o).doubleValue();
        return Double.isNaN(v) || Double.isInfinite(v) ? null : v;
    }

    int gradeIndex() {
        return grade == null ? GRADES.length() : GRADES.indexOf(grade.charAt(0));
    }

    double cost() {
        return ecoCost != null && ecoCost > 0 ? ecoCost : Double.POSITIVE_INFINITY;
    }

    // ---------------------------------------------------------------------------------------------
    // Comparateur en rayon (même règle que l'app : lib/compare.dart et web/src/lib/compare.ts)

    static final class Ranking {
        /** Code-barres (lu par la caméra) du vêtement le mieux noté */
        final String bestCode;
        final String summary;

        Ranking(String bestCode, String summary) {
            this.bestCode = bestCode;
            this.summary = summary;
        }
    }

    /** Classement des vêtements notés (note, puis coût environnemental) ; null s'il y en a moins de deux. */
    static Ranking rank(Collection<PanelData> panels) {
        Map<String, PanelData> unique = new LinkedHashMap<>();
        for (PanelData p : panels) {
            if (p != null && p.state == State.FOUND && !unique.containsKey(p.ean)) unique.put(p.ean, p);
        }
        if (unique.size() < 2) return null;
        List<PanelData> list = new ArrayList<>(unique.values());
        list.sort((a, b) -> {
            int g = Integer.compare(a.gradeIndex(), b.gradeIndex());
            if (g != 0) return g;
            int c = Double.compare(a.cost(), b.cost());
            if (c != 0) return c;
            return String.valueOf(a.name).compareTo(String.valueOf(b.name));
        });
        PanelData best = list.get(0);
        PanelData worst = list.get(list.size() - 1);
        boolean sameType = best.category != null && worst.category != null
                && best.category.trim().equalsIgnoreCase(worst.category.trim());
        double cb = best.cost();
        double cw = worst.cost();
        boolean muchLess = !Double.isInfinite(cb) && !Double.isInfinite(cw) && cw > cb * 1.15;
        String summary;
        // textes dans la langue de l'app (Texts), français par défaut
        if (sameType && muchLess) {
            summary = Texts.format("ratio", "{ratio} fois moins d'impact que le moins bon ({grade})",
                    "ratio", fr(cw / cb), "grade", worst.grade);
        } else if (best.grade.equals(worst.grade)) {
            summary = Texts.format("same", "Notes proches : tous notés {grade}", "grade", best.grade);
        } else {
            summary = Texts.format("diff", "Note {best}, contre {worst} pour le moins bon",
                    "best", best.grade, "worst", worst.grade);
        }
        return new Ranking(best.code, summary);
    }

    /** Nombre à la française, une décimale au plus : 2,3 ; 3 */
    static String fr(double v) {
        double rounded = Math.round(v * 10) / 10.0;
        if (rounded == Math.rint(rounded)) return String.valueOf((long) rounded);
        return String.format(Locale.ROOT, "%.1f", rounded).replace('.', ',');
    }

    /** 1 266 pts (espace fine insécable entre les milliers ; unité dans la langue de l'app) */
    static String points(double v) {
        long n = Math.round(v);
        String digits = String.valueOf(Math.abs(n));
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) out.append(' ');
            out.append(digits.charAt(i));
        }
        return (n < 0 ? "-" : "") + out + " " + Texts.get("pts", "pts");
    }

    /** 7,3 kg CO₂e */
    static String climate(double kg) {
        String value = kg >= 10 ? String.valueOf(Math.round(kg)) : String.format(Locale.ROOT, "%.1f", kg).replace('.', ',');
        return value + " " + Texts.get("kg", "kg CO₂e");
    }

    /** 2 001000 000012 */
    static String formatEan(String code) {
        if (code != null && code.length() == 13) {
            return code.charAt(0) + " " + code.substring(1, 7) + " " + code.substring(7);
        }
        return code;
    }
}
