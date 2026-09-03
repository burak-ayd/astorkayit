import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import * as Network from "expo-network";

import * as db from "@/database/db";
import {
	getFreshAccessToken,
	syncAllRecordsToDrive,
	syncZipArchiveToDrive,
	isNetworkAllowedForSync,
} from "@/services/googleDriveService";
import { sendTaskNotification } from "@/services/notificationService";
import { bgLog } from "@/services/backgroundLogger";

export const DRIVE_BACKGROUND_SYNC_TASK = "DRIVE_BACKGROUND_SYNC_TASK";

/** Arka plan görevi için dahili zaman aşımı (90 saniye) */
const TASK_TIMEOUT_MS = 90_000;

/**
 * Görev içinde kontrollü zaman aşımı sağlar.
 * WorkManager zaten görevi kesecek ama biz kontrolü kaybetmeden
 * durumu kaydedip düzgün çıkış yaparız.
 */
function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	onTimeout: () => void,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			onTimeout();
			reject(new Error("TASK_TIMEOUT"));
		}, timeoutMs);

		promise
			.then((val) => {
				clearTimeout(timer);
				resolve(val);
			})
			.catch((err) => {
				clearTimeout(timer);
				reject(err);
			});
	});
}

/**
 * Expo TaskManager ile arka plan otomatik senkronizasyon görevini tanımlar
 * (Top-level scope'ta tanımlanmalıdır)
 */
