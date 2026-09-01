import * as db from "@/database/db";
import {
	registerBackgroundSyncTask,
	unregisterBackgroundSyncTask,
} from "@/services/backgroundSyncService";
import {
	authenticateWithGoogle,
	deleteFileFromDrive,
	getFreshAccessToken,
	getOrCreateDriveFolder,
	GoogleUser,
	syncAllRecordsToDrive,
	SyncResult,
	syncZipArchiveToDrive,
} from "@/services/googleDriveService";
import { sendTaskNotification } from "@/services/notificationService";
import type { RecordItem } from "@/types";
import { create } from "zustand";
import MediaStorageModule from "../../modules/my-module/src/MediaStorageModule";

interface DriveState {
	isConnected: boolean;
	user: GoogleUser | null;
	accessToken: string | null;
	autoSyncEnabled: boolean;
	autoSyncFrequency: "on_change" | "daily" | "weekly" | "custom";
	autoSyncCustomHours: number;
	syncOnWifiOnly: boolean;
	deleteFromDriveOnLocalDelete: boolean;
	syncMode: "zip" | "folders";
	lastSyncTime: string | null;
	isSyncing: boolean;
	syncStage: string | null;
	syncProgressPercent: number;
	lastSyncResult: SyncResult | null;
	clientId: string;
	activeAbortController: AbortController | null;

	// Actions
	loadDriveSettings: () => Promise<void>;
	connectWithGoogle: () => Promise<boolean>;
	disconnect: () => Promise<void>;
	setAutoSync: (enabled: boolean) => Promise<void>;
	setAutoSyncFrequency: (
		frequency: "on_change" | "daily" | "weekly" | "custom",
	) => Promise<void>;
	setAutoSyncCustomHours: (hours: number) => Promise<void>;
	setSyncWifiOnly: (wifiOnly: boolean) => Promise<void>;
	setDeletePolicy: (deleteOnLocalDelete: boolean) => Promise<void>;
	setSyncMode: (mode: "zip" | "folders") => Promise<void>;
	setClientId: (clientId: string) => Promise<void>;
	syncNow: (records: RecordItem[]) => Promise<SyncResult>;
	cancelSync: () => Promise<void>;
	handleRecordDeleteSync: (
		recordTitle: string,
		recordId: number,
	) => Promise<void>;
}

