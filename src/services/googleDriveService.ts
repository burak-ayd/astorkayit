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
	const parentQuery = parentFolderId ? ` and '${parentFolderId}' in parents` : "";
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
		console.error(`Google Drive list files error (${folderName}):`, listRes.status, errBody);
		throw new Error(`Google Drive klasör araması başarısız (${folderName}): HTTP ${listRes.status} ${errBody}`);
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
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(bodyPayload),
	});

	if (!createRes.ok) {
		const errBody = await createRes.text();
		console.error(`Google Drive create folder error (${folderName}):`, createRes.status, errBody);
		throw new Error(`Google Drive klasörü oluşturulamadı (${folderName}): HTTP ${createRes.status} ${errBody}`);
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
			Authorization: `Bearer ${accessToken}`,
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
export async function uploadMediaFileToDrive(
	accessToken: string,
	localFilePath: string,
	fileName: string,
	parentFolderId: string,
): Promise<{ id: string; name: string }> {
	// Aynı isimde dosya bu klasörde zaten var mı kontrol et (Bant genişliği tasarrufu)
	const q = encodeURIComponent(
		`name = '${fileName}' and '${parentFolderId}' in parents and trashed = false`,
	);
	const checkRes = await fetch(
		`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id, name)`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (checkRes.ok) {
		const checkData = await checkRes.json();
		if (checkData.files && checkData.files.length > 0) {
			return checkData.files[0];
		}
	}

	const uri = localFilePath.startsWith("file://")
		? localFilePath
		: `file://${localFilePath}`;

	let mimeType = "image/jpeg";
	const lower = fileName.toLowerCase();
	if (lower.endsWith(".png")) mimeType = "image/png";
	else if (lower.endsWith(".webp")) mimeType = "image/webp";
	else if (lower.endsWith(".mp4")) mimeType = "video/mp4";

	// 1. Adım: Google Drive Resumable Upload oturumu başlat
	const initRes = await fetch(
		"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json; charset=UTF-8",
			},
			body: JSON.stringify({
				name: fileName,
				parents: [parentFolderId],
				mimeType,
			}),
		},
	);

	if (!initRes.ok) {
		const err = await initRes.text();
		throw new Error(`Google Drive yükleme oturumu başlatılamadı (${fileName}): ${err}`);
	}

	const locationUrl =
		initRes.headers.get("Location") || initRes.headers.get("location");
	if (!locationUrl) {
		throw new Error(`Google Drive yükleme adresi alınamadı (${fileName}).`);
	}

	// 2. Adım: Expo FileSystem ile dosyayı yerel bellekten doğrudan stream ederek yükle (Blob/Base64 kullanılmaz)
	const uploadResult = await FileSystem.uploadAsync(locationUrl, uri, {
		httpMethod: "PUT",
		headers: {
			"Content-Type": mimeType,
		},
		uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
	});

	if (uploadResult.status < 200 || uploadResult.status >= 300) {
		throw new Error(
			`Fotoğraf yüklenemedi (${fileName}): ${uploadResult.body}`,
		);
	}

	return JSON.parse(uploadResult.body);
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

/**
 * ZIP yapısını referans alarak klasör yapısını bozmadan tüm kayıtları, HTML görüntüleyiciyi
 * ve fotoğrafları doğrudan Google Drive'a senkronize eder (Ziplemeden saf REST API ile)
 */
export async function syncAllRecordsToDrive(
	accessToken: string,
	records: RecordItem[],
	wifiOnly: boolean,
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

	// Toplam yüklenecek fotoğraf sayısını hesapla
	let totalPhotos = 0;
	for (const r of records) {
		if (r.photos) totalPhotos += r.photos.length;
	}
	const totalSteps = totalPhotos + 2; // + index.html, records.json
	let currentStep = 0;

	try {
		// Native Foreground Servisi başlat (Ağ kopmasını önler ve bildirimi gösterir)
		if (MediaStorageModule) {
			await MediaStorageModule.startSyncForegroundService(
				"Google Drive Senkronizasyonu ☁️",
				"Yedekleme hazırlanıyor...",
			);
		}

		// 1. Google Drive içinde ana 'AstorKayit' klasörünü oluştur/bul
		const rootFolderId = await getOrCreateDriveFolder(
			accessToken,
			"AstorKayit",
		);

		// 2. Google Drive içinde 'Files' medya klasörünü oluştur/bul
		const filesFolderId = await getOrCreateDriveFolder(
			accessToken,
			"Files",
			rootFolderId,
		);

		// 3. 'index.html' interaktif HTML görüntüleyiciyi yükle/güncelle
		const htmlContent = generateExportHtml(
			records,
			`Astor Kayıt Arşivi (${records.length} Kayıt)`,
		);
		await uploadTextFileToDrive(
			accessToken,
			"index.html",
			"text/html",
			htmlContent,
			rootFolderId,
		);
		currentStep++;
		if (MediaStorageModule) {
			await MediaStorageModule.updateSyncForegroundService(
				"Google Drive Senkronizasyonu ☁️",
				"HTML görüntüleyici yüklendi...",
				currentStep,
				totalSteps,
			);
		}

		// 4. 'records.json' veritabanı JSON yedeğini yükle/güncelle
		await uploadTextFileToDrive(
			accessToken,
			"records.json",
			"application/json",
			JSON.stringify(records, null, 2),
			rootFolderId,
		);
		currentStep++;
		if (MediaStorageModule) {
			await MediaStorageModule.updateSyncForegroundService(
				"Google Drive Senkronizasyonu ☁️",
				"Veritabanı JSON yedeği yüklendi...",
				currentStep,
				totalSteps,
			);
		}

		// 5. Her kaydın klasörünü (Files/record_<id>_<title>) oluştur ve fotoğraflarını yükle
		let uploadedPhotoCount = 0;
		for (const record of records) {
			const recordFolderName = getRecordFolderName(record.id, record.title);
			const recordFolderId = await getOrCreateDriveFolder(
				accessToken,
				recordFolderName,
				filesFolderId,
			);

			// Kayda ait tüm fotoğrafları yükle
			if (record.photos && record.photos.length > 0) {
				for (const photoPath of record.photos) {
					if (!photoPath) continue;

					const parts = photoPath.split("/");
					const fileName = parts[parts.length - 1];

					await uploadMediaFileToDrive(
						accessToken,
						photoPath,
						fileName,
						recordFolderId,
					);

					currentStep++;
					uploadedPhotoCount++;
					if (MediaStorageModule) {
						await MediaStorageModule.updateSyncForegroundService(
							"Google Drive Senkronizasyonu ☁️",
							`Fotoğraflar yükleniyor (${uploadedPhotoCount}/${totalPhotos})...`,
							currentStep,
							totalSteps,
						);
					}
				}
			}
		}

		return {
			success: true,
			uploadedCount: records.length,
			syncedAt: new Date().toISOString(),
		};
	} catch (error) {
		console.error("Google Drive sync failed:", error);
		return {
			success: false,
			uploadedCount: 0,
			error: String(error),
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
