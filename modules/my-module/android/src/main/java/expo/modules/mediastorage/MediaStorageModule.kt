package expo.modules.mediastorage

import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.util.Log
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class MediaStorageModule : Module() {
  private val TAG = "MediaStorageModule"

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

    // Returns the base path: Android/media/com.burakaydogan.AstorKayit/AstorKayit
    Function("getMediaBasePath") {
      val context = appContext.reactContext ?: return@Function null
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isNotEmpty() && mediaDirs[0] != null) {
        val basePath = File(mediaDirs[0], "AstorKayit")
        return@Function basePath.absolutePath
      }
      return@Function null
    }

    // Initialize the directory structure:
    // Android/media/com.burakaydogan.AstorKayit/AstorKayit/
    //   ├── Files/
    //   ├── Database/
    //   └── Backups/
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

    // Create a text file at the given relative path under the base directory
    AsyncFunction("createFile") { relativePath: String, content: String ->
      val context = appContext.reactContext
        ?: throw Exception("React context is not available")
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isEmpty() || mediaDirs[0] == null) {
        throw Exception("External media directory is not available")
      }

      val basePath = File(mediaDirs[0], "AstorKayit")
      val file = File(basePath, relativePath)

      // Ensure parent directory exists
      file.parentFile?.mkdirs()

      file.writeText(content)

      val mimeType = getMimeType(file)

      // Scan file with MediaScannerConnection so it's indexed immediately
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

    // Save/copy a media file (image, video, etc.) from a URI to relative path under base directory
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

        // Ensure parent directory exists
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
              // Ignore fd sync if not supported
            }
          }
        }

        val mimeType = getMimeType(destFile)

        // Trigger MediaScannerConnection and resolve promise once indexed
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

    // Check if .nomedia exists in the given relative directory (e.g. "Files")
    Function("hasNoMedia") { relativeDirectory: String ->
      val context = appContext.reactContext ?: return@Function false
      val mediaDirs = context.externalMediaDirs
      if (mediaDirs.isEmpty() || mediaDirs[0] == null) return@Function false

      val basePath = File(mediaDirs[0], "AstorKayit")
      val targetDir = File(basePath, relativeDirectory)
      val noMediaFile = File(targetDir, ".nomedia")
      return@Function noMediaFile.exists()
    }

    // Explicitly create .nomedia in the given directory to hide files from Android gallery
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

        // Scan the directory so gallery immediately hides all contents
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

    // Explicitly remove .nomedia from the given directory and rescan all media files so they appear in gallery
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

        // Rescan all files (including subdirectories like record_*) so gallery immediately detects them
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

    // Explicitly scan a file or all files in a relative directory
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

    // Delete a single file (.nomedia cannot be deleted with deleteFile; must use removeNoMedia)
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

      // Prohibit deleting .nomedia via regular deleteFile
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
            // Ignore
          }
        }
        return@AsyncFunction deleted
      }
      return@AsyncFunction false
    }

    // Delete a directory recursively (e.g. "Files/record_123") and scan all deleted files out of MediaStore
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

    // List all files recursively in a relative directory
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

    // Check if a path exists
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

    // Share one or more media files along with title and message via native Android Intent
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
  }
}
