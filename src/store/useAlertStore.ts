import { create } from "zustand";

export type AlertType = "info" | "success" | "warning" | "danger" | "confirm";

export interface CustomAlertButton {
	text: string;
	onPress?: () => void;
	style?: "default" | "cancel" | "destructive";
}

export interface AlertOptions {
	title: string;
	message?: string;
	type?: AlertType;
	icon?: any;
	buttons?: CustomAlertButton[];
}

interface AlertStoreState {
	isOpen: boolean;
	title: string;
	message?: string;
	type: AlertType;
	icon?: any;
	buttons: CustomAlertButton[];
	showAlert: (options: AlertOptions) => void;
	closeAlert: () => void;
}

export const useAlertStore = create<AlertStoreState>((set) => ({
	isOpen: false,
	title: "",
	message: undefined,
	type: "info",
	icon: undefined,
	buttons: [{ text: "Tamam", style: "default" }],

	showAlert: (options: AlertOptions) => {
		// Detect alert type automatically if not provided
		let inferredType: AlertType = options.type || "info";
		const lowerTitle = options.title.toLowerCase();
		if (!options.type) {
			if (
				lowerTitle.includes("hata") ||
				lowerTitle.includes("sil") ||
				lowerTitle.includes("tehlikeli")
			) {
				inferredType = "danger";
			} else if (
				lowerTitle.includes("başarılı") ||
				lowerTitle.includes("tamamlandı") ||
				lowerTitle.includes("hazır")
			) {
				inferredType = "success";
			} else if (
				lowerTitle.includes("uyarı") ||
				lowerTitle.includes("dikkat")
			) {
				inferredType = "warning";
			} else if (
				options.buttons &&
				options.buttons.length > 1
			) {
				inferredType = "confirm";
			}
		}

		set({
			isOpen: true,
			title: options.title,
			message: options.message,
			type: inferredType,
			icon: options.icon,
			buttons:
				options.buttons && options.buttons.length > 0
					? options.buttons
					: [{ text: "Tamam", style: "default" }],
		});
	},

	closeAlert: () => {
		set({ isOpen: false });
	},
}));

/**
 * React Native Alert.alert yerine kullanılabilecek şık, modern yardımcı fonksiyon
 */
export function showAlert(
	titleOrOptions: string | AlertOptions,
	message?: string,
	buttons?: CustomAlertButton[],
	type?: AlertType,
) {
	if (typeof titleOrOptions === "object") {
		useAlertStore.getState().showAlert(titleOrOptions);
	} else {
		useAlertStore.getState().showAlert({
			title: titleOrOptions,
			message,
			buttons,
			type,
		});
	}
}