TaskManager.defineTask(DRIVE_BACKGROUND_SYNC_TASK, async () => {
	const taskStartTime = Date.now();

	try {
		// ═══════════════════════════════════════════════
		// 📝 BÖLÜM 1: Dosya tabanlı loglama (kaynak etiketli)
		// ═══════════════════════════════════════════════
		await bgLog("INFO", "task_started", "Arka plan görevi tetiklendi.", {
			timestamp: new Date().toISOString(),
			source: "background_task_manager",
		});

		// ═══════════════════════════════════════════════
		// 📝 BÖLÜM 1: Ağ durumu logu
		// ═══════════════════════════════════════════════
		let networkType = "unknown";
		let isConnected = false;
		try {
			const netState = await Network.getNetworkStateAsync();
			networkType = netState.type
				? Network.NetworkStateType[netState.type]
				: "unknown";
			isConnected =
				!!netState.isConnected && !!netState.isInternetReachable;
			await bgLog("INFO", "network_check", "Ağ durumu kontrol edildi.", {
				type: networkType,
				isConnected,
				isInternetReachable: netState.isInternetReachable,
			});
		} catch (netErr) {
			await bgLog(
				"WARN",
				"network_check",
				"Ağ durumu okunamadı, varsayılan ile devam.",
				{ error: String(netErr) },
			);
		}

		// Veritabanından ayarları oku
		const accessTokenStored = await db.getSetting("gdrive_access_token");
		const driveConnected =
			(await db.getSetting("gdrive_connected")) === "1" ||
			!!accessTokenStored;
		const autoSyncEnabled =
			(await db.getSetting("gdrive_auto_sync")) === "1";
		const autoSyncFreq =
			(await db.getSetting("gdrive_auto_sync_frequency")) || "on_change";
		const syncOnWifiOnly =
			(await db.getSetting("gdrive_wifi_only")) !== "0";
		const syncMode =
			(await db.getSetting("gdrive_sync_mode")) || "folders";
		const lastSync = await db.getSetting("gdrive_last_sync");

		if (!driveConnected || !autoSyncEnabled) {
			await bgLog(
				"INFO",
				"task_skipped",
				"Atlandı: Hesap bağlı değil veya otomatik eşitleme kapalı.",
				{ driveConnected, autoSyncEnabled },
			);
			return BackgroundTask.BackgroundTaskResult.Success;
		}

		// 'on_change' modunda arka plan zamanlayıcısı çalıştırmıyoruz
		if (autoSyncFreq === "on_change") {
			await bgLog(
				"INFO",
				"task_skipped",
				"Atlandı: 'Yeni Kayıtlarda' modunda.",
			);
			return BackgroundTask.BackgroundTaskResult.Success;
		}

		// ═══════════════════════════════════════════════
		// 📝 BÖLÜM 3: Wi-Fi / Mobil Veri kontrolü
		// ═══════════════════════════════════════════════
		const netCheck = await isNetworkAllowedForSync(syncOnWifiOnly);
		if (!netCheck.allowed) {
			await bgLog(
				"INFO",
				"task_skipped",
				`Ağ koşulları uygun değil: ${netCheck.reason}`,
				{ syncOnWifiOnly, networkType },
			);
			return BackgroundTask.BackgroundTaskResult.Success;
		}

		// ─── Zaman kontrolünü kaldırıyoruz ───
		// BÖLÜM 3 kararı: "gece 3" hedefinden vazgeçildi.
		// minimumInterval: 1440 ile "günde 1 kez, sistem uygun gördüğünde"
		// WorkManager'ın kendisi zaten interval kontrolü yapıyor.
		// Bu sayede görev her tetiklendiğinde upload denemesi yapılır.

		// Son 24 saatte başarılı sync oldu mu? (Gereksiz tekrar engellemesi)
		if (lastSync) {
			const elapsedMs = Date.now() - new Date(lastSync).getTime();
			const MIN_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 saat
			if (elapsedMs < MIN_INTERVAL_MS) {
				await bgLog(
					"INFO",
					"task_skipped",
					`Son senkronizasyondan bu yana sadece ${Math.round(elapsedMs / 60000)} dakika geçti (min 12 saat).`,
				);
				return BackgroundTask.BackgroundTaskResult.Success;
			}
		}

		// Google Play Services üzerinden taze accessToken al
		await bgLog(
			"INFO",
			"token_refresh",
			"Access token yenileniyor...",
		);
		let accessToken = await getFreshAccessToken();
		if (!accessToken && accessTokenStored) {
			await bgLog(
				"INFO",
				"token_fallback",
				"Taze token alınamadı (Headless mod), kayıtlı access token kullanılıyor.",
			);
			accessToken = accessTokenStored;
		}
		if (!accessToken) {
			await bgLog(
				"WARN",
				"token_failed",
				"Access token bulunamadı.",
			);
			return BackgroundTask.BackgroundTaskResult.Failed;
		}
		await bgLog(
			"INFO",
			"token_refresh",
			"Access token başarıyla alındı.",
		);

		// Veritabanındaki tüm kayıtları oku
		const records = await db.getAllRecords();
		await bgLog(
			"INFO",
			"sync_start",
			`${records.length} kayıt için senkronizasyon başlatılıyor.`,
			{ syncMode, recordCount: records.length },
		);

		// ═══════════════════════════════════════════════
		// 📝 BÖLÜM 2: Zaman aşımı ile senkronizasyonu başlat
		// ═══════════════════════════════════════════════
		const abortController = new AbortController();

		const syncPromise =
			syncMode === "folders"
				? syncAllRecordsToDrive(
						accessToken,
						records,
						syncOnWifiOnly,
						undefined,
						abortController.signal,
						true,
					)
				: syncZipArchiveToDrive(
						accessToken,
						records,
						syncOnWifiOnly,
						undefined,
						abortController.signal,
						true,
					);

		const result = await withTimeout(
			syncPromise,
			TASK_TIMEOUT_MS,
			() => {
				abortController.abort();
			},
		);

		if (result.success) {
			const now = new Date().toISOString();
			await db.setSetting("gdrive_last_sync", now);

			const taskDurationMs = Date.now() - taskStartTime;
			await bgLog(
				"INFO",
				"upload_success",
				`Senkronizasyon başarıyla tamamlandı.`,
				{
					uploadedCount: result.uploadedCount,
					durationMs: taskDurationMs,
				},
			);

			await sendTaskNotification({
				title: "Otomatik Eşitleme Tamamlandı ☁️",
				body: `${result.uploadedCount} adet anı kaydı arka planda Google Drive'a yedeklendi.`,
				alertTitle: "Arka Plan Senkronizasyonu",
				alertMessage: `${result.uploadedCount} adet kayıt ve tüm fotoğrafları başarıyla eşitlendi.`,
				alertType: "success",
				actionType: "drive_sync",
			});

			const taskEndTime = Date.now();
			await bgLog(
				"INFO",
				"task_ended",
				"Görev başarıyla tamamlandı.",
				{
					durationMs: taskEndTime - taskStartTime,
					durationSec: Math.round(
						(taskEndTime - taskStartTime) / 1000,
					),
				},
			);

			return BackgroundTask.BackgroundTaskResult.Success;
		} else {
			await bgLog(
				"WARN",
				"upload_failed",
				`Senkronizasyon tamamlanamadı.`,
				{ error: result.error },
			);
			return BackgroundTask.BackgroundTaskResult.Failed;
		}
	} catch (error: any) {
		const taskEndTime = Date.now();
		const errorMsg = String(error);
		const isTimeout =
			errorMsg.includes("TASK_TIMEOUT") ||
			error?.message === "TASK_TIMEOUT";

		if (isTimeout) {
			await bgLog(
				"WARN",
				"task_timeout",
				`Görev dahili zaman aşımına uğradı (${TASK_TIMEOUT_MS / 1000}s). State korundu, bir sonraki tetiklemede devam edilecek.`,
				{
					durationMs: taskEndTime - taskStartTime,
				},
			);
		} else {
			await bgLog(
				"ERROR",
				"task_error",
				`Beklenmeyen hata: ${errorMsg}`,
				{
					durationMs: taskEndTime - taskStartTime,
				},
			);
		}

		await bgLog("INFO", "task_ended", "Görev hata ile sonlandı.", {
			durationMs: taskEndTime - taskStartTime,
			durationSec: Math.round((taskEndTime - taskStartTime) / 1000),
		});

		return BackgroundTask.BackgroundTaskResult.Failed;
	}
});

