'use strict';
/* ==================================================================
   AZRA.CO — script.js
   Frontend logic: jelly UI, Android project generator, ZIP export,
   backend connectivity (Termux compiler), persistent history.
   (c) byazradev
   ================================================================== */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   1. SPRING PHYSICS + MAGNETIC JELLY SYSTEM
   ============================================================ */
function Spring(value, stiffness, damping){
  this.value=value; this.target=value; this.velocity=0;
  this.stiffness=stiffness; this.damping=damping;
}
Spring.prototype.set=function(t){ this.target=t; };
Spring.prototype.update=function(){
  const force=(this.target-this.value)*this.stiffness;
  this.velocity=(this.velocity+force)*this.damping;
  this.value+=this.velocity;
  return this.value;
};

function JellyEl(el, opts){
  opts=opts||{};
  this.el=el;
  this.radius=opts.radius||90;
  this.pull=opts.pull||0.32;
  this.x=new Spring(0,.18,.78);
  this.y=new Spring(0,.18,.78);
  this.s=new Spring(1,.22,.7);
  const self=this;
  el.addEventListener('pointerdown', function(){ self.s.set(.9); });
  el.addEventListener('pointerup', function(){ self._bounce(); });
  el.addEventListener('pointercancel', function(){ self._bounce(); });
  JellySystem.add(this);
}
JellyEl.prototype._bounce=function(){
  const self=this;
  this.s.set(1.06);
  setTimeout(function(){ self.s.set(1); }, 100);
};
JellyEl.prototype.checkMagnet=function(mx,my){
  if(REDUCED_MOTION) return;
  const r=this.el.getBoundingClientRect();
  const cx=r.left+r.width/2, cy=r.top+r.height/2;
  const dx=mx-cx, dy=my-cy;
  const dist=Math.hypot(dx,dy);
  if(dist<this.radius){ this.x.set(dx*this.pull); this.y.set(dy*this.pull); }
  else { this.x.set(0); this.y.set(0); }
};
JellyEl.prototype.render=function(){
  this.x.update(); this.y.update(); this.s.update();
  this.el.style.transform='translate('+this.x.value.toFixed(2)+'px,'+this.y.value.toFixed(2)+'px) scale('+this.s.value.toFixed(3)+')';
};

const JellySystem={
  items:[],
  add:function(i){ this.items.push(i); },
  init:function(){
    const self=this;
    document.addEventListener('pointermove', function(e){
      for(let i=0;i<self.items.length;i++) self.items[i].checkMagnet(e.clientX, e.clientY);
    });
    this.loop();
  },
  loop:function(){
    const self=this;
    for(let i=0;i<this.items.length;i++) this.items[i].render();
    requestAnimationFrame(function(){ self.loop(); });
  }
};

/* ============================================================
   2. UTILITIES
   ============================================================ */
function escapeXml(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function escapeJavaString(str){ return String(str).replace(/\\/g,'\\\\').replace(/"/g,'\\"'); }
function escapeHtml(str){ const d=document.createElement('div'); d.textContent=String(str==null?'':str); return d.innerHTML; }
function slugify(str){
  let s=String(str||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!s) s='app';
  if(!/^[a-z]/.test(s)) s='a'+s;
  return s;
}
function capitalize(s){ s=String(s||''); return s.charAt(0).toUpperCase()+s.slice(1); }
function formatBytes(b){
  if(b<1024) return b+' B';
  if(b<1024*1024) return (b/1024).toFixed(1)+' KB';
  return (b/1024/1024).toFixed(1)+' MB';
}
function timeAgo(ts){
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60) return 'baru saja';
  if(s<3600) return Math.floor(s/60)+' menit lalu';
  if(s<86400) return Math.floor(s/3600)+' jam lalu';
  return Math.floor(s/86400)+' hari lalu';
}
function isValidUrl(str){
  try{ const u=new URL(str); return u.protocol==='http:'||u.protocol==='https:'; }catch(e){ return false; }
}
function isValidPackageSuffix(str){ return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(str); }
function shadeColor(hex, percent){
  const num=parseInt(String(hex).replace('#',''),16);
  let r=(num>>16)+Math.round(2.55*percent);
  let g=((num>>8)&0xff)+Math.round(2.55*percent);
  let b=(num&0xff)+Math.round(2.55*percent);
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return '#'+(r<<16|g<<8|b).toString(16).padStart(6,'0');
}
function wait(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function loadImage(src){
  return new Promise(function(resolve,reject){
    const img=new Image();
    img.onload=function(){ resolve(img); };
    img.onerror=function(){ reject(new Error('Gagal load gambar')); };
    img.src=src;
  });
}
let toastTimer;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){ t.classList.remove('show'); }, 2800);
}

/* ============================================================
   3. ICON GENERATOR (canvas) — auto + custom upload
   ============================================================ */
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function drawIcon(canvas, name, color, size){
  canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,size,size);
  const grad=ctx.createLinearGradient(0,0,size,size);
  grad.addColorStop(0,color);
  grad.addColorStop(1,shadeColor(color,-26));
  roundRect(ctx,0,0,size,size,size*0.22);
  ctx.fillStyle=grad;
  ctx.fill();
  const sheen=ctx.createLinearGradient(0,0,0,size);
  sheen.addColorStop(0,'rgba(255,255,255,0.30)');
  sheen.addColorStop(0.55,'rgba(255,255,255,0)');
  roundRect(ctx,0,0,size,size,size*0.22);
  ctx.fillStyle=sheen;
  ctx.fill();
  const initial=(String(name||'A')).trim().charAt(0).toUpperCase()||'A';
  ctx.fillStyle='#ffffff';
  ctx.font='700 '+(size*0.46)+'px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(initial, size/2, size*0.54);
}
function drawIconFromImage(canvas, imgEl, size){
  canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,size,size);
  roundRect(ctx,0,0,size,size,size*0.22);
  ctx.save();
  ctx.clip();
  const iw=imgEl.naturalWidth||imgEl.width, ih=imgEl.naturalHeight||imgEl.height;
  const scale=Math.max(size/iw, size/ih);
  const sw=size/scale, sh=size/scale;
  const sx=(iw-sw)/2, sy=(ih-sh)/2;
  ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, size, size);
  ctx.restore();
}
async function drawIconAsync(canvas, name, color, size, customDataUrl){
  if(customDataUrl){
    try{ const img=await loadImage(customDataUrl); drawIconFromImage(canvas, img, size); return; }
    catch(e){ /* fall through to generated icon */ }
  }
  drawIcon(canvas, name, color, size);
}
async function generateIconPngs(name, color, customDataUrl){
  const densities={'mipmap-mdpi':48,'mipmap-hdpi':72,'mipmap-xhdpi':96,'mipmap-xxhdpi':144,'mipmap-xxxhdpi':192};
  const out={};
  let img=null;
  if(customDataUrl){ try{ img=await loadImage(customDataUrl); }catch(e){ img=null; } }
  const dirs=Object.keys(densities);
  for(let i=0;i<dirs.length;i++){
    const dir=dirs[i];
    const c=document.createElement('canvas');
    if(img) drawIconFromImage(c, img, densities[dir]); else drawIcon(c, name, color, densities[dir]);
    out[dir]=c.toDataURL('image/png').split(',')[1];
  }
  return out;
}

