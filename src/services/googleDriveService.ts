import { getRecordFolderName } from "@/database/db";

import type { RecordItem } from "@/types";

import { generateExportHtml } from "@/utils/zipExport";

import * as FileSystem from "expo-file-system/legacy";

import * as Network from "expo-network";

import {
	GoogleOneTapSignIn,
	isCancelledResponse,
	isNoSavedCredentialFoundResponse,
	isSuccessResponse,
} from "react-native-nitro-google-signin";

import MediaStorageModule from "../../modules/my-module/src/MediaStorageModule";

// Drive API için gerekli izin kapsamı

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Google Cloud Console'dan alınan Web Client ID

const DEFAULT_WEB_CLIENT_ID =
	"454523910715-mle95po88u9fifd7rd8hofk2cit7r242.apps.googleusercontent.com";

export interface GoogleUser {
	id: string;

	email: string;

	name: string;

	picture?: string;
}

export interface SyncResult {
	success: boolean;

	uploadedCount: number;

	error?: string;

	syncedAt: string;
}

/**

 * Nitro Google Sign-In modülünü yapılandırır

 */

export function configureGoogleSignIn(customWebClientId?: string) {
	GoogleOneTapSignIn.configure({
		webClientId: customWebClientId || DEFAULT_WEB_CLIENT_ID,

		scopes: [DRIVE_SCOPE],

		offlineAccess: true,
	});
}

/**

 * Yerel Android/iOS arayüzü ile Google girişi yapar ve Drive için accessToken alır

 */

export async function authenticateWithGoogle(
	customWebClientId?: string,
): Promise<{
	accessToken: string;

	user: GoogleUser;
} | null> {
	try {
		configureGoogleSignIn(customWebClientId);

		// Google Play Services kontrolü

		await GoogleOneTapSignIn.checkPlayServices();

		// 1. One Tap Sign-In denemesi

		let response = await GoogleOneTapSignIn.signIn();

		// 2. Kayıtlı hesap bulunamazsa hesap oluşturma/seçme diyaloğunu aç

		if (isNoSavedCredentialFoundResponse(response)) {
			response = await GoogleOneTapSignIn.createAccount();
		}

		// 3. Hala hesap seçilmediyse açık hesap seçici ekranını (Explicit Sign-In) göster

		if (isNoSavedCredentialFoundResponse(response)) {
			response = await GoogleOneTapSignIn.presentExplicitSignIn();
		}

		// Kullanıcı iptal ettiyse

		if (isCancelledResponse(response)) {
			console.log("Kullanıcı Google girişini iptal etti.");

			return null;
		}

		if (isSuccessResponse(response)) {
			const userData = response.data?.user;

			// Drive API kapsamları için yetki ve accessToken al

			await GoogleOneTapSignIn.requestScopes([DRIVE_SCOPE]);

			const tokenResult = await GoogleOneTapSignIn.getTokens();

			if (!tokenResult.accessToken) {
				throw new Error(
					"Google Drive erişim belirteci (accessToken) alınamadı.",
				);
			}

			return {
				accessToken: tokenResult.accessToken,

				user: {
					id: userData?.id || "",

					email: userData?.email || "",

					name: userData?.name || userData?.email || "",

					picture: userData?.photo || undefined,
				},
			};
		}

		return null;
	} catch (error) {
		console.error("Google Sign-In Hatası:", error);

		throw error;
	}
}

/**

 * Geçerli / yenilenmiş accessToken alır

 */

export async function getFreshAccessToken(
	customWebClientId?: string,
): Promise<string | null> {
	try {
		configureGoogleSignIn(customWebClientId);

		const tokenResult = await GoogleOneTapSignIn.getTokens();

		if (tokenResult && tokenResult.accessToken) {
			return tokenResult.accessToken;
		}

		return null;
	} catch (e) {
		console.warn("Token yenileme hatası:", e);

		return null;
	}
}

/**

 * Oturumu kapatır

 */

export async function signOutFromGoogle(): Promise<void> {
	try {
		await GoogleOneTapSignIn.signOut();
	} catch (error) {
		console.warn("Google çıkış hatası:", error);
	}
}

/**

 * Senkronizasyon öncesi ağ bağlantısını denetler

 */

