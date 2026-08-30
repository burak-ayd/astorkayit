import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { ThemeMode, useSettingsStore } from "@/store/useSettingsStore";

export function AppearanceSection() {
	const theme = useTheme();
	const defaultHideFromGallery = useSettingsStore(
		(s) => s.defaultHideFromGallery,
	);
	const setDefaultHideFromGallery = useSettingsStore(
		(s) => s.setDefaultHideFromGallery,
	);
	const themeMode = useSettingsStore((s) => s.themeMode);
	const setThemeMode = useSettingsStore((s) => s.setThemeMode);

	const handleToggleDefaultHide = async (val: boolean) => {
		await setDefaultHideFromGallery(val);
	};

	const handleSelectTheme = async (mode: ThemeMode) => {
		await setThemeMode(mode);
	};

	return (
		<>
			{/* Segmented Theme Picker */}
			<ThemedText
				type="small"
				style={[
					styles.fieldLabel,
					{ color: theme.textSecondary },
				]}>
				Tema Seçimi
			</ThemedText>

			<View
				style={[
					styles.segmentedControl,
					{
						backgroundColor: theme.background,
						borderColor: theme.border,
						borderWidth: 1,
					},
				]}>
				{/* System */}
				<Pressable
					style={({ pressed }) => [
						styles.segmentItem,
						themeMode === "system" && {
							backgroundColor: theme.primary,
						},
						pressed && styles.buttonPressed,
					]}
					onPress={() => handleSelectTheme("system")}>
					<MaterialIcons
						name="settings-brightness"
						size={18}
						color={
							themeMode === "system"
								? "#ffffff"
								: theme.textSecondary
						}
					/>
					<ThemedText
						style={[
							styles.segmentText,
							{
								color:
									themeMode === "system"
										? "#ffffff"
										: theme.textSecondary,
							},
						]}>
						Sistem
					</ThemedText>
				</Pressable>

				{/* Light */}
				<Pressable
					style={({ pressed }) => [
						styles.segmentItem,
						themeMode === "light" && {
							backgroundColor: theme.primary,
						},
						pressed && styles.buttonPressed,
					]}
					onPress={() => handleSelectTheme("light")}>
					<MaterialIcons
						name="light-mode"
						size={18}
						color={
							themeMode === "light"
								? "#ffffff"
								: theme.textSecondary
						}
					/>
					<ThemedText
						style={[
							styles.segmentText,
							{
								color:
									themeMode === "light"
										? "#ffffff"
										: theme.textSecondary,
							},
						]}>
						Aydınlık
					</ThemedText>
				</Pressable>

				{/* Dark */}
				<Pressable
					style={({ pressed }) => [
						styles.segmentItem,
						themeMode === "dark" && {
							backgroundColor: theme.primary,
						},
						pressed && styles.buttonPressed,
					]}
					onPress={() => handleSelectTheme("dark")}>
					<MaterialIcons
						name="dark-mode"
						size={18}
						color={
							themeMode === "dark"
								? "#ffffff"
								: theme.textSecondary
						}
					/>
					<ThemedText
						style={[
							styles.segmentText,
							{
								color:
									themeMode === "dark"
										? "#ffffff"
										: theme.textSecondary,
							},
						]}>
						Karanlık
					</ThemedText>
				</Pressable>
			</View>

			{/* Gallery Visibility */}
			<View
				style={[
					styles.optionRow,
					{
						borderTopColor: theme.border,
						borderTopWidth: 1,
						paddingTop: Spacing.three,
						marginTop: Spacing.one,
					},
				]}>
				<View
					style={[
						styles.optionIconBox,
						{
							backgroundColor: defaultHideFromGallery
								? theme.warningMuted
								: theme.primaryMuted,
						},
					]}>
					<MaterialIcons
						name={
							defaultHideFromGallery
								? "visibility-off"
								: "visibility"
						}
						size={20}
						color={
							defaultHideFromGallery
								? theme.warning
								: theme.primary
						}
					/>
				</View>
				<View style={styles.optionTextWrap}>
					<ThemedText type="smallBold">
						Galeride Varsayılan Gizle
					</ThemedText>
					<ThemedText
						type="small"
						style={[
							styles.optionDesc,
							{ color: theme.textSecondary },
						]}>
						{defaultHideFromGallery
							? "Yeni eklenen fotoğraflar cihaz galerisinde gizlenir."
							: "Yeni fotoğraflar cihaz galerisinde görünür."}
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
		</>
	);
}

const styles = StyleSheet.create({
	fieldLabel: {
		fontSize: 12,
		fontWeight: "600",
		marginBottom: -4,
	},
	segmentedControl: {
		flexDirection: "row",
		padding: 3,
		borderRadius: 14,
		gap: 3,
	},
	segmentItem: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 5,
		paddingVertical: 8,
		borderRadius: 10,
	},
	segmentText: {
		fontSize: 12,
		fontWeight: "700",
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
	buttonPressed: {
		opacity: 0.85,
		transform: [{ scale: 0.98 }],
	},
});