/* ============================================================
   4. ANDROID PROJECT GENERATOR
   ============================================================ */
function genSettingsGradle(cfg){
  return 'pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\n\nrootProject.name = "'+escapeJavaString(cfg.appName)+'"\ninclude \':app\'\n';
}
function genRootBuildGradle(){
  return "// Top-level build file\nplugins {\n    id 'com.android.application' version '9.2.0' apply false\n}\n";
}
function genGradleProperties(){
  return 'org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nandroid.nonTransitiveRClass=true\n';
}
function genWrapperProps(){
  return 'distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-9.5.1-bin.zip\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n';
}
function genAppBuildGradle(cfg){
  const deps=["    implementation 'androidx.appcompat:appcompat:1.7.0'"];
  if(cfg.refresh) deps.push("    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'");
  if(cfg.forceDark) deps.push("    implementation 'androidx.webkit:webkit:1.12.1'");
  if(cfg.fileUpload) deps.push("    implementation 'androidx.activity:activity:1.9.3'");
  return "plugins {\n    id 'com.android.application'\n}\n\nandroid {\n    namespace '"+cfg.packageId+"'\n    compileSdk 36\n\n    defaultConfig {\n        applicationId \""+cfg.packageId+"\"\n        minSdk 24\n        targetSdk 36\n        versionCode "+cfg.versionCode+"\n        versionName \""+escapeJavaString(cfg.versionName)+"\"\n    }\n\n    buildTypes {\n        release {\n            minifyEnabled false\n            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'\n        }\n    }\n\n    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }\n}\n\ndependencies {\n"+deps.join('\n')+"\n}\n";
}
function genManifest(cfg){
  const permissions=['<uses-permission android:name="android.permission.INTERNET" />','<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />'];
  if(cfg.permCamera) permissions.push('<uses-permission android:name="android.permission.CAMERA" />');
  if(cfg.permLocation){ permissions.push('<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />'); permissions.push('<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />'); }
  if(cfg.permMic) permissions.push('<uses-permission android:name="android.permission.RECORD_AUDIO" />');
  if(cfg.permStorage){ permissions.push('<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />'); permissions.push('<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />'); }
  const features=[];
  if(cfg.permCamera) features.push('<uses-feature android:name="android.hardware.camera" android:required="false" />');
  const orientationAttr=(cfg.orientation && cfg.orientation!=='unspecified') ? '\n            android:screenOrientation="'+cfg.orientation+'"' : '';
  const featureBlock = features.length ? '\n\n    '+features.join('\n    ') : '';
  return '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n\n    '+permissions.join('\n    ')+featureBlock+'\n\n    <application\n        android:allowBackup="true"\n        android:icon="@mipmap/ic_launcher"\n        android:label="@string/app_name"\n        android:theme="@style/Theme.AzraApp"\n        android:usesCleartextTraffic="true">\n\n        <activity\n            android:name=".MainActivity"\n            android:exported="true"'+orientationAttr+'\n            android:configChanges="orientation|screenSize|keyboardHidden">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n\n</manifest>\n';
}
function genActivityMainXml(cfg){
  let webviewTag;
  if(cfg.refresh){
    webviewTag='    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout\n        android:id="@+id/swipeRefresh"\n        android:layout_width="match_parent"\n        android:layout_height="match_parent">\n\n        <WebView\n            android:id="@+id/webview"\n            android:layout_width="match_parent"\n            android:layout_height="match_parent"/>\n\n    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>\n';
  } else {
    webviewTag='    <WebView\n        android:id="@+id/webview"\n        android:layout_width="match_parent"\n        android:layout_height="match_parent"/>\n';
  }
  const progressTag = cfg.loadingBar
    ? '\n    <ProgressBar\n        android:id="@+id/progressBar"\n        style="?android:attr/progressBarStyleHorizontal"\n        android:layout_width="match_parent"\n        android:layout_height="3dp"\n        android:layout_gravity="top"\n        android:max="100"\n        android:progressTint="@color/colorPrimary"\n        android:visibility="gone"/>\n'
    : '';
  const splashTag = cfg.splash
    ? '\n    <LinearLayout\n        android:id="@+id/splashOverlay"\n        android:layout_width="match_parent"\n        android:layout_height="match_parent"\n        android:orientation="vertical"\n        android:gravity="center"\n        android:background="@color/colorPrimary">\n\n        <ImageView\n            android:layout_width="96dp"\n            android:layout_height="96dp"\n            android:src="@mipmap/ic_launcher"/>\n\n    </LinearLayout>\n'
    : '';
  return '<?xml version="1.0" encoding="utf-8"?>\n<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"\n    android:layout_width="match_parent"\n    android:layout_height="match_parent">\n\n'+webviewTag+progressTag+splashTag+'\n</FrameLayout>\n';
}
function genMainActivity(cfg){
  const pkg=cfg.packageId;
  const loadTarget = cfg.mode==='url' ? '"'+escapeJavaString(cfg.sourceUrl)+'"' : '"file:///android_asset/index.html"';
  let originHost='';
  if(cfg.mode==='url'){ try{ originHost=new URL(cfg.sourceUrl).hostname; }catch(e){ originHost=''; } }

  const imports=new Set(['android.os.Bundle','android.webkit.WebView','android.webkit.WebViewClient','android.webkit.WebChromeClient','android.webkit.WebSettings','androidx.appcompat.app.AppCompatActivity']);
  const fields=['private WebView webView;'];
  if(cfg.loadingBar||cfg.splash) imports.add('android.view.View');
  if(cfg.refresh){ imports.add('androidx.swiperefreshlayout.widget.SwipeRefreshLayout'); fields.push('private SwipeRefreshLayout swipeRefresh;'); }
  if(cfg.loadingBar){ imports.add('android.widget.ProgressBar'); fields.push('private ProgressBar progressBar;'); }
  if(cfg.splash){ fields.push('private View splashOverlay;'); }
  if(cfg.exitConfirm){ imports.add('android.widget.Toast'); fields.push('private long lastBackPress = 0;'); }
  if(cfg.fileUpload){
    imports.add('android.webkit.ValueCallback'); imports.add('android.net.Uri'); imports.add('android.content.Intent');
    imports.add('androidx.activity.result.ActivityResultLauncher'); imports.add('androidx.activity.result.contract.ActivityResultContracts');
    fields.push('private ValueCallback<Uri[]> filePathCallback;');
    fields.push('private ActivityResultLauncher<Intent> fileChooserLauncher;');
  }
  if(cfg.download){
    imports.add('android.app.DownloadManager'); imports.add('android.net.Uri'); imports.add('android.os.Environment');
    imports.add('android.webkit.URLUtil'); imports.add('android.widget.Toast');
  }
  const needsPerm = cfg.permCamera||cfg.permLocation||cfg.permMic||cfg.permStorage;
  if(needsPerm){ imports.add('android.Manifest'); imports.add('android.content.pm.PackageManager'); imports.add('androidx.core.app.ActivityCompat'); imports.add('androidx.core.content.ContextCompat'); }
  if(cfg.permCamera||cfg.permMic) imports.add('android.webkit.PermissionRequest');
  const wantsExternalLink = cfg.externalLink==='browser' && cfg.mode==='url' && originHost;
  if(wantsExternalLink){ imports.add('android.net.Uri'); imports.add('android.content.Intent'); imports.add('android.content.ActivityNotFoundException'); imports.add('android.webkit.WebResourceRequest'); }
  if(cfg.forceDark){ imports.add('androidx.webkit.WebSettingsCompat'); imports.add('androidx.webkit.WebViewFeature'); }

  const onPageFinishedBody=[];
  if(cfg.loadingBar) onPageFinishedBody.push('if (progressBar != null) progressBar.setVisibility(View.GONE);');
  if(cfg.splash) onPageFinishedBody.push('if (splashOverlay != null) { splashOverlay.animate().alpha(0f).setDuration(280).withEndAction(() -> splashOverlay.setVisibility(View.GONE)).start(); }');
  if(cfg.refresh) onPageFinishedBody.push('if (swipeRefresh != null) swipeRefresh.setRefreshing(false);');

  const clientMethods=[];
  if(onPageFinishedBody.length){
    clientMethods.push('@Override\n            public void onPageFinished(WebView view, String url) {\n                super.onPageFinished(view, url);\n                '+onPageFinishedBody.join('\n                ')+'\n            }');
  }
  if(wantsExternalLink){
    clientMethods.push('@Override\n            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {\n                Uri uri = request.getUrl();\n                if (uri.getHost() != null && !uri.getHost().contains("'+escapeJavaString(originHost)+'")) {\n                    try {\n                        startActivity(new Intent(Intent.ACTION_VIEW, uri));\n                        return true;\n                    } catch (ActivityNotFoundException e) {\n                        return false;\n                    }\n                }\n                return false;\n            }');
  }

  const chromeMethods=[];
  if(cfg.loadingBar){
    chromeMethods.push('@Override\n            public void onProgressChanged(WebView view, int newProgress) {\n                if (progressBar != null) {\n                    progressBar.setProgress(newProgress);\n                    progressBar.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);\n                }\n            }');
  }
  if(cfg.fileUpload){
    chromeMethods.push('@Override\n            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {\n                filePathCallback = callback;\n                try {\n                    fileChooserLauncher.launch(params.createIntent());\n                } catch (Exception e) {\n                    filePathCallback = null;\n                    return false;\n                }\n                return true;\n            }');
  }
  if(cfg.permCamera||cfg.permMic){
    const inner=[];
    if(cfg.permCamera) inner.push('if (r.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) granted.add(r);');
    if(cfg.permMic) inner.push('if (r.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) granted.add(r);');
    chromeMethods.push('@Override\n            public void onPermissionRequest(PermissionRequest request) {\n                java.util.List<String> granted = new java.util.ArrayList<>();\n                for (String r : request.getResources()) {\n                    '+inner.join('\n                    ')+'\n                }\n                if (!granted.isEmpty()) request.grant(granted.toArray(new String[0]));\n                else request.deny();\n            }');
  }

  const oc=[];
  oc.push('setContentView(R.layout.activity_main);');
  oc.push('');
  if(cfg.refresh) oc.push('swipeRefresh = findViewById(R.id.swipeRefresh);');
  oc.push('webView = findViewById(R.id.webview);');
  if(cfg.loadingBar) oc.push('progressBar = findViewById(R.id.progressBar);');
  if(cfg.splash) oc.push('splashOverlay = findViewById(R.id.splashOverlay);');
  if(needsPerm){ oc.push(''); oc.push('requestNeededPermissions();'); }
  if(cfg.fileUpload){
    oc.push('');
    oc.push('fileChooserLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {');
    oc.push('    if (filePathCallback == null) return;');
    oc.push('    Uri[] results = null;');
    oc.push('    if (result.getResultCode() == RESULT_OK && result.getData() != null && result.getData().getDataString() != null) {');
    oc.push('        results = new Uri[]{ Uri.parse(result.getData().getDataString()) };');
    oc.push('    }');
    oc.push('    filePathCallback.onReceiveValue(results);');
    oc.push('    filePathCallback = null;');
    oc.push('});');
  }
  oc.push('');
  oc.push('WebSettings settings = webView.getSettings();');
  oc.push('settings.setJavaScriptEnabled(true);');
  oc.push('settings.setDomStorageEnabled(true);');
  oc.push('settings.setLoadWithOverviewMode(true);');
  oc.push('settings.setUseWideViewPort(true);');
  oc.push('settings.setSupportZoom('+(cfg.zoom?'true':'false')+');');
  oc.push('settings.setBuiltInZoomControls('+(cfg.zoom?'true':'false')+');');
  oc.push('settings.setDisplayZoomControls(false);');
  if(cfg.offline) oc.push('settings.setCacheMode(WebSettings.LOAD_DEFAULT);');
  if(cfg.fileUpload) oc.push('settings.setAllowFileAccess(true);');
  if(cfg.userAgent) oc.push('settings.setUserAgentString("'+escapeJavaString(cfg.userAgent)+'");');
  if(cfg.forceDark){
    oc.push('');
    oc.push('if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {');
    oc.push('    WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true);');
    oc.push('}');
  }
  oc.push('');
  oc.push('webView.setWebViewClient(new WebViewClient() {');
  if(clientMethods.length) oc.push('            '+clientMethods.join('\n\n            '));
  oc.push('        });');
  oc.push('');
  oc.push('webView.setWebChromeClient(new WebChromeClient() {');
  if(chromeMethods.length) oc.push('            '+chromeMethods.join('\n\n            '));
  oc.push('        });');
  if(cfg.download){
    oc.push('');
    oc.push('webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {');
    oc.push('    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));');
    oc.push('    request.setMimeType(mimeType);');
    oc.push('    String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);');
    oc.push('    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);');
    oc.push('    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);');
    oc.push('    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);');
    oc.push('    if (dm != null) dm.enqueue(request);');
    oc.push('    Toast.makeText(this, "Mengunduh " + filename, Toast.LENGTH_SHORT).show();');
    oc.push('});');
  }
  oc.push('');
  oc.push('webView.loadUrl('+loadTarget+');');

  const extraMethods=[];
  if(needsPerm){
    const permList=[];
    if(cfg.permCamera) permList.push('Manifest.permission.CAMERA');
    if(cfg.permLocation) permList.push('Manifest.permission.ACCESS_FINE_LOCATION');
    if(cfg.permMic) permList.push('Manifest.permission.RECORD_AUDIO');
    if(cfg.permStorage) permList.push('Manifest.permission.WRITE_EXTERNAL_STORAGE');
    extraMethods.push('private void requestNeededPermissions() {\n        String[] needed = { '+permList.join(', ')+' };\n        java.util.List<String> toRequest = new java.util.ArrayList<>();\n        for (String p : needed) {\n            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {\n                toRequest.add(p);\n            }\n        }\n        if (!toRequest.isEmpty()) {\n            ActivityCompat.requestPermissions(this, toRequest.toArray(new String[0]), 1001);\n        }\n    }');
  }

  let onBackPressedBody;
  if(cfg.exitConfirm){
    onBackPressedBody='if (webView.canGoBack()) {\n            webView.goBack();\n        } else if (lastBackPress + 2000 > System.currentTimeMillis()) {\n            super.onBackPressed();\n        } else {\n            lastBackPress = System.currentTimeMillis();\n            Toast.makeText(this, "Tekan sekali lagi untuk keluar", Toast.LENGTH_SHORT).show();\n        }';
  } else {
    onBackPressedBody='if (webView.canGoBack()) {\n            webView.goBack();\n        } else {\n            super.onBackPressed();\n        }';
  }

  const importLines=Array.from(imports).sort().map(function(i){ return 'import '+i+';'; }).join('\n');
  const fieldLines=fields.map(function(f){ return '    '+f; }).join('\n');
  const ocLines=oc.map(function(l){ return l===''?'':'        '+l; }).join('\n');
  const extraMethodLines=extraMethods.length ? '\n\n    '+extraMethods.join('\n\n    ') : '';

  return 'package '+pkg+';\n\n'+importLines+'\n\npublic class MainActivity extends AppCompatActivity {\n\n'+fieldLines+'\n\n    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n'+ocLines+'\n    }\n\n    @Override\n    public void onBackPressed() {\n        '+onBackPressedBody+'\n    }'+extraMethodLines+'\n}\n';
}
function genStrings(cfg){ return '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">'+escapeXml(cfg.appName)+'</string>\n</resources>\n'; }
function genColors(cfg){ return '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="colorPrimary">'+cfg.color+'</color>\n    <color name="colorPrimaryDark">'+shadeColor(cfg.color,-20)+'</color>\n    <color name="colorBackground">#000000</color>\n</resources>\n'; }
function genThemes(){ return '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="Theme.AzraApp" parent="Theme.AppCompat.Light.NoActionBar">\n        <item name="colorPrimary">@color/colorPrimary</item>\n        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>\n        <item name="android:statusBarColor">@color/colorPrimaryDark</item>\n        <item name="android:windowBackground">@color/colorBackground</item>\n    </style>\n</resources>\n'; }
function genReadme(cfg){
  const sumber = cfg.mode==='url' ? cfg.sourceUrl : 'File HTML yang di-upload ('+(cfg.htmlFileName||'index.html')+')';
  return '# '+cfg.appName+'\n\nProject Android ini dibuat otomatis oleh **azra.co**.\n\n- **Package ID:** `'+cfg.packageId+'`\n- **Versi:** '+cfg.versionName+' (code '+cfg.versionCode+')\n- **Sumber:** '+sumber+'\n- **Dibuat:** '+new Date().toLocaleString('id-ID')+'\n\n## Cara Build APK\n\n### Opsi 1 — Android Studio (paling mudah)\n1. Extract file .zip ini.\n2. Buka Android Studio -> Open -> pilih folder hasil extract.\n3. Tunggu Gradle sync selesai.\n4. Klik Run, atau Build -> Build Bundle(s) / APK(s) -> Build APK(s).\n5. File .apk ada di `app/build/outputs/apk/debug/`.\n\n### Opsi 2 — Termux / Command Line\nJalankan `setup_termux.sh` sekali (lihat paket azra.co), lalu:\n```\ngradle assembleDebug\n```\nFile hasil ada di `app/build/outputs/apk/debug/app-debug.apk`.\n\n### Opsi 3 — Backend azra.co (otomatis)\nJalankan `backend.py` di Termux dan pakai tombol "Compile Langsung ke .APK" di website — project ini akan dikirim otomatis dan APK jadi tanpa command manual.\n\n## Kustomisasi\nIkon default dibuat dari inisial nama app (atau gambar yang kamu upload). Untuk regenerate ikon adaptif penuh, gunakan Android Studio -> klik kanan `res` -> New -> Image Asset.\n\n---\nDibuat dengan azra.co - (c) byazradev\n';
}
async function generateAndroidProject(cfg){
  const files={};
  const pkgPath=cfg.packageId.replace(/\./g,'/');
  files['settings.gradle']=genSettingsGradle(cfg);
  files['build.gradle']=genRootBuildGradle();
  files['gradle.properties']=genGradleProperties();
  files['gradle/wrapper/gradle-wrapper.properties']=genWrapperProps();
  files['app/build.gradle']=genAppBuildGradle(cfg);
  files['app/proguard-rules.pro']='# Add project specific ProGuard rules here.\n';
  files['app/src/main/AndroidManifest.xml']=genManifest(cfg);
  files['app/src/main/res/layout/activity_main.xml']=genActivityMainXml(cfg);
  files['app/src/main/java/'+pkgPath+'/MainActivity.java']=genMainActivity(cfg);
  files['app/src/main/res/values/strings.xml']=genStrings(cfg);
  files['app/src/main/res/values/colors.xml']=genColors(cfg);
  files['app/src/main/res/values/themes.xml']=genThemes();
  files['README.md']=genReadme(cfg);

  const icons=await generateIconPngs(cfg.appName, cfg.color, cfg.customIconDataUrl);
  Object.keys(icons).forEach(function(dir){
    files['app/src/main/res/'+dir+'/ic_launcher.png']={base64:true,data:icons[dir]};
    files['app/src/main/res/'+dir+'/ic_launcher_round.png']={base64:true,data:icons[dir]};
  });
  if(cfg.mode==='html'){ files['app/src/main/assets/index.html']=cfg.htmlContent; }
  return files;
}

