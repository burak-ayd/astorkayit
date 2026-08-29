import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	FlatList,
	Pressable,
	RefreshControl,
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
import { selectFilteredRecords, useRecordStore } from "@/store/useRecordStore";

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

	const [dateModalVisible, setDateModalVisible] = useState(false);

	// app.config.js içindeki name veya extra alanını okuyun
	const appName = Constants.expoConfig?.name;
	const variant = Constants.expoConfig?.extra?.variant;

	const filteredRecords = selectFilteredRecords(
		records,
		searchQuery,
		dateFilter,
	);
	const isFilterActive =
		dateFilter.startDate !== null || dateFilter.endDate !== null;

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

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				{/* Header Bar */}
				<View style={styles.header}>
					<View>
						<ThemedText type="subtitle" style={styles.headerTitle}>
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
							color={isFilterActive ? "#ffffff" : theme.primary}
						/>
					</Pressable>
				</View>

				{/* Search Bar */}
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
							style={[styles.searchInput, { color: theme.text }]}
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

				{/* Active Filter Chips */}
				{isFilterActive && (
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
							onPress={() =>
								router.push({
									pathname: "/detail/[id]",
									params: { id: item.id },
								} as any)
							}
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
