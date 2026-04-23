const fs = require('fs');
const path = require('path');
const {
  withAppBuildGradle,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
  withProjectBuildGradle,
} = require('@expo/config-plugins');

const PROVIDER_CLASS = '.widget.AiriaTodayWidgetProvider';
const PACKAGE_CLASS = 'AiriaWidgetPackage';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, contents) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents);
}

function getAndroidPackage(config) {
  return config.android?.package || 'pro.airia.app';
}

function getKotlinPackageDir(androidPackage) {
  return androidPackage.split('.').join(path.sep);
}

function withWidgetManifest(config) {
  return withAndroidManifest(config, (pluginConfig) => {
    const manifest = pluginConfig.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return pluginConfig;

    application.receiver = (application.receiver || []).filter(
      (receiver) => receiver.$?.['android:name'] !== PROVIDER_CLASS,
    );

    application.receiver.push({
      $: {
        'android:name': PROVIDER_CLASS,
        'android:exported': 'true',
        'android:label': 'Hoje na Airia',
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
              },
            },
          ],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/airia_today_widget_info',
          },
        },
      ],
    });

    return pluginConfig;
  });
}

function withWidgetPackage(config) {
  return withMainApplication(config, (pluginConfig) => {
    const androidPackage = getAndroidPackage(pluginConfig);
    let contents = pluginConfig.modResults.contents;
    const importLine = `import ${androidPackage}.widget.${PACKAGE_CLASS}`;
    const packageLine = `packages.add(${PACKAGE_CLASS}())`;

    // 1. Injetar Import (funciona em Java e Kotlin)
    if (!contents.includes(importLine)) {
      // Tenta inserir após o primeiro import de React ou no topo
      if (contents.includes('import com.facebook.react.')) {
        contents = contents.replace(/(import com\.facebook\.react\.[a-zA-Z.]+)/, `$1\n${importLine}`);
      } else {
        contents = contents.replace(/(package [a-zA-Z.]+)/, `$1\n\n${importLine}`);
      }
    }

    // 2. Injetar Package na lista (funciona com o padrao do Expo 51)
    if (!contents.includes(packageLine)) {
      // Expo 51 + Kotlin
      if (contents.includes('PackageList(this).packages')) {
        contents = contents.replace(
          /val\s+packages\s*=\s*PackageList\(this\)\.packages/,
          `val packages = PackageList(this).packages.toMutableList()\n            ${packageLine}`
        );
        // Se ja tentamos converter para mutable e falhou, ou se eh o padrao direto:
        if (!contents.includes('toMutableList()')) {
            contents = contents.replace(
                'return PackageList(this).packages',
                `val packages = PackageList(this).packages.toMutableList()\n            ${packageLine}\n            return packages`
            );
        }
      } else if (contents.includes('new PackageList(this).getPackages()')) {
        // Legado Java
        contents = contents.replace(
            'List<ReactPackage> packages = new PackageList(this).getPackages();',
            `List<ReactPackage> packages = new PackageList(this).getPackages();\n      packages.add(new ${PACKAGE_CLASS}());`
        );
      }
    }

    pluginConfig.modResults.contents = contents;
    return pluginConfig;
  });
}

function withWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (pluginConfig) => {
      const androidPackage = getAndroidPackage(pluginConfig);
      const projectRoot = pluginConfig.modRequest.platformProjectRoot;
      const mainPath = path.join(projectRoot, 'app', 'src', 'main');
      const kotlinDir = path.join(mainPath, 'java', getKotlinPackageDir(androidPackage), 'widget');

      writeFile(
        path.join(kotlinDir, 'AiriaTodayWidgetProvider.kt'),
        getProviderKotlin(androidPackage),
      );
      writeFile(
        path.join(kotlinDir, 'AiriaWidgetModule.kt'),
        getModuleKotlin(androidPackage),
      );
      writeFile(
        path.join(kotlinDir, 'AiriaWidgetPackage.kt'),
        getPackageKotlin(androidPackage),
      );
      writeFile(
        path.join(mainPath, 'res', 'layout', 'airia_today_widget.xml'),
        getWidgetLayoutXml(),
      );
      writeFile(
        path.join(mainPath, 'res', 'xml', 'airia_today_widget_info.xml'),
        getWidgetInfoXml(),
      );
      writeFile(
        path.join(mainPath, 'res', 'drawable', 'airia_widget_background.xml'),
        getWidgetBackgroundXml(),
      );
      writeFile(
        path.join(mainPath, 'res', 'values', 'airia_widget_colors.xml'),
        getWidgetColorsXml(),
      );

      return pluginConfig;
    },
  ]);
}