/* ============================================================
   5. ZIP EXPORT
   ============================================================ */
async function exportZip(cfg, files){
  const zip=new JSZip();
  const rootName=(cfg.appName||'AzraApp').replace(/[^a-zA-Z0-9-_ ]/g,'').trim()||'AzraApp';
  const root=zip.folder(rootName);
  Object.keys(files).forEach(function(path){
    const content=files[path];
    if(content && typeof content==='object' && content.base64){ root.file(path, content.data, {base64:true}); }
    else{ root.file(path, content); }
  });
  return zip.generateAsync({type:'blob', compression:'DEFLATE', compressionOptions:{level:6}});
}
function downloadBlob(blob, filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
}

/* ============================================================
   6. BUILD PIPELINE (visual, client-side steps)
   ============================================================ */
const PIPELINE_STEPS=[
  {label:'Memeriksa sumber', ms:420},
  {label:'Menghasilkan ikon', ms:560},
  {label:'Menyusun struktur project', ms:620},
  {label:'Menulis konfigurasi Gradle', ms:580},
  {label:'Mengemas project', ms:680},
  {label:'Selesai', ms:240}
];
function setPipelineIcon(state){
  const icon=document.getElementById('pipelineIcon');
  icon.className='pipeline-icon'+(state==='liquefy'?' liquefy':state==='solidify'?' solidify':'');
}
async function runPipeline(){
  const overlay=document.getElementById('pipelineOverlay');
  const stepsWrap=document.getElementById('pipelineSteps');
  const barFill=document.getElementById('pipelineBarFill');
  const title=document.getElementById('pipelineTitle');
  stepsWrap.innerHTML=PIPELINE_STEPS.map(function(s,i){ return '<div class="pstep" data-idx="'+i+'"><div class="pstep-dot"></div><div class="pstep-label">'+s.label+'</div></div>'; }).join('');
  title.textContent='Compiling…';
  barFill.style.width='0%';
  setPipelineIcon('liquefy');
  overlay.classList.add('show');
  const stepEls=stepsWrap.querySelectorAll('.pstep');
  const total=PIPELINE_STEPS.reduce(function(a,s){ return a+s.ms; },0);
  let elapsed=0;
  for(let i=0;i<PIPELINE_STEPS.length;i++){
    stepEls[i].classList.add('active');
    await wait(PIPELINE_STEPS[i].ms);
    stepEls[i].classList.remove('active');
    stepEls[i].classList.add('done');
    stepEls[i].querySelector('.pstep-dot').textContent='✓';
    elapsed+=PIPELINE_STEPS[i].ms;
    barFill.style.width=Math.round(elapsed/total*100)+'%';
  }
  setPipelineIcon('solidify');
  title.textContent='Selesai!';
  await wait(420);
  overlay.classList.remove('show');
}