export async function isNetworkAllowedForSync(
	wifiOnly: boolean,
): Promise<{ allowed: boolean; reason?: string }> {
	try {
		const netState = await Network.getNetworkStateAsync();

		if (!netState.isConnected || !netState.isInternetReachable) {
			return {
				allowed: false,

				reason: "İnternet bağlantısı bulunamadı.",
			};
		}

		if (wifiOnly && netState.type !== Network.NetworkStateType.WIFI) {
			return {
				allowed: false,

				reason: "Sadece Wi-Fi ile yükleme seçeneği aktif, hücresel veridesiniz.",
			};
		}

		return { allowed: true };
	} catch {
		return { allowed: true };
	}
}

/**

 * Google Drive içinde belirli bir klasörü bulur veya oluşturur

 */

export async function getOrCreateDriveFolder(
	accessToken: string,

	folderName: string,

	parentFolderId?: string,
): Promise<string> {
	const parentQuery = parentFolderId
		? ` and '${parentFolderId}' in parents`
		: "";

	const query = encodeURIComponent(
		`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder'${parentQuery} and trashed = false`,
	);

	const listRes = await fetch(
		`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,

		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (!listRes.ok) {
		const errBody = await listRes.text();

		console.error(
			`Google Drive list files error (${folderName}):`,
			listRes.status,
			errBody,
		);

		throw new Error(
			`Google Drive klasör araması başarısız (${folderName}): HTTP ${listRes.status} ${errBody}`,
		);
	}

	const listData = await listRes.json();

	if (listData.files && listData.files.length > 0) {
		return listData.files[0].id;
	}

	// Klasör yoksa oluştur

	const bodyPayload: Record<string, any> = {
		name: folderName,

		mimeType: "application/vnd.google-apps.folder",
	};

	if (parentFolderId) {
		bodyPayload.parents = [parentFolderId];
	}

	const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
		method: "POST",

		headers: {
			"Authorization": `Bearer ${accessToken}`,

			"Content-Type": "application/json",
		},

		body: JSON.stringify(bodyPayload),
	});

	if (!createRes.ok) {
		const errBody = await createRes.text();

		console.error(
			`Google Drive create folder error (${folderName}):`,
			createRes.status,
			errBody,
		);

		throw new Error(
			`Google Drive klasörü oluşturulamadı (${folderName}): HTTP ${createRes.status} ${errBody}`,
		);
	}

	const createData = await createRes.json();

	return createData.id;
}

/**

 * Google Drive'a metin tabanlı (HTML, JSON) dosya yükler veya günceller

 */

export async function uploadTextFileToDrive(
	accessToken: string,

	fileName: string,

	mimeType: string,

	content: string,

	parentFolderId?: string,
): Promise<{ id: string; name: string }> {
	let existingFileId: string | null = null;

	if (parentFolderId) {
		const q = encodeURIComponent(
			`name = '${fileName}' and '${parentFolderId}' in parents and trashed = false`,
		);

		const checkRes = await fetch(
			`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,

			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		if (checkRes.ok) {
			const data = await checkRes.json();

			if (data.files && data.files.length > 0) {
				existingFileId = data.files[0].id;
			}
		}
	}

	const metadata: Record<string, any> = {
		name: fileName,

		mimeType,
	};

	if (parentFolderId && !existingFileId) {
		metadata.parents = [parentFolderId];
	}

	const boundary = "-------AstorKayitBoundary314159";

	const delimiter = `\r\n--${boundary}\r\n`;

	const closeDelimiter = `\r\n--${boundary}--`;

	const multipartRequestBody =
		delimiter +
		"Content-Type: application/json; charset=UTF-8\r\n\r\n" +
		JSON.stringify(metadata) +
		delimiter +
		`Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
		content +
		closeDelimiter;

	const url = existingFileId
		? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
		: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

	const res = await fetch(url, {
		method: existingFileId ? "PATCH" : "POST",

		headers: {
			"Authorization": `Bearer ${accessToken}`,

			"Content-Type": `multipart/related; boundary=${boundary}`,
		},

		body: multipartRequestBody,
	});

	if (!res.ok) {
		const errText = await res.text();

		throw new Error(`Dosya yüklenemedi (${fileName}): ${errText}`);
	}

	return await res.json();
}

/**

 * Google Drive'a yerel medya/fotoğraf dosyasını yükler (Zaten varsa tekrar yüklemez)

 */

/**

 * Google Drive'da belirli bir klasör altındaki tüm alt klasörleri tek sorguda haritalar

 */

async function fetchFolderMap(
	accessToken: string,

	parentFolderId: string,
): Promise<Map<string, string>> {
	const map = new Map<string, string>();

	try {
		const query = encodeURIComponent(
			`'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
		);

		const res = await fetch(
			`https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=1000&fields=files(id,name)`,

			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		if (res.ok) {
			const data = await res.json();

			if (data.files) {
				for (const f of data.files) {
					map.set(f.name, f.id);
				}
			}
		}
	} catch (e) {
		console.warn("fetchFolderMap warning:", e);
	}

	return map;
}

