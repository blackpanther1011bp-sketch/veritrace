package com.veritrace.ar;

import android.graphics.Point;
import android.graphics.Rect;
import android.media.Image;

import com.google.ar.core.Pose;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Lecture des codes-barres (ML Kit) sur l'image de la caméra d'ARCore. Seule la luminance est copiée : la
 * lecture d'un code-barres n'a pas besoin des couleurs. Une image à la fois.
 */
final class BarcodeReader {

    /** État de la caméra au moment de l'image : sert à placer le code-barres dans l'espace. */
    static final class Capture {
        boolean tracking;
        Pose pose;
        float fx;
        float fy;
        float cx;
        float cy;
        /** Points suivis par ARCore (x, y, z, confiance) dans le repère du monde */
        float[] points;
    }

    static final class Detected {
        final String code;
        /** Coins dans l'image (pixels) : x0, y0, … x3, y3 */
        final float[] corners;

        Detected(String code, float[] corners) {
            this.code = code;
            this.corners = corners;
        }
    }

    interface Listener {
        /** Appelé sur le thread principal. */
        void onBarcodes(Capture capture, List<Detected> codes);
    }

    private final BarcodeScanner scanner = BarcodeScanning.getClient(
            new BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A)
                    .build());
    private volatile boolean busy;
    private volatile boolean closed;
    private byte[] buffer;
    private int bufferWidth;
    private int bufferHeight;

    boolean isBusy() {
        return busy;
    }

    /**
     * Copie l'image (thread OpenGL, avant sa fermeture) puis lance la lecture en arrière-plan.
     * Les coordonnées renvoyées sont celles de l'image d'ARCore, sans rotation : ML Kit lit les codes-barres
     * quelle que soit leur orientation.
     */
    boolean submit(Image image, Capture capture, Listener listener) {
        if (busy || closed) return false;
        int w = image.getWidth();
        int h = image.getHeight();
        if (buffer == null || bufferWidth != w || bufferHeight != h) {
            buffer = new byte[w * h * 3 / 2];
            // chrominance neutre (gris) : seule la luminance compte
            Arrays.fill(buffer, w * h, buffer.length, (byte) 128);
            bufferWidth = w;
            bufferHeight = h;
        }
        Image.Plane plane = image.getPlanes()[0];
        ByteBuffer src = plane.getBuffer();
        int rowStride = plane.getRowStride();
        int pixelStride = plane.getPixelStride();
        if (pixelStride == 1) {
            for (int row = 0; row < h; row++) {
                src.position(row * rowStride);
                src.get(buffer, row * w, w);
            }
        } else {
            for (int row = 0; row < h; row++) {
                int base = row * rowStride;
                for (int col = 0; col < w; col++) buffer[row * w + col] = src.get(base + col * pixelStride);
            }
        }
        busy = true;
        InputImage input = InputImage.fromByteArray(buffer, w, h, 0, InputImage.IMAGE_FORMAT_NV21);
        scanner.process(input)
                .addOnSuccessListener(barcodes -> {
                    if (closed) return;
                    List<Detected> out = new ArrayList<>();
                    for (Barcode b : barcodes) {
                        String raw = b.getRawValue();
                        float[] corners = cornersOf(b);
                        if (raw != null && corners != null) out.add(new Detected(raw, corners));
                    }
                    if (!out.isEmpty()) listener.onBarcodes(capture, out);
                })
                .addOnCompleteListener(task -> busy = false);
        return true;
    }

    void close() {
        closed = true;
        scanner.close();
    }

    private static float[] cornersOf(Barcode b) {
        Point[] points = b.getCornerPoints();
        if (points != null && points.length >= 4) {
            float[] out = new float[8];
            for (int i = 0; i < 4; i++) {
                out[2 * i] = points[i].x;
                out[2 * i + 1] = points[i].y;
            }
            return out;
        }
        Rect r = b.getBoundingBox();
        if (r == null) return null;
        return new float[] {r.left, r.top, r.right, r.top, r.right, r.bottom, r.left, r.bottom};
    }
}