/**
 * Arka plan senkronizasyon görevini sisteme kaydeder
 *
 * BÖLÜM 3: minimumInterval 1440 dakika (24 saat) olarak ayarlandı.
 * "Gece 3" hedefinden vazgeçildi → "günde 1 kez, sistem uygun gördüğünde"
 */
export async function registerBackgroundSyncTask() {
	try {
		const isRegistered = await TaskManager.isTaskRegisteredAsync(
			DRIVE_BACKGROUND_SYNC_TASK,
		);
		if (!isRegistered) {
			await BackgroundTask.registerTaskAsync(DRIVE_BACKGROUND_SYNC_TASK, {
				minimumInterval: 60 * 24, // 24 saat (dakika cinsinden) — günde 1 kez
			});
			await bgLog(
				"INFO",
				"task_registered",
				"Arka plan görevi sisteme kaydedildi (interval: 24 saat).",
			);
			console.log(
				"✅ [Drive Arka Plan Görevi] Android arka plan senkronizasyon görevi sisteme kaydedildi (24 saat interval).",
			);
		}
	} catch (error) {
		await bgLog("ERROR", "task_register_error", "Görev kaydı başarısız.", {
			error: String(error),
		});
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
			await bgLog(
				"INFO",
				"task_unregistered",
				"Arka plan görevi sistemden kaldırıldı.",
			);
			console.log(
				"⏹️ [Drive Arka Plan Görevi] Android arka plan senkronizasyon görevi sistemden kaldırıldı.",
			);
		}
	} catch (error) {
		console.warn(
			"⚠️ [Drive Arka Plan Görevi] Görev iptali sırasında hata:",
			error,
		);
	}
}

/**
 * BÖLÜM 3: Görev kaydının sağlıklı olduğunu doğrular.
 * Uygulama her açıldığında çağrılır — kayıp/silinmiş kayıt varsa yeniden kaydeder.
 */
export async function ensureBackgroundTaskRegistered(): Promise<void> {
	try {
		const driveConnected =
			(await db.getSetting("gdrive_connected")) === "1" ||
			!!(await db.getSetting("gdrive_access_token"));
		const autoSyncEnabled =
			(await db.getSetting("gdrive_auto_sync")) === "1";
		const autoSyncFreq =
			(await db.getSetting("gdrive_auto_sync_frequency")) || "on_change";

		if (driveConnected && autoSyncEnabled && autoSyncFreq !== "on_change") {
			const isRegistered = await TaskManager.isTaskRegisteredAsync(
				DRIVE_BACKGROUND_SYNC_TASK,
			);
			if (!isRegistered) {
				console.log(
					"🔧 [Drive Arka Plan Görevi] Görev kaydı kaybolmuş, yeniden kaydediliyor...",
				);
				await registerBackgroundSyncTask();
			} else {
				// OneTimeWorkRequest zinciri kırılmış olabilir —
				// unregister + re-register ile zinciri sıfırla.
				// expo-background-task, Android 8+ için OneTimeWorkRequest
				// zinciri kullanıyor; görev foreground'da atlanırsa
				// bir sonraki zincir halkası zamanlanmayabilir.
				await bgLog(
					"INFO",
					"task_chain_reset",
					"Görev kayıtlı ama zincir sıfırlanıyor (foreground açılışı).",
					{ source: "foreground_app_open" },
				);
				await unregisterBackgroundSyncTask();
				await registerBackgroundSyncTask();
			}
		}
	} catch (e) {
		console.warn(
			"⚠️ [Drive Arka Plan Görevi] Görev kontrolü sırasında hata:",
			e,
		);
	}
}

