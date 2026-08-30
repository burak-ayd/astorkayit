import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	Alert,
	FlatList,
	Pressable,
	RefreshControl,
	Share,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateRangeModal } from "@/components/DateRangeModal";
import { RecordCard } from "@/components/RecordCard";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { sendTaskNotification } from "@/services/notificationService";
import { showAlert } from "@/store/useAlertStore";
import { selectFilteredRecords, useRecordStore } from "@/store/useRecordStore";
import { exportRecordsToZip } from "@/utils/zipExport";
import MediaStorageModule from "../../../modules/my-module/src/MediaStorageModule";

export default function HomeScreen() {
	const router = useRouter();
	const theme = useTheme();

	const records = useRecordStore((s) => s.records);
	const isLoading = useRecordStore((s) => s.isLoading);
	const searchQuery = useRecordStore((s) => s.searchQuery);
	const dateFilter = useRecordStore((s) => s.dateFilter);

	const loadRecords = useRecordStore((s) => s.loadRecords);
	const setSearchQuery = useRecordStore((s) => s.setSearchQuery);
	const setDateFilter = useRecordStore((s) => s.setDateFilter);
	const resetFilters = useRecordStore((s) => s.resetFilters);
	const togglePinRecords = useRecordStore((s) => s.togglePinRecords);
	const deleteMultipleRecords = useRecordStore((s) => s.deleteMultipleRecords);
	const toggleMultipleRecordVisibility = useRecordStore(
		(s) => s.toggleMultipleRecordVisibility,
	);

	const [dateModalVisible, setDateModalVisible] = useState(false);
	const [selectedIds, setSelectedIds] = useState<number[]>([]);

	// app.config.js içindeki name veya extra alanını okuyun
	const appName = Constants.expoConfig?.name;

	const filteredRecords = selectFilteredRecords(
		records,
		searchQuery,
		dateFilter,
	);
	const isFilterActive =
		dateFilter.startDate !== null || dateFilter.endDate !== null;
	const isSelectionMode = selectedIds.length > 0;

	useEffect(() => {
		loadRecords();
	}, [loadRecords]);

	const formatDateShort = (d: Date | null) => {
		if (!d) return "";
		return d.toLocaleDateString("tr-TR", {
			day: "numeric",
			month: "short",
		});
	};

	// Selection Helpers
	const isAllFilteredSelected =
		filteredRecords.length > 0 &&
		filteredRecords.every((r) => selectedIds.includes(r.id));

	const areAllSelectedPinned =
		selectedIds.length > 0 &&
		selectedIds.every((id) => {
			const r = records.find((rec) => rec.id === id);
			return r?.is_pinned;
		});

	const areAllSelectedHidden =
		selectedIds.length > 0 &&
		selectedIds.every((id) => {
			const r = records.find((rec) => rec.id === id);
			return r?.is_hidden;
		});

	const handleCardLongPress = (id: number) => {
		if (!selectedIds.includes(id)) {
			setSelectedIds((prev) => [...prev, id]);
		}
	};

	const handleCardPress = (id: number) => {
		if (isSelectionMode) {
			if (selectedIds.includes(id)) {
				setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
			} else {
				setSelectedIds((prev) => [...prev, id]);
			}
		} else {
			router.push({
				pathname: "/detail/[id]",
				params: { id },
			} as any);
		}
	};

	const handleCancelSelection = () => {
		setSelectedIds([]);
	};

	const handleToggleSelectAll = () => {
		if (isAllFilteredSelected) {
			setSelectedIds([]);
		} else {
			setSelectedIds(filteredRecords.map((r) => r.id));
		}
	};

	// Actions
	const handleTogglePin = async () => {
		if (selectedIds.length === 0) return;
		const nextPinState = !areAllSelectedPinned;
		await togglePinRecords(selectedIds, nextPinState);
		setSelectedIds([]);
	};

	const handleToggleVisibility = () => {
		if (selectedIds.length === 0) return;
		const nextHiddenState = !areAllSelectedHidden;
		showAlert({
			title: nextHiddenState ? "Galeride Gizle" : "Galeride Göster",
			message: `Seçilen ${selectedIds.length} kaydın fotoğrafları cihaz galerisinde ${
				nextHiddenState ? "gizlensin mi?" : "gösterilsin mi?"
			}`,
			type: "confirm",
			buttons: [
				{ text: "Vazgeç", style: "cancel" },
				{
					text: "Evet",
					onPress: async () => {
						await toggleMultipleRecordVisibility(
							selectedIds,
							nextHiddenState,
						);
						setSelectedIds([]);
					},
				},
			],
		});
	};

	const handleShare = async () => {
		if (selectedIds.length === 0) return;
		const selectedRecords = records.filter((r) => selectedIds.includes(r.id));

		const allPhotos: string[] = [];
		for (const rec of selectedRecords) {
			for (const p of rec.photos) {
				if (p) allPhotos.push(p);
			}
		}

		let title = "";
		let message = "";

		if (selectedRecords.length === 1) {
			const r = selectedRecords[0];
			title = r.title;
			const dateStr = new Date(r.created_at).toLocaleDateString("tr-TR");
			const timeStr = new Date(r.created_at).toLocaleTimeString("tr-TR", {
				hour: "2-digit",
				minute: "2-digit",
			});
			message = `📋 ${r.title}\n\n${
				r.description ? r.description + "\n\n" : ""
			}📅 Tarih: ${dateStr} ${timeStr}${
				r.photos.length > 0 ? `\n📸 ${r.photos.length} Adet Fotoğraf` : ""
			}`;
		} else {
			title = `${selectedRecords.length} Adet Kayıt`;
			const summary = selectedRecords
				.map((r, idx) => {
					const dateStr = new Date(r.created_at).toLocaleDateString("tr-TR");
					return `${idx + 1}. ${r.title} (${dateStr})${
						r.description ? `\n   ${r.description}` : ""
					}`;
				})
				.join("\n\n");

			message = `📋 Seçilen Kayıtlar (${selectedRecords.length} Adet):\n\n${summary}${
				allPhotos.length > 0 ? `\n\n📸 Toplam ${allPhotos.length} Fotoğraf` : ""
			}`;
		}

		try {
			if (MediaStorageModule && allPhotos.length > 0) {
				await MediaStorageModule.shareMediaFiles(allPhotos, title, message);
			} else {
				await Share.share({
					title,
					message,
				});
			}
		} catch (error) {
			console.error("Paylaşım hatası:", error);
			try {
				await Share.share({
					title,
					message,
				});
			} catch {
				showAlert({
					title: "Hata",
					message: "Paylaşım başlatılamadı.",
					type: "danger",
				});
			}
		}
	};

	const handleExport = async () => {
		if (selectedIds.length === 0) return;
		const selectedRecords = records.filter((r) => selectedIds.includes(r.id));

		try {
			const result = await exportRecordsToZip(
				selectedRecords,
				`${appName || "Astor Kayıt"} - Seçilen Kayıtlar (${selectedRecords.length})`,
			);

			if (result.success && result.zipPath) {
				const alertTitle = "ZIP Arşivi Hazır";
				const alertMessage = `${selectedRecords.length} adet kayıt, fotoğraflar ve interaktif HTML görüntüleyici ZIP olarak arşivlendi.\n\nDosyayı şimdi paylaşmak ister misiniz?`;

				await sendTaskNotification({
					title: "ZIP Arşivi Hazır 📦",
					body: `${selectedRecords.length} adet kayıt başarıyla arşivlendi. Paylaşmak için dokunun.`,
					alertTitle,
					alertMessage,
					alertType: "success",
					actionType: "zip_export",
					zipPath: result.zipPath,
					zipName: result.zipName,
				});

				setSelectedIds([]);
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
				message: "Dışa aktarma sırasında bir sorun oluştu: " + String(e),
				type: "danger",
			});
		}
	};

	const handleDelete = () => {
		if (selectedIds.length === 0) return;
		showAlert({
			title: "Kayıtları Sil",
			message: `Seçilen ${selectedIds.length} adet kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
			type: "danger",
			buttons: [
				{ text: "Vazgeç", style: "cancel" },
				{
					text: "Sil",
					style: "destructive",
					onPress: async () => {
						await deleteMultipleRecords(selectedIds);
						setSelectedIds([]);
					},
				},
			],
		});
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				{/* Header Bar or Selection Action Bar */}
				{isSelectionMode ? (
					<View
						style={[
							styles.selectionHeader,
							{
								backgroundColor: theme.backgroundElement,
								borderColor: theme.border,
							},
						]}>
						{/* Selection Top Row */}
						<View style={styles.selectionTopRow}>
							<View style={styles.selectionLeft}>
								<Pressable
									style={({ pressed }) => [
										styles.selectionCloseBtn,
										{ backgroundColor: theme.backgroundSelected },
										pressed && styles.buttonPressed,
									]}
									onPress={handleCancelSelection}
									hitSlop={8}>
									<MaterialIcons
										name="close"
										size={20}
										color={theme.text}
									/>
								</Pressable>
								<View>
									<ThemedText
										type="smallBold"
										style={styles.selectionTitle}>
										{selectedIds.length} Seçildi
									</ThemedText>
									<ThemedText
										type="small"
										style={[
											styles.selectionSub,
											{ color: theme.textSecondary },
										]}>
										{filteredRecords.length} kayıttan
									</ThemedText>
								</View>
							</View>

							<Pressable
								style={({ pressed }) => [
									styles.selectAllBtn,
									{
										backgroundColor: isAllFilteredSelected
											? theme.primary
											: theme.primaryMuted,
									},
									pressed && styles.buttonPressed,
								]}
								onPress={handleToggleSelectAll}>
								<MaterialIcons
									name={
										isAllFilteredSelected
											? "check-box"
											: "select-all"
									}
									size={16}
									color={
										isAllFilteredSelected
											? "#ffffff"
											: theme.primary
									}
								/>
								<ThemedText
									type="small"
									style={[
										styles.selectAllBtnText,
										{
											color: isAllFilteredSelected
												? "#ffffff"
												: theme.primary,
										},
									]}>
									{isAllFilteredSelected
										? "Kaldır"
										: "Tümünü Seç"}
								</ThemedText>
							</Pressable>
						</View>

						{/* Action Buttons Toolbar */}
						<View style={styles.selectionActionsRow}>
							{/* Pin Action */}
							<Pressable
								style={({ pressed }) => [
									styles.actionItem,
									pressed && styles.buttonPressed,
								]}
								onPress={handleTogglePin}>
								<View
									style={[
										styles.actionIconCircle,
										{ backgroundColor: theme.primaryMuted },
									]}>
									<MaterialIcons
										name="push-pin"
										size={18}
										color={
											areAllSelectedPinned
												? theme.warning
												: theme.primary
										}
									/>
								</View>
								<ThemedText style={styles.actionLabel}>
									{areAllSelectedPinned ? "Pin Kaldır" : "Pinle"}
								</ThemedText>
							</Pressable>

							{/* Gallery Visibility Action */}
							<Pressable
								style={({ pressed }) => [
									styles.actionItem,
									pressed && styles.buttonPressed,
								]}
								onPress={handleToggleVisibility}>
								<View
									style={[
										styles.actionIconCircle,
										{ backgroundColor: theme.primaryMuted },
									]}>
									<MaterialIcons
										name={
											areAllSelectedHidden
												? "visibility"
												: "visibility-off"
										}
										size={18}
										color={theme.primary}
									/>
								</View>
								<ThemedText style={styles.actionLabel}>
									{areAllSelectedHidden ? "Görünür Yap" : "Gizle"}
								</ThemedText>
							</Pressable>

							{/* Share Action */}
							<Pressable
								style={({ pressed }) => [
									styles.actionItem,
									pressed && styles.buttonPressed,
								]}
								onPress={handleShare}>
								<View
									style={[
										styles.actionIconCircle,
										{ backgroundColor: theme.primaryMuted },
									]}>
									<MaterialIcons
										name="share"
										size={18}
										color={theme.primary}
									/>
								</View>
								<ThemedText style={styles.actionLabel}>
									Paylaş
								</ThemedText>
							</Pressable>

							{/* Export Action */}
							<Pressable
								style={({ pressed }) => [
									styles.actionItem,
									pressed && styles.buttonPressed,
								]}
								onPress={handleExport}>
								<View
									style={[
										styles.actionIconCircle,
										{ backgroundColor: theme.primaryMuted },
									]}>
									<MaterialIcons
										name="archive"
										size={18}
										color={theme.primary}
									/>
								</View>
								<ThemedText style={styles.actionLabel}>
									Dışa Aktar
								</ThemedText>
							</Pressable>

							{/* Delete Action */}
							<Pressable
								style={({ pressed }) => [
									styles.actionItem,
									pressed && styles.buttonPressed,
								]}
								onPress={handleDelete}>
								<View
									style={[
										styles.actionIconCircle,
										{ backgroundColor: theme.dangerMuted },
									]}>
									<MaterialIcons
										name="delete-outline"
										size={18}
										color={theme.danger}
									/>
								</View>
								<ThemedText
									style={[
										styles.actionLabel,
										{ color: theme.danger },
									]}>
									Sil
								</ThemedText>
							</Pressable>
						</View>
					</View>
				) : (
					<View style={styles.header}>
						<View>
							<ThemedText
								type="subtitle"
								style={styles.headerTitle}>
								{appName}
							</ThemedText>
							<ThemedText
								type="small"
								style={[
									styles.headerSub,
									{ color: theme.textSecondary },
								]}>
								{records.length} Adet Kayıt
							</ThemedText>
						</View>

						<Pressable
							style={({ pressed }) => [
								styles.filterButton,
								{
									backgroundColor: isFilterActive
										? theme.primary
										: theme.primaryMuted,
								},
								pressed && styles.buttonPressed,
							]}
							onPress={() => setDateModalVisible(true)}>
							<MaterialIcons
								name="filter-list"
								size={22}
								color={
									isFilterActive ? "#ffffff" : theme.primary
								}
							/>
						</Pressable>
					</View>
				)}

				{/* Search Bar */}
				{!isSelectionMode && (
					<View style={styles.searchBarWrapper}>
						<View
							style={[
								styles.searchBar,
								{
									backgroundColor: theme.backgroundElement,
									borderColor: theme.border,
									borderWidth: 1,
								},
							]}>
							<MaterialIcons
								name="search"
								size={20}
								color={theme.textMuted}
							/>
							<TextInput
								placeholder="Başlık veya açıklamada ara..."
								placeholderTextColor={theme.textMuted}
								style={[
									styles.searchInput,
									{ color: theme.text },
								]}
								value={searchQuery}
								onChangeText={setSearchQuery}
								clearButtonMode="while-editing"
							/>
							{searchQuery.length > 0 && (
								<Pressable
									onPress={() => setSearchQuery("")}
									hitSlop={8}>
									<MaterialIcons
										name="close"
										size={18}
										color={theme.textMuted}
									/>
								</Pressable>
							)}
						</View>
					</View>
				)}

				{/* Active Filter Chips */}
				{isFilterActive && !isSelectionMode && (
					<View style={styles.filterChipsRow}>
						<View
							style={[
								styles.filterChip,
								{
									backgroundColor: theme.primaryMuted,
									borderColor: theme.border,
									borderWidth: 1,
								},
							]}>
							<MaterialIcons
								name="event"
								size={14}
								color={theme.primary}
							/>
							<ThemedText
								type="small"
								style={[
									styles.filterChipText,
									{ color: theme.primary },
								]}>
								{formatDateShort(dateFilter.startDate)} -{" "}
								{formatDateShort(dateFilter.endDate)}
							</ThemedText>
							<Pressable onPress={resetFilters} hitSlop={8}>
								<MaterialIcons
									name="cancel"
									size={16}
									color={theme.primary}
								/>
							</Pressable>
						</View>
					</View>
				)}

				{/* Records List */}
				<FlatList
					data={filteredRecords}
					keyExtractor={(item) => item.id.toString()}
					contentContainerStyle={styles.listContent}
					showsVerticalScrollIndicator={false}
					refreshControl={
						<RefreshControl
							refreshing={isLoading}
							onRefresh={loadRecords}
							tintColor={theme.primary}
							colors={[theme.primary]}
						/>
					}
					renderItem={({ item }) => (
						<RecordCard
							record={item}
							isSelectionMode={isSelectionMode}
							isSelected={selectedIds.includes(item.id)}
							onPress={() => handleCardPress(item.id)}
							onLongPress={() => handleCardLongPress(item.id)}
						/>
					)}
					ListEmptyComponent={
						!isLoading ? (
							<View style={styles.emptyContainer}>
								<View
									style={[
										styles.emptyIconCircle,
										{
											backgroundColor:
												theme.backgroundSelected,
										},
									]}>
									<MaterialIcons
										name={
											searchQuery || isFilterActive
												? "search-off"
												: "post-add"
										}
										size={40}
										color={theme.textMuted}
									/>
								</View>
								<ThemedText
									type="smallBold"
									style={styles.emptyTitle}>
									{searchQuery || isFilterActive
										? "Arama sonucu bulunamadı"
										: "Henüz kayıt eklenmemiş"}
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.emptySubtitle,
										{ color: theme.textSecondary },
									]}>
									{searchQuery || isFilterActive
										? "Farklı bir arama terimi deneyin veya filtreleri temizleyin."
										: 'Yeni bir anı eklemek için aşağıdaki "+" butonunu kullanın.'}
								</ThemedText>

								{searchQuery || isFilterActive ? (
									<Pressable
										style={({ pressed }) => [
											styles.emptyActionBtn,
											{ backgroundColor: theme.primary },
											pressed && styles.buttonPressed,
										]}
										onPress={resetFilters}>
										<ThemedText
											style={styles.emptyActionBtnText}>
											Filtreleri Temizle
										</ThemedText>
									</Pressable>
								) : (
									<Pressable
										style={({ pressed }) => [
											styles.emptyActionBtn,
											{ backgroundColor: theme.primary },
											pressed && styles.buttonPressed,
										]}
										onPress={() =>
											router.push("/add" as any)
										}>
										<ThemedText
											style={styles.emptyActionBtnText}>
											+ İlk Kaydı Ekle
										</ThemedText>
									</Pressable>
								)}
							</View>
						) : null
					}
				/>

				{/* Date Filter Modal */}
				<DateRangeModal
					visible={dateModalVisible}
					onClose={() => setDateModalVisible(false)}
					currentFilter={dateFilter}
					onApply={setDateFilter}
					onReset={resetFilters}
				/>
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
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: Spacing.four,
		paddingTop: Spacing.two,
		paddingBottom: Spacing.two,
	},
	headerTitle: {
		fontSize: 26,
		fontWeight: "700",
	},
	headerSub: {
		fontSize: 13,
		marginTop: 2,
		fontWeight: "500",
	},
	filterButton: {
		width: 44,
		height: 44,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	selectionHeader: {
		paddingHorizontal: Spacing.three,
		paddingTop: Spacing.two,
		paddingBottom: Spacing.three,
		marginHorizontal: Spacing.three,
		marginTop: Spacing.one,
		marginBottom: Spacing.two,
		borderRadius: 18,
		borderWidth: 1,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.08,
		shadowRadius: 10,
		elevation: 4,
	},
	selectionTopRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.three,
	},
	selectionLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	selectionCloseBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	selectionTitle: {
		fontSize: 16,
		lineHeight: 20,
	},
	selectionSub: {
		fontSize: 11,
		lineHeight: 14,
	},
	selectAllBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderRadius: 12,
	},
	selectAllBtnText: {
		fontSize: 12,
		fontWeight: "600",
	},
	selectionActionsRow: {
		flexDirection: "row",
		justifyContent: "space-around",
		alignItems: "center",
		paddingTop: Spacing.one,
	},
	actionItem: {
		alignItems: "center",
		gap: 4,
		minWidth: 54,
	},
	actionIconCircle: {
		width: 42,
		height: 42,
		borderRadius: 21,
		alignItems: "center",
		justifyContent: "center",
	},
	actionLabel: {
		fontSize: 11,
		fontWeight: "600",
		textAlign: "center",
	},
	searchBarWrapper: {
		paddingHorizontal: Spacing.four,
		paddingVertical: Spacing.one,
	},
	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.three,
		paddingVertical: 10,
		borderRadius: 14,
		gap: Spacing.two,
	},
	searchInput: {
		flex: 1,
		fontSize: 15,
		padding: 0,
	},
	filterChipsRow: {
		paddingHorizontal: Spacing.four,
		paddingVertical: Spacing.one,
		flexDirection: "row",
		gap: Spacing.one,
	},
	filterChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 12,
	},
	filterChipText: {
		fontSize: 12,
		fontWeight: "600",
	},
	listContent: {
		paddingHorizontal: Spacing.four,
		paddingTop: Spacing.two,
		paddingBottom: Spacing.six,
	},
	emptyContainer: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Spacing.six,
		paddingHorizontal: Spacing.four,
		gap: Spacing.two,
	},
	emptyIconCircle: {
		width: 72,
		height: 72,
		borderRadius: 36,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.one,
	},
	emptyTitle: {
		fontSize: 17,
		textAlign: "center",
	},
	emptySubtitle: {
		fontSize: 13,
		textAlign: "center",
		lineHeight: 18,
	},
	emptyActionBtn: {
		marginTop: Spacing.two,
		paddingVertical: 12,
		paddingHorizontal: 22,
		borderRadius: 14,
	},
	emptyActionBtnText: {
		color: "#ffffff",
		fontSize: 14,
		fontWeight: "700",
	},
	buttonPressed: {
		opacity: 0.8,
		transform: [{ scale: 0.98 }],
	},
});
