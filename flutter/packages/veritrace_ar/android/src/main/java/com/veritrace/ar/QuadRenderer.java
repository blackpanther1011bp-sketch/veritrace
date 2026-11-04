package com.veritrace.ar;

import android.graphics.Bitmap;
import android.opengl.GLES20;
import android.opengl.GLUtils;
import android.util.Log;

import java.nio.FloatBuffer;

/** Rectangle texturé placé dans l'espace (panneaux et point d'ancrage). */
final class QuadRenderer {
    private static final String TAG = "VeriTraceAR";
    private static final String VERTEX =
            "uniform mat4 u_Mvp;\n"
                    + "attribute vec4 a_Position;\n"
                    + "attribute vec2 a_TexCoord;\n"
                    + "varying vec2 v_TexCoord;\n"
                    + "void main() {\n"
                    + "  gl_Position = u_Mvp * a_Position;\n"
                    + "  v_TexCoord = a_TexCoord;\n"
                    + "}\n";
    private static final String FRAGMENT =
            "precision mediump float;\n"
                    + "uniform sampler2D u_Texture;\n"
                    + "uniform float u_Alpha;\n"
                    + "varying vec2 v_TexCoord;\n"
                    + "void main() {\n"
                    + "  gl_FragColor = texture2D(u_Texture, v_TexCoord) * u_Alpha;\n"
                    + "}\n";

    // Carré unité centré ; le haut de l'image (ligne 0 du bitmap) en haut du carré
    private final FloatBuffer positions = CameraBackground.floats(new float[] {
        -0.5f, -0.5f, 0f,
        0.5f, -0.5f, 0f,
        -0.5f, 0.5f, 0f,
        0.5f, 0.5f, 0f,
    });
    private final FloatBuffer texCoords = CameraBackground.floats(new float[] {0f, 1f, 1f, 1f, 0f, 0f, 1f, 0f});
    private int program;
    private int aPosition;
    private int aTexCoord;
    private int uMvp;
    private int uTexture;
    private int uAlpha;

    void create() {
        program = program(VERTEX, FRAGMENT);
        aPosition = GLES20.glGetAttribLocation(program, "a_Position");
        aTexCoord = GLES20.glGetAttribLocation(program, "a_TexCoord");
        uMvp = GLES20.glGetUniformLocation(program, "u_Mvp");
        uTexture = GLES20.glGetUniformLocation(program, "u_Texture");
        uAlpha = GLES20.glGetUniformLocation(program, "u_Alpha");
    }

    /** Dessine la texture (couleurs prémultipliées) avec la matrice projection × vue × modèle. */
    void draw(int texture, float[] mvp, float alpha) {
        if (texture == 0) return;
        positions.rewind();
        texCoords.rewind();
        GLES20.glUseProgram(program);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texture);
        GLES20.glUniform1i(uTexture, 0);
        GLES20.glUniform1f(uAlpha, alpha);
        GLES20.glUniformMatrix4fv(uMvp, 1, false, mvp, 0);
        GLES20.glVertexAttribPointer(aPosition, 3, GLES20.GL_FLOAT, false, 0, positions);
        GLES20.glVertexAttribPointer(aTexCoord, 2, GLES20.GL_FLOAT, false, 0, texCoords);
        GLES20.glEnableVertexAttribArray(aPosition);
        GLES20.glEnableVertexAttribArray(aTexCoord);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(aPosition);
        GLES20.glDisableVertexAttribArray(aTexCoord);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, 0);
    }

    /** Envoie l'image à la carte graphique (nouvelle texture si `texture` vaut 0) et renvoie la texture. */
    static int upload(Bitmap bitmap, int texture) {
        int id = texture;
        if (id == 0) {
            int[] ids = new int[1];
            GLES20.glGenTextures(1, ids, 0);
            id = ids[0];
        }
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, id);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR_MIPMAP_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0);
        GLES20.glGenerateMipmap(GLES20.GL_TEXTURE_2D);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, 0);
        return id;
    }

    static void delete(int texture) {
        if (texture != 0) GLES20.glDeleteTextures(1, new int[] {texture}, 0);
    }

    static int program(String vertexSource, String fragmentSource) {
        int vertex = shader(GLES20.GL_VERTEX_SHADER, vertexSource);
        int fragment = shader(GLES20.GL_FRAGMENT_SHADER, fragmentSource);
        int program = GLES20.glCreateProgram();
        GLES20.glAttachShader(program, vertex);
        GLES20.glAttachShader(program, fragment);
        GLES20.glLinkProgram(program);
        int[] status = new int[1];
        GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, status, 0);
        if (status[0] == 0) Log.e(TAG, "Programme OpenGL : " + GLES20.glGetProgramInfoLog(program));
        GLES20.glDeleteShader(vertex);
        GLES20.glDeleteShader(fragment);
        return program;
    }

    private static int shader(int type, String source) {
        int shader = GLES20.glCreateShader(type);
        GLES20.glShaderSource(shader, source);
        GLES20.glCompileShader(shader);
        int[] status = new int[1];
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0);
        if (status[0] == 0) Log.e(TAG, "Shader OpenGL : " + GLES20.glGetShaderInfoLog(shader));
        return shader;
    }
}