function withExplicitAndroidEntryFile(config) {
  return withAppBuildGradle(config, (pluginConfig) => {
    const resolvedEntryFileLine =
      'entryFile = file(["node", "-e", "require(\'expo/scripts/resolveAppEntry\')", projectRoot, "android", "absolute"].execute(null, rootDir).text.trim())';
    const explicitEntryFileLine = 'entryFile = file("$projectRoot/index.js")';
    const appReactNativePathBlock = [
      'def airiaWorkspaceReactNativeDir = file("$rootDir/../../../node_modules/react-native")',
      'def airiaLocalReactNativeDir = file("$rootDir/../node_modules/react-native")',
      'ext.REACT_NATIVE_NODE_MODULES_DIR = airiaWorkspaceReactNativeDir.exists() ? airiaWorkspaceReactNativeDir.absolutePath : airiaLocalReactNativeDir.absolutePath',
    ].join('\n');

    pluginConfig.modResults.contents = pluginConfig.modResults.contents.replace(
      resolvedEntryFileLine,
      explicitEntryFileLine,
    );

    if (!pluginConfig.modResults.contents.includes('airiaWorkspaceReactNativeDir')) {
      pluginConfig.modResults.contents = pluginConfig.modResults.contents.replace(
        /\nreact \{\n/,
        `\n${appReactNativePathBlock}\n\nreact {\n`,
      );
    }

    return pluginConfig;
  });
}

function withWorkspaceReactNativePath(config) {
  return withProjectBuildGradle(config, (pluginConfig) => {
    const reactNativePathLine =
      '        REACT_NATIVE_NODE_MODULES_DIR = file("$rootDir/../../../node_modules/react-native").exists() ? file("$rootDir/../../../node_modules/react-native").absolutePath : file("$rootDir/../node_modules/react-native").absolutePath';

    if (!pluginConfig.modResults.contents.includes('REACT_NATIVE_NODE_MODULES_DIR')) {
      pluginConfig.modResults.contents = pluginConfig.modResults.contents.replace(
        /(\s+ext \{\n)/,
        `$1${reactNativePathLine}\n`,
      );
    }

    return pluginConfig;
  });
}

function getProviderKotlin(androidPackage) {
  return `package ${androidPackage}.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import ${androidPackage}.R

class AiriaTodayWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { widgetId ->
      updateWidget(context, appWidgetManager, widgetId)
    }
  }

  companion object {
    private const val PREFS_NAME = "airia_widget_prefs"
    private const val TODAY_KEY = "airia_widget_today"

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, AiriaTodayWidgetProvider::class.java)
      manager.getAppWidgetIds(component).forEach { widgetId ->
        updateWidget(context, manager, widgetId)
      }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
      val views = RemoteViews(context.packageName, R.layout.airia_today_widget)
      val payload = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(TODAY_KEY, null)
      val data = payload?.let { runCatching { JSONObject(it) }.getOrNull() }

      val stateLabel = data?.optString("stateLabel")?.takeIf { it.isNotBlank() } ?: "Sem check-in"
      val stateType = data?.optString("stateType") ?: "unknown"
      val mood = data?.opt("moodScore")
      val energy = data?.opt("energyScore")
      val planner = data?.optJSONArray("planner")

      views.setTextViewText(R.id.airia_widget_state, stateLabel)
      views.setTextColor(R.id.airia_widget_state, colorForState(stateType))

      val scores = buildScoresText(mood, energy)
      views.setTextViewText(R.id.airia_widget_scores, scores)

      if (planner == null || planner.length() == 0) {
        views.setTextViewText(R.id.airia_widget_task_1_time, "--")
        views.setTextViewText(R.id.airia_widget_task_1_title, "Planner livre por enquanto")
        views.setViewVisibility(R.id.airia_widget_task_2, View.GONE)
        views.setViewVisibility(R.id.airia_widget_task_3, View.GONE)
      } else {
        bindTask(views, R.id.airia_widget_task_1, R.id.airia_widget_task_1_time, R.id.airia_widget_task_1_title, planner.optJSONObject(0))
        bindTask(views, R.id.airia_widget_task_2, R.id.airia_widget_task_2_time, R.id.airia_widget_task_2_title, planner.optJSONObject(1))
        bindTask(views, R.id.airia_widget_task_3, R.id.airia_widget_task_3_time, R.id.airia_widget_task_3_title, planner.optJSONObject(2))
      }

      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: Intent()
      val pendingIntent = PendingIntent.getActivity(
        context,
        0,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.airia_widget_root, pendingIntent)

      manager.updateAppWidget(widgetId, views)
    }

    private fun bindTask(views: RemoteViews, rowId: Int, timeId: Int, titleId: Int, task: JSONObject?) {
      if (task == null) {
        views.setViewVisibility(rowId, View.GONE)
        return
      }
      views.setViewVisibility(rowId, View.VISIBLE)
      views.setTextViewText(timeId, task.optString("time", "--"))
      views.setTextViewText(titleId, task.optString("title", "Bloco sem titulo"))
    }

    private fun buildScoresText(mood: Any?, energy: Any?): String {
      val moodValue = scoreValue(mood)
      val energyValue = scoreValue(energy)
      return when {
        moodValue != null && energyValue != null -> "Humor $moodValue/10 · Energia $energyValue/10"
        energyValue != null -> "Energia $energyValue/10"
        moodValue != null -> "Humor $moodValue/10"
        else -> "Toque para atualizar seu dia"
      }
    }

    private fun scoreValue(value: Any?): Int? {
      return when (value) {
        is Int -> value
        is Double -> value.toInt()
        is Number -> value.toInt()
        else -> null
      }
    }

    private fun colorForState(stateType: String): Int {
      return when (stateType.lowercase()) {
        "leve", "stable", "moderado", "balanced" -> 0xFF3A7A66.toInt()
        "sensível", "sensivel", "sensitive" -> 0xFFA8544A.toInt()
        "crítico", "critico", "overloaded" -> 0xFF8F3D45.toInt()
        "radiant" -> 0xFFD7897F.toInt()
        else -> 0xFF4E4742.toInt()
      }
    }
  }
}
`;
}

function getModuleKotlin(androidPackage) {
  return `package ${androidPackage}.widget

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AiriaWidgetModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AiriaWidgetModule"

  @ReactMethod
  fun updateTodayWidget(payload: String, promise: Promise) {
    try {
      reactContext
        .getSharedPreferences("airia_widget_prefs", Context.MODE_PRIVATE)
        .edit()
        .putString("airia_widget_today", payload)
        .apply()

      AiriaTodayWidgetProvider.updateAll(reactContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("AIRIA_WIDGET_UPDATE_FAILED", error)
    }
  }
}
`;
}

function getPackageKotlin(androidPackage) {
  return `package ${androidPackage}.widget

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AiriaWidgetPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(AiriaWidgetModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;
}

function getWidgetLayoutXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/airia_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:background="@drawable/airia_widget_background"
  android:padding="16dp">

  <TextView
    android:id="@+id/airia_widget_title"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:text="Hoje na Airia"
    android:textColor="@color/airia_widget_muted"
    android:textSize="12sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/airia_widget_state"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="4dp"
    android:maxLines="1"
    android:ellipsize="end"
    android:text="Sem check-in"
    android:textColor="@color/airia_widget_text"
    android:textSize="20sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/airia_widget_scores"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="2dp"
    android:maxLines="1"
    android:ellipsize="end"
    android:text="Toque para atualizar seu dia"
    android:textColor="@color/airia_widget_muted"
    android:textSize="12sp" />

  <LinearLayout
    android:id="@+id/airia_widget_task_1"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="12dp"
    android:orientation="horizontal">
    <TextView
      android:id="@+id/airia_widget_task_1_time"
      android:layout_width="44dp"
      android:layout_height="wrap_content"
      android:text="--"
      android:textColor="@color/airia_widget_accent"
      android:textSize="12sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/airia_widget_task_1_title"
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:maxLines="1"
      android:ellipsize="end"
      android:text="Planner livre por enquanto"
      android:textColor="@color/airia_widget_text"
      android:textSize="13sp" />
  </LinearLayout>

  <LinearLayout
    android:id="@+id/airia_widget_task_2"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:orientation="horizontal">
    <TextView
      android:id="@+id/airia_widget_task_2_time"
      android:layout_width="44dp"
      android:layout_height="wrap_content"
      android:text="--"
      android:textColor="@color/airia_widget_accent"
      android:textSize="12sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/airia_widget_task_2_title"
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:maxLines="1"
      android:ellipsize="end"
      android:text=""
      android:textColor="@color/airia_widget_text"
      android:textSize="13sp" />
  </LinearLayout>

  <LinearLayout
    android:id="@+id/airia_widget_task_3"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:orientation="horizontal">
    <TextView
      android:id="@+id/airia_widget_task_3_time"
      android:layout_width="44dp"
      android:layout_height="wrap_content"
      android:text="--"
      android:textColor="@color/airia_widget_accent"
      android:textSize="12sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/airia_widget_task_3_title"
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:maxLines="1"
      android:ellipsize="end"
      android:text=""
      android:textColor="@color/airia_widget_text"
      android:textSize="13sp" />
  </LinearLayout>
</LinearLayout>
`;
}

function getWidgetInfoXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="250dp"
  android:minHeight="110dp"
  android:targetCellWidth="4"
  android:targetCellHeight="2"
  android:updatePeriodMillis="1800000"
  android:initialLayout="@layout/airia_today_widget"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen" />
`;
}

function getWidgetBackgroundXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="@color/airia_widget_background" />
  <corners android:radius="22dp" />
  <stroke android:width="1dp" android:color="@color/airia_widget_border" />
</shape>
`;
}

function getWidgetColorsXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="airia_widget_background">#FAF8F5</color>
  <color name="airia_widget_border">#E9DED7</color>
  <color name="airia_widget_text">#3F3833</color>
  <color name="airia_widget_muted">#81756D</color>
  <color name="airia_widget_accent">#A8544A</color>
</resources>
`;
}

module.exports = function withAiriaTodayWidget(config) {
  config = withWorkspaceReactNativePath(config);
  config = withExplicitAndroidEntryFile(config);
  config = withWidgetManifest(config);
  config = withWidgetPackage(config);
  config = withWidgetFiles(config);
  return config;
};
