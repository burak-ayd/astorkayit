import React from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { useRecordStore } from "@/store/useRecordStore";

interface DangerZoneSectionProps {
	isProcessing: boolean;
	setIsProcessing: (v: boolean) => void;
}

export function DangerZoneSection({
	isProcessing,
	setIsProcessing,
}: DangerZoneSectionProps) {
	const theme = useTheme();
	const clearAllRecords = useRecordStore((s) => s.clearAllRecords);

	const handleClearAll = () => {
		Alert.alert(
			"Tüm Verileri Sil ⚠️",
			"Tüm anı kayıtları ve kaydedilen fotoğraflar kalıcı olarak silinecek. Bu işlem geri alınamaz!\n\nDevam etmek istiyor musunuz?",
			[
				{ text: "İptal", style: "cancel" },
				{
					text: "Hepsini Sil",
					style: "destructive",
					onPress: async () => {
						try {
							setIsProcessing(true);
							await clearAllRecords();
							Alert.alert(
								"Başarılı",
								"Tüm kayıtlar ve fotoğraflar silindi.",
							);
						} catch (e) {
							Alert.alert(
								"Hata",
								"Kayıtlar silinemedi: " + String(e),
							);
						} finally {
							setIsProcessing(false);
						}
					},
				},
			],
		);
	};

	return (
		<>
			<ThemedText
				type="small"
				style={[
					styles.explainerText,
					{ color: theme.danger },
				]}>
				Bu işlem cihazdaki tüm kayıtları ve kayıtlı tüm fotoğrafları
				kalıcı olarak siler. Bu işlem geri alınamaz.
			</ThemedText>

			<Pressable
				style={({ pressed }) => [
					styles.fullWidthBtn,
					{
						backgroundColor: theme.dangerMuted,
						borderColor: theme.danger,
						borderWidth: 1,
					},
					pressed && styles.buttonPressed,
					isProcessing && styles.buttonDisabled,
				]}
				onPress={handleClearAll}
				disabled={isProcessing}>
				{isProcessing ? (
					<ActivityIndicator
						size="small"
						color={theme.danger}
					/>
				) : (
					<ThemedText
						style={[
							styles.fullWidthBtnText,
							{ color: theme.danger },
						]}>
						🗑️ Tüm Kayıtları ve Fotoğrafları Sil
					</ThemedText>
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