/** Son yedeklemeden bu yana geçen süreye göre fallback türü */
export type FallbackResult =
	| { needed: false }
	| { needed: true; mode: "auto" | "prompt"; hoursSince: number };

/**
 * BÖLÜM 3 + 4: Uygulama açılışı güvenlik ağı (Fallback).
 *
 * - Hiç sync yoksa → prompt (kullanıcıya sor)
 * - 20-24 saat arası → auto (sessizce foreground sync başlat)
 * - 24+ saat → prompt (uyarı göster + otomatik başlat)
 *
 * Böylece arka plan görevi hiç çalışmasa bile her uygulama açılışında
 * foreground sync güvence altına alınmış olur.
 */
export async function checkAndRunFallbackSync(): Promise<FallbackResult> {
	try {
		const driveConnected =
			(await db.getSetting("gdrive_connected")) === "1" ||
			!!(await db.getSetting("gdrive_access_token"));
		const autoSyncEnabled =
			(await db.getSetting("gdrive_auto_sync")) === "1";

		if (!driveConnected || !autoSyncEnabled) return { needed: false };

		const lastSync = await db.getSetting("gdrive_last_sync");
		if (!lastSync) {
			// Hiç sync yapılmamış — kullanıcıya sor
			await bgLog(
				"INFO",
				"fallback_check",
				"Hiç yedekleme yapılmamış, fallback prompt.",
				{ source: "foreground_app_open" },
			);
			return { needed: true, mode: "prompt", hoursSince: -1 };
		}

		const elapsedMs = Date.now() - new Date(lastSync).getTime();
		const hoursSince = Math.round(elapsedMs / 3600000);
		const AUTO_THRESHOLD_MS = 20 * 60 * 60 * 1000; // 20 saat
		const PROMPT_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 saat

		if (elapsedMs > PROMPT_THRESHOLD_MS) {
			await bgLog(
				"INFO",
				"fallback_check",
				`Son yedekleme ${hoursSince} saat önce. Uyarılı fallback.`,
				{ source: "foreground_app_open", hoursSince },
			);
			return { needed: true, mode: "prompt", hoursSince };
		}

		if (elapsedMs > AUTO_THRESHOLD_MS) {
			await bgLog(
				"INFO",
				"fallback_check",
				`Son yedekleme ${hoursSince} saat önce. Otomatik fallback.`,
				{ source: "foreground_app_open", hoursSince },
			);
			return { needed: true, mode: "auto", hoursSince };
		}

		return { needed: false };
	} catch (e) {
		console.warn("⚠️ [Fallback] Kontrol sırasında hata:", e);
		return { needed: false };
	}
}

/**
 * BÖLÜM 5: Son yedekleme durumunu döndürür (UI görünürlüğü için)
 */
export interface BackupStatus {
	/** Son başarılı yedekleme zamanı (ISO string veya null) */
	lastSyncTime: string | null;
	/** Son yedeklemeden bu yana geçen saat */
	hoursSinceLastSync: number | null;
	/** Durum: 'success' | 'stale' | 'never' | 'error' */
	status: "success" | "stale" | "never" | "error";
	/** Durum açıklaması */
	message: string;
}

export async function getBackupStatus(): Promise<BackupStatus> {
	try {
		const lastSync = await db.getSetting("gdrive_last_sync");
		if (!lastSync) {
			return {
				lastSyncTime: null,
				hoursSinceLastSync: null,
				status: "never",
				message: "Henüz yedekleme yapılmadı.",
			};
		}

		const elapsedMs = Date.now() - new Date(lastSync).getTime();
		const hoursSince = Math.round(elapsedMs / 3600000);

		if (elapsedMs > 48 * 60 * 60 * 1000) {
			return {
				lastSyncTime: lastSync,
				hoursSinceLastSync: hoursSince,
				status: "stale",
				message: `Son yedekleme ${hoursSince} saat önce yapıldı. Lütfen elle yedekleyin.`,
			};
		}

		return {
			lastSyncTime: lastSync,
			hoursSinceLastSync: hoursSince,
			status: "success",
			message: `Son yedekleme ${hoursSince} saat önce.`,
		};
	} catch {
		return {
			lastSyncTime: null,
			hoursSinceLastSync: null,
			status: "error",
			message: "Yedekleme durumu okunamadı.",
		};
	}
}
