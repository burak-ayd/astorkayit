import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface CollapsibleCardProps {
	icon: any;
	iconColor?: string;
	iconBgColor?: string;
	title: string;
	subtitle: string;
	badgeText?: string;
	badgeColor?: string;
	badgeBgColor?: string;
	isExpanded: boolean;
	onToggle: () => void;
	isDanger?: boolean;
	children: React.ReactNode;
}

export function CollapsibleCard({
	icon,
	iconColor,
	iconBgColor,
	title,
	subtitle,
	badgeText,
	badgeColor,
	badgeBgColor,
	isExpanded,
	onToggle,
	isDanger = false,
	children,
}: CollapsibleCardProps) {
	const theme = useTheme();

	const resolvedIconColor = iconColor || (isDanger ? theme.danger : theme.primary);
	const resolvedIconBg = iconBgColor || (isDanger ? theme.dangerMuted : theme.primaryMuted);

	return (
		<ThemedView
			type="backgroundElement"
			style={[
				styles.card,
				{
					borderColor: isDanger ? theme.dangerMuted : theme.border,
					borderWidth: isDanger ? 1.5 : 1,
					shadowColor: theme.shadow,
				},
			]}>
			<Pressable
				style={({ pressed }) => [
					styles.header,
					pressed && styles.pressed,
				]}
				onPress={onToggle}>
				<View style={[styles.iconBox, { backgroundColor: resolvedIconBg }]}>
					<MaterialIcons
						name={icon}
						size={22}
						color={resolvedIconColor}
					/>
				</View>

				<View style={styles.headerTexts}>
					<View style={styles.titleRow}>
						<ThemedText
							type="smallBold"
							style={[
								styles.title,
								isDanger && { color: theme.danger },
							]}>
							{title}
						</ThemedText>

						{badgeText && (
							<View
								style={[
									styles.badge,
									{
										backgroundColor:
											badgeBgColor ||
											theme.backgroundSelected,
									},
								]}>
								<ThemedText
									style={[
										styles.badgeText,
										{ color: badgeColor || theme.primary },
									]}>
									{badgeText}
								</ThemedText>
							</View>
						)}
					</View>

					<ThemedText
						type="small"
						numberOfLines={1}
						style={[
							styles.subtitle,
							{ color: theme.textSecondary },
						]}>
						{subtitle}
					</ThemedText>
				</View>

				<MaterialIcons
					name={
						isExpanded
							? "keyboard-arrow-up"
							: "keyboard-arrow-down"
					}
					size={24}
					color={isDanger ? theme.danger : theme.textSecondary}
				/>
			</Pressable>

			{isExpanded && <View style={styles.body}>{children}</View>}
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: 20,
		overflow: "hidden",
		elevation: 2,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.four,
		paddingVertical: Spacing.three,
		gap: Spacing.three,
	},
	iconBox: {
		width: 42,
		height: 42,
		borderRadius: 13,
		alignItems: "center",
		justifyContent: "center",
	},
	headerTexts: {
		flex: 1,
		gap: 2,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	title: {
		fontSize: 15,
		fontWeight: "700",
	},
	subtitle: {
		fontSize: 12,
	},
	badge: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 8,
	},
	badgeText: {
		fontSize: 10,
		fontWeight: "700",
	},
	body: {
		paddingHorizontal: Spacing.four,
		paddingBottom: Spacing.four,
		paddingTop: Spacing.two,
		gap: Spacing.three,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "rgba(150, 150, 150, 0.15)",
	},
	pressed: {
		opacity: 0.85,
	},
});
