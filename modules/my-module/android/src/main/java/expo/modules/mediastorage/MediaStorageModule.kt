package expo.modules.mediastorage

import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Protocol
import okio.BufferedSink
import okio.ForwardingSink
import okio.buffer
import okio.source
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.TimeUnit
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import okhttp3.Interceptor
import okhttp3.Response
import java.net.InetSocketAddress
import java.net.Socket
import java.io.RandomAccessFile
import javax.net.SocketFactory



/** Gerçek transfer hızını logcat'e yazar — bir sonraki testte size kanıt verir */
class SpeedLogInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val bodyLength = request.body?.contentLength() ?: -1
        val start = System.nanoTime()
        val response = chain.proceed(request)
        val elapsedSec = (System.nanoTime() - start) / 1_000_000_000.0
        if (bodyLength > 0 && elapsedSec > 0) {
            val mbps = (bodyLength / 1024.0 / 1024.0) / elapsedSec
            Log.d("MediaStorageModule", "Upload: ${bodyLength}B, ${"%.2f".format(elapsedSec)}s, ~${"%.2f".format(mbps)} MB/s, protokol=${response.protocol}")
        }
        return response
    }
}

class MediaStorageModule : Module() {
  private val TAG = "MediaStorageModule"

  companion object {
    @Volatile
    var instance: MediaStorageModule? = null

    fun cancelFromNotification() {
      instance?.performCancel(fromNotification = true)
    }
  }

  // Google Drive Resumable Upload için optimize edilmiş OkHttpClient (Singleton)
  // client tanımını bununla değiştirin:
	private val client = OkHttpClient.Builder()
		.connectTimeout(30, TimeUnit.SECONDS)
		.writeTimeout(10, TimeUnit.MINUTES)
		.readTimeout(60, TimeUnit.SECONDS)
		.retryOnConnectionFailure(true)
		.addNetworkInterceptor(SpeedLogInterceptor())
		.build()

  @Volatile
  private var activeCall: okhttp3.Call? = null

  @Volatile
  private var isUploadCanceled: Boolean = false

  fun performCancel(fromNotification: Boolean = false) {
    isUploadCanceled = true
    activeCall?.cancel()
    activeCall = null
    val context = appContext.reactContext ?: appContext.currentActivity
    if (context != null) {
      SyncForegroundService.stop(context)
    }
    if (fromNotification) {
      try {
        sendEvent("onSyncCancelled", mapOf("cancelled" to true))
      } catch (e: Exception) {
        Log.w(TAG, "sendEvent onSyncCancelled error: ${e.message}")
      }
    }
  }

  private fun getMimeType(file: File): String {
    val extension = file.extension.lowercase()
    if (extension.isNotEmpty()) {
      val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
      if (mime != null) return mime
    }
    return when (extension) {
      "jpg", "jpeg" -> "image/jpeg"
      "png" -> "image/png"
      "webp" -> "image/webp"
      "mp4" -> "video/mp4"
      "mov" -> "video/quicktime"
      "txt" -> "text/plain"
      else -> "application/octet-stream"
    }
  }

  override fun definition() = ModuleDefinition {
    Name("MediaStorage")

    OnCreate {
      instance = this@MediaStorageModule
    }

    OnDestroy {
      if (instance == this@MediaStorageModule) {
        instance = null
      }
    }

    // Base dizini döner: Android/media/com.burakaydogan.AstorKayit/AstorKayit
    Function("getMediaBasePath") {
      val context = appContext.reactContext ?: return@Function null
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isNotEmpty() && mediaDirs[0] != null) {
        val basePath = File(mediaDirs[0], "AstorKayit")
        return@Function basePath.absolutePath
      }
      return@Function null
    }

    // Gerekli klasör hiyerarşisini oluşturur
    AsyncFunction("initializeDirectories") {
      val context = appContext.reactContext
        ?: throw Exception("React context is not available")
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
        throw Exception("External media directory is not available")
      }

      val basePath = File(mediaDirs[0], "AstorKayit")
      val directories = listOf(
        File(basePath, "Files"),
        File(basePath, "Database"),
        File(basePath, "Backups")
      )

      val results = mutableMapOf<String, Boolean>()

