package app.bulles;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Affiche l'appli web Bulles (assets/index.html) dans un WebView. */
public class MainActivity extends Activity {
    // Adresse https locale : les sites (AniList, Open Library...) acceptent ses requêtes
    private static final String HOST = "appassets.androidplatform.net";
    private static final int CHOIX_FICHIER = 1;

    private WebView web;
    private ValueCallback<Uri[]> fichierCallback;
    private static final int PERMISSION_CAMERA = 2;
    private android.webkit.PermissionRequest demandeCamera;

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != PERMISSION_CAMERA || demandeCamera == null) return;
        if (results.length > 0 && results[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            demandeCamera.grant(demandeCamera.getResources());
        } else {
            demandeCamera.deny();
        }
        demandeCamera = null;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        android.widget.FrameLayout cadre = new android.widget.FrameLayout(this);
        cadre.setBackgroundColor(0xFF121116);
        cadre.addView(web);
        setContentView(cadre);

        // Pas de contenu sous la barre d'état ni sous les boutons de navigation
        cadre.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets b = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsets.CONSUMED;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // localStorage = la collection

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("api.mangadex.org".equals(url.getHost()) && "GET".equals(request.getMethod())) return viaAndroid(url);
                return loader.shouldInterceptRequest(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageChargee = true;
                lancerWidget();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost())) return false;
                // Liens vers Amazon, Fnac, AniList... : ouverts dans le navigateur
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "Aucune appli pour ouvrir ce lien", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // Caméra pour scanner les codes-barres
            @Override
            public void onPermissionRequest(android.webkit.PermissionRequest request) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        request.grant(request.getResources());
                    } else {
                        demandeCamera = request;
                        requestPermissions(new String[]{android.Manifest.permission.CAMERA}, PERMISSION_CAMERA);
                    }
                });
            }

            // Bouton « Importer » : choisir un fichier de sauvegarde
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fichierCallback != null) fichierCallback.onReceiveValue(null);
                fichierCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                startActivityForResult(Intent.createChooser(i, "Choisir une sauvegarde"), CHOIX_FICHIER);
                return true;
            }
        });

        web.addJavascriptInterface(new Pont(), "BullesAndroid");

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::retour);
        }

        livreWidget = getIntent().getStringExtra("widget_chrono");
        if (savedInstanceState == null) web.loadUrl("https://" + HOST + "/assets/index.html");
        else web.restoreState(savedInstanceState);
    }

    /** MangaDex n'accepte les appels du navigateur que depuis localhost : Android fait l'appel à sa place. */
    private static WebResourceResponse viaAndroid(Uri url) {
        try {
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url.toString()).openConnection();
            c.setRequestProperty("User-Agent", "Bulles/1.0 (Android)");
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            int code = c.getResponseCode();
            java.util.Map<String, String> h = new java.util.HashMap<>();
            h.put("Access-Control-Allow-Origin", "*");
            return new WebResourceResponse("application/json", "utf-8", code, code < 400 ? "OK" : "Erreur", h,
                    code < 400 ? c.getInputStream() : c.getErrorStream());
        } catch (Exception e) {
            return null;
        }
    }

    /** Retour : ferme la fenêtre ouverte dans l'appli, sinon quitte. */
    private void retour() {
        web.evaluateJavascript(
                "(function(){var m=document.getElementById('modal');if(m&&m.open){m.close();return true}return false})()",
                r -> { if (!"true".equals(r)) finish(); });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        retour();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == CONNEXION_GOOGLE) {
            try {
                com.google.android.gms.auth.api.identity.AuthorizationResult r =
                        com.google.android.gms.auth.api.identity.Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(data);
                renvoyerJeton(r.getAccessToken(), null);
            } catch (Exception e) {
                renvoyerJeton(null, resultCode == RESULT_OK ? e.getMessage() : "annulée");
            }
            return;
        }
        if (requestCode != CHOIX_FICHIER || fichierCallback == null) return;
        Uri[] res = (resultCode == RESULT_OK && data != null && data.getData() != null)
                ? new Uri[]{data.getData()} : null;
        fichierCallback.onReceiveValue(res);
        fichierCallback = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    /* ---------- Bouton du widget : ouvrir le livre et lancer le chrono ---------- */
    private String livreWidget;
    private boolean pageChargee;

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        livreWidget = intent.getStringExtra("widget_chrono");
        lancerWidget();
    }

    private void lancerWidget() {
        if (livreWidget == null || !pageChargee) return;
        web.evaluateJavascript("window.widgetChrono&&widgetChrono(" + org.json.JSONObject.quote(livreWidget) + ")", null);
        livreWidget = null;
    }

    /* ---------- Connexion Google (Drive, dossier caché de l'appli) ---------- */
    private static final int CONNEXION_GOOGLE = 3;

    private void demanderJeton(boolean interactif) {
        com.google.android.gms.auth.api.identity.AuthorizationRequest req =
                com.google.android.gms.auth.api.identity.AuthorizationRequest.builder()
                        .setRequestedScopes(java.util.Collections.singletonList(
                                new com.google.android.gms.common.api.Scope("https://www.googleapis.com/auth/drive.appdata")))
                        .build();
        com.google.android.gms.auth.api.identity.Identity.getAuthorizationClient(this).authorize(req)
                .addOnSuccessListener(res -> {
                    if (!res.hasResolution()) { renvoyerJeton(res.getAccessToken(), null); return; }
                    if (!interactif) { renvoyerJeton(null, "connexion requise"); return; }
                    try {
                        startIntentSenderForResult(res.getPendingIntent().getIntentSender(), CONNEXION_GOOGLE, null, 0, 0, 0);
                    } catch (Exception e) {
                        renvoyerJeton(null, e.getMessage());
                    }
                })
                .addOnFailureListener(e -> renvoyerJeton(null, e.getMessage()));
    }

    private void renvoyerJeton(String jeton, String erreur) {
        runOnUiThread(() -> web.evaluateJavascript("window.__gcb&&__gcb("
                + (jeton == null ? "null" : org.json.JSONObject.quote(jeton)) + ","
                + (erreur == null ? "null" : org.json.JSONObject.quote(erreur)) + ")", null));
    }

    /** Appelé par app.js : enregistre la sauvegarde dans Téléchargements. */
    private class Pont {
        @JavascriptInterface
        public void googleToken(boolean interactif) {
            runOnUiThread(() -> demanderJeton(interactif));
        }

        @JavascriptInterface
        public void widget(String json) {
            getSharedPreferences("widget", MODE_PRIVATE).edit().putString("livre", json).apply();
            LectureWidget.majTous(MainActivity.this);
        }

        @JavascriptInterface
        public void enregistrer(String nom, String contenu) {
            try {
                byte[] data = contenu.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, nom);
                    v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) { out.write(data); }
                    message("Sauvegarde enregistrée dans Téléchargements");
                } else {
                    File f = new File(getExternalFilesDir(null), nom);
                    try (FileOutputStream out = new FileOutputStream(f)) { out.write(data); }
                    message("Sauvegarde enregistrée : " + f.getAbsolutePath());
                }
            } catch (Exception e) {
                message("Impossible d'enregistrer la sauvegarde");
            }
        }

        private void message(String m) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, m, Toast.LENGTH_LONG).show());
        }
    }
}
