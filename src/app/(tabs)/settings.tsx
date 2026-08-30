import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useDriveStore } from "@/store/useDriveStore";
import { useRecordStore } from "@/store/useRecordStore";
import { ThemeMode, useSettingsStore } from "@/store/useSettingsStore";
import { exportRecordsToZip } from "@/utils/zipExport";
import MediaStorageModule from "../../../modules/my-module/src/MediaStorageModule";

export default function SettingsScreen() {
	const theme = useTheme();
	const records = useRecordStore((s) => s.records);
	const stats = useRecordStore((s) => s.stats);
	const loadStats = useRecordStore((s) => s.loadStats);
	const clearAllRecords = useRecordStore((s) => s.clearAllRecords);

	const defaultHideFromGallery = useSettingsStore(
		(s) => s.defaultHideFromGallery,
	);
	const setDefaultHideFromGallery = useSettingsStore(
		(s) => s.setDefaultHideFromGallery,
	);
	const themeMode = useSettingsStore((s) => s.themeMode);
	const setThemeMode = useSettingsStore((s) => s.setThemeMode);
	const loadSettings = useSettingsStore((s) => s.loadSettings);

	// Google Drive Store
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
	const loadDriveSettings = useDriveStore((s) => s.loadDriveSettings);

	const [isProcessing, setIsProcessing] = useState(false);
	const [basePath, setBasePath] = useState<string>("");

	const checkStatus = useCallback(() => {
		if (!MediaStorageModule || Platform.OS !== "android") return;
		try {
			const path = MediaStorageModule.getMediaBasePath();
			if (path) setBasePath(path);
		} catch (e) {
			console.warn("Status check failed:", e);
		}
	}, []);

	useEffect(() => {
		loadStats();
		loadSettings();
		loadDriveSettings();
		checkStatus();
	}, [loadStats, loadSettings, loadDriveSettings, checkStatus]);

	const handleToggleDefaultHide = async (val: boolean) => {
		await setDefaultHideFromGallery(val);
	};

	const handleSelectTheme = async (mode: ThemeMode) => {
		await setThemeMode(mode);
	};

	const handleGoogleConnect = async () => {
		try {
			setIsProcessing(true);
			const ok = await connectWithGoogle();
			if (ok) {
				Alert.alert(
					"Bağlantı Başarılı 🎉",
					"Google Drive hesabınız başarıyla bağlandı. Kayıtlarınızı senkronize edebilirsiniz.",
				);
			}
		} catch (e: any) {
			Alert.alert(
				"Bağlantı Hatası",
				e.message || "Google hesabı bağlanamadı.",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleGoogleDisconnect = () => {
		Alert.alert(
			"Bağlantıyı Kes",
			"Google Drive hesabınızın bağlantısını kesmek istediğinize emin misiniz? Cihazdaki yerel verileriniz etkilenmez.",
			[
				{ text: "İptal", style: "cancel" },
				{
					text: "Bağlantıyı Kes",
					style: "destructive",
					onPress: async () => {
						await disconnectDrive();
					},
				},
			],
		);
	};

	const handleManualDriveSync = async () => {
		if (!isDriveConnected) return;
		try {
			const res = await syncNow(records);
			if (res.success) {
				Alert.alert(
					"Senkronizasyon Başarılı ☁️",
					`${res.uploadedCount} adet kayıt Google Drive'a başarıyla yedeklendi.`,
				);
			} else {
				Alert.alert(
					"Senkronizasyon Uyarısı",
					res.error || "Yedekleme tamamlanamadı.",
				);
			}
		} catch (e) {
			Alert.alert("Hata", "Senkronizasyon hatası: " + String(e));
		}
	};

	const handleExportAllZip = async () => {
		if (records.length === 0) {
			Alert.alert(
				"Uyarı",
				"Dışa aktarılacak herhangi bir kayıt bulunmuyor.",
			);
			return;
		}

		try {
			setIsProcessing(true);
			const result = await exportRecordsToZip(
				records,
				"Astor Kayıt - Tüm Arşiv Yedeği",
			);

			if (result.success && result.zipPath) {
				Alert.alert(
					"Yedekleme Tamamlandı 📦",
					`Toplam ${records.length} kayıt, tüm fotoğraflar ve interaktif HTML görüntüleyici ZIP arşivi olarak kaydedildi.\n\nKonum: Backups/${result.zipName}\n\nArşivi şimdi paylaşmak ister misiniz?`,
					[
						{ text: "Kapat", style: "cancel" },
						{
							text: "Paylaş",
							onPress: async () => {
								if (MediaStorageModule && result.zipPath) {
									await MediaStorageModule.shareMediaFiles(
										[result.zipPath],
										result.zipName,
										`Astor Kayıt Tüm Arşiv Yedeği (${records.length} Kayıt)`,
									);
								}
							},
						},
					],
				);
			} else {
				Alert.alert("Hata", result.error || "ZIP oluşturulamadı.");
			}
		} catch (e) {
			Alert.alert("Hata", "Dışa aktarma başarısız: " + String(e));
		} finally {
			setIsProcessing(false);
		}
	};

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

	const formatSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	};

	const formatSyncDate = (isoStr: string | null) => {
		if (!isoStr) return "Henüz senkronize edilmedi";
		try {
			const d = new Date(isoStr);
			return d.toLocaleDateString("tr-TR", {
				day: "numeric",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return isoStr;
		}
	};

	const cardStyle = [
		styles.card,
		{
			borderColor: theme.border,
			borderWidth: 1,
			shadowColor: theme.shadow,
		},
	];

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<ScrollView
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}>
					{/* Header */}
					<View style={styles.header}>
						<ThemedText type="subtitle" style={styles.headerTitle}>
							Ayarlar & Bulut Senkronizasyon
						</ThemedText>
						<ThemedText
							type="small"
							style={[
								styles.headerSub,
								{ color: theme.textSecondary },
							]}>
							Google Drive, depolama ve uygulama tercihleri
						</ThemedText>
					</View>

					{/* Google Drive Sync Card */}
					<ThemedView type="backgroundElement" style={cardStyle}>
						<View style={styles.cardHeader}>
							<MaterialIcons
								name="cloud-sync"
								size={24}
								color={
									isDriveConnected
										? theme.success
										: theme.primary
								}
							/>
							<View style={styles.cardHeaderTexts}>
								<ThemedText
									type="smallBold"
									style={styles.cardTitle}>
									Google Drive Senkronizasyonu
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.cardSubtitle,
										{ color: theme.textSecondary },
									]}>
									{isDriveConnected
										? "Google Drive bağlı • Offline First"
										: "Çevrimdışı öncelikli • İsteğe bağlı bulut yedekleme"}
								</ThemedText>
							</View>
							{isDriveConnected && (
								<View
									style={[
										styles.connectedPill,
										{ backgroundColor: theme.successMuted },
									]}>
									<MaterialIcons
										name="check-circle"
										size={14}
										color={theme.success}
									/>
									<ThemedText
										style={[
											styles.connectedPillText,
											{ color: theme.success },
										]}>
										Bağlı
									</ThemedText>
								</View>
							)}
						</View>

						{isDriveConnected && driveUser ? (
							<View style={styles.driveContent}>
								{/* User Info Bar */}
								<View
									style={[
										styles.userBar,
										{
											backgroundColor: theme.background,
											borderColor: theme.border,
											borderWidth: 1,
										},
									]}>
									{driveUser.picture ? (
										<Image
											source={{ uri: driveUser.picture }}
											style={styles.userAvatar}
										/>
									) : (
										<View
											style={[
												styles.userAvatarPlaceholder,
												{
													backgroundColor:
														theme.primaryMuted,
												},
											]}>
											<MaterialIcons
												name="account-circle"
												size={24}
												color={theme.primary}
											/>
										</View>
									)}
									<View style={styles.userBarTexts}>
										<ThemedText
											type="smallBold"
											numberOfLines={1}>
											{driveUser.name}
										</ThemedText>
										<ThemedText
											type="small"
											style={{
												color: theme.textSecondary,
												fontSize: 11,
											}}
											numberOfLines={1}>
											{driveUser.email}
										</ThemedText>
									</View>
									<Pressable
										style={({ pressed }) => [
											styles.disconnectBtn,
											pressed && styles.buttonPressed,
										]}
										onPress={handleGoogleDisconnect}>
										<ThemedText
											style={[
												styles.disconnectBtnText,
												{ color: theme.danger },
											]}>
											Çıkış Yap
										</ThemedText>
									</Pressable>
								</View>

								{/* Last Sync Info & Manual Sync Button */}
								<View style={styles.syncActionRow}>
									<View style={styles.lastSyncWrapper}>
										<ThemedText
											type="small"
											style={[
												styles.lastSyncLabel,
												{ color: theme.textSecondary },
											]}>
											Son Senkronizasyon:
										</ThemedText>
										<ThemedText
											type="smallBold"
											style={[
												styles.lastSyncValue,
												{ color: theme.primary },
											]}>
											{formatSyncDate(lastSyncTime)}
										</ThemedText>
									</View>

									<Pressable
										style={({ pressed }) => [
											styles.syncNowBtn,
											{ backgroundColor: theme.primary },
											pressed && styles.buttonPressed,
											isSyncing && styles.buttonDisabled,
										]}
										onPress={handleManualDriveSync}
										disabled={isSyncing}>
										{isSyncing ? (
											<ActivityIndicator
												size="small"
												color="#ffffff"
											/>
										) : (
											<>
												<MaterialIcons
													name="sync"
													size={16}
													color="#ffffff"
												/>
												<ThemedText
													style={
														styles.syncNowBtnText
													}>
													Şimdi Eşitle
												</ThemedText>
											</>
										)}
									</Pressable>
								</View>

								{/* Toggle Settings */}
								<View
									style={[
										styles.togglesWrapper,
										{ borderTopColor: theme.border },
									]}>
									{/* Auto Sync Toggle */}
									<View style={styles.toggleRow}>
										<View style={styles.toggleTexts}>
											<ThemedText type="smallBold">
												Otomatik Senkronizasyon (Oto
												Upload)
											</ThemedText>
											<ThemedText
												type="small"
												style={[
													styles.toggleDesc,
													{
														color: theme.textSecondary,
													},
												]}>
												{autoSyncEnabled
													? "Yeni veya düzenlenen anılar anında Google Drive'a yüklenir."
													: 'Kapalı • Yalnızca "Şimdi Eşitle" butonuna basıldığında yüklenir (Offline First).'}
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

									{/* Wi-Fi Only Toggle */}
									<View style={styles.toggleRow}>
										<View style={styles.toggleTexts}>
											<ThemedText type="smallBold">
												Sadece Wi-Fi ile Yükle
											</ThemedText>
											<ThemedText
												type="small"
												style={[
													styles.toggleDesc,
													{
														color: theme.textSecondary,
													},
												]}>
												{syncOnWifiOnly
													? "Mobil veri korunur; yükleme sadece Wi-Fi bağlıyken yapılır."
													: "Wi-Fi veya Mobil Veri üzerinden senkronizasyona izin verilir."}
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

									{/* Deletion Policy Toggle */}
									<View style={styles.toggleRow}>
										<View style={styles.toggleTexts}>
											<ThemedText type="smallBold">
												Silinenleri Drive'dan da Sil
											</ThemedText>
											<ThemedText
												type="small"
												style={[
													styles.toggleDesc,
													{
														color: theme.textSecondary,
													},
												]}>
												{deleteFromDriveOnLocalDelete
													? "Cihazdan silinen kayıtlar Google Drive'dan da silinir."
													: "Kapalı • Silinen kayıtlar Google Drive'da kalıcı yedek olarak saklanır."}
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
							</View>
						) : (
							<View style={styles.driveLoginPrompt}>
								<ThemedText
									type="small"
									style={[
										styles.offlineFirstDesc,
										{ color: theme.textSecondary },
									]}>
									Uygulama{" "}
									<ThemedText type="smallBold">
										Offline-first (önce çevrimdışı)
									</ThemedText>{" "}
									çalışır. Tüm verileriniz cihazınızda
									saklanır. Google hesabınızla giriş yaparak
									kayıtlarınızı Google Drive'a
									yedekleyebilirsiniz.
								</ThemedText>

								<Pressable
									style={({ pressed }) => [
										styles.googleLoginBtn,
										{ backgroundColor: theme.primary },
										pressed && styles.buttonPressed,
										isProcessing && styles.buttonDisabled,
									]}
									onPress={handleGoogleConnect}
									disabled={isProcessing}>
									{isProcessing ? (
										<ActivityIndicator
											size="small"
											color="#ffffff"
										/>
									) : (
										<>
											<MaterialIcons
												name="login"
												size={18}
												color="#ffffff"
											/>
											<ThemedText
												style={
													styles.googleLoginBtnText
												}>
												Google Hesabı ile Bağlan
											</ThemedText>
										</>
									)}
								</Pressable>
							</View>
						)}
					</ThemedView>

					{/* Theme & Appearance Card */}
					<ThemedView type="backgroundElement" style={cardStyle}>
						<View style={styles.cardHeader}>
							<MaterialIcons
								name="palette"
								size={22}
								color={theme.primary}
							/>
							<View style={styles.cardHeaderTexts}>
								<ThemedText
									type="smallBold"
									style={styles.cardTitle}>
									Görünüm & Tema
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.cardSubtitle,
										{ color: theme.textSecondary },
									]}>
									Uygulama renk temasını belirleyin
								</ThemedText>
							</View>
						</View>

						<View
							style={[
								styles.themeSelectorRow,
								{
									backgroundColor: theme.background,
									borderColor: theme.border,
									borderWidth: 1,
								},
							]}>
							{/* System Theme Option */}
							<Pressable
								style={({ pressed }) => [
									styles.themeOptionBtn,
									themeMode === "system" && {
										backgroundColor: theme.primary,
									},
									pressed && styles.buttonPressed,
								]}
								onPress={() => handleSelectTheme("system")}>
								<MaterialIcons
									name="settings-brightness"
									size={20}
									color={
										themeMode === "system"
											? theme.background === "#0B0F19"
												? "#0B0F19"
												: "#ffffff"
											: theme.textMuted
									}
								/>
								<ThemedText
									style={[
										styles.themeOptionText,
										{
											color:
												themeMode === "system"
													? theme.background ===
														"#0B0F19"
														? "#0B0F19"
														: "#ffffff"
													: theme.textSecondary,
										},
									]}>
									Sistem
								</ThemedText>
							</Pressable>

							{/* Light Theme Option */}
							<Pressable
								style={({ pressed }) => [
									styles.themeOptionBtn,
									themeMode === "light" && {
										backgroundColor: theme.primary,
									},
									pressed && styles.buttonPressed,
								]}
								onPress={() => handleSelectTheme("light")}>
								<MaterialIcons
									name="light-mode"
									size={20}
									color={
										themeMode === "light"
											? theme.background === "#0B0F19"
												? "#0B0F19"
												: "#ffffff"
											: theme.textMuted
									}
								/>
								<ThemedText
									style={[
										styles.themeOptionText,
										{
											color:
												themeMode === "light"
													? theme.background ===
														"#0B0F19"
														? "#0B0F19"
														: "#ffffff"
													: theme.textSecondary,
										},
									]}>
									Aydınlık
								</ThemedText>
							</Pressable>

							{/* Dark Theme Option */}
							<Pressable
								style={({ pressed }) => [
									styles.themeOptionBtn,
									themeMode === "dark" && {
										backgroundColor: theme.primary,
									},
									pressed && styles.buttonPressed,
								]}
								onPress={() => handleSelectTheme("dark")}>
								<MaterialIcons
									name="dark-mode"
									size={20}
									color={
										themeMode === "dark"
											? theme.background === "#0B0F19"
												? "#0B0F19"
												: "#ffffff"
											: theme.textMuted
									}
								/>
								<ThemedText
									style={[
										styles.themeOptionText,
										{
											color:
												themeMode === "dark"
													? theme.background ===
														"#0B0F19"
														? "#0B0F19"
														: "#ffffff"
													: theme.textSecondary,
										},
									]}>
									Karanlık
								</ThemedText>
							</Pressable>
						</View>
					</ThemedView>

					{/* Storage Stats Card */}
					<ThemedView type="backgroundElement" style={cardStyle}>
						<View style={styles.cardHeader}>
							<MaterialIcons
								name="pie-chart"
								size={22}
								color={theme.primary}
							/>
							<ThemedText
								type="smallBold"
								style={styles.cardTitle}>
								Kullanım İstatistikleri
							</ThemedText>
						</View>

						<View style={styles.statsGrid}>
							<View
								style={[
									styles.statBox,
									{
										backgroundColor: theme.background,
										borderColor: theme.border,
										borderWidth: 1,
									},
								]}>
								<ThemedText
									style={[
										styles.statNumber,
										{ color: theme.primary },
									]}>
									{stats.totalRecords}
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.statLabel,
										{ color: theme.textSecondary },
									]}>
									Toplam Kayıt
								</ThemedText>
							</View>

							<View
								style={[
									styles.statBox,
									{
										backgroundColor: theme.background,
										borderColor: theme.border,
										borderWidth: 1,
									},
								]}>
								<ThemedText
									style={[
										styles.statNumber,
										{ color: theme.primary },
									]}>
									{stats.totalPhotos}
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.statLabel,
										{ color: theme.textSecondary },
									]}>
									Toplam Fotoğraf
								</ThemedText>
							</View>

							<View
								style={[
									styles.statBox,
									{
										backgroundColor: theme.background,
										borderColor: theme.border,
										borderWidth: 1,
									},
								]}>
								<ThemedText
									style={[
										styles.statNumber,
										{ color: theme.primary },
									]}>
									{formatSize(stats.totalSizeBytes)}
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.statLabel,
										{ color: theme.textSecondary },
									]}>
									Disk Kullanımı
								</ThemedText>
							</View>
						</View>

						{basePath !== "" && (
							<View
								style={[
									styles.pathBox,
									{
										backgroundColor: theme.background,
										borderColor: theme.border,
										borderWidth: 1,
									},
								]}>
								<ThemedText
									type="small"
									style={[
										styles.pathLabel,
										{ color: theme.textSecondary },
									]}>
									Depolama Yolu:
								</ThemedText>
								<ThemedText
									type="code"
									style={[
										styles.pathValue,
										{ color: theme.text },
									]}>
									{basePath}
								</ThemedText>
							</View>
						)}
					</ThemedView>

					{/* Global Default Gallery Visibility Card */}
					<ThemedView type="backgroundElement" style={cardStyle}>
						<View style={styles.cardHeader}>
							<MaterialIcons
								name={
									defaultHideFromGallery
										? "visibility-off"
										: "visibility"
								}
								size={24}
								color={
									defaultHideFromGallery
										? theme.warning
										: theme.primary
								}
							/>
							<View style={styles.cardHeaderTexts}>
								<ThemedText
									type="smallBold"
									style={styles.cardTitle}>
									Varsayılan Galeri Görünürlüğü (Global)
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.cardSubtitle,
										{ color: theme.textSecondary },
									]}>
									{defaultHideFromGallery
										? "Yeni kayıtlar varsayılan olarak cihaz galerisinden GİZLENİR."
										: "Yeni kayıtlar varsayılan olarak cihaz galerisinde GÖRÜNÜR."}
								</ThemedText>
							</View>
							<Switch
								value={defaultHideFromGallery}
								onValueChange={handleToggleDefaultHide}
								trackColor={{
									false: theme.border,
									true: theme.warning,
								}}
								thumbColor="#ffffff"
							/>
						</View>
					</ThemedView>

					{/* Tools & Rescan Card */}
					<ThemedView type="backgroundElement" style={cardStyle}>
						<View style={styles.cardHeader}>
							<MaterialIcons
								name="sync"
								size={22}
								color={theme.accent}
							/>
							<View style={styles.cardHeaderTexts}>
								<ThemedText
									type="smallBold"
									style={styles.cardTitle}>
									Medya Veritabanı Senkronizasyonu
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.cardSubtitle,
										{ color: theme.textSecondary },
									]}>
									Tüm fotoğrafları Android sistem medya
									tarayıcısıyla yeniden eşitleyin
								</ThemedText>
							</View>
						</View>

						<Pressable
							style={({ pressed }) => [
								styles.actionBtn,
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
							<ThemedText
								style={[
									styles.actionBtnText,
									{ color: theme.primary },
								]}>
								🔄 Galeri Veritabanını Yeniden Tara
							</ThemedText>
						</Pressable>
					</ThemedView>

					{/* Export & Backup (ZIP) Card */}
					<ThemedView type="backgroundElement" style={cardStyle}>
						<View style={styles.cardHeader}>
							<MaterialIcons
								name="archive"
								size={24}
								color={theme.primary}
							/>
							<View style={styles.cardHeaderTexts}>
								<ThemedText
									type="smallBold"
									style={styles.cardTitle}>
									Yedekleme & Dışa Aktarma (ZIP)
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.cardSubtitle,
										{ color: theme.textSecondary },
									]}>
									Tüm kayıtları, fotoğrafları ve interaktif
									HTML görüntüleyiciyi tek bir ZIP dosyasında
									paketleyin
								</ThemedText>
							</View>
						</View>

						<Pressable
							style={({ pressed }) => [
								styles.actionBtn,
								{
									backgroundColor: theme.primary,
									borderColor: theme.primary,
									borderWidth: 1,
								},
								pressed && styles.buttonPressed,
								isProcessing && styles.buttonDisabled,
							]}
							onPress={handleExportAllZip}
							disabled={isProcessing}>
							{isProcessing ? (
								<ActivityIndicator
									size="small"
									color="#ffffff"
								/>
							) : (
								<ThemedText
									style={[
										styles.actionBtnText,
										{ color: "#ffffff" },
									]}>
									📦 Tüm Kayıtları ZIP Olarak Dışa Aktar
								</ThemedText>
							)}
						</Pressable>
					</ThemedView>

					{/* Danger Zone */}
					<ThemedView
						type="backgroundElement"
						style={[
							...cardStyle,
							{
								borderColor: theme.dangerMuted,
								borderWidth: 1.5,
							},
						]}>
						<View style={styles.cardHeader}>
							<MaterialIcons
								name="warning"
								size={22}
								color={theme.danger}
							/>
							<View style={styles.cardHeaderTexts}>
								<ThemedText
									type="smallBold"
									style={[
										styles.cardTitle,
										{ color: theme.danger },
									]}>
									Tehlikeli Bölge
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.cardSubtitle,
										{ color: theme.textSecondary },
									]}>
									Tüm veritabanını ve kayıtlı tüm medya
									dosyalarını kalıcı olarak temizler
								</ThemedText>
							</View>
						</View>

						<Pressable
							style={({ pressed }) => [
								styles.actionBtn,
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
										styles.actionBtnText,
										{ color: theme.danger },
									]}>
									🗑️ Tüm Kayıtları ve Fotoğrafları Sil
								</ThemedText>
							)}
						</Pressable>
					</ThemedView>
				</ScrollView>
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	safeArea: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: Spacing.four,
		paddingTop: Spacing.three,
		paddingBottom: Spacing.six,
		gap: Spacing.four,
	},
	header: {
		gap: 2,
		paddingTop: Spacing.one,
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: "700",
	},
	headerSub: {
		fontSize: 13,
		fontWeight: "500",
	},
	card: {
		padding: Spacing.four,
		borderRadius: 20,
		gap: Spacing.three,
		elevation: 3,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	cardHeaderTexts: {
		flex: 1,
		gap: 2,
	},
	cardTitle: {
		fontSize: 15,
	},
	cardSubtitle: {
		fontSize: 12,
	},
	connectedPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 8,
	},
	connectedPillText: {
		fontSize: 11,
		fontWeight: "700",
	},
	driveContent: {
		gap: Spacing.three,
	},
	userBar: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.two,
		borderRadius: 14,
		gap: Spacing.two,
	},
	userAvatar: {
		width: 36,
		height: 36,
		borderRadius: 18,
	},
	userAvatarPlaceholder: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	userBarTexts: {
		flex: 1,
	},
	disconnectBtn: {
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	disconnectBtnText: {
		fontSize: 12,
		fontWeight: "600",
	},
	syncActionRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
	},
	lastSyncWrapper: {
		flex: 1,
	},
	lastSyncLabel: {
		fontSize: 11,
	},
	lastSyncValue: {
		fontSize: 12,
		marginTop: 2,
	},
	syncNowBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 14,
		paddingVertical: 9,
		borderRadius: 12,
	},
	syncNowBtnText: {
		color: "#ffffff",
		fontSize: 12,
		fontWeight: "700",
	},
	togglesWrapper: {
		borderTopWidth: 1,
		paddingTop: Spacing.two,
		gap: Spacing.three,
	},
	toggleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
	},
	toggleTexts: {
		flex: 1,
		gap: 2,
	},
	toggleDesc: {
		fontSize: 11,
		lineHeight: 15,
	},
	driveLoginPrompt: {
		gap: Spacing.three,
	},
	offlineFirstDesc: {
		fontSize: 12,
		lineHeight: 17,
	},
	googleLoginBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
		borderRadius: 14,
	},
	googleLoginBtnText: {
		color: "#ffffff",
		fontSize: 14,
		fontWeight: "700",
	},
	themeSelectorRow: {
		flexDirection: "row",
		gap: Spacing.two,
		padding: 5,
		borderRadius: 14,
	},
	themeOptionBtn: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		paddingVertical: 10,
		borderRadius: 10,
	},
	themeOptionText: {
		fontSize: 13,
		fontWeight: "600",
	},
	statsGrid: {
		flexDirection: "row",
		gap: Spacing.two,
	},
	statBox: {
		flex: 1,
		paddingVertical: Spacing.three,
		paddingHorizontal: Spacing.two,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
	},
	statNumber: {
		fontSize: 18,
		fontWeight: "700",
	},
	statLabel: {
		fontSize: 11,
		textAlign: "center",
		fontWeight: "500",
	},
	pathBox: {
		padding: Spacing.two,
		borderRadius: 12,
		gap: 2,
	},
	pathLabel: {
		fontSize: 11,
		fontWeight: "500",
	},
	pathValue: {
		fontSize: 11,
	},
	actionBtn: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	actionBtnText: {
		fontSize: 14,
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