      for (dir in directories) {
        val created = if (!dir.exists()) {
          dir.mkdirs()
        } else {
          true
        }
        results[dir.name] = created
      }

      return@AsyncFunction mapOf(
        "basePath" to basePath.absolutePath,
        "directories" to results,
        "success" to results.values.all { it }
      )
    }

    // Metin dosyası oluşturur ve MediaStore indeksini yeniler
    AsyncFunction("createFile") { relativePath: String, content: String ->
      val context = appContext.reactContext
        ?: throw Exception("React context is not available")
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
        throw Exception("External media directory is not available")
      }

      val basePath = File(mediaDirs[0], "AstorKayit")
      val file = File(basePath, relativePath)

      file.parentFile?.mkdirs()
      file.writeText(content)

      val mimeType = getMimeType(file)

      try {
        MediaScannerConnection.scanFile(
          context.applicationContext,
          arrayOf(file.absolutePath),
          arrayOf(mimeType)
        ) { path, uri ->
          Log.d(TAG, "createFile scanned: $path -> $uri")
        }
      } catch (e: Exception) {
        Log.w(TAG, "Scan error: ${e.message}")
      }

      return@AsyncFunction mapOf(
        "path" to file.absolutePath,
        "success" to true
      )
    }

    // Medya dosyasını hedef klasöre kopyalar ve MediaScanner'a bildirir
    AsyncFunction("saveMediaFile") { sourceUriString: String, relativeDestinationPath: String, promise: Promise ->
      try {
        val context = appContext.reactContext
          ?: throw Exception("React context is not available")
        val mediaDirs = context.externalMediaDirs
        if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
          throw Exception("External media directory is not available")
        }

        val basePath = File(mediaDirs[0], "AstorKayit")
        val destFile = File(basePath, relativeDestinationPath)

        destFile.parentFile?.mkdirs()

        val uri = Uri.parse(sourceUriString)
        val inputStream: InputStream? = if (sourceUriString.startsWith("file://") || sourceUriString.startsWith("/")) {
          val cleanPath = sourceUriString.removePrefix("file://")
          File(cleanPath).inputStream()
        } else {
          context.contentResolver.openInputStream(uri)
        }

        if (inputStream == null) {
          throw Exception("Source file could not be opened: $sourceUriString")
        }

        inputStream.use { input ->
          FileOutputStream(destFile).use { output ->
            input.copyTo(output)
            output.flush()
            try {
              output.fd.sync()
            } catch (e: Exception) {
              // Görmezden gel
            }
          }
        }

        val mimeType = getMimeType(destFile)

        MediaScannerConnection.scanFile(
          context.applicationContext,
          arrayOf(destFile.absolutePath),
          arrayOf(mimeType)
        ) { path, scannedUri ->
          Log.d(TAG, "MediaScanner completed: $path -> $scannedUri (mime: $mimeType)")
          promise.resolve(
            mapOf(
              "path" to destFile.absolutePath,
              "name" to destFile.name,
              "size" to destFile.length(),
              "mimeType" to mimeType,
              "scannedUri" to (scannedUri?.toString() ?: ""),
              "success" to true
            )
          )
        }
      } catch (e: Exception) {
        promise.reject("SAVE_MEDIA_FAILED", e.message, e)
      }
    }

    // .nomedia varlığını kontrol eder
    Function("hasNoMedia") { relativeDirectory: String ->
      val context = appContext.reactContext ?: return@Function false
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isEmpty() || mediaDirs[0] == null) return@Function false

      val basePath = File(mediaDirs[0], "AstorKayit")
      val targetDir = File(basePath, relativeDirectory)
      val noMediaFile = File(targetDir, ".nomedia")
      return@Function noMediaFile.exists()
    }

    // .nomedia dosyası oluşturur
    AsyncFunction("createNoMedia") { relativeDirectory: String, promise: Promise ->
      try {
        val context = appContext.reactContext
          ?: throw Exception("React context is not available")
        val mediaDirs = context.externalMediaDirs
        if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
          promise.resolve(false)
          return@AsyncFunction
        }

        val basePath = File(mediaDirs[0], "AstorKayit")
        val targetDir = File(basePath, relativeDirectory)
        if (!targetDir.exists()) {
          targetDir.mkdirs()
        }

        val noMediaFile = File(targetDir, ".nomedia")
        if (!noMediaFile.exists()) {
          noMediaFile.createNewFile()
        }

        MediaScannerConnection.scanFile(
          context.applicationContext,
          arrayOf(noMediaFile.absolutePath, targetDir.absolutePath),
          null
        ) { path, uri ->
          Log.d(TAG, "createNoMedia scanned: $path -> $uri")
        }

        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("CREATE_NOMEDIA_FAILED", e.message, e)
      }
    }

    // .nomedia dosyasını silip galeriyi yeniler
    AsyncFunction("removeNoMedia") { relativeDirectory: String, promise: Promise ->
      try {
        val context = appContext.reactContext
          ?: throw Exception("React context is not available")
        val mediaDirs = context.externalMediaDirs
        if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
          promise.resolve(false)
          return@AsyncFunction
        }

        val basePath = File(mediaDirs[0], "AstorKayit")
        val targetDir = File(basePath, relativeDirectory)
        val noMediaFile = File(targetDir, ".nomedia")

        if (noMediaFile.exists()) {
          noMediaFile.delete()
        }

        val files = targetDir.walkTopDown().filter { it.isFile && it.name != ".nomedia" }.toList()
        if (files.isNotEmpty()) {
          val paths = files.map { it.absolutePath }.toTypedArray()
          val mimes = files.map { getMimeType(it) }.toTypedArray()

          var scannedCount = 0
          MediaScannerConnection.scanFile(
            context.applicationContext,
            paths,
            mimes
          ) { path, uri ->
            Log.d(TAG, "removeNoMedia rescan: $path -> $uri")
            scannedCount++
            if (scannedCount >= paths.size) {
              promise.resolve(true)
            }
          }
        } else {
          promise.resolve(true)
        }
      } catch (e: Exception) {
        promise.reject("REMOVE_NOMEDIA_FAILED", e.message, e)
      }
    }

    // Belirli bir dosya/klasörü tarar
    AsyncFunction("scanFile") { relativeOrAbsolutePath: String, promise: Promise ->
      try {
        val context = appContext.reactContext
          ?: throw Exception("React context is not available")
        val mediaDirs = context.externalMediaDirs
        if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
          promise.resolve(false)
          return@AsyncFunction
        }

        val targetFile = if (relativeOrAbsolutePath.startsWith("/")) {
          File(relativeOrAbsolutePath)
        } else {
          val basePath = File(mediaDirs[0], "AstorKayit")
          File(basePath, relativeOrAbsolutePath)
        }

        if (!targetFile.exists()) {
          promise.resolve(false)
          return@AsyncFunction
        }

        val filesToScan = if (targetFile.isDirectory) {
          targetFile.walkTopDown().filter { it.isFile && it.name != ".nomedia" }.toList()
        } else {
          listOf(targetFile)
        }

        if (filesToScan.isNotEmpty()) {
          val paths = filesToScan.map { it.absolutePath }.toTypedArray()
          val mimes = filesToScan.map { getMimeType(it) }.toTypedArray()

          var scannedCount = 0
          MediaScannerConnection.scanFile(
            context.applicationContext,
            paths,
            mimes
          ) { path, uri ->
            Log.d(TAG, "Manual scan: $path -> $uri")
            scannedCount++
            if (scannedCount >= paths.size) {
              promise.resolve(true)
            }
          }
        } else {
          promise.resolve(true)
        }
      } catch (e: Exception) {
        promise.reject("SCAN_FAILED", e.message, e)
      }
    }

    // Tek bir dosya siler
    AsyncFunction("deleteFile") { relativeOrAbsolutePath: String ->
      val context = appContext.reactContext
        ?: throw Exception("React context is not available")
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
        return@AsyncFunction false
      }

      val targetFile = if (relativeOrAbsolutePath.startsWith("/")) {
        File(relativeOrAbsolutePath)
      } else {
        val basePath = File(mediaDirs[0], "AstorKayit")
        File(basePath, relativeOrAbsolutePath)
      }

      if (targetFile.name == ".nomedia") {
        return@AsyncFunction false
      }

      if (targetFile.exists()) {
        val deleted = if (targetFile.isDirectory) {
          targetFile.deleteRecursively()
        } else {
          targetFile.delete()
        }
        if (deleted) {
          try {
            MediaScannerConnection.scanFile(
              context.applicationContext,
              arrayOf(targetFile.absolutePath),
              null,
              null
            )
          } catch (e: Exception) {
            // Görmezden gel
          }
        }
        return@AsyncFunction deleted
      }
      return@AsyncFunction false
    }

    // Klasörü siler
    AsyncFunction("deleteDirectory") { relativeOrAbsolutePath: String, promise: Promise ->
      try {
        val context = appContext.reactContext
          ?: throw Exception("React context is not available")
        val mediaDirs = context.externalMediaDirs
        if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
          promise.resolve(false)
          return@AsyncFunction
        }

        val targetDir = if (relativeOrAbsolutePath.startsWith("/")) {
          File(relativeOrAbsolutePath)
        } else {
          val basePath = File(mediaDirs[0], "AstorKayit")
          File(basePath, relativeOrAbsolutePath)
        }

        if (!targetDir.exists()) {
          promise.resolve(true)
          return@AsyncFunction
        }

        val childFiles = targetDir.walkTopDown().filter { it.isFile }.map { it.absolutePath }.toList()
        val deleted = targetDir.deleteRecursively()

        if (deleted && childFiles.isNotEmpty()) {
          MediaScannerConnection.scanFile(
            context.applicationContext,
            childFiles.toTypedArray(),
            null
          ) { path, uri ->
            Log.d(TAG, "Deleted directory scanned: $path -> $uri")
          }
        }

        promise.resolve(deleted)
      } catch (e: Exception) {
        promise.reject("DELETE_DIR_FAILED", e.message, e)
      }
    }

    // Klasör altındaki dosyaları listeler
    AsyncFunction("listFiles") { relativePath: String ->
      val context = appContext.reactContext
        ?: throw Exception("React context is not available")
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      val basePath = File(mediaDirs[0], "AstorKayit")
      val targetDir = File(basePath, relativePath)

      if (!targetDir.exists() || !targetDir.isDirectory) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      return@AsyncFunction targetDir.walkTopDown()
        .filter { it.isFile && it.name != ".nomedia" }
        .sortedByDescending { it.lastModified() }
        .map { file ->
          mapOf(
            "name" to file.name,
            "path" to file.absolutePath,
            "size" to file.length(),
            "lastModified" to file.lastModified()
          )
        }.toList()
    }

    // Dosya/klasör varlığını kontrol eder
    Function("exists") { relativePath: String ->
      val context = appContext.reactContext ?: return@Function false
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
        return@Function false
      }

      val basePath = File(mediaDirs[0], "AstorKayit")
      val file = File(basePath, relativePath)
      return@Function file.exists()
    }

    // Paylaşım menüsü açar
    AsyncFunction("shareMediaFiles") { filePaths: List<String>, title: String?, message: String?, promise: Promise ->
      try {
        val context = appContext.reactContext
          ?: throw Exception("React context is not available")
        val currentActivity = appContext.currentActivity
          ?: throw Exception("Current activity is not available")

        val uris = ArrayList<Uri>()
        var primaryMimeType = "*/*"

        for (rawPath in filePaths) {
          val cleanPath = rawPath.removePrefix("file://")
          val file = File(cleanPath)
          if (file.exists()) {
            val contentUri = FileProvider.getUriForFile(
              context,
              "${context.packageName}.fileprovider",
              file
            )
            uris.add(contentUri)
            primaryMimeType = getMimeType(file)
          }
        }

        val shareIntent = if (uris.size > 1) {
          Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            val allImages = uris.isNotEmpty() && filePaths.all {
              val ext = File(it.removePrefix("file://")).extension.lowercase()
              listOf("jpg", "jpeg", "png", "webp", "gif").contains(ext)
            }
            type = if (allImages) "image/*" else "*/*"
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
          }
        } else if (uris.size == 1) {
          Intent(Intent.ACTION_SEND).apply {
            type = primaryMimeType
            putExtra(Intent.EXTRA_STREAM, uris[0])
          }
        } else {
          Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
          }
        }

        if (!message.isNullOrEmpty()) {
          shareIntent.putExtra(Intent.EXTRA_TEXT, message)
        }
        if (!title.isNullOrEmpty()) {
          shareIntent.putExtra(Intent.EXTRA_SUBJECT, title)
          shareIntent.putExtra(Intent.EXTRA_TITLE, title)
        }

        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        val chooser = Intent.createChooser(shareIntent, title ?: "Paylaş")
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        currentActivity.startActivity(chooser)

        promise.resolve(true)
      } catch (e: Exception) {
        Log.e(TAG, "shareMediaFiles failed: ${e.message}", e)
        promise.reject("SHARE_FAILED", e.message, e)
      }
    }

    // Native ZIP arşivi oluşturur
    AsyncFunction("createZipExport") { zipRelativePath: String, htmlContent: String, jsonContent: String, folderRelativePaths: List<String>, promise: Promise ->
      try {
        val context = appContext.reactContext
          ?: throw Exception("React context is not available")
        val mediaDirs = context.externalMediaDirs
        if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
          throw Exception("External media directory is not available")
        }

        val basePath = File(mediaDirs[0], "AstorKayit")
        val zipFile = File(basePath, zipRelativePath)

        zipFile.parentFile?.mkdirs()

        if (zipFile.exists()) {
          zipFile.delete()
        }

        val rootPrefix = "${zipFile.nameWithoutExtension}/"

        FileOutputStream(zipFile).use { fos ->
          BufferedOutputStream(fos).use { bos ->
            ZipOutputStream(bos).use { zos ->
              // 1. index.html ekle
              if (htmlContent.isNotEmpty()) {
                val htmlEntry = ZipEntry("${rootPrefix}index.html")
                zos.putNextEntry(htmlEntry)
                zos.write(htmlContent.toByteArray(Charsets.UTF_8))
                zos.closeEntry()
              }

              // 2. records.json ekle
              if (jsonContent.isNotEmpty()) {
                val jsonEntry = ZipEntry("${rootPrefix}records.json")
                zos.putNextEntry(jsonEntry)
                zos.write(jsonContent.toByteArray(Charsets.UTF_8))
                zos.closeEntry()
              }

              // 3. İlgili klasörlerin dosyalarını ekle
              for (relFolderPath in folderRelativePaths) {
                val folder = File(basePath, relFolderPath)
                if (folder.exists() && folder.isDirectory) {
                  val files = folder.walkTopDown().filter { it.isFile && it.name != ".nomedia" }.toList()
                  for (file in files) {
                    val entryRelativePath = file.relativeTo(basePath).path.replace('\\', '/')
                    val entry = ZipEntry("$rootPrefix$entryRelativePath")
                    
                    val ext = file.extension.lowercase()
                    if (ext == "jpg" || ext == "jpeg" || ext == "png" || ext == "webp" || ext == "mp4" || ext == "mov") {
                      entry.method = ZipEntry.STORED
                      entry.size = file.length()
                      entry.compressedSize = file.length()
                      val crc = java.util.zip.CRC32()
                      file.inputStream().use { input ->
                        val buffer = ByteArray(8192)
                        var length: Int
                        while (input.read(buffer).also { length = it } >= 0) {
                          crc.update(buffer, 0, length)
                        }
                      }
                      entry.crc = crc.value
                    }

                    zos.putNextEntry(entry)
                    FileInputStream(file).use { fis ->
                      BufferedInputStream(fis).use { bis ->
                        bis.copyTo(zos)
                      }
                    }
                    zos.closeEntry()
                  }
                }
              }

              zos.flush()
            }
          }
        }

        MediaScannerConnection.scanFile(
          context.applicationContext,
          arrayOf(zipFile.absolutePath),
          arrayOf("application/zip")
        ) { path, uri ->
          Log.d(TAG, "Zip export scanned: $path -> $uri")
        }

        promise.resolve(
          mapOf(
            "path" to zipFile.absolutePath,
            "name" to zipFile.name,
            "size" to zipFile.length(),
            "success" to true
          )
        )
      } catch (e: Exception) {
        Log.e(TAG, "createZipExport failed: ${e.message}", e)
        promise.reject("ZIP_EXPORT_FAILED", e.message, e)
      }
    }

    // Foreground Service Başlatma / Güncelleme / Durdurma
    AsyncFunction("startSyncForegroundService") { title: String, message: String, promise: Promise ->
      try {
        isUploadCanceled = false
        val context = appContext.reactContext ?: appContext.currentActivity ?: throw Exception("Context not found")
        SyncForegroundService.start(context, title, message)
        promise.resolve(true)
      } catch (e: Exception) {
        Log.e(TAG, "startSyncForegroundService failed: ${e.message}", e)
        promise.resolve(false)
      }
    }

    AsyncFunction("updateSyncForegroundService") { title: String, message: String, progress: Int, max: Int, promise: Promise ->
      try {
        val context = appContext.reactContext ?: appContext.currentActivity ?: throw Exception("Context not found")
        SyncForegroundService.update(context, title, message, progress, max)
        promise.resolve(true)
      } catch (e: Exception) {
        Log.e(TAG, "updateSyncForegroundService failed: ${e.message}", e)
        promise.resolve(false)
      }
    }

    AsyncFunction("stopSyncForegroundService") { promise: Promise ->
      try {
        val context = appContext.reactContext ?: appContext.currentActivity ?: throw Exception("Context not found")
        SyncForegroundService.stop(context)
        promise.resolve(true)
      } catch (e: Exception) {
        Log.e(TAG, "stopSyncForegroundService failed: ${e.message}", e)
        promise.resolve(false)
      }
    }

    // ⚡ Devam eden native upload işlemini anında iptal eder ve soketi kapatır
    AsyncFunction("cancelNativeUpload") { promise: Promise ->
      try {
        performCancel(fromNotification = false)
        promise.resolve(true)
      } catch (e: Exception) {
        Log.e(TAG, "cancelNativeUpload failed: ${e.message}", e)
        promise.resolve(false)
      }
    }

    Events("onUploadProgress", "onSyncCancelled")

    // Google Drive Resumable Upload (Chunked, Retries, Range, RandomAccessFile)
    AsyncFunction("nativeUploadFile") { uploadUrl: String, filePath: String, mimeType: String, promise: Promise ->
      isUploadCanceled = false
      Thread {
        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_DEFAULT)
        try {
          val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
          val file = File(cleanPath)
          if (!file.exists()) {
            promise.reject("FILE_NOT_FOUND", "File not found at $cleanPath", null)
            return@Thread
          }

          val totalLength = file.length()
          val context = appContext.reactContext ?: appContext.currentActivity
          val chunkSize = 32L * 1024L * 1024L // 32 MB chunks

          var currentOffset = 0L
          var retries = 0
          val maxRetries = 3

          if (context != null) {
            SyncForegroundService.update(
              context,
              "Google Drive Yedekleme ☁️",
              "Google Drive'a yükleniyor (%0)...",
              0,
              100
            )
          }

          val raf = RandomAccessFile(file, "r")
          raf.use { randomAccessFile ->
            while (currentOffset < totalLength) {
              if (isUploadCanceled) {
                promise.reject("CANCELLED", "Yükleme kullanıcı tarafından iptal edildi", null)
                return@Thread
              }

              val bytesLeft = totalLength - currentOffset
              val bytesToUpload = if (bytesLeft < chunkSize) bytesLeft else chunkSize
              val endOffset = currentOffset + bytesToUpload - 1

              val requestBody = object : RequestBody() {
                override fun contentType() = mimeType.toMediaTypeOrNull()
                override fun contentLength() = bytesToUpload

                override fun writeTo(sink: BufferedSink) {
                  var bytesUploaded = 0L
                  var lastUpdatePercent = -1
                  var lastEventTime = 0L

                  randomAccessFile.seek(currentOffset)

                  val buffer = ByteArray(8192)
                  var read: Int
                  while (bytesUploaded < bytesToUpload) {
                    if (isUploadCanceled) {
                      throw java.io.IOException("Canceled by user")
                    }
                    val toRead = if (bytesToUpload - bytesUploaded < buffer.size) (bytesToUpload - bytesUploaded).toInt() else buffer.size
                    read = randomAccessFile.read(buffer, 0, toRead)
                    if (read == -1) break
                    
                    sink.write(buffer, 0, read)
                    bytesUploaded += read

                    val totalUploaded = currentOffset + bytesUploaded
                    val percent = if (totalLength > 0) ((totalUploaded * 100) / totalLength).toInt() else 0
                    val now = System.currentTimeMillis()

                    if ((percent != lastUpdatePercent && (now - lastEventTime > 500)) || totalUploaded == totalLength) {
                      lastUpdatePercent = percent
                      lastEventTime = now

                      Handler(Looper.getMainLooper()).post {
                        if (context != null) {
                          SyncForegroundService.update(
                            context,
                            "Google Drive Yedekleme ☁️",
                            "Google Drive'a yükleniyor (%$percent)...",
                            percent,
                            100
                          )
                        }
                        sendEvent("onUploadProgress", mapOf(
                          "percent" to percent,
                          "bytesSent" to totalUploaded,
                          "totalBytes" to totalLength
                        ))
                      }
                    }
                  }
                  sink.flush()
                }
              }

              val request = Request.Builder()
                .url(uploadUrl)
                .put(requestBody)
                .addHeader("Content-Range", "bytes $currentOffset-$endOffset/$totalLength")
                .build()

              val call = client.newCall(request)
              activeCall = call

              try {
                call.execute().use { response ->
                  activeCall = null
                  val responseBody = response.body?.string() ?: ""
                  
                  if (response.code == 308) {
                    val rangeHeader = response.header("Range")
                    if (rangeHeader != null && rangeHeader.startsWith("bytes=0-")) {
                      val lastUploadedByte = rangeHeader.substring(8).toLongOrNull() ?: -1L
                      currentOffset = lastUploadedByte + 1
                    } else {
                      currentOffset = 0L
                    }
                    retries = 0 // reset retries on progress
                  } else if (response.isSuccessful) {
                    promise.resolve(mapOf(
                      "success" to true,
                      "statusCode" to response.code,
                      "body" to responseBody
                    ))
                    return@Thread
                  } else {
                    throw java.io.IOException("HTTP ${response.code}: $responseBody")
                  }
                }
              } catch (e: Exception) {
                activeCall = null
                if (isUploadCanceled || e.message == "Canceled by user" || e.message?.contains("Canceled") == true || e.message?.contains("Socket closed") == true || e.message?.contains("Socket is closed") == true) {
                    promise.reject("CANCELLED", "Yükleme kullanıcı tarafından iptal edildi", null)
                    return@Thread
                }
                
                retries++
                if (retries > maxRetries) {
                  promise.reject("UPLOAD_ERROR", "Max retries exceeded: ${e.message}", e)
                  return@Thread
                }
                
                Log.w(TAG, "Chunk upload failed, retrying ($retries/$maxRetries). Error: ${e.message}")
                Thread.sleep((1000L * Math.pow(2.0, (retries - 1).toDouble())).toLong())
                
                // Query server for current status (308 resume query)
                try {
                  val emptyBody = object : RequestBody() {
                    override fun contentType() = null
                    override fun contentLength() = 0L
                    override fun writeTo(sink: BufferedSink) {}
                  }
                  
                  val statusRequest = Request.Builder()
                    .url(uploadUrl)
                    .put(emptyBody)
                    .addHeader("Content-Range", "bytes */$totalLength")
                    .build()
                    
                  val statusCall = client.newCall(statusRequest)
                  activeCall = statusCall
                  statusCall.execute().use { statusResponse ->
                    activeCall = null
                    if (statusResponse.code == 308) {
                      val rangeHeader = statusResponse.header("Range")
                      if (rangeHeader != null && rangeHeader.startsWith("bytes=0-")) {
                        val lastUploadedByte = rangeHeader.substring(8).toLongOrNull() ?: -1L
                        currentOffset = lastUploadedByte + 1
                      } else {
                        currentOffset = 0L // Start from beginning if server has nothing
                      }
                    } else if (statusResponse.isSuccessful) {
                      promise.resolve(mapOf("success" to true, "statusCode" to statusResponse.code, "body" to (statusResponse.body?.string() ?: "")))
                      return@Thread
                    } else {
                       throw java.io.IOException("Status check failed: HTTP ${statusResponse.code}")
                    }
                  }
                } catch (statusException: Exception) {
                  Log.e(TAG, "Status check failed: ${statusException.message}")
                }
              }
            } // while end
          } // raf use end
        } catch (e: Exception) {
          activeCall = null
          Log.e(TAG, "nativeUploadFile failed: ${e.message}", e)
          promise.reject("UPLOAD_ERROR", e.message, e)
        }
      }.start()
    }
  }
}