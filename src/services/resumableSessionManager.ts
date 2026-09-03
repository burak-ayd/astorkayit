/**
 * Resumable Upload — Kesintiye Dayanıklı Oturum Yönetimi
 *
 * Upload session URI ve son başarılı byte offset'i SQLite'a kaydeder.
 * Görev her tetiklendiğinde önce yarım kalmış session kontrol eder.
 * Eğer varsa Drive API'ye devam noktasını sorar ve kaldığı yerden devam eder.
 */
import * as db from "@/database/db";

export interface ResumableSession {
	/** Google Drive resumable upload URI */
	sessionUri: string;
	/** Yüklenen toplam dosya boyutu (bytes) */
	totalBytes: number;
	/** Son başarılı byte offset (0-indexed, exclusive — bu byte'a kadar yüklendi) */
	lastByteOffset: number;
	/** Oturumun oluşturulma zamanı (ISO string) */
	createdAt: string;
	/** Yüklenen dosya adı (tanımlama için) */
	fileName: string;
	/** Sync modu: zip veya folders */
	syncMode: string;
}

const SESSION_KEY = "gdrive_resumable_session";

/**
 * Resumable session bilgisini SQLite'a kaydeder
 */
export async function saveResumableSession(
	session: ResumableSession,
): Promise<void> {
	await db.setSetting(SESSION_KEY, JSON.stringify(session));
}

/**
 * Mevcut resumable session bilgisini okur
 */
export async function getResumableSession(): Promise<ResumableSession | null> {
	const raw = await db.getSetting(SESSION_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as ResumableSession;
	} catch {
		return null;
	}
}

/**
 * Resumable session kaydını siler (başarılı upload veya geçersiz session sonrası)
 */
export async function clearResumableSession(): Promise<void> {
	await db.setSetting(SESSION_KEY, "");
}

/**
 * Google Drive'daki session'ın nereden devam edeceğini sorgular.
 * `Content-Range: bytes * /<total>` ile boş PUT gönderir.
 *
 * @returns Devam edilecek byte offset veya null (session geçersiz / süresi dolmuş)
 */
export async function queryResumeOffset(
	sessionUri: string,
	totalBytes: number,
): Promise<number | null> {
	try {
		const res = await fetch(sessionUri, {
			method: "PUT",
			headers: {
				"Content-Length": "0",
				"Content-Range": `bytes */${totalBytes}`,
			},
		});

		if (res.status === 200 || res.status === 201) {
			// Upload zaten tamamlanmış!
			return totalBytes;
		}

		if (res.status === 308) {
			// Kısmi upload — Range header'ından offset oku
			const rangeHeader = res.headers.get("Range");
			if (rangeHeader) {
				// Format: bytes=0-<lastByte>
				const match = rangeHeader.match(/bytes=0-(\d+)/);
				if (match) {
					return parseInt(match[1], 10) + 1; // exclusive offset
				}
			}
			// Range header yoksa en baştan devam et
			return 0;
		}

		// 404 veya diğer hatalar — session geçersiz
		return null;
	} catch {
		return null;
	}
}

/**
 * Session'ın hâlâ geçerli olup olmadığını kontrol eder.
 * Google Drive resumable session'lar ~1 hafta geçerli,
 * ama bağlantı kopması durumunda daha kısa sürede geçersiz olabilir.
 *
 * @returns true → session muhtemelen hâlâ kullanılabilir
 */
export function isSessionLikelyValid(session: ResumableSession): boolean {
	const sessionAge = Date.now() - new Date(session.createdAt).getTime();
	const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

	// 1 haftadan eski session'ları geçersiz say
	if (sessionAge > ONE_WEEK_MS) return false;

	return true;
}
