package com.veritrace.ar;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.Image;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.util.Size;
import android.view.Display;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.ar.core.Anchor;
import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Camera;
import com.google.ar.core.CameraConfig;
import com.google.ar.core.CameraConfigFilter;
import com.google.ar.core.CameraIntrinsics;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.PointCloud;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.CameraNotAvailableException;
import com.google.ar.core.exceptions.UnavailableApkTooOldException;
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException;
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException;
import com.google.ar.core.exceptions.UnavailableSdkTooOldException;
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException;

import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentLinkedQueue;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * Réalité augmentée native (ARCore) : la note de chaque vêtement visé est posée en 3D sur son code-barres et
 * reste à sa place quand on se déplace. Toucher une note renvoie à l'app Flutter, qui ouvre la fiche.
 *
 * Threads : le rendu OpenGL (ARCore, ancres, textures) ; le thread principal (ML Kit, fiches, interface).
 */
public final class ArActivity extends Activity implements GLSurfaceView.Renderer, BarcodeReader.Listener {
    static final String EXTRA_ACTION = "action";
    static final String EXTRA_EAN = "ean";
    static final String EXTRA_MESSAGE = "message";
    static final String EXTRA_PLACED = "placed";

    private static final String TAG = "VeriTraceAR";
    private static final int CAMERA_REQUEST = 7301;
    /** Une lecture de code-barres toutes les 120 ms au plus */
    private static final long SCAN_INTERVAL_MS = 120;
    private static final int MAX_ITEMS = 8;
    /** Largeur réelle d'un panneau (mètres) ; au-delà de 45 cm il grandit pour rester lisible */
    private static final float PANEL_WIDTH_M = 0.09f;
    private static final float DOT_SIZE_M = 0.022f;
    private static final float READABLE_DISTANCE_M = 0.45f;

    /** Vêtement repéré pendant la visite */
    private static final class Item {
        final String code;
        volatile PanelData data;
        volatile Bitmap bitmap;
        volatile int version;
        volatile long lastSeen;
        // Thread OpenGL uniquement
        Anchor anchor;
        int texture;
        int uploaded = -1;
        float aspect = PanelPainter.HEIGHT / (float) PanelPainter.WIDTH;
        float[] position;
        float distance;
        float[] screenQuad;
        boolean placed;

        Item(String code) {
            this.code = code;
            this.data = PanelData.loading(code);
        }
    }

    private static final class Pending {
        final BarcodeReader.Capture capture;
        final BarcodeReader.Detected code;

        Pending(BarcodeReader.Capture capture, BarcodeReader.Detected code) {
            this.capture = capture;
            this.code = code;
        }
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    /** Protégé par synchronized (items) */
    private final Map<String, Item> items = new LinkedHashMap<>();
    private final ConcurrentLinkedQueue<Pending> detections = new ConcurrentLinkedQueue<>();
    private final ConcurrentLinkedQueue<Item> removed = new ConcurrentLinkedQueue<>();
    private final ConcurrentLinkedQueue<float[]> taps = new ConcurrentLinkedQueue<>();

    private BarcodeReader reader;
    private GLSurfaceView surface;
    private LinearLayout bar;
    private TextView hint;

    private volatile Session session;
    private boolean installRequested;
    private boolean permissionRequested;
    private boolean resultSet;
    private volatile boolean destroyed;
    private volatile int placedCount;
    private volatile int displayRotation = Surface.ROTATION_0;
    private volatile boolean geometryChanged = true;
    private volatile String rankingHint;
    private String bestCode;

    // Thread OpenGL
    private CameraBackground background;
    private QuadRenderer quads;
    private int dotTexture;
    private int viewWidth;
    private int viewHeight;
    private long lastScan;
    private String hintShown;
    private final float[] projection = new float[16];
    private final float[] view = new float[16];
    private final float[] viewProjection = new float[16];
    private final float[] model = new float[16];
    private final float[] mvp = new float[16];