export const useDriveStore = create<DriveState>((set, get) => ({
	isConnected: false,
	user: null,
	accessToken: null,
	autoSyncEnabled: false,
	autoSyncFrequency: "on_change",
	autoSyncCustomHours: 6,
	syncOnWifiOnly: true,
	deleteFromDriveOnLocalDelete: false,
	syncMode: "folders",
	lastSyncTime: null,
	isSyncing: false,
	syncStage: null,
	syncProgressPercent: 0,
	lastSyncResult: null,
	clientId: "",
	activeAbortController: null,

	loadDriveSettings: async () => {
		try {
			const accessToken = await db.getSetting("gdrive_access_token");
			const userEmail = await db.getSetting("gdrive_user_email");
			const userName = await db.getSetting("gdrive_user_name");
			const userPicture = await db.getSetting("gdrive_user_picture");
			const autoSync = await db.getSetting("gdrive_auto_sync");
			const autoSyncFreq = (await db.getSetting(
				"gdrive_auto_sync_frequency",
			)) as "on_change" | "daily" | "weekly" | "custom" | null;
			const autoSyncCustomHours = parseInt(
				(await db.getSetting("gdrive_auto_sync_custom_hours")) || "6",
				10,
			);
			const wifiOnly = await db.getSetting("gdrive_wifi_only");
			const deletePolicy = await db.getSetting("gdrive_delete_policy");
			const savedSyncMode = await db.getSetting("gdrive_sync_mode");
			const lastSync = await db.getSetting("gdrive_last_sync");
			const customClientId = await db.getSetting("gdrive_client_id");

			const isConnected = !!accessToken && !!userEmail;
			const user = isConnected
				? {
						id: "google-user",
						email: userEmail || "",
						name: userName || userEmail || "",
						picture: userPicture || undefined,
					}
				: null;

			const isAutoSync = autoSync === "1";
			set({
				isConnected,
				user,
				accessToken,
				autoSyncEnabled: isAutoSync,
				autoSyncFrequency: autoSyncFreq || "on_change",
				autoSyncCustomHours: isNaN(autoSyncCustomHours) ? 6 : autoSyncCustomHours,
				syncOnWifiOnly: wifiOnly !== "0", // default true
				deleteFromDriveOnLocalDelete: deletePolicy === "1",
				syncMode: savedSyncMode === "folders" ? "folders" : "zip",
				lastSyncTime: lastSync || null,
				clientId: customClientId || "",
			});

			if (isConnected && isAutoSync && autoSyncFreq !== "on_change") {
				await registerBackgroundSyncTask();
			}
		} catch (e) {
			console.warn("⚠️ [Drive Ayarları] Ayarlar yüklenirken hata:", e);
		}
	},

	connectWithGoogle: async () => {
		try {
			const { clientId } = get();
			const authResult = await authenticateWithGoogle(
				clientId || undefined,
			);

			if (authResult) {
				const { accessToken, user } = authResult;

				// Persist credentials
				await db.setSetting("gdrive_access_token", accessToken);
				await db.setSetting("gdrive_user_email", user.email);
				await db.setSetting("gdrive_user_name", user.name);
				if (user.picture) {
					await db.setSetting("gdrive_user_picture", user.picture);
				}

				set({
					isConnected: true,
					accessToken,
					user,
				});

				return true;
			}
			return false;
		} catch (error) {
			console.error("❌ [Google Giriş] Google hesabı ile bağlantı başarısız:", error);
			return false;
		}
	},

	disconnect: async () => {
		try {
			await db.setSetting("gdrive_access_token", "");
			await db.setSetting("gdrive_user_email", "");
			await db.setSetting("gdrive_user_name", "");
			await db.setSetting("gdrive_user_picture", "");
			await db.setSetting("gdrive_auto_sync", "0");
			await unregisterBackgroundSyncTask();

			set({
				isConnected: false,
				accessToken: null,
				user: null,
				autoSyncEnabled: false,
			});
		} catch (e) {
			console.warn("⚠️ [Google Çıkış] Google bağlantısı kesilirken hata:", e);
		}
	},

	setAutoSync: async (enabled: boolean) => {
		set({ autoSyncEnabled: enabled });
		await db.setSetting("gdrive_auto_sync", enabled ? "1" : "0");
		const { autoSyncFrequency } = get();
		if (enabled && autoSyncFrequency !== "on_change") {
			await registerBackgroundSyncTask();
		} else {
			await unregisterBackgroundSyncTask();
		}
	},

	setAutoSyncFrequency: async (
		frequency: "on_change" | "daily" | "weekly" | "custom",
	) => {
		set({ autoSyncFrequency: frequency });
		await db.setSetting("gdrive_auto_sync_frequency", frequency);
		const { autoSyncEnabled } = get();
		if (autoSyncEnabled && frequency !== "on_change") {
			await registerBackgroundSyncTask();
		} else if (frequency === "on_change") {
			await unregisterBackgroundSyncTask();
		}
	},

	setAutoSyncCustomHours: async (hours: number) => {
		const validHours = Math.max(1, Math.min(168, hours));
		set({ autoSyncCustomHours: validHours });
		await db.setSetting("gdrive_auto_sync_custom_hours", String(validHours));
	},

	setSyncWifiOnly: async (wifiOnly: boolean) => {
		set({ syncOnWifiOnly: wifiOnly });
		await db.setSetting("gdrive_wifi_only", wifiOnly ? "1" : "0");
	},

	setDeletePolicy: async (deleteOnLocalDelete: boolean) => {
		set({ deleteFromDriveOnLocalDelete: deleteOnLocalDelete });
		await db.setSetting(
			"gdrive_delete_policy",
			deleteOnLocalDelete ? "1" : "0",
		);
	},

	setSyncMode: async (mode: "zip" | "folders") => {
		set({ syncMode: mode });
		await db.setSetting("gdrive_sync_mode", mode);
	},

	setClientId: async (clientId: string) => {
		set({ clientId });
		await db.setSetting("gdrive_client_id", clientId);
	},

	syncNow: async (records: RecordItem[]) => {
		let { accessToken, isConnected, syncOnWifiOnly, syncMode } = get();

		if (!isConnected) {
			const errRes: SyncResult = {
				success: false,
				uploadedCount: 0,
				error: "Google Drive hesabı bağlı değil.",
				syncedAt: new Date().toISOString(),
			};
			set({ lastSyncResult: errRes });
			return errRes;
		}

		// Google Play Services üzerinden taze token al
		const freshToken = await getFreshAccessToken();
		if (freshToken) {
			accessToken = freshToken;
			set({ accessToken: freshToken });
		}

		if (!accessToken) {
			const errRes: SyncResult = {
				success: false,
				uploadedCount: 0,
				error: "Google Drive oturumu geçersiz veya erişim belirteci alınamadı. Lütfen tekrar giriş yapın.",
				syncedAt: new Date().toISOString(),
			};
			set({ lastSyncResult: errRes });
			return errRes;
		}

		const abortController = new AbortController();

		try {
			set({
				isSyncing: true,
				syncStage: "Yedekleme hazırlanıyor...",
				syncProgressPercent: 0,
				activeAbortController: abortController,
			});

			const onProgress = (
				stage: string,
				progress: number,
				max: number,
			) => {
				if (abortController.signal.aborted) return;
				const percent =
					max > 0 ? Math.round((progress / max) * 100) : 0;
				set({
					syncStage: stage,
					syncProgressPercent: Math.min(100, Math.max(0, percent)),
				});
			};

			const result =
				syncMode === "zip"
					? await syncZipArchiveToDrive(
							accessToken,
							records,
							syncOnWifiOnly,
							onProgress,
							abortController.signal,
						)
					: await syncAllRecordsToDrive(
							accessToken,
							records,
							syncOnWifiOnly,
							onProgress,
							abortController.signal,
						);

			if (abortController.signal.aborted) {
				const cancelledRes: SyncResult = {
					success: false,
					uploadedCount: 0,
					error: "Eşitleme kullanıcı tarafından iptal edildi.",
					syncedAt: new Date().toISOString(),
				};
				set({ lastSyncResult: cancelledRes });
				return cancelledRes;
			}

			if (result.success) {
				const now = new Date().toISOString();
				await db.setSetting("gdrive_last_sync", now);
				set({ lastSyncTime: now, lastSyncResult: result });

				await sendTaskNotification({
					title: "Google Drive Eşitlendi ☁️",
					body: `${result.uploadedCount} adet anı kaydı ve tüm fotoğrafları Google Drive'a başarıyla yedeklendi.`,
					alertTitle: "Senkronizasyon Başarılı",
					alertMessage: `${result.uploadedCount} adet kayıt ve fotoğrafları Google Drive ile başarıyla eşitlendi.`,
					alertType: "success",
					actionType: "drive_sync",
				});
			} else {
				set({ lastSyncResult: result });

				if (!result.error?.includes("iptal")) {
					await sendTaskNotification({
						title: "Senkronizasyon Uyarısı ⚠️",
						body: result.error || "Yedekleme tamamlanamadı.",
						alertTitle: "Senkronizasyon Uyarısı",
						alertMessage:
							result.error || "Yedekleme tamamlanamadı.",
						alertType: "warning",
						actionType: "drive_sync",
					});
				}
			}

			return result;
		} catch (e) {
			const isCancelled =
				abortController.signal.aborted || String(e).includes("iptal");
			const errRes: SyncResult = {
				success: false,
				uploadedCount: 0,
				error: isCancelled
					? "Eşitleme kullanıcı tarafından iptal edildi."
					: String(e),
				syncedAt: new Date().toISOString(),
			};
			set({ lastSyncResult: errRes });

			if (!isCancelled) {
				await sendTaskNotification({
					title: "Senkronizasyon Hatası ❌",
					body: String(e),
					alertTitle: "Senkronizasyon Hatası",
					alertMessage: String(e),
					alertType: "danger",
					actionType: "drive_sync",
				});
			}

			return errRes;
		} finally {
			set({
				isSyncing: false,
				syncStage: null,
				syncProgressPercent: 0,
				activeAbortController: null,
			});
		}
	},

	cancelSync: async () => {
		const { activeAbortController, isSyncing } = get();
		if (!isSyncing && !activeAbortController) return;

		if (activeAbortController) {
			activeAbortController.abort();
		}
		set({
			isSyncing: false,
			syncStage: null,
			syncProgressPercent: 0,
			activeAbortController: null,
		});

		if (
			MediaStorageModule &&
			typeof (MediaStorageModule as any).cancelNativeUpload === "function"
		) {
			try {
				await (MediaStorageModule as any).cancelNativeUpload();
			} catch (e) {
				console.warn("⚠️ [Drive İptal] Native upload iptal hatası:", e);
			}
		}
		if (
			MediaStorageModule &&
			typeof (MediaStorageModule as any).stopSyncForegroundService ===
				"function"
		) {
			try {
				await (MediaStorageModule as any).stopSyncForegroundService();
			} catch (e) {
				console.warn("⚠️ [Drive İptal] Foreground servis durdurma hatası:", e);
			}
		}
	},

	handleRecordDeleteSync: async (recordTitle: string, recordId: number) => {
		const { isConnected, accessToken, deleteFromDriveOnLocalDelete } =
			get();
		if (!isConnected || !accessToken || !deleteFromDriveOnLocalDelete)
			return;

		try {
			const rootFolderId = await getOrCreateDriveFolder(
				accessToken,
				"AstorKayit",
			);
			const filesFolderId = await getOrCreateDriveFolder(
				accessToken,
				"Files",
				rootFolderId,
			);
			const folderName = db.getRecordFolderName(recordId, recordTitle);
			await deleteFileFromDrive(accessToken, folderName, filesFolderId);
		} catch (e) {
			console.warn("⚠️ [Drive Silme] Uzak dosya silme hatası:", e);
		}
	},
}));

// Bildirim üzerinden gelen "İptal Et" aksiyonunu dinle
if (
	MediaStorageModule &&
	typeof (MediaStorageModule as any).addListener === "function" &&
	!(globalThis as any)._hasSyncCancelListener
) {
	(globalThis as any)._hasSyncCancelListener = true;
	(MediaStorageModule as any).addListener("onSyncCancelled", () => {
		const state = useDriveStore.getState();
		if (state.isSyncing || state.activeAbortController) {
			console.log(
				'ℹ️ [Drive İptal] Bildirim çubuğundaki "İptal Et" butonuna basıldı. Senkronizasyon sonlandırılıyor...',
			);
			state.cancelSync();
		}
	});
}