/**

 * Google Drive'da belirli bir klasör altındaki tüm mevcut dosyaların adlarını tek sorguda çeker

 */

async function fetchExistingFilesSet(
	accessToken: string,

	folderId: string,
): Promise<Set<string>> {
	const set = new Set<string>();

	try {
		const query = encodeURIComponent(
			`'${folderId}' in parents and trashed = false`,
		);

		const res = await fetch(
			`https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=1000&fields=files(id,name)`,

			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		if (res.ok) {
			const data = await res.json();

			if (data.files) {
				for (const f of data.files) {
					set.add(f.name);
				}
			}
		}
	} catch (e) {
		console.warn("fetchExistingFilesSet warning:", e);
	}

	return set;
}

/**
 * Fotoğraflar gibi küçük/orta ölçekli dosyaları tek istekte (Multipart) yükler.
 * Resumable oturum açma gecikmesini (Round-trip) ortadan kaldırır.
 */
export async function uploadMediaFileToDrive(
	accessToken: string,
	localFilePath: string,
	fileName: string,
	parentFolderId: string,
): Promise<void> {
	const uri = localFilePath.startsWith("file://")
		? localFilePath
		: `file://${localFilePath}`;

	let mimeType = "image/jpeg";
	const lower = fileName.toLowerCase();
	if (lower.endsWith(".png")) mimeType = "image/png";
	else if (lower.endsWith(".webp")) mimeType = "image/webp";
	else if (lower.endsWith(".mp4")) mimeType = "video/mp4";

	// Doğrudan Multipart Upload ile tek seferde yükleme
	const uploadResult = await FileSystem.uploadAsync(
		"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
		uri,
		{
			httpMethod: "POST",
			uploadType: FileSystem.FileSystemUploadType.MULTIPART,
			fieldName: "media",
			mimeType: mimeType,
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			parameters: {
				metadata: JSON.stringify({
					name: fileName,
					parents: [parentFolderId],
					mimeType: mimeType,
				}),
			},
		},
	);

	if (uploadResult.status < 200 || uploadResult.status >= 300) {
		throw new Error(
			`Yükleme hatası (${fileName}): HTTP ${uploadResult.status} - ${uploadResult.body}`,
		);
	}
}

/**

 * Eşzamanlı (Paralel) havuz çalıştırıcı

 */

async function runConcurrent<T>(
	items: T[],

	concurrency: number,

	workerFn: (item: T) => Promise<void>,

	abortSignal?: AbortSignal,
) {
	let index = 0;

	const workers = new Array(concurrency).fill(0).map(async () => {
		while (index < items.length) {
			if (abortSignal?.aborted) return;
			const current = items[index++];

			if (current !== undefined) {
				await workerFn(current);
			}
		}
	});

	await Promise.all(workers);
}

/**

 * Google Drive'dan dosya veya klasör siler

 */

export async function deleteFileFromDrive(
	accessToken: string,

	fileName: string,

	parentFolderId: string,
): Promise<boolean> {
	try {
		const q = encodeURIComponent(
			`name = '${fileName}' and '${parentFolderId}' in parents and trashed = false`,
		);

		const checkRes = await fetch(
			`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,

			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		if (checkRes.ok) {
			const data = await checkRes.json();

			if (data.files && data.files.length > 0) {
				for (const f of data.files) {
					await fetch(
						`https://www.googleapis.com/drive/v3/files/${f.id}`,

						{
							method: "DELETE",

							headers: { Authorization: `Bearer ${accessToken}` },
						},
					);
				}

				return true;
			}
		}
	} catch (e) {
		console.warn("Drive deletion error:", e);
	}

	return false;
}

interface PhotoUploadTask {
	photoPath: string;

	fileName: string;

	folderId: string;

	recordTitle: string;
}

export type ProgressCallback = (
	stage: string,
	progress: number,
	max: number,
) => void;