    // ---------------------------------------------------------------------------------------------
    // Cycle de vie

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        reader = new BarcodeReader();
        PanelPainter.loadFonts(getAssets());

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0F1A14);

        surface = new GLSurfaceView(this);
        surface.setPreserveEGLContextOnPause(true);
        surface.setEGLContextClientVersion(3);
        surface.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        surface.setRenderer(this);
        surface.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        surface.setContentDescription(Texts.get("camera", "Caméra : la note des vêtements s'affiche en 3D sur leur code-barres"));
        GestureDetector gestures = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onDown(MotionEvent e) {
                return true;
            }

            @Override
            public boolean onSingleTapUp(MotionEvent e) {
                taps.offer(new float[] {e.getX(), e.getY()});
                return true;
            }
        });
        surface.setOnTouchListener((v, event) -> {
            if (event.getActionMasked() == MotionEvent.ACTION_UP) v.performClick();
            return gestures.onTouchEvent(event);
        });
        root.addView(surface, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Barre du haut : fermer, titre
        bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        // arabe : bouton fermer à droite, comme dans le reste de l'app
        bar.setLayoutDirection(Texts.rtl() ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        TextView close = new TextView(this);
        close.setText("✕");
        close.setTextColor(Color.WHITE);
        close.setTextSize(20f);
        close.setGravity(Gravity.CENTER);
        close.setBackground(round(0x66000000, -1));
        close.setContentDescription(Texts.get("close", "Fermer la réalité augmentée"));
        close.setOnClickListener(v -> finish());
        bar.addView(close, new LinearLayout.LayoutParams(dp(44), dp(44)));
        TextView title = new TextView(this);
        title.setText(Texts.get("title", "Réalité augmentée 3D"));
        title.setTextColor(Color.WHITE);
        title.setTextSize(17f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        title.setShadowLayer(6f, 0f, 1f, 0x99000000);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        bar.addView(new View(this), new LinearLayout.LayoutParams(dp(44), dp(44)));
        root.addView(bar, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP));

        // Consigne du bas
        hint = new TextView(this);
        hint.setText(Texts.get("starting", "Démarrage de la réalité augmentée…"));
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(15f);
        hint.setGravity(Gravity.CENTER);
        hint.setLineSpacing(0f, 1.25f);
        hint.setPadding(dp(16), dp(12), dp(16), dp(12));
        hint.setBackground(round(0xD90F1A14, dp(16)));
        hint.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        FrameLayout.LayoutParams hintParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        hintParams.setMargins(dp(16), 0, dp(16), dp(24));
        root.addView(hint, hintParams);

        // Plein écran : l'image de la caméra passe sous les barres du système
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int top;
            int bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                top = bars.top;
                bottom = bars.bottom;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
            }
            bar.setPadding(dp(16), top + dp(8), dp(16), dp(8));
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) hint.getLayoutParams();
            lp.bottomMargin = bottom + dp(24);
            hint.setLayoutParams(lp);
            return insets;
        });
        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        displayRotation = currentRotation();
        geometryChanged = true;
        Session s = session;
        if (s == null) {
            try {
                if (ArCoreApk.getInstance().requestInstall(this, !installRequested)
                        == ArCoreApk.InstallStatus.INSTALL_REQUESTED) {
                    // Le Play Store s'ouvre pour installer « Services Google Play pour la RA »
                    installRequested = true;
                    return;
                }
                if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    if (!permissionRequested) {
                        permissionRequested = true;
                        requestPermissions(new String[] {Manifest.permission.CAMERA}, CAMERA_REQUEST);
                    }
                    return;
                }
                s = new Session(this);
                chooseCamera(s);
                configure(s);
            } catch (Exception e) {
                Log.e(TAG, "Démarrage d'ARCore", e);
                if (s != null) s.close();
                if (e instanceof UnavailableDeviceNotCompatibleException) {
                    finishWith("unsupported", null, Texts.get("unsupported",
                            "Ce téléphone n'est pas compatible avec la réalité augmentée 3D. Le scanner classique reste disponible."));
                } else if (e instanceof UnavailableUserDeclinedInstallationException) {
                    finishWith("error", null, Texts.get("needServices",
                            "La réalité augmentée 3D a besoin de « Services Google Play pour la RA » (gratuit, sur le Play Store)."));
                } else if (e instanceof UnavailableArcoreNotInstalledException || e instanceof UnavailableApkTooOldException) {
                    finishWith("error", null, Texts.get("installServices",
                            "Installez ou mettez à jour « Services Google Play pour la RA » depuis le Play Store, puis réessayez."));
                } else if (e instanceof UnavailableSdkTooOldException) {
                    finishWith("error", null, Texts.get("updateApp", "Mettez à jour VeriTrace pour utiliser la réalité augmentée 3D."));
                } else {
                    finishWith("error", null, Texts.get("startFailed", "La réalité augmentée 3D n'a pas pu démarrer sur ce téléphone."));
                }
                return;
            }
        }
        try {
            s.resume();
        } catch (Exception e) {
            Log.e(TAG, "Reprise d'ARCore", e);
            if (session == null) s.close();
            finishWith("error", null, Texts.get("cameraBusy", "La caméra est occupée ou indisponible : réessayez dans un instant."));
            return;
        }
        // Le rendu n'utilise la session qu'une fois reprise
        session = s;
        surface.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        Session s = session;
        if (s != null) {
            surface.onPause();
            s.pause();
        }
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        Session s = session;
        session = null;
        if (s != null) s.close();
        if (reader != null) reader.close();
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != CAMERA_REQUEST) return;
        if (grantResults.length == 0 || grantResults[0] != PackageManager.PERMISSION_GRANTED) {
            finishWith("error", null, Texts.get("cameraPermission", "Autorisez l'accès à la caméra pour utiliser la réalité augmentée."));
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        displayRotation = currentRotation();
        geometryChanged = true;
    }

    @Override
    public void finish() {
        if (!resultSet) {
            Intent data = new Intent();
            data.putExtra(EXTRA_ACTION, "closed");
            data.putExtra(EXTRA_PLACED, placedCount);
            setResult(RESULT_OK, data);
            resultSet = true;
        }
        super.finish();
    }

    private void finishWith(String action, String ean, String message) {
        if (isFinishing()) return;
        Intent data = new Intent();
        data.putExtra(EXTRA_ACTION, action);
        data.putExtra(EXTRA_EAN, ean);
        data.putExtra(EXTRA_MESSAGE, message);
        data.putExtra(EXTRA_PLACED, placedCount);
        setResult(RESULT_OK, data);
        resultSet = true;
        finish();
    }

    private static void chooseCamera(Session s) {
        // Image de la caméra la plus nette possible (jusqu'à 1920 × 1080) : les codes-barres des étiquettes
        // sont petits
        try {
            CameraConfigFilter filter = new CameraConfigFilter(s);
            filter.setFacingDirection(CameraConfig.FacingDirection.BACK);
            filter.setTargetFps(EnumSet.of(CameraConfig.TargetFps.TARGET_FPS_30));
            CameraConfig best = null;
            long bestArea = 0;
            for (CameraConfig c : s.getSupportedCameraConfigs(filter)) {
                Size size = c.getImageSize();
                long area = (long) size.getWidth() * size.getHeight();
                if (size.getWidth() <= 1920 && area > bestArea) {
                    best = c;
                    bestArea = area;
                }
            }
            if (best != null) s.setCameraConfig(best);
        } catch (RuntimeException e) {
            Log.w(TAG, "Configuration de la caméra", e);
        }
    }

    private static void configure(Session s) {
        Config config = new Config(s);
        // Mise au point automatique : indispensable pour lire un code-barres de près
        config.setFocusMode(Config.FocusMode.AUTO);
        config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
        config.setPlaneFindingMode(Config.PlaneFindingMode.DISABLED);
        config.setLightEstimationMode(Config.LightEstimationMode.DISABLED);
        try {
            s.configure(config);
        } catch (RuntimeException e) {
            // réglage refusé par ce téléphone : configuration par défaut d'ARCore
            Log.w(TAG, "Configuration ARCore", e);
            s.configure(new Config(s));
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Rendu (thread OpenGL)

    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig config) {
        GLES20.glClearColor(0.06f, 0.1f, 0.08f, 1f);
        background = new CameraBackground();
        background.create();
        quads = new QuadRenderer();
        quads.create();
        dotTexture = QuadRenderer.upload(PanelPainter.dot(), 0);
        // Nouveau contexte OpenGL : les textures des panneaux sont à renvoyer
        synchronized (items) {
            for (Item it : items.values()) {
                it.texture = 0;
                it.uploaded = -1;
            }
        }
        geometryChanged = true;
    }

    @Override
    public void onSurfaceChanged(GL10 gl, int width, int height) {
        GLES20.glViewport(0, 0, width, height);
        viewWidth = width;
        viewHeight = height;
        geometryChanged = true;
    }

    @Override
    public void onDrawFrame(GL10 gl) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        Session s = session;
        if (s == null || background == null || destroyed) return;
        if (geometryChanged && viewWidth > 0) {
            geometryChanged = false;
            s.setDisplayGeometry(displayRotation, viewWidth, viewHeight);
        }
        Frame frame;
        try {
            s.setCameraTextureName(background.texture());
            frame = s.update();
        } catch (Exception e) {
            if (e instanceof CameraNotAvailableException) {
                showHint(Texts.get("cameraUnavailable", "Caméra indisponible : fermez puis rouvrez la réalité augmentée."));
            } else {
                Log.w(TAG, "Image ARCore", e);
            }
            return;
        }
        Camera camera = frame.getCamera();
        background.draw(frame);
        boolean tracking = camera.getTrackingState() == TrackingState.TRACKING;

        long now = SystemClock.uptimeMillis();
        if (now - lastScan >= SCAN_INTERVAL_MS && !reader.isBusy()) {
            lastScan = now;
            capture(frame, camera, tracking);
        }
        placeDetections(s, tracking);
        if (tracking) {
            camera.getProjectionMatrix(projection, 0, 0.02f, 30f);
            camera.getViewMatrix(view, 0);
            Geometry.multiplyMM(viewProjection, projection, view);
            drawItems(camera.getPose().getTranslation());
        } else {
            taps.clear();
        }
        showHint(hintFor(camera, tracking));
    }

    /** Copie l'image de la caméra pour ML Kit, avec la position de la caméra à cet instant. */
    private void capture(Frame frame, Camera camera, boolean tracking) {
        Image image;
        try {
            image = frame.acquireCameraImage();
        } catch (Exception e) {
            return; // image pas encore prête
        }
        try {
            BarcodeReader.Capture c = new BarcodeReader.Capture();
            c.tracking = tracking;
            if (tracking) {
                c.pose = camera.getPose();
                CameraIntrinsics k = camera.getImageIntrinsics();
                float[] focal = k.getFocalLength();
                float[] principal = k.getPrincipalPoint();
                int[] dims = k.getImageDimensions();
                float sx = dims[0] > 0 ? image.getWidth() / (float) dims[0] : 1f;
                float sy = dims[1] > 0 ? image.getHeight() / (float) dims[1] : 1f;
                c.fx = focal[0] * sx;
                c.fy = focal[1] * sy;
                c.cx = principal[0] * sx;
                c.cy = principal[1] * sy;
                try (PointCloud cloud = frame.acquirePointCloud()) {
                    FloatBuffer points = cloud.getPoints();
                    points.rewind();
                    c.points = new float[points.remaining()];
                    points.get(c.points);
                } catch (Exception e) {
                    c.points = null;
                }
            }
            reader.submit(image, c, this);
        } catch (RuntimeException e) {
            Log.w(TAG, "Lecture de l'image", e);
        } finally {
            image.close();
        }
    }

    /** Pose (ou déplace) l'ancre de chaque code-barres lu. */
    private void placeDetections(Session s, boolean tracking) {
        Item gone;
        while ((gone = removed.poll()) != null) {
            if (gone.anchor != null) gone.anchor.detach();
            gone.anchor = null;
            QuadRenderer.delete(gone.texture);
            gone.texture = 0;
        }
        Pending p;
        while ((p = detections.poll()) != null) {
            if (!tracking || !p.capture.tracking) continue;
            Item item;
            synchronized (items) {
                item = items.get(p.code.code);
            }
            if (item != null) place(s, item, locate(p));
        }
    }

    /** Position 3D du code-barres : direction vue par la caméra et distance (points d'ARCore ou taille du code). */
    private static float[] locate(Pending p) {
        BarcodeReader.Capture c = p.capture;
        float[] q = p.code.corners;
        float[] center = Geometry.centroid(q);
        float sizeDepth = Geometry.depthFromSize((c.fx + c.fy) / 2f, Geometry.longEdge(q));
        float[] zone = Geometry.expand(q, 1.3f);
        float[] depths = new float[48];
        int n = 0;
        if (c.points != null) {
            Pose toCamera = c.pose.inverse();
            float[] point = new float[3];
            for (int i = 0; i + 3 < c.points.length && n < depths.length; i += 4) {
                if (c.points[i + 3] < 0.2f) continue;
                point[0] = c.points[i];
                point[1] = c.points[i + 1];
                point[2] = c.points[i + 2];
                float[] local = toCamera.transformPoint(point);
                float[] px = Geometry.imagePoint(local, c.fx, c.fy, c.cx, c.cy);
                if (px != null && Geometry.inside(px[0], px[1], zone)) depths[n++] = -local[2];
            }
        }
        float depth = Geometry.chooseDepth(sizeDepth, depths, n);
        return c.pose.transformPoint(Geometry.cameraPoint(center[0], center[1], c.fx, c.fy, c.cx, c.cy, depth));
    }

    private void place(Session s, Item item, float[] world) {
        float[] target = world;
        if (item.anchor != null && item.anchor.getTrackingState() != TrackingState.STOPPED) {
            float[] current = item.anchor.getPose().getTranslation();
            float moved = Geometry.distance(current, world);
            if (moved < 0.02f) return; // déjà bien placé : pas de tremblement
            // petit écart : on lisse ; grand écart (vêtement déplacé) : on saute
            float k = moved > 0.2f ? 1f : 0.4f;
            target = new float[] {
                current[0] + (world[0] - current[0]) * k,
                current[1] + (world[1] - current[1]) * k,
                current[2] + (world[2] - current[2]) * k,
            };
        }
        Anchor fresh;
        try {
            fresh = s.createAnchor(Pose.makeTranslation(target[0], target[1], target[2]));
        } catch (RuntimeException e) {
            return;
        }
        if (item.anchor != null) item.anchor.detach();
        item.anchor = fresh;
        if (!item.placed) {
            item.placed = true;
            placedCount++;
            String code = item.code;
            main.post(() -> {
                if (destroyed) return;
                surface.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK);
                VeritraceArPlugin.event("ar3d_place", code, null);
            });
        }
    }

    private void drawItems(float[] camera) {
        List<Item> list;
        synchronized (items) {
            list = new ArrayList<>(items.values());
        }
        List<Item> visible = new ArrayList<>();
        for (Item it : list) {
            it.screenQuad = null;
            if (it.anchor == null || it.anchor.getTrackingState() != TrackingState.TRACKING) continue;
            int version = it.version;
            Bitmap bitmap = it.bitmap;
            if (bitmap == null) continue;
            if (it.texture == 0 || it.uploaded != version) {
                it.texture = QuadRenderer.upload(bitmap, it.texture);
                it.uploaded = version;
                it.aspect = bitmap.getHeight() / (float) bitmap.getWidth();
            }
            it.position = it.anchor.getPose().getTranslation();
            it.distance = Geometry.distance(camera, it.position);
            visible.add(it);
        }
        // Du plus loin au plus près : les panneaux proches passent devant
        visible.sort((a, b) -> Float.compare(b.distance, a.distance));

        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        for (Item it : visible) {
            float scale = Math.max(1f, it.distance / READABLE_DISTANCE_M);
            float[][] axes = Geometry.facingAxes(it.position, camera);
            float dot = DOT_SIZE_M * scale;
            drawQuad(dotTexture, it.position, axes, dot, dot, 1f);
            float w = PANEL_WIDTH_M * scale;
            float h = w * it.aspect;
            // La pointe du panneau arrive juste au-dessus du point posé sur le code-barres
            float[] center = Geometry.onPanel(it.position, axes, 0f, h / 2f + dot * 0.6f, 0f, 1f);
            drawQuad(it.texture, center, axes, w, h, it.data.state == PanelData.State.LOADING ? 0.9f : 1f);
            it.screenQuad = screenQuad(center, axes, w, h);
        }
        GLES20.glDisable(GLES20.GL_BLEND);

        // Toucher : le panneau le plus proche sous le doigt
        float[] tap;
        while ((tap = taps.poll()) != null) {
            Item hit = null;
            for (Item it : visible) {
                if (it.screenQuad != null && Geometry.inside(tap[0], tap[1], it.screenQuad)
                        && (hit == null || it.distance < hit.distance)) {
                    hit = it;
                }
            }
            if (hit != null) {
                Item chosen = hit;
                main.post(() -> onPanelTapped(chosen));
            }
        }
    }

    private void drawQuad(int texture, float[] center, float[][] axes, float w, float h, float alpha) {
        Geometry.panelModel(model, center, axes, w, h);
        Geometry.multiplyMM(mvp, viewProjection, model);
        quads.draw(texture, mvp, alpha);
    }

    private float[] screenQuad(float[] center, float[][] axes, float w, float h) {
        float[][] corners = {{-0.5f, -0.5f}, {0.5f, -0.5f}, {0.5f, 0.5f}, {-0.5f, 0.5f}};
        float[] out = new float[8];
        for (int i = 0; i < 4; i++) {
            float[] p = Geometry.onPanel(center, axes, w, h, corners[i][0], corners[i][1]);
            float[] s = Geometry.toScreen(viewProjection, p[0], p[1], p[2], viewWidth, viewHeight);
            if (s == null) return null;
            out[2 * i] = s[0];
            out[2 * i + 1] = s[1];
        }
        return out;
    }

    private String hintFor(Camera camera, boolean tracking) {
        if (!tracking) {
            switch (camera.getTrackingFailureReason()) {
                case INSUFFICIENT_LIGHT:
                    return Texts.get("lowLight", "Pas assez de lumière : rapprochez-vous d'un éclairage.");
                case EXCESSIVE_MOTION:
                    return Texts.get("slower", "Bougez le téléphone plus lentement.");
                case INSUFFICIENT_FEATURES:
                    return Texts.get("noFeatures", "Visez des vêtements ou des étiquettes, pas un mur uni.");
                case CAMERA_UNAVAILABLE:
                    return Texts.get("cameraUnavailable", "Caméra indisponible : fermez puis rouvrez la réalité augmentée.");
                default:
                    return Texts.get("moveToStart", "Bougez doucement le téléphone de gauche à droite pour démarrer.");
            }
        }
        if (placedCount == 0) return Texts.get("aimBarcode", "Visez le code-barres d'un vêtement : sa note se pose dessus en 3D.");
        String ranking = rankingHint;
        if (ranking != null) return ranking + " " + Texts.get("tapToOpen", "Touchez une note pour ouvrir la fiche.");
        return Texts.get("tapHint", "Touchez une note pour ouvrir la fiche. Tournez autour : elle reste en place.");
    }

    private void showHint(String text) {
        if (text.equals(hintShown)) return;
        hintShown = text;
        main.post(() -> hint.setText(text));
    }

    // ---------------------------------------------------------------------------------------------
    // Codes-barres et fiches (thread principal)

    @Override
    public void onBarcodes(BarcodeReader.Capture capture, List<BarcodeReader.Detected> codes) {
        if (destroyed) return;
        long now = SystemClock.uptimeMillis();
        for (BarcodeReader.Detected d : codes) {
            Item item;
            boolean fresh = false;
            synchronized (items) {
                item = items.get(d.code);
                if (item == null) {
                    item = new Item(d.code);
                    item.lastSeen = now;
                    items.put(d.code, item);
                    fresh = true;
                    if (items.size() > MAX_ITEMS) removeOldest();
                }
            }
            item.lastSeen = now;
            if (fresh) {
                surface.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                lookup(item);
            }
            detections.offer(new Pending(capture, d));
        }
    }

    /** À appeler avec le verrou de items. */
    private void removeOldest() {
        Item oldest = null;
        for (Item it : items.values()) {
            if (oldest == null || it.lastSeen < oldest.lastSeen) oldest = it;
        }
        if (oldest != null) {
            items.remove(oldest.code);
            removed.offer(oldest);
        }
    }

    private void lookup(Item item) {
        setData(item, PanelData.loading(item.code));
        VeritraceArPlugin.lookup(item.code, result -> {
            if (destroyed) return;
            setData(item, PanelData.fromMap(item.code, result));
            updateRanking();
        });
    }

    private void setData(Item item, PanelData data) {
        item.data = data;
        repaint(item);
    }

    private void repaint(Item item) {
        item.bitmap = PanelPainter.panel(item.data, item.code.equals(bestCode));
        item.version = item.version + 1;
    }

    /** Comparateur en rayon : couronne sur le mieux noté et résumé de l'écart. */
    private void updateRanking() {
        List<Item> list;
        synchronized (items) {
            list = new ArrayList<>(items.values());
        }
        List<PanelData> panels = new ArrayList<>();
        for (Item it : list) panels.add(it.data);
        PanelData.Ranking ranking = PanelData.rank(panels);
        String best = ranking == null ? null : ranking.bestCode;
        rankingHint = ranking == null ? null
                : Texts.get("crown", "Couronne : le mieux noté ici.") + " " + ranking.summary + ".";
        if (!Objects.equals(best, bestCode)) {
            String previous = bestCode;
            bestCode = best;
            for (Item it : list) {
                if (it.code.equals(previous) || it.code.equals(best)) repaint(it);
            }
        }
    }

    private void onPanelTapped(Item item) {
        if (destroyed || isFinishing()) return;
        PanelData d = item.data;
        switch (d.state) {
            case FOUND:
                finishWith("product", d.ean, null);
                break;
            case UNKNOWN:
                finishWith("unknown", d.ean, null);
                break;
            case ERROR:
                surface.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                lookup(item);
                break;
            default:
                break;
        }
    }

    // ---------------------------------------------------------------------------------------------

    private int currentRotation() {
        Display display = Build.VERSION.SDK_INT >= 30 ? getDisplay() : getWindowManager().getDefaultDisplay();
        return display == null ? Surface.ROTATION_0 : display.getRotation();
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    /** Fond arrondi ; radius &lt; 0 : cercle. */
    private static GradientDrawable round(int color, int radius) {
        GradientDrawable d = new GradientDrawable();
        if (radius < 0) d.setShape(GradientDrawable.OVAL);
        else d.setCornerRadius(radius);
        d.setColor(color);
        return d;
    }
}
