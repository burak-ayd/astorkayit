package expo.modules.mediastorage

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class SyncForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "astor_sync_foreground_channel"
        const val NOTIFICATION_ID = 9901

        const val ACTION_START = "ACTION_START"
        const val ACTION_UPDATE = "ACTION_UPDATE"
        const val ACTION_STOP = "ACTION_STOP"

        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_MESSAGE = "EXTRA_MESSAGE"
        const val EXTRA_PROGRESS = "EXTRA_PROGRESS"
        const val EXTRA_MAX_PROGRESS = "EXTRA_MAX_PROGRESS"

        fun start(context: Context, title: String, message: String) {
            val intent = Intent(context, SyncForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_MESSAGE, message)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun update(context: Context, title: String, message: String, progress: Int, max: Int) {
            val intent = Intent(context, SyncForegroundService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_MESSAGE, message)
                putExtra(EXTRA_PROGRESS, progress)
                putExtra(EXTRA_MAX_PROGRESS, max)
            }
            context.startService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, SyncForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_NOT_STICKY

        when (action) {
            ACTION_START -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "Yedekleme İşlemi"
                val message = intent.getStringExtra(EXTRA_MESSAGE) ?: "Yedekleme devam ediyor..."
                val notification = buildNotification(title, message, -1, -1)
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val serviceType = if (Build.VERSION.SDK_INT >= 34) {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    } else {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    }
                    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, serviceType)
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
            }
            ACTION_UPDATE -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "Yedekleme İşlemi"
                val message = intent.getStringExtra(EXTRA_MESSAGE) ?: "Yedekleniyor..."
                val progress = intent.getIntExtra(EXTRA_PROGRESS, -1)
                val max = intent.getIntExtra(EXTRA_MAX_PROGRESS, -1)
                
                val notification = buildNotification(title, message, progress, max)
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, notification)
            }
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }

        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Yedekleme ve Senkronizasyon",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Yedekleme ve dosya aktarımı sırasında çalışan ön plan bildirimleri"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(title: String, message: String, progress: Int, max: Int): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = if (launchIntent != null) {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            PendingIntent.getActivity(this, 0, launchIntent, flags)
        } else null

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(message)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent)
        }

        if (max > 0 && progress >= 0) {
            builder.setProgress(max, progress, false)
        } else if (progress == -1 && max == -1) {
            builder.setProgress(0, 0, true) // Indeterminate progress
        }

        return builder.build()
    }
}