/* ============================================================
   7. BACKEND CLIENT — Termux compiler connection
   ============================================================ */
const Backend={
  baseUrl:null, online:false, ready:false,

  resolveBaseUrl:function(){
    if(location.protocol==='http:' && (location.hostname==='localhost'||location.hostname==='127.0.0.1')){
      return location.origin;
    }
    return 'http://localhost:8080';
  },
  init:function(){
    this.baseUrl=this.resolveBaseUrl();
    const self=this;
    this.checkStatus();
    setInterval(function(){ self.checkStatus(); }, 10000);
  },
  checkStatus:async function(){
    try{
      const opts={method:'GET'};
      if(window.AbortSignal && AbortSignal.timeout) opts.signal=AbortSignal.timeout(3000);
      const res=await fetch(this.baseUrl+'/api/status', opts);
      if(!res.ok) throw new Error('bad status');
      const data=await res.json();
      this.online=true;
      this.ready=!!(data.environment && data.environment.ready);
      updateServerBanner(true, this.ready, data);
    }catch(e){
      this.online=false; this.ready=false;
      updateServerBanner(false, false, null);
    }
  },
  compile:async function(blob){
    const form=new FormData();
    form.append('project', blob, 'project.zip');
    const res=await fetch(this.baseUrl+'/api/compile', {method:'POST', body:form});
    if(!res.ok){
      const err=await res.json().catch(function(){ return {error:'Gagal terhubung ke backend'}; });
      throw new Error(err.error||'Gagal compile');
    }
    const data=await res.json();
    return data.job_id;
  },
  pollJob:function(jobId, onUpdate){
    const self=this;
    return new Promise(function(resolve, reject){
      const iv=setInterval(async function(){
        try{
          const res=await fetch(self.baseUrl+'/api/job/'+jobId);
          const data=await res.json();
          if(onUpdate) onUpdate(data);
          if(data.status==='done'){ clearInterval(iv); resolve(data); }
          else if(data.status==='failed'){ clearInterval(iv); reject(new Error(data.error||'Build gagal')); }
        }catch(e){ /* transient network hiccup, keep polling */ }
      }, 1800);
    });
  },
  downloadUrl:function(jobId){ return this.baseUrl+'/api/download/'+jobId; }
};
function updateServerBanner(online, ready, data){
  const el=document.getElementById('serverStatus');
  const text=document.getElementById('serverStatusText');
  const link=document.getElementById('serverStatusLink');
  const apkBtn=document.getElementById('compileApkBtn');
  if(online){
    el.dataset.state='online';
    text.textContent = ready ? 'Backend terhubung — siap compile langsung ke .apk' : 'Backend terhubung, tapi environment Android SDK belum lengkap (lihat FAQ)';
    link.hidden = ready;
    apkBtn.hidden = !ready;
  } else {
    el.dataset.state='offline';
    text.textContent='Backend offline — jalankan backend.py di Termux untuk compile langsung ke .apk';
    link.hidden=false;
    apkBtn.hidden=true;
  }
}

