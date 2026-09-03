/**
 * Arka Plan Görevi — Dosya Tabanlı Log Sistemi
 *
 * Android: Android/media/<paket_adi>/AstorKayit/Log/background_sync.log
 * Native MediaStorageModule.appendToFile ile doğrudan Java File API kullanarak yazar.
 * Böylece ExponentFileSystem izin/writable kısıtlamalarına takılmaz.
 */
import * as FileSystem from "expo-file-system/legacy";
import MediaStorageModule from "../../modules/my-module/src/MediaStorageModule";

const RELATIVE_LOG_DIR = "Log";
const RELATIVE_LOG_FILE = "Log/background_sync.log";
const FALLBACK_LOG_DIR = `${FileSystem.documentDirectory}logs/`;
const FALLBACK_LOG_FILE = `${FALLBACK_LOG_DIR}background_sync.log`;
const MAX_LOG_SIZE_BYTES = 512 * 1024; // 512KB → daha büyürse rotate

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

/**
 * Dosyaya tek satır log ekler
 */
export async function bgLog(
	level: LogLevel,
	tag: string,
	message: string,
	extra?: Record<string, unknown>,
): Promise<void> {
	try {
		const timestamp = new Date().toISOString();
		let line = `[${timestamp}] [${level}] [${tag}] ${message}`;
		if (extra) {
			line += ` | ${JSON.stringify(extra)}`;
		}
		line += "\n";

		// 1. Tercih: Native Modül ile doğrudan Android/media/.../AstorKayit/Log içine yaz
		if (MediaStorageModule && typeof MediaStorageModule.appendToFile === "function") {
			try {
				const res = await MediaStorageModule.appendToFile(RELATIVE_LOG_FILE, line);
				// 512KB rotasyon kontrolü
				if (res.size && res.size > MAX_LOG_SIZE_BYTES) {
					const now = new Date();
					const pad = (n: number) => n.toString().padStart(2, "0");
					const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
					const backupRelativePath = `Log/background_sync_${timestampStr}.log`;
					const allContent = await MediaStorageModule.readTextFile(RELATIVE_LOG_FILE);
					if (allContent) {
						await MediaStorageModule.createFile(backupRelativePath, allContent);
						await MediaStorageModule.createFile(RELATIVE_LOG_FILE, ""); // Aktif dosyayı sıfırla
					}
				}
				logToConsole(level, line);
				return;
			} catch (nativeErr) {
				console.warn("[bgLog] Native appendToFile başarısız, fallback deneniyor:", nativeErr);
			}
		}

		// 2. Fallback: FileSystem.documentDirectory içine yaz
		await ensureFallbackDir();
		const fileInfo = await FileSystem.getInfoAsync(FALLBACK_LOG_FILE);
		if (fileInfo.exists) {
			const existing = await FileSystem.readAsStringAsync(FALLBACK_LOG_FILE);
			await FileSystem.writeAsStringAsync(FALLBACK_LOG_FILE, existing + line);
		} else {
			await FileSystem.writeAsStringAsync(FALLBACK_LOG_FILE, line);
		}

		logToConsole(level, line);
	} catch (e) {
		console.warn("[bgLog] Log dosyasına yazılamadı:", e);
	}
}

function logToConsole(level: LogLevel, line: string) {
	const consoleMsg = `📝 [BG-LOG] ${line.trim()}`;
	if (level === "ERROR") console.error(consoleMsg);
	else if (level === "WARN") console.warn(consoleMsg);
	else console.log(consoleMsg);
}

async function ensureFallbackDir(): Promise<void> {
	const dirInfo = await FileSystem.getInfoAsync(FALLBACK_LOG_DIR);
	if (!dirInfo.exists) {
		await FileSystem.makeDirectoryAsync(FALLBACK_LOG_DIR, { intermediates: true });
	}
}

/**
 * Log dosyasının tüm içeriğini döndürür (debug ekranı için)
 */
export async function readAllLogs(): Promise<string> {
	try {
		// Önce Native Modülden oku
		if (MediaStorageModule && typeof MediaStorageModule.readTextFile === "function") {
			const content = await MediaStorageModule.readTextFile(RELATIVE_LOG_FILE);
			if (content && content.trim().length > 0) {
				return content;
			}
		}

		// Yoksa fallback dizinden oku
		const info = await FileSystem.getInfoAsync(FALLBACK_LOG_FILE);
		if (!info.exists) return "(Henüz log kaydı yok)";
		return await FileSystem.readAsStringAsync(FALLBACK_LOG_FILE);
	} catch {
		return "(Log dosyası okunamadı)";
	}
}

/**
 * Son N satır log döndürür
 */
export async function readLastLogs(lines: number = 50): Promise<string> {
	const all = await readAllLogs();
	if (all.startsWith("(")) return all;
	const arr = all.trim().split("\n");
	return arr.slice(-lines).join("\n");
}

/**
 * Log dosyasını temizler
 */
export async function clearLogs(): Promise<void> {
	try {
		if (MediaStorageModule && typeof MediaStorageModule.createFile === "function") {
			await MediaStorageModule.createFile(RELATIVE_LOG_FILE, "");
		}
		const info = await FileSystem.getInfoAsync(FALLBACK_LOG_FILE);
		if (info.exists) {
			await FileSystem.deleteAsync(FALLBACK_LOG_FILE, { idempotent: true });
		}
	} catch {
		// temizleme başarısızsa yok say
	}
}

/**
 * Log dosyasının yolunu döndürür (adb pull veya dosya yöneticisi için)
 */
export function getLogFilePath(): string {
	if (MediaStorageModule && typeof MediaStorageModule.getMediaBasePath === "function") {
		const basePath = MediaStorageModule.getMediaBasePath();
		if (basePath) {
			return `${basePath}/${RELATIVE_LOG_FILE}`;
		}
	}
	return FALLBACK_LOG_FILE;
}