/**

 * ZIP yapısını referans alarak klasör yapısını bozmadan tüm kayıtları, HTML görüntüleyiciyi

 * ve fotoğrafları doğrudan Google Drive'a yüksek hızda (Paralel akış & Önbellek) senkronize eder

 */

export async function syncAllRecordsToDrive(
	accessToken: string,

	records: RecordItem[],

	wifiOnly: boolean,

	onProgress?: ProgressCallback,

	abortSignal?: AbortSignal,
): Promise<SyncResult> {
	const netCheck = await isNetworkAllowedForSync(wifiOnly);

	if (!netCheck.allowed) {
		return {
			success: false,

			uploadedCount: 0,

			error: netCheck.reason,

			syncedAt: new Date().toISOString(),
		};
	}

	if (abortSignal?.aborted) {
		return {
			success: false,
			uploadedCount: 0,
			error: "Eşitleme kullanıcı tarafından iptal edildi.",
			syncedAt: new Date().toISOString(),
		};
	}

	try {
		onProgress?.("Yedekleme hazırlanıyor...", 0, 100);

		// Native Foreground Servisi başlat

		if (MediaStorageModule) {
			await MediaStorageModule.startSyncForegroundService(
				"Google Drive Senkronizasyonu ☁️",

				"Yedekleme hazırlanıyor...",
			);
		}

		// 1. Ana 'AstorKayit' ve 'Files' klasörlerini bul veya oluştur

		onProgress?.("Klasör yapısı kontrol ediliyor...", 5, 100);

		const rootFolderId = await getOrCreateDriveFolder(
			accessToken,

			"AstorKayit",
		);

		const filesFolderId = await getOrCreateDriveFolder(
			accessToken,

			"Files",

			rootFolderId,
		);

		// 2. 'index.html' ve 'records.json' yükle/güncelle (Paralel 2 istek)

		onProgress?.("HTML ve Veritabanı eşitleniyor...", 10, 100);

		const htmlContent = generateExportHtml(
			records,

			`Astor Kayıt Arşivi (${records.length} Kayıt)`,
		);

		await Promise.all([
			uploadTextFileToDrive(
				accessToken,

				"index.html",

				"text/html",

				htmlContent,

				rootFolderId,
			),

			uploadTextFileToDrive(
				accessToken,

				"records.json",

				"application/json",

				JSON.stringify(records, null, 2),

				rootFolderId,
			),
		]);

		// 3. 'Files' klasörü altındaki mevcut tüm kayıt klasörlerini TEK SORGUDA önbelleğe al

		const folderMap = await fetchFolderMap(accessToken, filesFolderId);

		// 4. Tüm kayıt klasörlerini ve dosya listelerini eşzamanlı (Paralel) olarak tespit et

		onProgress?.("Dosya listesi taranıyor...", 15, 100);

		const tasksToUpload: PhotoUploadTask[] = [];

		await Promise.all(
			records.map(async (record) => {
				const recordFolderName = getRecordFolderName(
					record.id,
					record.title,
				);

				let recordFolderId = folderMap.get(recordFolderName);

				if (!recordFolderId) {
					recordFolderId = await getOrCreateDriveFolder(
						accessToken,

						recordFolderName,

						filesFolderId,
					);

					folderMap.set(recordFolderName, recordFolderId);
				}

				if (record.photos && record.photos.length > 0) {
					const existingFilesSet = await fetchExistingFilesSet(
						accessToken,

						recordFolderId,
					);

					for (const photoPath of record.photos) {
						if (!photoPath) continue;

						const parts = photoPath.split("/");

						const fileName = parts[parts.length - 1];

						if (!existingFilesSet.has(fileName)) {
							tasksToUpload.push({
								photoPath,

								fileName,

								folderId: recordFolderId,

								recordTitle: record.title,
							});
						}
					}
				}
			}),
		);

		// 5. Fotoğrafları 5'ERLİ PARALEL AKIŞLA (Maksimum Bant Genişliği) yükle

		const totalToUpload = tasksToUpload.length;

		let completedCount = 0;

		if (totalToUpload > 0) {
			const startStageMsg = `Google Drive'a yükleniyor (0/${totalToUpload})...`;

			onProgress?.(startStageMsg, 0, totalToUpload);

			if (MediaStorageModule) {
				await MediaStorageModule.updateSyncForegroundService(
					"Google Drive Senkronizasyonu ☁️",

					startStageMsg,

					0,

					totalToUpload,
				);
			}

			await runConcurrent(tasksToUpload, 5, async (task) => {
				await uploadMediaFileToDrive(
					accessToken,

					task.photoPath,

					task.fileName,

					task.folderId,
				);

				completedCount++;

				const percent = Math.round(
					(completedCount / totalToUpload) * 100,
				);

				const stageMsg = `Fotoğraflar yükleniyor (${completedCount}/${totalToUpload})`;

				onProgress?.(stageMsg, completedCount, totalToUpload);

				if (MediaStorageModule) {
					await MediaStorageModule.updateSyncForegroundService(
						"Google Drive Senkronizasyonu ☁️",

						stageMsg,

						completedCount,

						totalToUpload,
					);
				}
			});
		}

		onProgress?.("Yedekleme tamamlandı", 100, 100);

		return {
			success: true,

			uploadedCount: records.length,

			syncedAt: new Date().toISOString(),
		};
	} catch (error) {
		const isCancelled =
			abortSignal?.aborted ||
			String(error).toLowerCase().includes("iptal");
		if (isCancelled) {
			console.log(
				"ℹ️ [Drive Sync] Senkronizasyon kullanıcı tarafından iptal edildi.",
			);
		} else {
			console.error("Google Drive sync failed:", error);
		}

		return {
			success: false,

			uploadedCount: 0,

			error: isCancelled
				? "Eşitleme kullanıcı tarafından iptal edildi."
				: String(error),

			syncedAt: new Date().toISOString(),
		};
	} finally {
		if (MediaStorageModule) {
			try {
				await MediaStorageModule.stopSyncForegroundService();
			} catch (e) {
				console.warn("Foreground service durdurulamadı:", e);
			}
		}
	}
}