/* ============================================================
   8. HISTORY — localStorage (persists on real deployments too)
   ============================================================ */
const HistoryManager={
  KEY:'azra_co_build_history',
  load:function(){ try{ const raw=localStorage.getItem(this.KEY); return raw?JSON.parse(raw):[]; }catch(e){ return []; } },
  save:function(list){ try{ localStorage.setItem(this.KEY, JSON.stringify(list)); }catch(e){ console.error('storage save failed', e); } },
  add:function(entry){ const list=this.load(); list.unshift(entry); this.save(list.slice(0,30)); },
  remove:function(id){ const list=this.load(); this.save(list.filter(function(x){ return x.id!==id; })); }
};
function renderHistory(){
  const grid=document.getElementById('historyGrid');
  const list=HistoryManager.load();
  if(!list.length){
    grid.innerHTML='<div class="history-empty glass" style="grid-column:1/-1">Belum ada project. Compile yang pertama di atas ↑</div>';
    return;
  }
  grid.innerHTML=list.map(function(item){
    return '<div class="history-card glass" data-id="'+item.id+'">'
      +'<img class="history-icon" src="'+item.iconDataUrl+'" alt="">'
      +'<div style="min-width:0">'
      +'<div class="history-name">'+escapeHtml(item.appName)+'</div>'
      +'<div class="history-pkg">'+escapeHtml(item.packageId)+'</div>'
      +'<div class="history-date">'+timeAgo(item.createdAt)+'</div>'
      +'<div class="history-actions"><button class="redo" data-id="'+item.id+'" type="button">↻ Compile Ulang</button><button class="del" data-id="'+item.id+'" type="button">Hapus</button></div>'
      +'</div></div>';
  }).join('');
  grid.querySelectorAll('.redo').forEach(function(b){ b.addEventListener('click', function(){ recompileFromHistory(b.dataset.id); }); });
  grid.querySelectorAll('.del').forEach(function(b){ b.addEventListener('click', function(){ deleteHistoryItem(b.dataset.id); }); });
}
async function recompileFromHistory(id){
  const item=HistoryManager.load().find(function(x){ return x.id===id; });
  if(!item) return;
  if(item.mode==='html'){
    showToast('Mode upload HTML — upload ulang file-nya untuk compile ulang');
    switchTab('html');
    document.getElementById('tool').scrollIntoView({behavior:'smooth'});
    return;
  }
  const files=await generateAndroidProject({
    mode:'url', appName:item.appName, packageId:item.packageId, sourceUrl:item.sourceUrl,
    color:item.color, orientation:item.orientation, versionName:'1.0', versionCode:1,
    zoom:false, fullscreen:true, offline:true, refresh:true, splash:true, loadingBar:true,
    fileUpload:true, download:true, externalLink:'app', permCamera:false, permLocation:false,
    permMic:false, permStorage:false, exitConfirm:true, forceDark:false, userAgent:''
  });
  const blob=await exportZip({appName:item.appName}, files);
  downloadBlob(blob, slugify(item.appName)+'-android.zip');
  showToast('Project berhasil di-generate ulang ✓');
}
function deleteHistoryItem(id){ HistoryManager.remove(id); renderHistory(); showToast('Dihapus dari riwayat'); }

