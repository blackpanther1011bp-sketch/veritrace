package com.veritrace.ar;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Textes de l'écran natif, fournis par l'app Flutter dans la langue choisie (lib/native_ar.dart) ;
 * français par défaut si une clé manque. `rtl` : interface en arabe, de droite à gauche.
 * Sans dépendance Android.
 */
final class Texts {
    private Texts() {}

    private static volatile Map<String, String> values = Collections.emptyMap();
    private static volatile boolean rtl;

    /** Textes reçus à l'ouverture de la réalité augmentée ({clé: texte}). */
    static void set(Map<?, ?> map, boolean rightToLeft) {
        Map<String, String> out = new HashMap<>();
        if (map != null) {
            for (Map.Entry<?, ?> e : map.entrySet()) {
                if (e.getKey() instanceof String && e.getValue() instanceof String) {
                    out.put((String) e.getKey(), (String) e.getValue());
                }
            }
        }
        values = Collections.unmodifiableMap(out);
        rtl = rightToLeft;
    }

    static boolean rtl() {
        return rtl;
    }

    static String get(String key, String fallback) {
        String v = values.get(key);
        return v == null || v.isEmpty() ? fallback : v;
    }

    /** get(), puis {nom} remplacé par sa valeur (paires nom, valeur). */
    static String format(String key, String fallback, String... pairs) {
        String out = get(key, fallback);
        for (int i = 0; i + 1 < pairs.length; i += 2) out = out.replace("{" + pairs[i] + "}", pairs[i + 1]);
        return out;
    }

    /** Fragment de gauche à droite (code-barres) isolé dans une phrase arabe : ses groupes de chiffres restent dans l'ordre. */
    static String ltr(String s) {
        return rtl && s != null ? "\u2066" + s + "\u2069" : s;
    }
}
