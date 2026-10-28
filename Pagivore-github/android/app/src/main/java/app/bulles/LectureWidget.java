package app.bulles;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Widget d'accueil : livre en cours, page, chrono et bouton pour lire. */
public class LectureWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        majTous(c);
    }

    /** Redessine tous les widgets avec le livre envoyé par l'appli (MainActivity.Pont.widget). */
    static void majTous(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_lecture);
        String id = "";
        try {
            JSONObject o = new JSONObject(c.getSharedPreferences("widget", Context.MODE_PRIVATE).getString("livre", "{}"));
            id = o.optString("id");
            int page = o.optInt("page"), total = o.optInt("total");
            long chrono = o.optLong("chrono");
            v.setTextViewText(R.id.titre, id.isEmpty() ? "Aucun livre en cours" : o.optString("title"));
            v.setTextViewText(R.id.pages, id.isEmpty() ? "Lance une lecture dans Pagivore"
                    : total > 0 ? "Page " + page + " sur " + total + " (" + (page * 100 / total) + " %)" : "Page " + page);
            v.setProgressBar(R.id.progression, Math.max(total, 1), Math.min(page, Math.max(total, 1)), false);
            v.setViewVisibility(R.id.progression, total > 0 ? View.VISIBLE : View.GONE);
            // Chrono qui tourne tout seul sur l'écran d'accueil
            long base = SystemClock.elapsedRealtime() - (chrono > 0 ? System.currentTimeMillis() - chrono : 0);
            v.setChronometer(R.id.chrono, base, null, chrono > 0);
            v.setTextViewText(R.id.bouton, chrono > 0 ? "Arrêter" : "Lire");
        } catch (Exception e) {
            v.setTextViewText(R.id.titre, "Aucun livre en cours");
        }

        Intent ouvrir = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.widget, PendingIntent.getActivity(c, 0, ouvrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        if (!id.isEmpty()) {
            Intent lire = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra("widget_chrono", id);
            v.setOnClickPendingIntent(R.id.bouton, PendingIntent.getActivity(c, 1, lire, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        AppWidgetManager.getInstance(c).updateAppWidget(new ComponentName(c, LectureWidget.class), v);
    }
}
