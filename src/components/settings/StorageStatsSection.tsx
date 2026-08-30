import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRecordStore } from "@/store/useRecordStore";
import MediaStorageModule from "../../../modules/my-module/src/MediaStorageModule";

interface StorageStatsSectionProps {
	basePath: string;
	isProcessing: boolean;
	setIsProcessing: (v: boolean) => void;
}

export function StorageStatsSection({
	basePath,
	isProcessing,
	setIsProcessing,
}: StorageStatsSectionProps) {
	const theme = useTheme();
	const stats = useRecordStore((s) => s.stats);

	const handleRescan = async () => {
		if (!MediaStorageModule || Platform.OS !== "android") return;
		try {
			setIsProcessing(true);
			await MediaStorageModule.scanFile("Files");
			Alert.alert(
				"Tamamlandı ✅",
				"Tüm medya dosyaları Android MediaStore ile eşitlendi.",
			);
		} catch (e) {
			Alert.alert("Hata", String(e));
		} finally {
			setIsProcessing(false);
		}
	};

	const formatSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	};

	return (
		<>
			{/* Stats 3-Tile Grid */}
			<View style={styles.statsTilesRow}>
				<View
					style={[
						styles.statTile,
						{
							backgroundColor: theme.background,
							borderColor: theme.border,
							borderWidth: 1,
						},
					]}>
					<MaterialIcons
						name="format-list-bulleted"
						size={18}
						color={theme.primary}
					/>
					<ThemedText
						style={[
							styles.statTileNumber,
							{ color: theme.text },
						]}>
						{stats.totalRecords}
					</ThemedText>
					<ThemedText
						type="small"
						style={[
							styles.statTileLabel,
							{ color: theme.textSecondary },
						]}>
						Kayıt
					</ThemedText>
				</View>

				<View
					style={[
						styles.statTile,
						{
							backgroundColor: theme.background,
							borderColor: theme.border,
							borderWidth: 1,
						},
					]}>
					<MaterialIcons
						name="photo-library"
						size={18}
						color={theme.accent}
					/>
					<ThemedText
						style={[
							styles.statTileNumber,
							{ color: theme.text },
						]}>
						{stats.totalPhotos}
					</ThemedText>
					<ThemedText
						type="small"
						style={[
							styles.statTileLabel,
							{ color: theme.textSecondary },
						]}>
						Fotoğraf
					</ThemedText>
				</View>

				<View
					style={[
						styles.statTile,
						{
							backgroundColor: theme.background,
							borderColor: theme.border,
							borderWidth: 1,
						},
					]}>
					<MaterialIcons
						name="storage"
						size={18}
						color={theme.success}
					/>
					<ThemedText
						style={[
							styles.statTileNumber,
							{ color: theme.text },
						]}>
						{formatSize(stats.totalSizeBytes)}
					</ThemedText>
					<ThemedText
						type="small"
						style={[
							styles.statTileLabel,
							{ color: theme.textSecondary },
						]}>
						Disk
					</ThemedText>
				</View>
			</View>

			{/* Path Pill */}
			{basePath !== "" && (
				<View
					style={[
						styles.storagePathPill,
						{
							backgroundColor: theme.background,
							borderColor: theme.border,
							borderWidth: 1,
						},
					]}>
					<MaterialIcons
						name="folder-open"
						size={16}
						color={theme.textSecondary}
					/>
					<ThemedText
						type="small"
						numberOfLines={1}
						style={[
							styles.storagePathText,
							{ color: theme.textSecondary },
						]}>
						{basePath}
					</ThemedText>
				</View>
			)}

			{/* Rescan Button */}
			<Pressable
				style={({ pressed }) => [
					styles.secondaryActionBtn,
					{
						backgroundColor: theme.primaryMuted,
						borderColor: theme.border,
						borderWidth: 1,
					},
					pressed && styles.buttonPressed,
					isProcessing && styles.buttonDisabled,
				]}
				onPress={handleRescan}
				disabled={isProcessing}>
				<MaterialIcons
					name="sync"
					size={18}
					color={theme.primary}
				/>
				<ThemedText
					style={[
						styles.secondaryActionBtnText,
						{ color: theme.primary },
					]}>
					Galeri Veritabanını Yeniden Tara
				</ThemedText>
			</Pressable>
		</>
	);
}

const styles = StyleSheet.create({
	statsTilesRow: {
		flexDirection: "row",
		gap: Spacing.two,
	},
	statTile: {
		flex: 1,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.one,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
	},
	statTileNumber: {
		fontSize: 15,
		fontWeight: "800",
	},
	statTileLabel: {
		fontSize: 10,
		fontWeight: "600",
	},
	storagePathPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		borderRadius: 10,
	},
	storagePathText: {
		fontSize: 11,
		flex: 1,
	},
	secondaryActionBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		paddingVertical: 11,
		borderRadius: 12,
	},
	secondaryActionBtnText: {
		fontSize: 12,
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