/**

 * WhatsApp Modeli: Tüm kayıtları, fotoğrafları ve interaktif HTML'i tek bir ZIP arşivi

 * olarak paketleyip Google Drive'a ultra hızlı (Tek parça Stream) yükler.

 */

export async function syncZipArchiveToDrive(
	accessToken: string,

	records: RecordItem[],

	wifiOnly: boolean,

	onProgress?: ProgressCallback,

	abortSignal?: AbortSignal,
): Promise<SyncResult> {
	const netCheck = await isNetworkAllowedForSync(wifiOnly);

	if (!netCheck.allowed) {
		return {
			success: false,

			uploadedCount: 0,

			error: netCheck.reason,

			syncedAt: new Date().toISOString(),
		};
	}

	if (abortSignal?.aborted) {
		return {
			success: false,
			uploadedCount: 0,
			error: "Eşitleme kullanıcı tarafından iptal edildi.",
			syncedAt: new Date().toISOString(),
		};
	}

	if (!MediaStorageModule) {
		return {
			success: false,

			uploadedCount: 0,

			error: "Native modül bulunamadı.",

			syncedAt: new Date().toISOString(),
		};
	}

	try {
		onProgress?.("Yedekleme hazırlanıyor...", 0, 100);

		await MediaStorageModule.startSyncForegroundService(
			"Google Drive Yedekleme ☁️",

			"Yedekleme hazırlanıyor...",
		);

		if (abortSignal?.aborted) {
			throw new Error("Eşitleme kullanıcı tarafından iptal edildi.");
		}

		// 1. ZIP dosya adını tarih ve saat ile oluştur (Örn: AstorKayit_Yedek_31-08-2026_00-05.zip)

		const now = new Date();

		const pad = (n: number) => n.toString().padStart(2, "0");

		const dateFormatted = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;

		const zipName = `AstorKayit_Yedek_${dateFormatted}.zip`;

		const zipRelativePath = `Download/AstorKayit/${zipName}`;

		const htmlContent = generateExportHtml(
			records,

			`Astor Kayıt Arşivi (${records.length} Kayıt)`,
		);

		const jsonContent = JSON.stringify(records, null, 2);

		const folderRelativePaths = records.map(
			(r) => `Files/${getRecordFolderName(r.id, r.title)}`,
		);

		// 2. Native ZIP sıkıştırma

		onProgress?.("Arşiv paketi oluşturuluyor...", 10, 100);

		const zipResult = await MediaStorageModule.createZipExport(
			zipRelativePath,

			htmlContent,

			jsonContent,

			folderRelativePaths,
		);

		if (!zipResult.success || !zipResult.path) {
			throw new Error("ZIP arşivi oluşturulamadı.");
		}

		onProgress?.("Google Drive'a bağlanılıyor...", 15, 100);

		if (MediaStorageModule) {
			await MediaStorageModule.updateSyncForegroundService(
				"Google Drive Yedekleme ☁️",

				"Google Drive'a bağlanılıyor...",

				15,

				100,
			);
		}

		// 3. Drive ana klasörünü bul/oluştur

		const rootFolderId = await getOrCreateDriveFolder(
			accessToken,

			"AstorKayit",
		);

		// 4. Resumable Upload oturumu başlat

		onProgress?.("Yükleme oturumu başlatılıyor...", 20, 100);

		const initRes = await fetch(
			"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",

			{
				method: "POST",

				headers: {
					"Authorization": `Bearer ${accessToken}`,

					"Content-Type": "application/json; charset=UTF-8",
				},

				body: JSON.stringify({
					name: zipName,

					parents: [rootFolderId],

					mimeType: "application/zip",
				}),
			},
		);

		if (!initRes.ok) {
			const err = await initRes.text();

			throw new Error(`Google Drive oturumu başlatılamadı: ${err}`);
		}

		const locationUrl =
			initRes.headers.get("Location") || initRes.headers.get("location");

		if (!locationUrl) {
			throw new Error("Google Drive yükleme adresi alınamadı.");
		}

		// 5. Native 128KB Buffered Stream ile Ultra Hızlı Yükleme

		const uri = zipResult.path.startsWith("file://")
			? zipResult.path
			: `file://${zipResult.path}`;

		if (
			MediaStorageModule &&
			typeof MediaStorageModule.nativeUploadFile === "function"
		) {
			let sub: any = null;

			if (typeof (MediaStorageModule as any).addListener === "function") {
				sub = (MediaStorageModule as any).addListener(
					"onUploadProgress",

					(event: {
						percent: number;
						bytesSent: number;
						totalBytes: number;
					}) => {
						const displayPercent = Math.min(
							100,
							Math.max(0, event.percent),
						);

						onProgress?.(
							"Google Drive'a yükleniyor",
							displayPercent,
							100,
						);
					},
				);
			}

			try {
				await MediaStorageModule.nativeUploadFile(
					locationUrl,

					uri,

					"application/zip",
				);
			} finally {
				sub?.remove();
			}
		} else {
			const uploadTask = FileSystem.createUploadTask(
				locationUrl,

				uri,

				{
					httpMethod: "PUT",

					headers: {
						"Content-Type": "application/zip",
					},

					uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
				},

				(progressData) => {
					const sent = progressData.totalBytesSent;

					const total = progressData.totalBytesExpectedToSend;

					const rawPercent =
						total > 0 ? Math.round((sent / total) * 100) : 0;

					const displayPercent = Math.min(
						100,
						Math.max(0, rawPercent),
					);

					onProgress?.(
						"Google Drive'a yükleniyor",
						displayPercent,
						100,
					);

					if (MediaStorageModule) {
						MediaStorageModule.updateSyncForegroundService(
							"Google Drive Yedekleme ☁️",

							`Google Drive'a yükleniyor (%${displayPercent})...`,

							displayPercent,

							100,
						);
					}
				},
			);

			const uploadResult = await uploadTask.uploadAsync();

			if (
				!uploadResult ||
				uploadResult.status < 200 ||
				uploadResult.status >= 300
			) {
				throw new Error(
					`Yükleme başarısız oldu: HTTP ${uploadResult?.status || "Bilinmiyor"}`,
				);
			}
		}

		onProgress?.("Yedekleme tamamlandı", 100, 100);

		return {
			success: true,

			uploadedCount: records.length,

			syncedAt: new Date().toISOString(),
		};
	} catch (error) {
		const isCancelled =
			abortSignal?.aborted ||
			String(error).toLowerCase().includes("iptal");
		if (isCancelled) {
			console.log(
				"ℹ️ [Drive Sync] Yükleme kullanıcı tarafından iptal edildi.",
			);
		} else {
			console.error("Google Drive ZIP sync failed:", error);
		}

		return {
			success: false,

			uploadedCount: 0,

			error: isCancelled
				? "Eşitleme kullanıcı tarafından iptal edildi."
				: String(error),

			syncedAt: new Date().toISOString(),
		};
	} finally {
		if (MediaStorageModule) {
			try {
				await MediaStorageModule.stopSyncForegroundService();
			} catch (e) {
				console.warn("Foreground service durdurulamadı:", e);
			}
		}
	}
}