/* ============================================================
   9. FAQ
   ============================================================ */
const FAQ_DATA=[
  {q:'Apakah saya langsung dapat file .apk yang siap install?', a:'Tergantung. Kalau backend Termux kamu aktif (lihat indikator status di atas form), tombol "Compile Langsung ke .APK" akan build APK asli lewat Gradle di HP kamu sendiri. Kalau backend tidak aktif, hasilnya project Android (Gradle) yang tinggal dibuka di Android Studio lalu Run.'},
  {q:'Bagaimana cara menjalankan backend-nya?', a:'Di Termux: jalankan setup_termux.sh sekali untuk install Java, Android SDK, dan Gradle, lalu jalankan python backend.py. Backend akan tanya URL frontend azra.co kamu, lalu langsung siap menerima compile dari browser.'},
  {q:'Apakah HTML/ikon yang saya upload dikirim ke server?', a:'Kalau kamu cuma download project .zip, semuanya diproses di browser tanpa upload kemanapun. Kalau kamu pakai "Compile Langsung ke .APK", project dikirim ke backend Termux milikmu sendiri — bukan ke server pihak ketiga manapun.'},
  {q:'Kenapa "com.azra." di Package ID tidak bisa diubah?', a:'Prefix itu namespace tetap azra.co supaya semua app yang di-generate dari tool ini konsisten. Bagian setelahnya bebas kamu tentukan, boleh pakai titik juga (mis. appsaya.pro).'},
  {q:'Format apa saja yang didukung untuk upload?', a:'File .html tunggal maksimal 5MB, dan gambar ikon (.png/.jpg/.webp) maksimal 2MB.'},
  {q:'Apakah azra.co gratis?', a:'Ya, sepenuhnya gratis dan tanpa batas jumlah compile.'},
  {q:'Bisa edit project setelah di-download?', a:'Bisa banget — hasilnya project Android Studio standar. Edit MainActivity.java, ganti ikon, tambah dependency, semuanya seperti project Android biasa.'}
];
function renderFaq(){
  const wrap=document.getElementById('faqList');
  wrap.innerHTML=FAQ_DATA.map(function(f,i){
    return '<div class="faq-item glass" data-idx="'+i+'"><button class="faq-q" type="button" aria-expanded="false"><span>'+escapeHtml(f.q)+'</span><span class="chev">▾</span></button><div class="faq-a"><div class="faq-a-inner">'+escapeHtml(f.a)+'</div></div></div>';
  }).join('');
  wrap.querySelectorAll('.faq-item').forEach(function(item){
    item.querySelector('.faq-q').addEventListener('click', function(){
      const wasOpen=item.classList.contains('open');
      wrap.querySelectorAll('.faq-item').forEach(function(i){ i.classList.remove('open'); i.querySelector('.faq-q').setAttribute('aria-expanded','false'); });
      if(!wasOpen){ item.classList.add('open'); item.querySelector('.faq-q').setAttribute('aria-expanded','true'); }
    });
  });
}

/* ============================================================
   10. SCROLL REVEAL
   ============================================================ */
