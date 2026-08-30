import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { showAlert } from "@/store/useAlertStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import MediaStorageModule from "../../modules/my-module/src/MediaStorageModule";

/**
 * Bildirim yöneticisi: Uygulama ön plandayken üstten rahatsız edici banner düşürmez.
 * Sadece arka plandayken veya kilitliyken bildirim çekmecesinde sessizce listelenir.
 */
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

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

		const { status: existingStatus } =
			await Notifications.getPermissionsAsync();
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

export interface TaskNotificationPayload extends Record<string, unknown> {
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
 * İşlem bittiğinde bildirim gönderir.
 * Sadece uygulama arka plandayken bildirim merkezine gönderilir, böylece
 * bildirim çubuğundan dokunulduğunda doğrudan Alert açılır.
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
	const subscription = Notifications.addNotificationResponseReceivedListener(
		(response) => {
			const data = response.notification.request.content
				.data as unknown as TaskNotificationPayload;
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
		},
	);

	return () => subscription.remove();
}
