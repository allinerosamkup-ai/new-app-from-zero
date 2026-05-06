package pro.airia.app.health

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.max
import kotlin.math.min

class AiriaHealthConnectModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val providerPackageName = "com.google.android.apps.healthdata"
  private val permissions = setOf(
    HealthPermission.getReadPermission(SleepSessionRecord::class),
    HealthPermission.getReadPermission(StepsRecord::class),
    HealthPermission.getReadPermission(HeartRateRecord::class),
    HealthPermission.getReadPermission(ExerciseSessionRecord::class),
  )
  private val permissionContract = PermissionController.createRequestPermissionResultContract()
  private var pendingPromise: Promise? = null

  private val activityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_HEALTH_PERMISSIONS) return
      val promise = pendingPromise ?: return
      pendingPromise = null

      val granted = permissionContract.parseResult(resultCode, data)
      if (!granted.containsAll(permissions)) {
        promise.reject("AIRIA_HEALTH_PERMISSION_DENIED", "Permissao do Health Connect negada.")
        return
      }

      readTodaySnapshot(promise)
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "AiriaHealthConnectModule"

  @ReactMethod
  fun getAvailability(promise: Promise) {
    try {
      val status = HealthConnectClient.getSdkStatus(reactContext, providerPackageName)
      val result = Arguments.createMap()
      result.putBoolean("available", status == HealthConnectClient.SDK_AVAILABLE)
      result.putBoolean("updateRequired", status == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("AIRIA_HEALTH_AVAILABILITY_FAILED", error)
    }
  }

  @ReactMethod
  fun requestPermissionsAndReadToday(promise: Promise) {
    CoroutineScope(Dispatchers.Main).launch {
      try {
        val status = HealthConnectClient.getSdkStatus(reactContext, providerPackageName)
        if (status == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
          openHealthConnectInstall()
          promise.reject("AIRIA_HEALTH_UPDATE_REQUIRED", "Health Connect precisa ser instalado ou atualizado.")
          return@launch
        }
        if (status != HealthConnectClient.SDK_AVAILABLE) {
          promise.reject("AIRIA_HEALTH_UNAVAILABLE", "Health Connect indisponivel neste aparelho.")
          return@launch
        }

        val client = HealthConnectClient.getOrCreate(reactContext)
        val granted = withContext(Dispatchers.IO) {
          client.permissionController.getGrantedPermissions()
        }
        if (granted.containsAll(permissions)) {
          readTodaySnapshot(promise)
          return@launch
        }

        val activity = currentActivity
        if (activity == null) {
          promise.reject("AIRIA_HEALTH_NO_ACTIVITY", "Nao consegui abrir as permissoes agora.")
          return@launch
        }

        if (pendingPromise != null) {
          promise.reject("AIRIA_HEALTH_REQUEST_ACTIVE", "Ja existe uma solicitacao de permissao aberta.")
          return@launch
        }

        pendingPromise = promise
        activity.startActivityForResult(permissionContract.createIntent(reactContext, permissions), REQUEST_HEALTH_PERMISSIONS)
      } catch (error: Exception) {
        pendingPromise = null
        promise.reject("AIRIA_HEALTH_PERMISSION_FAILED", error)
      }
    }
  }

  private fun readTodaySnapshot(promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val client = HealthConnectClient.getOrCreate(reactContext)
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val start = today.minusDays(1).atStartOfDay(zone).toInstant()
        val end = Instant.now()
        val filter = TimeRangeFilter.between(start, end)

        val sleeps = client.readRecords(ReadRecordsRequest(recordType = SleepSessionRecord::class, timeRangeFilter = filter)).records
        val steps = client.readRecords(ReadRecordsRequest(recordType = StepsRecord::class, timeRangeFilter = filter)).records
        val heartRates = client.readRecords(ReadRecordsRequest(recordType = HeartRateRecord::class, timeRangeFilter = filter)).records
        val exercises = client.readRecords(ReadRecordsRequest(recordType = ExerciseSessionRecord::class, timeRangeFilter = filter)).records

        val sleepMinutes = sleeps.sumOf { max(0, Duration.between(it.startTime, it.endTime).toMinutes()).toInt() }
        val totalSteps = steps.sumOf { it.count }
        val bpmSamples = heartRates.flatMap { record -> record.samples.map { it.beatsPerMinute } }
        val avgHeartRate = if (bpmSamples.isEmpty()) null else bpmSamples.average()
        val exerciseMinutes = exercises.sumOf { max(0, Duration.between(it.startTime, it.endTime).toMinutes()).toInt() }

        val result = Arguments.createMap()
        result.putString("source", "health_connect")
        result.putString("localDate", today.toString())
        result.putInt("sleepMinutes", sleepMinutes)
        result.putInt("sleepScore", sleepScoreFromMinutes(sleepMinutes))
        result.putDouble("steps", totalSteps.toDouble())
        if (avgHeartRate != null) result.putDouble("avgHeartRate", avgHeartRate)
        result.putInt("exerciseMinutes", exerciseMinutes)
        result.putString("syncedAt", Instant.now().toString())

        withContext(Dispatchers.Main) {
          promise.resolve(result)
        }
      } catch (error: Exception) {
        withContext(Dispatchers.Main) {
          promise.reject("AIRIA_HEALTH_READ_FAILED", error)
        }
      }
    }
  }

  private fun sleepScoreFromMinutes(minutes: Int): Int {
    val score = when {
      minutes <= 0 -> 5
      minutes < 300 -> 3
      minutes < 360 -> 4
      minutes < 420 -> 6
      minutes <= 540 -> 8
      else -> 7
    }
    return min(10, max(1, score))
  }

  private fun openHealthConnectInstall() {
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setPackage("com.android.vending")
      data = Uri.parse("market://details?id=$providerPackageName&url=healthconnect%3A%2F%2Fonboarding")
      putExtra("overlay", true)
      putExtra("callerId", reactContext.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext.startActivity(intent)
  }

  companion object {
    private const val REQUEST_HEALTH_PERMISSIONS = 47021
  }
}
