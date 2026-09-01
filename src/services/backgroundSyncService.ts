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
 * Günlük eşitleme (Test için saat 03:00) zamanı geldi mi kontrol eder
 */
function shouldRunDailySync(lastSyncStr: string | null): boolean {
	const now = new Date();
	const targetTimeToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		3,
		0,
		0,
		0,
	);

	if (now < targetTimeToday) {
		// Saat henüz 03:00 olmadı
		if (!lastSyncStr) return false;
		const targetTimeYesterday = new Date(
			targetTimeToday.getTime() - 24 * 60 * 60 * 1000,
		);
		return new Date(lastSyncStr) < targetTimeYesterday;
	}

	// Saat 03:00 veya sonrası
	if (!lastSyncStr) return true;
	return new Date(lastSyncStr) < targetTimeToday;
}

/**
 * Haftalık eşitleme (Her Pazartesi gece saat 03:00) zamanı geldi mi kontrol eder
 */
function shouldRunWeeklySync(lastSyncStr: string | null): boolean {
	const now = new Date();
	const day = now.getDay(); // 0: Paz, 1: Pzt, ..., 6: Cmt
	const daysSinceMonday = (day + 6) % 7;

	const mostRecentMonday3AM = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate() - daysSinceMonday,
		3,
		0,
		0,
		0,
	);

	if (now < mostRecentMonday3AM) {
		if (!lastSyncStr) return false;
		const prevMonday3AM = new Date(
			mostRecentMonday3AM.getTime() - 7 * 24 * 60 * 60 * 1000,
		);
		return new Date(lastSyncStr) < prevMonday3AM;
	}

	if (!lastSyncStr) return true;
	return new Date(lastSyncStr) < mostRecentMonday3AM;
}

/**
 * Expo TaskManager ile arka plan otomatik senkronizasyon görevini tanımlar
 * (Top-level scope'ta tanımlanmalıdır)
 */
