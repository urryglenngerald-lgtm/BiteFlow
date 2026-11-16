package mt.biteflow.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** BiteFlow is a web app; this screen just shows it full-screen, so menus update without a new APK. */
public class MainActivity extends Activity {
  private static final String HOME = "https://urryglenngerald-lgtm.github.io/BiteFlow/";
  private WebView web;

  @Override protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    web = new WebView(this);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    web.setBackgroundColor(0xFFF7F3E8);
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if ("urryglenngerald-lgtm.github.io".equals(u.getHost())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
        return true;
      }
    });
    setContentView(web);
    if (saved != null) web.restoreState(saved); else web.loadUrl(HOME);
  }

  @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

  @Override public void onBackPressed() {
    if (web.canGoBack()) web.goBack(); else super.onBackPressed();
  }
}
