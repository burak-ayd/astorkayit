import React, { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { CollapsibleCard } from "@/components/settings/CollapsibleCard";
import { DangerZoneSection } from "@/components/settings/DangerZoneSection";
import { DriveSettingsSection } from "@/components/settings/DriveSettingsSection";
import { ExportSection } from "@/components/settings/ExportSection";
import { StorageStatsSection } from "@/components/settings/StorageStatsSection";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useDriveStore } from "@/store/useDriveStore";
import { useRecordStore } from "@/store/useRecordStore";
import { ThemeMode, useSettingsStore } from "@/store/useSettingsStore";
import MediaStorageModule from "../../../modules/my-module/src/MediaStorageModule";

type SectionId = "drive" | "appearance" | "export" | "storage" | "danger";

export default function SettingsScreen() {
	const theme = useTheme();
	const stats = useRecordStore((s) => s.stats);
	const loadStats = useRecordStore((s) => s.loadStats);
	const themeMode = useSettingsStore((s) => s.themeMode);
	const loadSettings = useSettingsStore((s) => s.loadSettings);
	const isDriveConnected = useDriveStore((s) => s.isConnected);
	const driveUser = useDriveStore((s) => s.user);
	const loadDriveSettings = useDriveStore((s) => s.loadDriveSettings);

	const [isProcessing, setIsProcessing] = useState(false);
	const [basePath, setBasePath] = useState<string>("");

	const [expandedSections, setExpandedSections] = useState<
		Record<SectionId, boolean>
	>({
		drive: true,
		appearance: false,
		export: false,
		storage: false,
		danger: false,
	});

	const toggleSection = (id: SectionId) => {
		setExpandedSections((prev) => ({
			...prev,
			[id]: !prev[id],
		}));
	};

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

	const formatSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	};

	const getThemeLabel = (mode: ThemeMode) => {
		if (mode === "dark") return "Karanlık";
		if (mode === "light") return "Aydınlık";
		return "Sistem";
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<ScrollView
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}>
					{/* Header */}
					<View style={styles.header}>
						<ThemedText type="subtitle" style={styles.headerTitle}>
							Ayarlar
						</ThemedText>
						<ThemedText
							type="small"
							style={[
								styles.headerSub,
								{ color: theme.textSecondary },
							]}>
							Bulut eşitleme, görünüm ve depolama tercihleri
						</ThemedText>
					</View>

					{/* 1. Google Drive Section */}
					<CollapsibleCard
						icon="cloud-sync"
						iconColor={
							isDriveConnected ? theme.success : theme.primary
						}
						iconBgColor={
							isDriveConnected
								? theme.successMuted
								: theme.primaryMuted
						}
						title="Google Drive Eşitleme"
						subtitle={
							isDriveConnected
								? driveUser?.email || "Hesap bağlı"
								: "Offline-First • Bulut Yedekleme"
						}
						badgeText={isDriveConnected ? "Bağlı" : undefined}
						badgeColor={theme.success}
						badgeBgColor={theme.successMuted}
						isExpanded={expandedSections.drive}
						onToggle={() => toggleSection("drive")}>
						<DriveSettingsSection
							isProcessing={isProcessing}
							setIsProcessing={setIsProcessing}
						/>
					</CollapsibleCard>

					{/* 2. Appearance Section */}
					<CollapsibleCard
						icon="palette"
						title="Görünüm & Tema"
						subtitle="Renk teması ve galeri görünürlüğü"
						badgeText={getThemeLabel(themeMode)}
						badgeColor={theme.primary}
						badgeBgColor={theme.backgroundSelected}
						isExpanded={expandedSections.appearance}
						onToggle={() => toggleSection("appearance")}>
						<AppearanceSection />
					</CollapsibleCard>

					{/* 3. Export ZIP Section */}
					<CollapsibleCard
						icon="archive"
						title="Dışa Aktarma (ZIP)"
						subtitle="İnteraktif çevrimdışı web arşivi oluştur"
						badgeText="HTML + Medya"
						badgeColor={theme.primary}
						badgeBgColor={theme.backgroundSelected}
						isExpanded={expandedSections.export}
						onToggle={() => toggleSection("export")}>
						<ExportSection
							isProcessing={isProcessing}
							setIsProcessing={setIsProcessing}
						/>
					</CollapsibleCard>

					{/* 4. Storage Stats Section */}
					<CollapsibleCard
						icon="storage"
						title="Depolama & İstatistikler"
						subtitle={`${stats.totalRecords} Kayıt • ${stats.totalPhotos} Fotoğraf`}
						badgeText={formatSize(stats.totalSizeBytes)}
						badgeColor={theme.textSecondary}
						badgeBgColor={theme.backgroundSelected}
						isExpanded={expandedSections.storage}
						onToggle={() => toggleSection("storage")}>
						<StorageStatsSection
							basePath={basePath}
							isProcessing={isProcessing}
							setIsProcessing={setIsProcessing}
						/>
					</CollapsibleCard>

					{/* 5. Danger Zone Section */}
					<CollapsibleCard
						icon="delete-forever"
						title="Tehlikeli Bölge"
						subtitle="Tüm veritabanı ve fotoğrafları sil"
						badgeText="Sıfırla"
						badgeColor={theme.danger}
						badgeBgColor={theme.dangerMuted}
						isDanger
						isExpanded={expandedSections.danger}
						onToggle={() => toggleSection("danger")}>
						<DangerZoneSection
							isProcessing={isProcessing}
							setIsProcessing={setIsProcessing}
						/>
					</CollapsibleCard>
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
		paddingTop: Spacing.two,
		paddingBottom: Spacing.six,
		gap: Spacing.three,
	},
	header: {
		paddingVertical: Spacing.two,
		gap: 3,
	},
	headerTitle: {
		fontSize: 26,
		fontWeight: "800",
		letterSpacing: -0.5,
	},
	headerSub: {
		fontSize: 13,
		fontWeight: "500",
	},
});