TaskManager.defineTask(DRIVE_BACKGROUND_SYNC_TASK, async () => {
	try {
		console.log(
			"🔄 [Drive Arka Plan Görevi] Otomatik senkronizasyon kontrolü tetiklendi.",
		);

		// Veritabanından ayarları oku
		const accessTokenStored = await db.getSetting("gdrive_access_token");
		const isConnected =
			(await db.getSetting("gdrive_connected")) === "1" ||
			!!accessTokenStored;
		const autoSyncEnabled =
			(await db.getSetting("gdrive_auto_sync")) === "1";
		const autoSyncFreq =
			(await db.getSetting("gdrive_auto_sync_frequency")) || "on_change";
		const customHours = parseInt(
			(await db.getSetting("gdrive_auto_sync_custom_hours")) || "6",
			10,
		);
		const syncOnWifiOnly =
			(await db.getSetting("gdrive_wifi_only")) !== "0";
		const syncMode = (await db.getSetting("gdrive_sync_mode")) || "folders";
		const lastSync = await db.getSetting("gdrive_last_sync");

		if (!isConnected || !autoSyncEnabled) {
			console.log(
				"ℹ️ [Drive Arka Plan Görevi] Atlandı: Google Drive hesabı bağlı değil veya otomatik eşitleme kapalı.",
			);
			return BackgroundTask.BackgroundTaskResult.Success;
		}

		// 'on_change' modunda arka plan zamanlayıcısı çalıştırmıyoruz
		if (autoSyncFreq === "on_change") {
			console.log(
				"ℹ️ [Drive Arka Plan Görevi] Atlandı: Otomatik eşitleme 'Yeni Kayıtlarda' modunda (anı kaydedildiğinde çalışır).",
			);
			return BackgroundTask.BackgroundTaskResult.Success;
		}

		// Zaman ve periyot denetimi (Günlük 03:00 / Pazartesi 03:00 / Özel)
		if (autoSyncFreq === "daily") {
			if (!shouldRunDailySync(lastSync)) {
				console.log(
					"⏳ [Drive Arka Plan Görevi] Atlandı: Günlük eşitleme zamanı (gece 00:05) henüz gelmedi.",
				);
				return BackgroundTask.BackgroundTaskResult.Success;
			}
		} else if (autoSyncFreq === "weekly") {
			if (!shouldRunWeeklySync(lastSync)) {
				console.log(
					"⏳ [Drive Arka Plan Görevi] Atlandı: Haftalık eşitleme zamanı (Pazartesi gece 03:00) henüz gelmedi.",
				);
				return BackgroundTask.BackgroundTaskResult.Success;
			}
		} else if (autoSyncFreq === "custom") {
			if (lastSync) {
				const elapsedMs = Date.now() - new Date(lastSync).getTime();
				const requiredIntervalMs =
					Math.max(1, isNaN(customHours) ? 6 : customHours) *
					60 *
					60 *
					1000;
				if (elapsedMs < requiredIntervalMs) {
					console.log(
						`⏳ [Drive Arka Plan Görevi] Atlandı: Özel süre aralığı (${customHours} saat) henüz dolmadı.`,
					);
					return BackgroundTask.BackgroundTaskResult.Success;
				}
			}
		}

		// Google Play Services üzerinden taze accessToken al
		const accessToken = await getFreshAccessToken();
		if (!accessToken) {
			console.warn(
				"⚠️ [Drive Arka Plan Görevi] Google Play erişim belirteci (access token) yenilenemedi.",
			);
			return BackgroundTask.BackgroundTaskResult.Failed;
		}

		// Veritabanındaki tüm kayıtları oku
		const records = await db.getAllRecords();
		console.log(
			`🚀 [Drive Arka Plan Görevi] ${records.length} adet kayıt için arka plan senkronizasyonu başlatılıyor (${syncMode === "folders" ? "Klasör Ağacı" : "ZIP"} modu)...`,
		);

		// Senkronizasyonu başlat (Seçilen moda göre)
		const result =
			syncMode === "folders"
				? await syncAllRecordsToDrive(
						accessToken,
						records,
						syncOnWifiOnly,
					)
				: await syncZipArchiveToDrive(
						accessToken,
						records,
						syncOnWifiOnly,
					);

		if (result.success) {
			const now = new Date().toISOString();
			await db.setSetting("gdrive_last_sync", now);
			console.log(
				`✅ [Drive Arka Plan Görevi] Otomatik senkronizasyon başarıyla tamamlandı (${result.uploadedCount} kayıt).`,
			);

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
			console.warn(
				"❌ [Drive Arka Plan Görevi] Senkronizasyon tamamlanamadı:",
				result.error,
			);
			return BackgroundTask.BackgroundTaskResult.Failed;
		}
	} catch (error) {
		console.error("❌ [Drive Arka Plan Görevi] Beklenmeyen hata:", error);
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
			await BackgroundTask.registerTaskAsync(DRIVE_BACKGROUND_SYNC_TASK, {
				minimumInterval: 15 * 60, // Minimum 15 dakika aralık (Android WorkManager standardı)
			});
			console.log(
				"✅ [Drive Arka Plan Görevi] Android arka plan senkronizasyon görevi sisteme kaydedildi (Zamanlayıcı Aktif).",
			);
		}
	} catch (error) {
		console.warn(
			"⚠️ [Drive Arka Plan Görevi] Arka plan görevi kaydı sırasında hata:",
			error,
		);
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
			await BackgroundTask.unregisterTaskAsync(
				DRIVE_BACKGROUND_SYNC_TASK,
			);
			console.log(
				"⏹️ [Drive Arka Plan Görevi] Android arka plan senkronizasyon görevi sistemden kaldırıldı (Zamanlayıcı Durduruldu).",
			);
		}
	} catch (error) {
		console.warn(
			"⚠️ [Drive Arka Plan Görevi] Görev iptali sırasında hata:",
			error,
		);
	}
}
