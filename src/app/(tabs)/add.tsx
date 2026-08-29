import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ImageViewerModal } from "@/components/ImageViewerModal";
import { PhotoGrid } from "@/components/PhotoGrid";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRecordStore } from "@/store/useRecordStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getTodayAsTitle } from "@/utils/dateUtils";

export default function AddRecordScreen() {
	const router = useRouter();
	const theme = useTheme();

	const addRecord = useRecordStore((s) => s.addRecord);
	const defaultHideFromGallery = useSettingsStore(
		(s) => s.defaultHideFromGallery,
	);

	const [title, setTitle] = useState(getTodayAsTitle());
	const [description, setDescription] = useState("");
	const [photos, setPhotos] = useState<string[]>([]);
	const [hideFromGallery, setHideFromGallery] = useState(
		defaultHideFromGallery,
	);
	const [isSaving, setIsSaving] = useState(false);
	const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
		null,
	);

	// Set default visibility based on global setting
	useEffect(() => {
		setHideFromGallery(defaultHideFromGallery);
		setTitle(getTodayAsTitle());
	}, [defaultHideFromGallery]);

	// Pick photos from Gallery
	const handlePickFromGallery = async () => {
		try {
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ["images"],
				allowsMultipleSelection: true,
				quality: 0.9,
			});

			if (result.canceled || !result.assets || result.assets.length === 0)
				return;

			const selectedUris = result.assets.map((a) => a.uri);
			setPhotos((prev) => [...prev, ...selectedUris]);
		} catch (e) {
			Alert.alert(
				"Hata",
				"Fotoğraf seçilirken bir hata oluştu: " + String(e),
			);
		}
	};

	// Capture photo from Camera
	const handleCaptureFromCamera = async () => {
		try {
			const result = await ImagePicker.launchCameraAsync({
				mediaTypes: ["images"],
				quality: 0.9,
			});

			if (result.canceled || !result.assets || result.assets.length === 0)
				return;

			const capturedUri = result.assets[0].uri;
			setPhotos((prev) => [...prev, capturedUri]);
		} catch (e) {
			Alert.alert(
				"Hata",
				"Fotoğraf çekilirken bir hata oluştu: " + String(e),
			);
		}
	};

	const handleRemovePhoto = (index: number) => {
		setPhotos((prev) => prev.filter((_, idx) => idx !== index));
	};

	const handleSave = async () => {
		const trimmedTitle = title.trim();

		if (!trimmedTitle) {
			Alert.alert("Uyarı ⚠️", "Lütfen bir başlık giriniz.");
			return;
		}

		if (photos.length === 0) {
			Alert.alert("Uyarı ⚠️", "Lütfen en az 1 adet fotoğraf ekleyiniz.");
			return;
		}

		try {
			setIsSaving(true);
			await addRecord(
				trimmedTitle,
				description.trim(),
				photos,
				hideFromGallery,
			);

			// Reset form
			setTitle(getTodayAsTitle());
			setDescription("");
			setPhotos([]);
			setHideFromGallery(defaultHideFromGallery);

			Alert.alert("Başarılı ✅", "Anı kaydınız başarıyla kaydedildi!", [
				{
					text: "Tamam",
					onPress: () => router.push("/" as any),
				},
			]);
		} catch (e) {
			Alert.alert(
				"Hata ❌",
				"Kayıt kaydedilirken bir hata oluştu: " + String(e),
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<ScrollView
					contentContainerStyle={styles.scrollContent}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}>
					{/* Header */}
					<View style={styles.header}>
						<ThemedText type="subtitle" style={styles.headerTitle}>
							Yeni Kayıt Oluştur
						</ThemedText>
						<ThemedText
							type="small"
							style={[
								styles.headerSub,
								{ color: theme.textSecondary },
							]}>
							Anılarınıza yeni fotoğraflar ve notlar ekleyin
						</ThemedText>
					</View>

					{/* Form Card */}
					<ThemedView
						type="backgroundElement"
						style={[
							styles.formCard,
							{
								borderColor: theme.border,
								borderWidth: 1,
								shadowColor: theme.shadow,
							},
						]}>
						{/* Title Input */}
						<View style={styles.inputGroup}>
							<ThemedText
								type="smallBold"
								style={styles.inputLabel}>
								Başlık{" "}
								<ThemedText style={{ color: theme.danger }}>
									*
								</ThemedText>
							</ThemedText>
							<TextInput
								style={[
									styles.textInput,
									{
										backgroundColor: theme.background,
										color: theme.text,
										borderColor: theme.border,
									},
								]}
								placeholder="Örn: Hafta Sonu Gezisi"
								placeholderTextColor={theme.textMuted}
								value={title}
								onChangeText={setTitle}
								maxLength={100}
							/>
						</View>

						{/* Description Input */}
						<View style={styles.inputGroup}>
							<ThemedText
								type="smallBold"
								style={styles.inputLabel}>
								Açıklama (İsteğe Bağlı)
							</ThemedText>
							<TextInput
								style={[
									styles.textArea,
									{
										backgroundColor: theme.background,
										color: theme.text,
										borderColor: theme.border,
									},
								]}
								placeholder="Bu anı ile ilgili detayları buraya yazabilirsiniz..."
								placeholderTextColor={theme.textMuted}
								value={description}
								onChangeText={setDescription}
								multiline
								numberOfLines={4}
								textAlignVertical="top"
							/>
						</View>

						{/* Photos Section */}
						<View style={styles.inputGroup}>
							<View style={styles.photoHeaderRow}>
								<ThemedText
									type="smallBold"
									style={styles.inputLabel}>
									Fotoğraflar{" "}
									<ThemedText style={{ color: theme.danger }}>
										*
									</ThemedText>
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.photoCountHint,
										{ color: theme.textSecondary },
									]}>
									{photos.length} seçildi (en az 1 gerekli)
								</ThemedText>
							</View>

							<PhotoGrid
								photos={photos}
								editable
								onAddFromCamera={handleCaptureFromCamera}
								onAddFromGallery={handlePickFromGallery}
								onRemovePhoto={handleRemovePhoto}
								onPhotoPress={(idx) =>
									setSelectedPhotoIndex(idx)
								}
							/>
						</View>

						{/* Gallery Visibility Option */}
						<View
							style={[
								styles.visibilityCard,
								{
									backgroundColor: theme.background,
									borderColor: theme.border,
									borderWidth: 1,
								},
							]}>
							<View
								style={[
									styles.visibilityIconBadge,
									{
										backgroundColor: hideFromGallery
											? theme.warningMuted
											: theme.primaryMuted,
									},
								]}>
								<MaterialIcons
									name={
										hideFromGallery
											? "visibility-off"
											: "visibility"
									}
									size={22}
									color={
										hideFromGallery
											? theme.warning
											: theme.primary
									}
								/>
							</View>
							<View style={styles.visibilityTextWrapper}>
								<ThemedText type="smallBold">
									{hideFromGallery
										? "Galeriden Gizle (.nomedia)"
										: "Cihaz Galerisinde Göster"}
								</ThemedText>
								<ThemedText
									type="small"
									style={[
										styles.visibilitySubText,
										{ color: theme.textSecondary },
									]}>
									{hideFromGallery
										? "Fotoğraflar cihazın genel galeri uygulamasında gizlenecek."
										: "Fotoğraflar cihazın genel galeri uygulamasında görünecek."}
								</ThemedText>
							</View>
							<Switch
								value={hideFromGallery}
								onValueChange={setHideFromGallery}
								trackColor={{
									false: theme.border,
									true: theme.warning,
								}}
								thumbColor="#ffffff"
							/>
						</View>
					</ThemedView>

					{/* Save Button */}
					<Pressable
						style={({ pressed }) => [
							styles.saveButton,
							{
								backgroundColor: theme.primary,
								shadowColor: theme.shadow,
							},
							isSaving && styles.buttonDisabled,
							pressed && styles.buttonPressed,
						]}
						onPress={handleSave}
						disabled={isSaving}>
						{isSaving ? (
							<ActivityIndicator color="#ffffff" size="small" />
						) : (
							<>
								<MaterialIcons
									name="check"
									size={22}
									color={
										theme.background === "#0B0F19"
											? "#0B0F19"
											: "#ffffff"
									}
								/>
								<ThemedText
									style={[
										styles.saveButtonText,
										{
											color:
												theme.background === "#0B0F19"
													? "#0B0F19"
													: "#ffffff",
										},
									]}>
									Kaydı Kaydet
								</ThemedText>
							</>
						)}
					</Pressable>
				</ScrollView>

				{/* Fullscreen Photo Viewer */}
				<ImageViewerModal
					visible={selectedPhotoIndex !== null}
					photos={photos}
					initialIndex={selectedPhotoIndex ?? 0}
					onClose={() => setSelectedPhotoIndex(null)}
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
	formCard: {
		padding: Spacing.four,
		borderRadius: 20,
		gap: Spacing.four,
		elevation: 3,
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.08,
		shadowRadius: 8,
	},
	inputGroup: {
		gap: Spacing.one,
	},
	inputLabel: {
		fontSize: 14,
	},
	textInput: {
		paddingHorizontal: Spacing.three,
		paddingVertical: 12,
		borderRadius: 14,
		fontSize: 15,
		borderWidth: 1,
	},
	textArea: {
		paddingHorizontal: Spacing.three,
		paddingVertical: 12,
		borderRadius: 14,
		fontSize: 15,
		minHeight: 90,
		borderWidth: 1,
	},
	photoHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	photoCountHint: {
		fontSize: 11,
	},
	visibilityCard: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.three,
		borderRadius: 14,
		gap: Spacing.two,
	},
	visibilityIconBadge: {
		width: 38,
		height: 38,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	visibilityTextWrapper: {
		flex: 1,
		gap: 2,
	},
	visibilitySubText: {
		fontSize: 11,
		lineHeight: 15,
	},
	saveButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.one,
		paddingVertical: 16,
		borderRadius: 16,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 4,
	},
	saveButtonText: {
		fontSize: 16,
		fontWeight: "700",
	},
	buttonPressed: {
		opacity: 0.85,
		transform: [{ scale: 0.98 }],
	},
	buttonDisabled: {
		opacity: 0.6,
	},
});
