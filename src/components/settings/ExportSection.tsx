import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { sendTaskNotification } from "@/services/notificationService";
import { showAlert } from "@/store/useAlertStore";
import { useRecordStore } from "@/store/useRecordStore";
import { exportRecordsToZip } from "@/utils/zipExport";
import MediaStorageModule from "../../../modules/my-module/src/MediaStorageModule";

interface ExportSectionProps {
	isProcessing: boolean;
	setIsProcessing: (v: boolean) => void;
}

export function ExportSection({
	isProcessing,
	setIsProcessing,
}: ExportSectionProps) {
	const theme = useTheme();
	const records = useRecordStore((s) => s.records);

	const handleExportAllZip = async () => {
		if (records.length === 0) {
			showAlert({
				title: "Kayıt Bulunamadı",
				message: "Dışa aktarılacak herhangi bir anı kaydı bulunmuyor.",
				type: "warning",
			});
			return;
		}

		try {
			setIsProcessing(true);
			const result = await exportRecordsToZip(
				records,
				"Astor Kayıt - Tüm Arşiv Yedeği",
			);

			if (result.success && result.zipPath) {
				const alertTitle = "ZIP Arşivi Hazır";
				const alertMessage = `Toplam ${records.length} kayıt, tüm fotoğraflar ve interaktif HTML görüntüleyici ZIP olarak hazırlandı.\n\nKonum: Backups/${result.zipName}\n\nArşivi şimdi paylaşmak ister misiniz?`;

				await sendTaskNotification({
					title: "ZIP Arşivi Hazır 📦",
					body: `${records.length} adet kayıt başarıyla paketlendi. Paylaşmak için dokunun.`,
					alertTitle,
					alertMessage,
					alertType: "success",
					actionType: "zip_export",
					zipPath: result.zipPath,
					zipName: result.zipName,
				});
			} else {
				showAlert({
					title: "Hata",
					message: result.error || "ZIP oluşturulamadı.",
					type: "danger",
				});
			}
		} catch (e) {
			showAlert({
				title: "Dışa Aktarma Hatası",
				message: "İşlem sırasında bir hata oluştu: " + String(e),
				type: "danger",
			});
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<>
			<ThemedText
				type="small"
				style={[
					styles.explainerText,
					{ color: theme.textSecondary },
				]}>
				Tüm anılarınızı, fotoğraflarını ve herhangi bir tarayıcıda
				doğrudan çalıştırılabilen interaktif HTML görüntüleyiciyi tek bir
				ZIP arşivinde toplar.
			</ThemedText>

			<Pressable
				style={({ pressed }) => [
					styles.fullWidthBtn,
					{
						backgroundColor: theme.backgroundSelected,
						borderColor: theme.border,
						borderWidth: 1,
					},
					pressed && styles.buttonPressed,
					isProcessing && styles.buttonDisabled,
				]}
				onPress={handleExportAllZip}
				disabled={isProcessing}>
				{isProcessing ? (
					<ActivityIndicator size="small" color={theme.primary} />
				) : (
					<>
						<MaterialIcons
							name="folder-zip"
							size={20}
							color={theme.primary}
						/>
						<ThemedText
							style={[
								styles.fullWidthBtnText,
								{ color: theme.text },
							]}>
							📦 Tümünü ZIP Olarak Dışa Aktar
						</ThemedText>
					</>
				)}
			</Pressable>
		</>
	);
}

const styles = StyleSheet.create({
	explainerText: {
		fontSize: 12,
		lineHeight: 17,
	},
	fullWidthBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
		borderRadius: 14,
	},
	fullWidthBtnText: {
		fontSize: 13,
		fontWeight: "700",
	},
	buttonPressed: {
		opacity: 0.85,
		transform: [{ scale: 0.98 }],
	},
	buttonDisabled: {
		opacity: 0.5,
	},
});