function initReveal(){
  const els=document.querySelectorAll('.reveal');
  if(REDUCED_MOTION){ els.forEach(function(e){ e.classList.add('in'); }); return; }
  const io=new IntersectionObserver(function(entries){
    entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, {threshold:0.15});
  els.forEach(function(e){ io.observe(e); });
}

/* ============================================================
   11. UI WIRING
   ============================================================ */
const tabBtnUrl=document.getElementById('tabBtnUrl');
const tabBtnHtml=document.getElementById('tabBtnHtml');
const panelUrl=document.getElementById('panelUrl');
const panelHtml=document.getElementById('panelHtml');
const tabIndicator=document.getElementById('tabIndicator');
let activeTab='url';
function switchTab(tab){
  activeTab=tab;
  const isUrl=tab==='url';
  tabBtnUrl.classList.toggle('active', isUrl);
  tabBtnHtml.classList.toggle('active', !isUrl);
  tabBtnUrl.setAttribute('aria-selected', isUrl);
  tabBtnHtml.setAttribute('aria-selected', !isUrl);
  panelUrl.hidden=!isUrl;
  panelHtml.hidden=isUrl;
  tabIndicator.style.transform=isUrl?'translateX(0)':'translateX(100%)';
}
tabBtnUrl.addEventListener('click', function(){ switchTab('url'); });
tabBtnHtml.addEventListener('click', function(){ switchTab('html'); });

const urlInput=document.getElementById('urlInput');
const appNameInput=document.getElementById('appNameInput');
const packageSuffixInput=document.getElementById('packageSuffixInput');
const iconPreviewCanvas=document.getElementById('iconPreviewCanvas');
const iconUploadBtn=document.getElementById('iconUploadBtn');
const iconResetBtn=document.getElementById('iconResetBtn');
const iconFileInput=document.getElementById('iconFileInput');
const iconPickerHint=document.getElementById('iconPickerHint');
let customIconDataUrl=null;

function refreshIconPreview(){
  const name=appNameInput.value.trim()||'A';
  drawIconAsync(iconPreviewCanvas, name, selectedColor, 56, customIconDataUrl);
}

urlInput.addEventListener('input', function(){
  urlInput.classList.remove('invalid');
  document.getElementById('urlError').classList.remove('show');
  try{
    const u=new URL(urlInput.value);
    const host=u.hostname.replace(/^www\./,'').split('.')[0];
    if(!appNameInput.value){ appNameInput.value=capitalize(host); refreshIconPreview(); }
    if(!packageSuffixInput.value) packageSuffixInput.value=slugify(host);
  }catch(e){}
});
appNameInput.addEventListener('input', function(){ if(!customIconDataUrl) refreshIconPreview(); });
packageSuffixInput.addEventListener('input', function(){
  packageSuffixInput.value=packageSuffixInput.value.toLowerCase().replace(/[^a-z0-9_.]/g,'');
  packageSuffixInput.classList.remove('invalid');
  document.getElementById('packageError').classList.remove('show');
});
packageSuffixInput.addEventListener('blur', function(){
  const val=packageSuffixInput.value.trim();
  const err=document.getElementById('packageError');
  const invalid=val && !isValidPackageSuffix(val);
  packageSuffixInput.classList.toggle('invalid', invalid);
  err.classList.toggle('show', invalid);
});

iconUploadBtn.addEventListener('click', function(){ iconFileInput.click(); });
iconFileInput.addEventListener('change', function(){
  const f=iconFileInput.files[0];
  if(!f) return;
  if(!f.type.startsWith('image/')){ showToast('File harus berupa gambar'); return; }
  if(f.size>2*1024*1024){ showToast('Ukuran ikon maksimal 2MB'); return; }
  const reader=new FileReader();
  reader.onload=function(e){
    customIconDataUrl=e.target.result;
    iconResetBtn.hidden=false;
    iconPickerHint.textContent=f.name;
    refreshIconPreview();
  };
  reader.readAsDataURL(f);
});
iconResetBtn.addEventListener('click', function(){
  customIconDataUrl=null;
  iconResetBtn.hidden=true;
  iconPickerHint.textContent='Otomatis dari nama & warna aplikasi';
  iconFileInput.value='';
  refreshIconPreview();
});

const COLORS=['#9d5cf5','#2dd4f0','#e558c9','#ff7a45','#34e0a1'];
let selectedColor=COLORS[0];
(function initColors(){
  const row=document.getElementById('colorRow');
  COLORS.forEach(function(c,i){
    const sw=document.createElement('button');
    sw.type='button';
    sw.className='color-swatch jelly'+(i===0?' active':'');
    sw.style.background=c;
    sw.setAttribute('aria-label','Warna '+c);
    sw.addEventListener('click', function(){
      row.querySelectorAll('.color-swatch').forEach(function(s){ s.classList.remove('active'); });
      sw.classList.add('active');
      selectedColor=c;
      refreshIconPreview();
    });
    row.appendChild(sw);
    new JellyEl(sw, {radius:60, pull:.35});
  });
})();

let selectedOrientation='unspecified';
document.querySelectorAll('#orientationSeg button').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.querySelectorAll('#orientationSeg button').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    selectedOrientation=btn.dataset.value;
  });
});
let selectedExternalLink='app';
document.querySelectorAll('#externalLinkSeg button').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.querySelectorAll('#externalLinkSeg button').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    selectedExternalLink=btn.dataset.value;
  });
});

const configToggle=document.getElementById('configToggle');
const configBody=document.getElementById('configBody');
configToggle.addEventListener('click', function(){
  const open=configBody.classList.toggle('open');
  configToggle.setAttribute('aria-expanded', open);
});

const dropzone=document.getElementById('dropzone');
const htmlFileInput=document.getElementById('htmlFileInput');
const fileChip=document.getElementById('fileChip');
let uploadedHtmlContent=null;
let uploadedFileName=null;
dropzone.addEventListener('click', function(){ htmlFileInput.click(); });
dropzone.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); htmlFileInput.click(); } });
['dragover','dragenter'].forEach(function(evt){ dropzone.addEventListener(evt, function(e){ e.preventDefault(); dropzone.classList.add('dragover'); }); });
['dragleave','drop'].forEach(function(evt){ dropzone.addEventListener(evt, function(e){ e.preventDefault(); dropzone.classList.remove('dragover'); }); });
dropzone.addEventListener('drop', function(e){ const f=e.dataTransfer.files[0]; if(f) handleFile(f); });
htmlFileInput.addEventListener('change', function(){ if(htmlFileInput.files[0]) handleFile(htmlFileInput.files[0]); });
function handleFile(file){
  const err=document.getElementById('htmlError');
  const name=file.name.toLowerCase();
  if(!name.endsWith('.html') && !name.endsWith('.htm')){ err.textContent='File harus berformat .html'; err.classList.add('show'); return; }
  if(file.size>5*1024*1024){ err.textContent='Ukuran file maksimal 5MB'; err.classList.add('show'); return; }
  err.classList.remove('show');
  const reader=new FileReader();
  reader.onload=function(e){
    uploadedHtmlContent=e.target.result;
    uploadedFileName=file.name;
    document.getElementById('fileChipName').textContent=file.name;
    document.getElementById('fileChipSize').textContent=formatBytes(file.size);
    fileChip.hidden=false;
    dropzone.style.display='none';
    const base=file.name.replace(/\.(html|htm)$/i,'');
    if(!appNameInput.value){ appNameInput.value=capitalize(base); refreshIconPreview(); }
    if(!packageSuffixInput.value) packageSuffixInput.value=slugify(base);
  };
  reader.readAsText(file);
}
document.getElementById('fileChipRemove').addEventListener('click', function(){
  uploadedHtmlContent=null; uploadedFileName=null;
  fileChip.hidden=true; dropzone.style.display='';
  htmlFileInput.value='';
});

/* ============================================================
   12. VALIDATION + COMPILE HANDLERS
   ============================================================ */
