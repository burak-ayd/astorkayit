import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { Image } from "expo-image";
import React from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	StyleSheet,
	Switch,
	View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { showAlert } from "@/store/useAlertStore";
import { useDriveStore } from "@/store/useDriveStore";
import { useRecordStore } from "@/store/useRecordStore";

interface DriveSettingsSectionProps {
	isProcessing: boolean;
	setIsProcessing: (v: boolean) => void;
}

export function DriveSettingsSection({
	isProcessing,
	setIsProcessing,
}: DriveSettingsSectionProps) {
	const theme = useTheme();
	const records = useRecordStore((s) => s.records);

	const isDriveConnected = useDriveStore((s) => s.isConnected);
	const driveUser = useDriveStore((s) => s.user);
	const autoSyncEnabled = useDriveStore((s) => s.autoSyncEnabled);
	const syncOnWifiOnly = useDriveStore((s) => s.syncOnWifiOnly);
	const deleteFromDriveOnLocalDelete = useDriveStore(
		(s) => s.deleteFromDriveOnLocalDelete,
	);
	const lastSyncTime = useDriveStore((s) => s.lastSyncTime);
	const isSyncing = useDriveStore((s) => s.isSyncing);
	const connectWithGoogle = useDriveStore((s) => s.connectWithGoogle);
	const disconnectDrive = useDriveStore((s) => s.disconnect);
	const setAutoSync = useDriveStore((s) => s.setAutoSync);
	const setSyncWifiOnly = useDriveStore((s) => s.setSyncWifiOnly);
	const setDeletePolicy = useDriveStore((s) => s.setDeletePolicy);
	const syncNow = useDriveStore((s) => s.syncNow);

	const handleGoogleConnect = async () => {
		try {
			setIsProcessing(true);
			const ok = await connectWithGoogle();
			if (ok) {
				showAlert({
					title: "Bağlantı Başarılı",
					message: "Google Drive hesabınız başarıyla bağlandı. Anılarınız güvende.",
					type: "success",
				});
			}
		} catch (e: any) {
			showAlert({
				title: "Bağlantı Hatası",
				message: e.message || "Google hesabı bağlanamadı.",
				type: "danger",
			});
		} finally {
			setIsProcessing(false);
		}
	};

	const handleGoogleDisconnect = () => {
		showAlert({
			title: "Bağlantıyı Kes",
			message: "Google Drive hesabınızın bağlantısını kesmek istediğinize emin misiniz? Yerel kayıtlarınız cihazınızda korunur.",
			type: "confirm",
			buttons: [
				{ text: "İptal", style: "cancel" },
				{
					text: "Bağlantıyı Kes",
					style: "destructive",
					onPress: async () => {
						await disconnectDrive();
					},
				},
			],
		});
	};

	const handleManualDriveSync = async () => {
		if (!isDriveConnected) return;
		try {
			const res = await syncNow(records);
			if (res.success) {
				showAlert({
					title: "Senkronizasyon Başarılı",
					message: `${res.uploadedCount} adet kayıt ve tüm fotoğrafları Google Drive ile eşitlendi.`,
					type: "success",
				});
			} else {
				showAlert({
					title: "Senkronizasyon Uyarısı",
					message: res.error || "Yedekleme tamamlanamadı.",
					type: "warning",
				});
			}
		} catch (e) {
			showAlert({
				title: "Senkronizasyon Hatası",
				message: "Hata detayı: " + String(e),
				type: "danger",
			});
		}
	};

	const formatSyncDate = (isoStr: string | null) => {
		if (!isoStr) return "Henüz eşitlenmedi";
		try {
			const d = new Date(isoStr);
			return d.toLocaleDateString("tr-TR", {
				day: "numeric",
				month: "short",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return isoStr;
		}
	};

	if (isDriveConnected && driveUser) {
		return (
			<>
				{/* User Profile Bar */}
				<View
					style={[
						styles.profileBar,
						{
							backgroundColor: theme.background,
							borderColor: theme.border,
							borderWidth: 1,
						},
					]}>
					{driveUser.picture ? (
						<Image
							source={{ uri: driveUser.picture }}
							style={styles.profileAvatar}
						/>
					) : (
						<View
							style={[
								styles.profileAvatarPlaceholder,
								{ backgroundColor: theme.primaryMuted },
							]}>
							<MaterialIcons
								name="person"
								size={20}
								color={theme.primary}
							/>
						</View>
					)}
					<View style={styles.profileTextWrap}>
						<ThemedText
							type="smallBold"
							numberOfLines={1}
							style={styles.profileName}>
							{driveUser.name}
						</ThemedText>
						<ThemedText
							type="small"
							numberOfLines={1}
							style={[
								styles.profileEmail,
								{ color: theme.textSecondary },
							]}>
							{driveUser.email}
						</ThemedText>
					</View>
					<Pressable
						style={({ pressed }) => [
							styles.logoutBtn,
							{ backgroundColor: theme.dangerMuted },
							pressed && styles.buttonPressed,
						]}
						onPress={handleGoogleDisconnect}>
						<ThemedText
							style={[
								styles.logoutBtnText,
								{ color: theme.danger },
							]}>
							Çıkış
						</ThemedText>
					</Pressable>
				</View>

				{/* Sync Banner */}
				<View
					style={[
						styles.syncBanner,
						{
							backgroundColor: theme.primaryMuted,
							borderColor: theme.border,
							borderWidth: 1,
						},
					]}>
					<View style={styles.syncBannerTexts}>
						<ThemedText
							type="small"
							style={[
								styles.syncBannerLabel,
								{ color: theme.textSecondary },
							]}>
							Son Eşitleme:
						</ThemedText>
						<ThemedText
							type="smallBold"
							style={[
								styles.syncBannerTime,
								{ color: theme.primary },
							]}>
							{formatSyncDate(lastSyncTime)}
						</ThemedText>
					</View>

					<Pressable
						style={({ pressed }) => [
							styles.primarySyncBtn,
							{ backgroundColor: theme.primary },
							pressed && styles.buttonPressed,
							isSyncing && styles.buttonDisabled,
						]}
						onPress={handleManualDriveSync}
						disabled={isSyncing}>
						{isSyncing ? (
							<ActivityIndicator size="small" color="#ffffff" />
						) : (
							<>
								<MaterialIcons
									name="sync"
									size={16}
									color="#ffffff"
								/>
								<ThemedText style={styles.primarySyncBtnText}>
									Şimdi Eşitle
								</ThemedText>
							</>
						)}
					</Pressable>
				</View>

				{/* Toggle Option Rows */}
				<View style={styles.toggleGroup}>
					{/* Auto Sync */}
					<View style={styles.optionRow}>
						<View
							style={[
								styles.optionIconBox,
								{ backgroundColor: theme.primaryMuted },
							]}>
							<MaterialIcons
								name="autorenew"
								size={18}
								color={theme.primary}
							/>
						</View>
						<View style={styles.optionTextWrap}>
							<ThemedText type="smallBold">
								Otomatik Eşitleme
							</ThemedText>
							<ThemedText
								type="small"
								style={[
									styles.optionDesc,
									{ color: theme.textSecondary },
								]}>
								{autoSyncEnabled
									? "Yeni anılar anında Drive'a yüklenir."
									: "Kapalı (Sadece manuel eşitleme)."}
							</ThemedText>
						</View>
						<Switch
							value={autoSyncEnabled}
							onValueChange={setAutoSync}
							trackColor={{
								false: theme.border,
								true: theme.primary,
							}}
							thumbColor="#ffffff"
						/>
					</View>

					{/* Wi-Fi Only */}
					<View style={styles.optionRow}>
						<View
							style={[
								styles.optionIconBox,
								{ backgroundColor: theme.primaryMuted },
							]}>
							<MaterialIcons
								name="wifi"
								size={18}
								color={theme.primary}
							/>
						</View>
						<View style={styles.optionTextWrap}>
							<ThemedText type="smallBold">
								Sadece Wi-Fi ile Yükle
							</ThemedText>
							<ThemedText
								type="small"
								style={[
									styles.optionDesc,
									{ color: theme.textSecondary },
								]}>
								{syncOnWifiOnly
									? "Mobil veri harcanmaz, sadece Wi-Fi'de yüklenir."
									: "Tüm bağlantılarda yüklemeye izin verilir."}
							</ThemedText>
						</View>
						<Switch
							value={syncOnWifiOnly}
							onValueChange={setSyncWifiOnly}
							trackColor={{
								false: theme.border,
								true: theme.primary,
							}}
							thumbColor="#ffffff"
						/>
					</View>

					{/* Delete Policy */}
					<View style={styles.optionRow}>
						<View
							style={[
								styles.optionIconBox,
								{ backgroundColor: theme.warningMuted },
							]}>
							<MaterialIcons
								name="delete-sweep"
								size={18}
								color={theme.warning}
							/>
						</View>
						<View style={styles.optionTextWrap}>
							<ThemedText type="smallBold">
								Silinenleri Drive'dan Sil
							</ThemedText>
							<ThemedText
								type="small"
								style={[
									styles.optionDesc,
									{ color: theme.textSecondary },
								]}>
								{deleteFromDriveOnLocalDelete
									? "Cihazdan silinen anı Drive'dan da silinir."
									: "Kapalı (Silinenler Drive'da kalıcı saklanır)."}
							</ThemedText>
						</View>
						<Switch
							value={deleteFromDriveOnLocalDelete}
							onValueChange={setDeletePolicy}
							trackColor={{
								false: theme.border,
								true: theme.warning,
							}}
							thumbColor="#ffffff"
						/>
					</View>
				</View>
			</>
		);
	}

	return (
		<View style={styles.loginPromptWrap}>
			<ThemedText
				type="small"
				style={[
					styles.loginPromptText,
					{ color: theme.textSecondary },
				]}>
				Anılarınızı Google Drive hesabınıza yedekleyebilir, fotoğraflarınızı
				orijinal klasör yapısıyla güvenle saklayabilirsiniz.
			</ThemedText>

			<Pressable
				style={({ pressed }) => [
					styles.googleMainBtn,
					{ backgroundColor: theme.primary },
					pressed && styles.buttonPressed,
					isProcessing && styles.buttonDisabled,
				]}
				onPress={handleGoogleConnect}
				disabled={isProcessing}>
				{isProcessing ? (
					<ActivityIndicator size="small" color="#ffffff" />
				) : (
					<>
						<MaterialIcons
							name="account-circle"
							size={20}
							color="#ffffff"
						/>
						<ThemedText style={styles.googleMainBtnText}>
							Google Hesabı ile Bağlan
						</ThemedText>
					</>
				)}
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	profileBar: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		borderRadius: 14,
		gap: Spacing.two,
	},
	profileAvatar: {
		width: 36,
		height: 36,
		borderRadius: 18,
	},
	profileAvatarPlaceholder: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	profileTextWrap: {
		flex: 1,
	},
	profileName: {
		fontSize: 13,
	},
	profileEmail: {
		fontSize: 11,
		marginTop: 1,
	},
	logoutBtn: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 8,
	},
	logoutBtnText: {
		fontSize: 11,
		fontWeight: "700",
	},
	syncBanner: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		borderRadius: 14,
	},
	syncBannerTexts: {
		gap: 1,
	},
	syncBannerLabel: {
		fontSize: 10,
		fontWeight: "500",
	},
	syncBannerTime: {
		fontSize: 12,
	},
	primarySyncBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
		elevation: 2,
	},
	primarySyncBtnText: {
		color: "#ffffff",
		fontSize: 12,
		fontWeight: "700",
	},
	toggleGroup: {
		gap: Spacing.three,
		paddingTop: Spacing.one,
	},
	optionRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
	},
	optionIconBox: {
		width: 32,
		height: 32,
		borderRadius: 9,
		alignItems: "center",
		justifyContent: "center",
	},
	optionTextWrap: {
		flex: 1,
		gap: 1,
	},
	optionDesc: {
		fontSize: 11,
		lineHeight: 14,
	},
	loginPromptWrap: {
		gap: Spacing.two,
		paddingTop: Spacing.one,
	},
	loginPromptText: {
		fontSize: 12,
		lineHeight: 17,
	},
	googleMainBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
		borderRadius: 14,
	},
	googleMainBtnText: {
		color: "#ffffff",
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
