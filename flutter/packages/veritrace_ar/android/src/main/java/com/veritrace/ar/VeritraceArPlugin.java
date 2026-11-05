package com.veritrace.ar;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.ar.core.ArCoreApk;

import java.util.HashMap;
import java.util.Map;

import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.embedding.engine.plugins.activity.ActivityAware;
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;
import io.flutter.plugin.common.PluginRegistry;

/**
 * Lien entre l'app Flutter et la réalité augmentée native :
 *  - « availability » : ARCore est-il utilisable sur ce téléphone ?
 *  - « open » : ouvre l'écran de RA 3D et renvoie ce que l'utilisateur a choisi (fiche, code inconnu, fermeture) ;
 *  - pendant la RA, l'écran natif demande les fiches à l'app (« lookup ») et lui signale les panneaux posés (« event »).
 */
public final class VeritraceArPlugin
        implements FlutterPlugin, ActivityAware, MethodChannel.MethodCallHandler, PluginRegistry.ActivityResultListener {

    private static final int REQUEST_AR = 0x5652;

    interface LookupCallback {
        void onResult(@Nullable Map<?, ?> result);
    }

    /** Canal du moteur Flutter attaché (utilisé par l'écran de RA pendant qu'il est au premier plan). */
    private static MethodChannel shared;

    private MethodChannel channel;
    private Context context;
    private ActivityPluginBinding activityBinding;
    private MethodChannel.Result pendingOpen;

    @Override
    public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {
        context = binding.getApplicationContext();
        // police arabe de l'app Flutter (flutter/fonts), pour les panneaux 3D en arabe
        PanelPainter.arabicFonts(
                binding.getFlutterAssets().getAssetFilePathByName("fonts/NotoSansArabic-Regular.ttf"),
                binding.getFlutterAssets().getAssetFilePathByName("fonts/NotoSansArabic-Bold.ttf"));
        channel = new MethodChannel(binding.getBinaryMessenger(), "veritrace_ar");
        channel.setMethodCallHandler(this);
        shared = channel;
    }

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
        channel.setMethodCallHandler(null);
        if (shared == channel) shared = null;
        channel = null;
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
        switch (call.method) {
            case "availability":
                try {
                    result.success(ArCoreApk.getInstance().checkAvailability(context).name());
                } catch (RuntimeException e) {
                    result.success("UNKNOWN_ERROR");
                }
                break;
            case "open":
                // textes dans la langue de l'app : {strings: {clé: texte}, rtl: bool}
                Object args = call.arguments;
                if (args instanceof Map) {
                    Map<?, ?> m = (Map<?, ?>) args;
                    Object strings = m.get("strings");
                    Texts.set(strings instanceof Map ? (Map<?, ?>) strings : null, Boolean.TRUE.equals(m.get("rtl")));
                } else {
                    Texts.set(null, false);
                }
                open(result);
                break;
            default:
                result.notImplemented();
        }
    }

    private void open(MethodChannel.Result result) {
        Activity activity = activityBinding == null ? null : activityBinding.getActivity();
        if (activity == null) {
            result.error("no_activity", "Écran de l'app indisponible", null);
            return;
        }
        if (pendingOpen != null) {
            result.error("busy", "La réalité augmentée est déjà ouverte", null);
            return;
        }
        pendingOpen = result;
        activity.startActivityForResult(new Intent(activity, ArActivity.class), REQUEST_AR);
    }

    @Override
    public boolean onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        if (requestCode != REQUEST_AR) return false;
        MethodChannel.Result result = pendingOpen;
        pendingOpen = null;
        if (result == null) return true;
        Map<String, Object> out = new HashMap<>();
        String action = data == null ? null : data.getStringExtra(ArActivity.EXTRA_ACTION);
        out.put("action", action == null ? "closed" : action);
        out.put("ean", data == null ? null : data.getStringExtra(ArActivity.EXTRA_EAN));
        out.put("message", data == null ? null : data.getStringExtra(ArActivity.EXTRA_MESSAGE));
        out.put("placed", data == null ? 0 : data.getIntExtra(ArActivity.EXTRA_PLACED, 0));
        result.success(out);
        return true;
    }

    @Override
    public void onAttachedToActivity(@NonNull ActivityPluginBinding binding) {
        activityBinding = binding;
        binding.addActivityResultListener(this);
    }

    @Override
    public void onDetachedFromActivityForConfigChanges() {
        onDetachedFromActivity();
    }

    @Override
    public void onReattachedToActivityForConfigChanges(@NonNull ActivityPluginBinding binding) {
        onAttachedToActivity(binding);
    }

    @Override
    public void onDetachedFromActivity() {
        if (activityBinding != null) activityBinding.removeActivityResultListener(this);
        activityBinding = null;
    }

    /** Demande la fiche d'un code-barres à l'app Flutter (à appeler sur le thread principal). */
    static void lookup(String code, LookupCallback callback) {
        MethodChannel ch = shared;
        if (ch == null) {
            callback.onResult(null);
            return;
        }
        ch.invokeMethod("lookup", code, new MethodChannel.Result() {
            @Override
            public void success(@Nullable Object value) {
                callback.onResult(value instanceof Map ? (Map<?, ?>) value : null);
            }

            @Override
            public void error(@NonNull String errorCode, @Nullable String message, @Nullable Object details) {
                callback.onResult(null);
            }

            @Override
            public void notImplemented() {
                callback.onResult(null);
            }
        });
    }

    /** Mesure d'usage (thread principal). */
    static void event(String name, @Nullable String ean, @Nullable String grade) {
        MethodChannel ch = shared;
        if (ch == null) return;
        Map<String, Object> args = new HashMap<>();
        args.put("name", name);
        args.put("ean", ean);
        args.put("grade", grade);
        ch.invokeMethod("event", args);
    }
}
