package com.dsfr.finance

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var errorView: FrameLayout
    private lateinit var errorMsg: TextView

    companion object {
        private const val APP_URL = "https://finance-frontend-3tf6.onrender.com"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView      = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar  = findViewById(R.id.progressBar)
        errorView    = findViewById(R.id.errorView)
        errorMsg     = findViewById(R.id.errorMsg)

        // WebView settings
        webView.settings.apply {
            javaScriptEnabled      = true
            domStorageEnabled      = true
            databaseEnabled        = true
            loadWithOverviewMode   = true
            useWideViewPort        = true
            builtInZoomControls    = false
            displayZoomControls    = false
            setSupportZoom(false)
            cacheMode              = WebSettings.LOAD_DEFAULT
            mixedContentMode       = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString        = userAgentString + " DSFRFinanceApp/1.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                progressBar.visibility = View.VISIBLE
                errorView.visibility   = View.GONE
            }
            override fun onPageFinished(view: WebView, url: String) {
                progressBar.visibility   = View.GONE
                swipeRefresh.isRefreshing = false
            }
            override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
                if (req.isForMainFrame) {
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    errorView.visibility   = View.VISIBLE
                    errorMsg.text = when {
                        !isConnected() -> "Sem conexão com a internet.\nVerifique sua rede e tente novamente."
                        else           -> "Não foi possível carregar o aplicativo.\nTente novamente."
                    }
                }
            }
            // Ensure all navigation stays inside the WebView
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progressBar.progress = newProgress
            }
        }

        // Pull-to-refresh
        swipeRefresh.setColorSchemeColors(getColor(R.color.brand_green))
        swipeRefresh.setOnRefreshListener { webView.reload() }

        // Retry button
        findViewById<View>(R.id.btnRetry).setOnClickListener { loadApp() }

        // Restore state or load fresh
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            loadApp()
        }
    }

    private fun loadApp() {
        errorView.visibility = View.GONE
        if (isConnected()) {
            webView.loadUrl(APP_URL)
        } else {
            progressBar.visibility = View.GONE
            errorView.visibility   = View.VISIBLE
            errorMsg.text = "Sem conexão com a internet.\nVerifique sua rede e tente novamente."
        }
    }

    private fun isConnected(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val cap = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }
}
