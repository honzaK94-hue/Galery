package expo.modules.galeriedevice

import android.app.Activity
import android.Manifest
import android.content.ClipData
import android.content.ContentResolver
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.view.WindowManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.atomic.AtomicInteger

class MediaQuery : Record {
  @Field var kind: String = "all"
  @Field var offset: Int = 0
  @Field var limit: Int = 60
  @Field var query: String? = null
  @Field var sort: String = "newest"
  @Field var ids: List<String>? = null
  @Field var excludeIds: List<String> = emptyList()
}

/** Android's own media operations; no file moves or private copies. */
class GalerieDeviceModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private val resolver: ContentResolver
    get() = (appContext.reactContext ?: throw Exceptions.ReactContextLost()).contentResolver

  // The Android 16 consent API accepts at most 2,000 items per request.
  private data class Mutation(
    val operation: String,
    val value: Boolean,
    val batches: List<List<Map<String, Any?>>>,
    val completed: MutableList<String>,
    val promise: Promise,
    var index: Int = 0,
    var requestCode: Int = -1
  )

  // Accessed only on the main thread. Keeping a single operation prevents one
  // confirmation dialog from overwriting another operation's pending result.
  private var mutation: Mutation? = null
  private var sharePromise: Promise? = null
  private var shareRequestCode: Int = -1
  // Do not touch FLAG_SECURE unless this helper is explicitly used. Another
  // module (expo-screen-capture) may own the app's capture protection.
  private var secureScreen: Boolean? = null

  override fun definition() = ModuleDefinition {
    Name("GalerieDevice")

    AsyncFunction("queryMedia") { options: MediaQuery -> query(options) }
    AsyncFunction("getMedia") { ids: List<String> -> getByIds(ids) }

    AsyncFunction("setTrashed") { ids: List<String>, value: Boolean, promise: Promise ->
      prepareMutation(ids, "trash", value, promise)
    }
    AsyncFunction("setFavorite") { ids: List<String>, value: Boolean, promise: Promise ->
      prepareMutation(ids, "favorite", value, promise)
    }
    AsyncFunction("deleteMedia") { ids: List<String>, promise: Promise ->
      prepareMutation(ids, "delete", false, promise)
    }
    AsyncFunction("shareMedia") { ids: List<String>, promise: Promise ->
      share(ids, promise)
    }
    AsyncFunction("setSecureScreen") { enabled: Boolean, promise: Promise ->
      main.post {
        try {
          secureScreen = enabled
          updateSecureFlag()
          promise.resolve()
        } catch (error: Exception) {
          promise.reject("E_SECURE_SCREEN", error.message, error)
        }
      }
    }

    OnActivityResult { _, result ->
      if (result.requestCode == mutation?.requestCode) {
        val current = mutation
        if (current != null) {
          if (result.resultCode == Activity.RESULT_OK) {
            // MediaStore finishes the operation before delivering RESULT_OK.
            current.completed.addAll(current.batches[current.index].map { it["id"] as String })
            current.index += 1
            launchNextBatch()
          } else {
            finishMutation(cancelled = true)
          }
        }
      } else if (result.requestCode == shareRequestCode) {
        sharePromise?.resolve()
        sharePromise = null
        shareRequestCode = -1
      }
    }
    OnActivityEntersForeground {
      main.post { updateSecureFlag() }
    }
    OnActivityDestroys {
      // Never leave JS awaiting a dead Activity. Completed batches are retained
      // in the result; the provider reconciles actual MediaStore state on resume.
      finishMutation(cancelled = true)
      sharePromise?.reject("E_ACTIVITY_DESTROYED", "Sdílení bylo přerušeno.", null)
      sharePromise = null
      shareRequestCode = -1
    }
    OnDestroy {
      main.post {
        finishMutation(cancelled = true)
        sharePromise?.reject("E_MODULE_DESTROYED", "Sdílení bylo přerušeno.", null)
        sharePromise = null
        shareRequestCode = -1
      }
    }
  }

  private fun requireSupported() {
    check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      "Tato funkce vyžaduje Android 11 nebo novější."
    }
  }

  private fun requireReadPermission() {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    fun granted(permission: String) = context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    val readable = if (Build.VERSION.SDK_INT >= 33) {
      granted(Manifest.permission.READ_MEDIA_IMAGES) || granted(Manifest.permission.READ_MEDIA_VIDEO) ||
        (Build.VERSION.SDK_INT >= 34 && granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED))
    } else granted(Manifest.permission.READ_EXTERNAL_STORAGE)
    if (!readable) throw SecurityException("Galerie nemá oprávnění číst fotografie a videa.")
  }

  private fun normalizeId(value: String): String {
    val text = value.trim()
    val id = if (text.startsWith("content://")) {
      val uri = Uri.parse(text)
      require(uri.authority == MediaStore.AUTHORITY) { "Neplatný identifikátor média." }
      uri.lastPathSegment.orEmpty()
    } else text
    // IDs are the same numeric MediaStore _ID used by expo-media-library/legacy.
    require(id.matches(Regex("[0-9]+")) && id.toLongOrNull() != null) {
      "Neplatný identifikátor média."
    }
    return id.toLong().toString()
  }

  private fun query(options: MediaQuery, includeTrash: Boolean = false): Map<String, Any?> {
    requireSupported()
    requireReadPermission()
    require(options.kind in listOf("all", "trash", "favorites")) { "Neplatný typ knihovny." }
    val offset = options.offset.coerceAtLeast(0)
    val limit = options.limit.coerceIn(1, 500)
    val conditions = mutableListOf("${MediaStore.Files.FileColumns.MEDIA_TYPE} IN (1, 3)")
    if (options.kind == "favorites") conditions.add("${MediaStore.MediaColumns.IS_FAVORITE} = 1")
    options.ids?.let { values ->
      val ids = values.map(::normalizeId).distinct()
      // Input is normalized to numeric IDs before constructing this predicate.
      conditions.add(if (ids.isEmpty()) "0" else "${MediaStore.MediaColumns._ID} IN (${ids.joinToString(",")})")
    }
    val excluded = options.excludeIds.map(::normalizeId).toHashSet()
    val search = options.query?.trim()?.takeIf { it.isNotEmpty() }
    val date = "CASE WHEN ${MediaStore.MediaColumns.DATE_TAKEN} > 0 THEN ${MediaStore.MediaColumns.DATE_TAKEN} ELSE ${MediaStore.MediaColumns.DATE_MODIFIED} * 1000 END"
    val order = when (options.sort) {
      "name" -> "${MediaStore.MediaColumns.DISPLAY_NAME} COLLATE NOCASE ASC, ${MediaStore.MediaColumns._ID} DESC"
      "oldest" -> "$date ASC, ${MediaStore.MediaColumns._ID} DESC"
      else -> "$date DESC, ${MediaStore.MediaColumns._ID} DESC"
    }
    val bundle = Bundle().apply {
      putString(ContentResolver.QUERY_ARG_SQL_SELECTION, conditions.joinToString(" AND "))
      putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER, order)
      putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, when {
        options.kind == "trash" -> MediaStore.MATCH_ONLY
        includeTrash -> MediaStore.MATCH_INCLUDE
        else -> MediaStore.MATCH_EXCLUDE
      })
      putInt(MediaStore.QUERY_ARG_MATCH_PENDING, MediaStore.MATCH_EXCLUDE)
    }
    val items = mutableListOf<Map<String, Any?>>()
    var total = 0
    val cursor = resolver.query(MediaStore.Files.getContentUri("external"), PROJECTION, bundle, null)
      ?: throw IllegalStateException("Android neposkytl mediální knihovnu.")
    cursor.use {
      if (excluded.isEmpty() && search == null) {
        total = it.count
        if (it.moveToPosition(offset)) {
          do {
            items.add(readAsset(it))
          } while (items.size < limit && it.moveToNext())
        }
      } else {
        // A large hidden library must not exceed SQLite's variable/expression
        // limits. Read just the ID while skipping; construct only one JS page.
        val idColumn = it.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
        val nameColumn = it.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
        while (it.moveToNext()) {
          if (excluded.contains(it.getLong(idColumn).toString())) continue
          // Unlike SQLite LIKE, Unicode comparison matches Czech upper/lowercase.
          if (search != null && !it.getString(nameColumn).orEmpty().contains(search, ignoreCase = true)) continue
          if (total >= offset && items.size < limit) items.add(readAsset(it))
          total += 1
        }
      }
    }
    val next = offset + items.size
    return mapOf("items" to items, "hasMore" to (next < total), "nextOffset" to next, "totalCount" to total)
  }

  @Suppress("UNCHECKED_CAST")
  private fun getByIds(ids: List<String>): List<Map<String, Any?>> {
    requireSupported()
    return ids.map(::normalizeId).distinct().chunked(500).flatMap { chunk ->
      val options = MediaQuery().apply { this.ids = chunk; limit = 500 }
      query(options, includeTrash = true)["items"] as List<Map<String, Any?>>
    }
  }

  private fun readAsset(cursor: Cursor): Map<String, Any?> {
    fun long(column: String): Long = cursor.getColumnIndex(column).let { if (it < 0 || cursor.isNull(it)) 0L else cursor.getLong(it) }
    fun text(column: String): String = cursor.getColumnIndex(column).let { if (it < 0 || cursor.isNull(it)) "" else cursor.getString(it) }
    val id = long(MediaStore.MediaColumns._ID)
    val video = long(MediaStore.Files.FileColumns.MEDIA_TYPE) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toLong()
    val collection = if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    val modified = long(MediaStore.MediaColumns.DATE_MODIFIED) * 1000
    val taken = long(MediaStore.MediaColumns.DATE_TAKEN)
    val expiry = long(MediaStore.MediaColumns.DATE_EXPIRES)
    val rotated = kotlin.math.abs(long(MediaStore.MediaColumns.ORIENTATION)) % 180 == 90L
    val width = long(MediaStore.MediaColumns.WIDTH)
    val height = long(MediaStore.MediaColumns.HEIGHT)
    return mapOf(
      "id" to id.toString(), "uri" to ContentUris.withAppendedId(collection, id).toString(),
      "filename" to text(MediaStore.MediaColumns.DISPLAY_NAME), "mediaType" to if (video) "video" else "photo",
      "width" to if (rotated) height else width, "height" to if (rotated) width else height,
      "creationTime" to if (taken > 0) taken else modified, "modificationTime" to modified,
      "duration" to (long(MediaStore.MediaColumns.DURATION) / 1000.0),
      "isFavorite" to (long(MediaStore.MediaColumns.IS_FAVORITE) == 1L),
      "isTrashed" to (long(MediaStore.MediaColumns.IS_TRASHED) == 1L),
      "dateExpires" to if (expiry > 0) expiry * 1000 else null
    )
  }

  private fun prepareMutation(ids: List<String>, operation: String, value: Boolean, promise: Promise) {
    try {
      val assets = getByIds(ids)
      val already = mutableListOf<String>()
      val targets = assets.filter { asset ->
        val unchanged = when (operation) {
          "trash" -> asset["isTrashed"] == value
          "favorite" -> asset["isFavorite"] == value
          else -> false
        }
        if (unchanged) already.add(asset["id"] as String)
        !unchanged
      }
      main.post {
        if (mutation != null || sharePromise != null) {
          promise.reject("E_MEDIA_BUSY", "Nejprve dokončete otevřené systémové okno.", null)
        } else {
          mutation = Mutation(operation, value, targets.chunked(2000), already, promise)
          launchNextBatch()
        }
      }
    } catch (error: Exception) {
      promise.reject("E_MEDIA_OPERATION", error.message, error)
    }
  }

  private fun launchNextBatch() {
    val current = mutation ?: return
    if (current.index >= current.batches.size) {
      finishMutation(cancelled = false)
      return
    }
    try {
      val activity = appContext.throwingActivity
      val uris = current.batches[current.index].map { Uri.parse(it["uri"] as String) }
      val request = when (current.operation) {
        "trash" -> MediaStore.createTrashRequest(resolver, uris, current.value)
        "favorite" -> MediaStore.createFavoriteRequest(resolver, uris, current.value)
        else -> MediaStore.createDeleteRequest(resolver, uris)
      }
      current.requestCode = nextRequestCode()
      activity.startIntentSenderForResult(request.intentSender, current.requestCode, null, 0, 0, 0)
    } catch (error: Exception) {
      if (current.completed.isNotEmpty()) {
        finishMutation(cancelled = true)
      } else {
        mutation = null
        current.promise.reject("E_MEDIA_OPERATION", error.message, error)
      }
    }
  }

  private fun finishMutation(cancelled: Boolean) {
    val current = mutation ?: return
    mutation = null
    current.promise.resolve(mapOf("completedIds" to current.completed.distinct(), "cancelled" to cancelled))
  }

  private fun share(ids: List<String>, promise: Promise) {
    try {
      val normalized = ids.map(::normalizeId).distinct()
      require(normalized.isNotEmpty()) { "Vyberte média ke sdílení." }
      val assets = getByIds(normalized)
      require(assets.size == normalized.size && assets.none { it["isTrashed"] == true }) {
        "Některá média už nejsou dostupná. Obnovte je z koše nebo upravte výběr."
      }
      val uris = ArrayList(assets.map { Uri.parse(it["uri"] as String) })
      val mime = when {
        assets.all { it["mediaType"] == "photo" } -> "image/*"
        assets.all { it["mediaType"] == "video" } -> "video/*"
        else -> "*/*"
      }
      val intent = Intent(if (uris.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE).apply {
        type = mime
        if (uris.size == 1) putExtra(Intent.EXTRA_STREAM, uris.first())
        else putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        clipData = ClipData.newUri(resolver, "Galerie", uris.first()).apply {
          uris.drop(1).forEach { addItem(ClipData.Item(it)) }
        }
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      main.post {
        if (mutation != null || sharePromise != null) {
          promise.reject("E_MEDIA_BUSY", "Nejprve dokončete otevřené systémové okno.", null)
        } else {
          try {
            val chooser = Intent.createChooser(intent, "Sdílet média").apply {
              addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            sharePromise = promise
            shareRequestCode = nextRequestCode()
            appContext.throwingActivity.startActivityForResult(chooser, shareRequestCode)
          } catch (error: Exception) {
            sharePromise = null
            shareRequestCode = -1
            promise.reject("E_MEDIA_SHARE", error.message, error)
          }
        }
      }
    } catch (error: Exception) {
      promise.reject("E_MEDIA_SHARE", error.message, error)
    }
  }

  private fun updateSecureFlag() {
    val enabled = secureScreen ?: return
    val activity = appContext.currentActivity ?: return
    if (enabled) activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
  }

  companion object {
    // Unique codes prevent a late result from a destroyed Activity from settling
    // a newer operation. The counter also survives Expo module recreation.
    private val requestSequence = AtomicInteger(28000)
    private fun nextRequestCode() = 28000 + requestSequence.getAndIncrement().mod(24000)
    private val PROJECTION = arrayOf(
      MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME,
      MediaStore.Files.FileColumns.MEDIA_TYPE, MediaStore.MediaColumns.WIDTH,
      MediaStore.MediaColumns.HEIGHT, MediaStore.MediaColumns.DATE_TAKEN,
      MediaStore.MediaColumns.ORIENTATION,
      MediaStore.MediaColumns.DATE_MODIFIED, MediaStore.MediaColumns.DURATION,
      MediaStore.MediaColumns.IS_FAVORITE, MediaStore.MediaColumns.IS_TRASHED,
      MediaStore.MediaColumns.DATE_EXPIRES
    )
  }
}
