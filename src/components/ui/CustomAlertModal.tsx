import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React from "react";
import {
	Modal,
	Pressable,
	StyleSheet,
	TouchableWithoutFeedback,
	View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
	AlertType,
	CustomAlertButton,
	useAlertStore,
} from "@/store/useAlertStore";

export function CustomAlertModal() {
	const theme = useTheme();
	const { isOpen, title, message, type, icon, buttons, closeAlert } =
		useAlertStore();

	if (!isOpen) return null;

	const getTypeConfig = (alertType: AlertType) => {
		switch (alertType) {
			case "success":
				return {
					icon: icon || "check-circle",
					color: theme.success,
					bgColor: theme.successMuted,
				};
			case "danger":
				return {
					icon: icon || "delete-forever",
					color: theme.danger,
					bgColor: theme.dangerMuted,
				};
			case "warning":
				return {
					icon: icon || "warning",
					color: theme.warning,
					bgColor: theme.warningMuted,
				};
			case "confirm":
				return {
					icon: icon || "help-outline",
					color: theme.primary,
					bgColor: theme.primaryMuted,
				};
			case "info":
			default:
				return {
					icon: icon || "info",
					color: theme.primary,
					bgColor: theme.primaryMuted,
				};
		}
	};

	const config = getTypeConfig(type);

	const handleButtonPress = (btn: CustomAlertButton) => {
		closeAlert();
		if (btn.onPress) {
			btn.onPress();
		}
	};

	// Clean up title by removing any leading/trailing emojis if needed, or render as is
	const cleanTitle = title;

	return (
		<Modal
			transparent
			visible={isOpen}
			animationType="fade"
			statusBarTranslucent
			onRequestClose={closeAlert}>
			<TouchableWithoutFeedback onPress={closeAlert}>
				<View style={styles.backdrop}>
					<TouchableWithoutFeedback>
						<ThemedView
							type="backgroundElement"
							style={[
								styles.alertCard,
								{
									borderColor:
										type === "danger"
											? theme.dangerMuted
											: theme.border,
									borderWidth: 1.5,
									shadowColor: "#000",
								},
							]}>
							{/* Icon Header */}
							<View
								style={[
									styles.iconContainer,
									{ backgroundColor: config.bgColor },
								]}>
								<MaterialIcons
									name={config.icon}
									size={32}
									color={config.color}
								/>
							</View>

							{/* Title & Message */}
							<View style={styles.contentWrap}>
								<ThemedText
									type="smallBold"
									style={[
										styles.title,
										type === "danger" && {
											color: theme.danger,
										},
									]}>
									{cleanTitle}
								</ThemedText>

								{message ? (
									<ThemedText
										type="small"
										style={[
											styles.message,
											{ color: theme.textSecondary },
										]}>
										{message}
									</ThemedText>
								) : null}
							</View>

							{/* Action Buttons */}
							<View
								style={[
									styles.buttonGroup,
									buttons.length > 2 && styles.buttonGroupColumn,
								]}>
								{buttons.map((btn, index) => {
									const isCancel = btn.style === "cancel";
									const isDestructive =
										btn.style === "destructive" ||
										(type === "danger" && !isCancel);

									let btnBg = theme.primary;
									let textColor = "#ffffff";

									if (isCancel) {
										btnBg = theme.backgroundSelected;
										textColor = theme.textSecondary;
									} else if (isDestructive) {
										btnBg = theme.danger;
										textColor = "#ffffff";
									}

									return (
										<Pressable
											key={index}
											style={({ pressed }) => [
												styles.button,
												{
													backgroundColor: btnBg,
													borderColor: isCancel
														? theme.border
														: "transparent",
													borderWidth: isCancel
														? 1
														: 0,
												},
												buttons.length === 2 &&
													styles.buttonHalf,
												pressed && styles.buttonPressed,
											]}
											onPress={() =>
												handleButtonPress(btn)
											}>
											<ThemedText
												style={[
													styles.buttonText,
													{ color: textColor },
													isCancel &&
														styles.cancelButtonText,
												]}>
												{btn.text}
											</ThemedText>
										</Pressable>
									);
								})}
							</View>
						</ThemedView>
					</TouchableWithoutFeedback>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.65)",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: Spacing.five,
	},
	alertCard: {
		width: "100%",
		maxWidth: 380,
		borderRadius: 26,
		paddingHorizontal: Spacing.four,
		paddingTop: Spacing.five,
		paddingBottom: Spacing.four,
		alignItems: "center",
		gap: Spacing.four,
		elevation: 8,
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.25,
		shadowRadius: 16,
	},
	iconContainer: {
		width: 60,
		height: 60,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	contentWrap: {
		width: "100%",
		alignItems: "center",
		gap: Spacing.two,
		paddingHorizontal: Spacing.two,
	},
	title: {
		fontSize: 18,
		fontWeight: "800",
		textAlign: "center",
		letterSpacing: -0.3,
	},
	message: {
		fontSize: 13,
		lineHeight: 19,
		textAlign: "center",
	},
	buttonGroup: {
		flexDirection: "row",
		width: "100%",
		gap: Spacing.two,
		marginTop: Spacing.one,
	},
	buttonGroupColumn: {
		flexDirection: "column",
	},
	button: {
		flex: 1,
		paddingVertical: 13,
		paddingHorizontal: Spacing.three,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonHalf: {
		flex: 1,
	},
	buttonText: {
		fontSize: 14,
		fontWeight: "700",
	},
	cancelButtonText: {
		fontWeight: "600",
	},
	buttonPressed: {
		opacity: 0.82,
		transform: [{ scale: 0.98 }],
	},
});
