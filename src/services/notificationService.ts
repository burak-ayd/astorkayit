import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import notifee, { AndroidColor, AndroidImportance } from "@notifee/react-native";

import { showAlert } from "@/store/useAlertStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import MediaStorageModule from "../../modules/my-module/src/MediaStorageModule";

/**
 * Bildirim yöneticisi ön plan davranışını ayarlar
 */
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

// Notifee Foreground Service kaydı (Uygulama açılırken çalışır ve servisin hayatta kalmasını sağlar)
notifee.registerForegroundService((notification) => {
	return new Promise(() => {
		// Bu promise resolve edilene kadar Foreground Service çalışmaya devam eder.
		// Biz servisi manuel olarak stopForegroundService ile durduracağız.
	});
});

export async function startForegroundService(title: string, message: string) {
	if (Platform.OS !== "android") return;
	try {
		const channelId = await notifee.createChannel({
			id: "sync_channel",
			name: "Arkaplan İşlemleri",
			importance: AndroidImportance.LOW,
		});

		await notifee.displayNotification({
			id: "sync_notification",
			title: title,
			body: message,
			android: {
				channelId,
				asForegroundService: true,
				color: AndroidColor.BLUE,
				ongoing: true,
			},
		});
	} catch (e) {
		console.warn("Foreground service start failed:", e);
	}
}

export async function updateForegroundService(title: string, message: string) {
	if (Platform.OS !== "android") return;
	try {
		const channelId = await notifee.createChannel({
			id: "sync_channel",
			name: "Arkaplan İşlemleri",
			importance: AndroidImportance.LOW,
		});

		await notifee.displayNotification({
			id: "sync_notification",
			title: title,
			body: message,
			android: {
				channelId,
				asForegroundService: true,
				ongoing: true,
			},
		});
	} catch (e) {
		console.warn("Foreground service update failed:", e);
	}
}

export async function stopForegroundService() {
	if (Platform.OS !== "android") return;
	try {
		await notifee.stopForegroundService();
	} catch (e) {
		console.warn("Foreground service stop failed:", e);
	}
}

/**
 * Android için yüksek öncelikli bildirim kanalı oluşturur
 */
export async function initNotifications() {
	try {
		if (Platform.OS === "android") {
			await Notifications.setNotificationChannelAsync("astor-tasks", {
				name: "İşlem Bildirimleri",
				importance: Notifications.AndroidImportance.HIGH,
				vibrationPattern: [0, 250, 250, 250],
				lightColor: "#3B82F6",
				enableVibrate: true,
			});
		}

		const { status: existingStatus } = await Notifications.getPermissionsAsync();
		let finalStatus = existingStatus;
		if (existingStatus !== "granted") {
			const { status } = await Notifications.requestPermissionsAsync();
			finalStatus = status;
		}

		return finalStatus === "granted";
	} catch (e) {
		console.warn("Bildirim sistemi başlatılamadı:", e);
		return false;
	}
}

export interface TaskNotificationPayload {
	title: string;
	body: string;
	alertTitle: string;
	alertMessage: string;
	alertType?: "success" | "danger" | "warning" | "info";
	actionType?: "zip_export" | "drive_sync";
	zipPath?: string;
	zipName?: string;
}

/**
 * İşlem bittiğinde yerel bildirim gönderir
 */
export async function sendTaskNotification(payload: TaskNotificationPayload) {
	const notificationsEnabled =
		useSettingsStore.getState().notificationsEnabled;
	if (!notificationsEnabled) return;

	try {
		await Notifications.scheduleNotificationAsync({
			content: {
				title: payload.title,
				body: payload.body,
				data: payload,
			},
			trigger: null, // Hemen gönder
		});
	} catch (e) {
		console.warn("Bildirim gönderilemedi:", e);
	}
}

/**
 * Bildirime tıklandığında ilgili Alert popup'ını açan dinleyiciyi kurar
 */
export function setupNotificationResponseListener() {
	const subscription =
		Notifications.addNotificationResponseReceivedListener((response) => {
			const data = response.notification.request.content
				.data as TaskNotificationPayload;
			if (!data || !data.alertTitle) return;

			if (data.actionType === "zip_export" && data.zipPath) {
				showAlert({
					title: data.alertTitle,
					message: data.alertMessage,
					type: data.alertType || "success",
					buttons: [
						{ text: "Kapat", style: "cancel" },
						{
							text: "Paylaş",
							onPress: async () => {
								if (MediaStorageModule && data.zipPath) {
									await MediaStorageModule.shareMediaFiles(
										[data.zipPath],
										data.zipName,
										data.alertTitle,
									);
								}
							},
						},
					],
				});
			} else {
				showAlert({
					title: data.alertTitle,
					message: data.alertMessage,
					type: data.alertType || "info",
				});
			}
		});

	return () => subscription.remove();
}
