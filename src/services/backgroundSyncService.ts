import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import * as db from "@/database/db";
import {
	getFreshAccessToken,
	syncAllRecordsToDrive,
	syncZipArchiveToDrive,
} from "@/services/googleDriveService";
import { sendTaskNotification } from "@/services/notificationService";

export const DRIVE_BACKGROUND_SYNC_TASK = "DRIVE_BACKGROUND_SYNC_TASK";

/**
 * Expo TaskManager ile arka plan otomatik senkronizasyon görevini tanımlar
 * (Top-level scope'ta tanımlanmalıdır)
 */
TaskManager.defineTask(DRIVE_BACKGROUND_SYNC_TASK, async () => {
	try {
		console.log("[BackgroundTask] Otomatik Drive senkronizasyonu çalışıyor...");

		// Veritabanından ayarları oku
		const isConnected = (await db.getSetting("gdrive_connected")) === "1";
		const autoSyncEnabled =
			(await db.getSetting("gdrive_auto_sync")) === "1";
		const syncOnWifiOnly = (await db.getSetting("gdrive_wifi_only")) !== "0";
		const syncMode = (await db.getSetting("gdrive_sync_mode")) || "zip";

		if (!isConnected || !autoSyncEnabled) {
			console.log(
				"[BackgroundTask] Drive bağlı değil veya otomatik eşitleme kapalı.",
			);
			return BackgroundTask.BackgroundTaskResult.Success;
		}

		// Google Play Services üzerinden taze accessToken al
		const accessToken = await getFreshAccessToken();
		if (!accessToken) {
			console.warn("[BackgroundTask] Erişim belirteci alınamadı.");
			return BackgroundTask.BackgroundTaskResult.Failed;
		}

		// Veritabanındaki tüm kayıtları oku
		const records = await db.getAllRecords();

		// Senkronizasyonu başlat (Seçilen moda göre)
		const result =
			syncMode === "folders"
				? await syncAllRecordsToDrive(accessToken, records, syncOnWifiOnly)
				: await syncZipArchiveToDrive(accessToken, records, syncOnWifiOnly);

		if (result.success) {
			const now = new Date().toISOString();
			await db.setSetting("gdrive_last_sync", now);

			await sendTaskNotification({
				title: "Otomatik Eşitleme Tamamlandı ☁️",
				body: `${result.uploadedCount} adet anı kaydı arka planda Google Drive'a yedeklendi.`,
				alertTitle: "Arka Plan Senkronizasyonu",
				alertMessage: `${result.uploadedCount} adet kayıt ve tüm fotoğrafları başarıyla eşitlendi.`,
				alertType: "success",
				actionType: "drive_sync",
			});

			return BackgroundTask.BackgroundTaskResult.Success;
		} else {
			console.warn("[BackgroundTask] Eşitleme başarısız:", result.error);
			return BackgroundTask.BackgroundTaskResult.Failed;
		}
	} catch (error) {
		console.error("[BackgroundTask] Hata:", error);
		return BackgroundTask.BackgroundTaskResult.Failed;
	}
});

/**
 * Arka plan senkronizasyon görevini sisteme kaydeder
 */
export async function registerBackgroundSyncTask() {
	try {
		const isRegistered = await TaskManager.isTaskRegisteredAsync(
			DRIVE_BACKGROUND_SYNC_TASK,
		);
		if (!isRegistered) {
			await BackgroundTask.registerTaskAsync(
				DRIVE_BACKGROUND_SYNC_TASK,
				{
					minimumInterval: 15 * 60, // Minimum 15 dakika aralık (Android WorkManager standardı)
				},
			);
			console.log("[BackgroundTask] Görev başarıyla kaydedildi.");
		}
	} catch (error) {
		console.warn("[BackgroundTask] Görev kaydı hatası:", error);
	}
}

/**
 * Arka plan senkronizasyon görevini iptal eder
 */
export async function unregisterBackgroundSyncTask() {
	try {
		const isRegistered = await TaskManager.isTaskRegisteredAsync(
			DRIVE_BACKGROUND_SYNC_TASK,
		);
		if (isRegistered) {
			await BackgroundTask.unregisterTaskAsync(DRIVE_BACKGROUND_SYNC_TASK);
			console.log("[BackgroundTask] Görev kaydı kaldırıldı.");
		}
	} catch (error) {
		console.warn("[BackgroundTask] Görev iptal hatası:", error);
	}
}