function validateAndBuildConfig(){
  const mode=activeTab;
  const sourceUrl=urlInput.value.trim();
  if(mode==='url'){
    if(!isValidUrl(sourceUrl)){
      urlInput.classList.add('invalid');
      document.getElementById('urlError').classList.add('show');
      urlInput.focus();
      return null;
    }
  } else if(!uploadedHtmlContent){
    const err=document.getElementById('htmlError');
    err.textContent='Pilih file HTML terlebih dahulu';
    err.classList.add('show');
    dropzone.scrollIntoView({behavior:'smooth', block:'center'});
    return null;
  }

  let appName=appNameInput.value.trim();
  if(!appName){
    appName = mode==='url' ? capitalize(new URL(sourceUrl).hostname.replace(/^www\./,'').split('.')[0]) : 'AzraApp';
    appNameInput.value=appName;
  }
  let suffix=packageSuffixInput.value.trim();
  if(!suffix){ suffix=slugify(appName); packageSuffixInput.value=suffix; }
  if(!isValidPackageSuffix(suffix)){
    packageSuffixInput.classList.add('invalid');
    document.getElementById('packageError').classList.add('show');
    packageSuffixInput.focus();
    return null;
  }

  return {
    mode:mode, appName:appName, packageId:'com.azra.'+suffix,
    sourceUrl:sourceUrl, htmlContent:uploadedHtmlContent, htmlFileName:uploadedFileName,
    color:selectedColor, orientation:selectedOrientation, customIconDataUrl:customIconDataUrl,
    versionName:(document.getElementById('versionNameInput').value.trim()||'1.0'),
    versionCode:(parseInt(document.getElementById('versionCodeInput').value,10)||1),
    splash:document.getElementById('optSplash').checked,
    loadingBar:document.getElementById('optLoadingBar').checked,
    forceDark:document.getElementById('optForceDark').checked,
    zoom:document.getElementById('optZoom').checked,
    fullscreen:document.getElementById('optFullscreen').checked,
    offline:document.getElementById('optOffline').checked,
    refresh:document.getElementById('optRefresh').checked,
    fileUpload:document.getElementById('optFileUpload').checked,
    download:document.getElementById('optDownload').checked,
    externalLink:selectedExternalLink,
    userAgent:document.getElementById('userAgentInput').value.trim(),
    permCamera:document.getElementById('optPermCamera').checked,
    permLocation:document.getElementById('optPermLocation').checked,
    permMic:document.getElementById('optPermMic').checked,
    permStorage:document.getElementById('optPermStorage').checked,
    exitConfirm:document.getElementById('optExitConfirm').checked
  };
}
async function saveHistoryEntry(cfg){
  const c=document.createElement('canvas');
  await drawIconAsync(c, cfg.appName, cfg.color, 64, cfg.customIconDataUrl);
  HistoryManager.add({
    id:'h'+Date.now()+Math.random().toString(36).slice(2,7),
    appName:cfg.appName, packageId:cfg.packageId, mode:cfg.mode, sourceUrl:cfg.mode==='url'?cfg.sourceUrl:null,
    color:cfg.color, orientation:cfg.orientation, iconDataUrl:c.toDataURL('image/png'), createdAt:Date.now()
  });
  renderHistory();
}

let currentResult=null;
const resultSection=document.getElementById('resultSection');
function showResult(cfg, blob, fileCount){
  resultSection.hidden=false;
  drawIconAsync(document.getElementById('resultIconCanvas'), cfg.appName, cfg.color, 84, cfg.customIconDataUrl);
  document.getElementById('resultAppName').textContent=cfg.appName;
  document.getElementById('resultPkg').textContent=cfg.packageId;
  document.getElementById('resultSize').textContent=formatBytes(blob.size)+' · '+fileCount+' file';
  resultSection.scrollIntoView({behavior:'smooth', block:'center'});
}

document.getElementById('compileBtn').addEventListener('click', async function(){
  const btn=this;
  const cfg=validateAndBuildConfig();
  if(!cfg) return;

  btn.disabled=true;
  document.getElementById('compileApkBtn').disabled=true;
  document.getElementById('resultApkBlock').hidden=true;
  document.getElementById('nextSteps').style.display='';

  await runPipeline();
  const files=await generateAndroidProject(cfg);
  const blob=await exportZip(cfg, files);
  currentResult={cfg:cfg, blob:blob};
  showResult(cfg, blob, Object.keys(files).length);
  await saveHistoryEntry(cfg);

  btn.disabled=false;
  document.getElementById('compileApkBtn').disabled=false;
});

document.getElementById('compileApkBtn').addEventListener('click', async function(){
  const btn=this;
  const cfg=validateAndBuildConfig();
  if(!cfg) return;

  btn.disabled=true;
  document.getElementById('compileBtn').disabled=true;

  await runPipeline();
  const files=await generateAndroidProject(cfg);
  const blob=await exportZip(cfg, files);
  currentResult={cfg:cfg, blob:blob};
  showResult(cfg, blob, Object.keys(files).length);
  await saveHistoryEntry(cfg);

  const apkBlock=document.getElementById('resultApkBlock');
  const apkStatus=document.getElementById('resultApkStatus');
  const apkStatusText=document.getElementById('resultApkStatusText');
  const downloadApkBtn=document.getElementById('downloadApkBtn');
  const nextSteps=document.getElementById('nextSteps');

  apkBlock.hidden=false;
  downloadApkBtn.hidden=true;
  apkStatus.className='result-apk-status';
  apkStatusText.textContent='Mengirim project ke backend…';

  try{
    const jobId=await Backend.compile(blob);
    const startTime=Date.now();
    const timerIv=setInterval(function(){
      const s=Math.floor((Date.now()-startTime)/1000);
      apkStatusText.textContent='Building di Termux… ('+s+'s)';
    }, 1000);

    await Backend.pollJob(jobId);
    clearInterval(timerIv);

    apkStatus.classList.add('done');
    apkStatusText.textContent='APK siap ✓';
    downloadApkBtn.hidden=false;
    downloadApkBtn.onclick=function(){ window.location.href=Backend.downloadUrl(jobId); };
    nextSteps.style.display='none';
    showToast('APK berhasil dibuat ✓');
  }catch(err){
    apkStatus.classList.add('failed');
    apkStatusText.textContent='Gagal: '+err.message;
    showToast('Build APK gagal — project .zip tetap bisa diunduh manual');
  }

  btn.disabled=false;
  document.getElementById('compileBtn').disabled=false;
});

document.getElementById('downloadBtn').addEventListener('click', function(){
  if(!currentResult) return;
  downloadBlob(currentResult.blob, slugify(currentResult.cfg.appName)+'-android.zip');
  showToast('Project berhasil diunduh ✓');
});
document.getElementById('buildAnotherBtn').addEventListener('click', function(){
  resultSection.hidden=true;
  document.getElementById('tool').scrollIntoView({behavior:'smooth'});
});

/* ============================================================
   13. INIT
   ============================================================ */
document.querySelectorAll('.jelly').forEach(function(el){ new JellyEl(el); });
JellySystem.init();
renderFaq();
initReveal();
renderHistory();
refreshIconPreview();
Backend.init();
