// app.config.js
const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getAppId = () => {
	if (IS_DEV) return "tr.net.burakaydogan.astorkayit.dev";
	if (IS_PREVIEW) return "tr.net.burakaydogan.astorkayit.preview";
	return "tr.net.burakaydogan.astorkayit"; // Release / Production
};

const getAppName = () => {
	if (IS_DEV) return "Astor Kayıt (Dev)";
	if (IS_PREVIEW) return "Astor Kayıt (Preview)";
	return "Astor Kayıt";
};

export default ({ config }) => ({
	...config,
	owner: "darkpuye", // EAS hesabı / organizasyon sahibi
	name: getAppName(),

	runtimeVersion: "1",
	ios: {
		...config.ios,
		bundleIdentifier: getAppId(),
	},
	android: {
		...config.android,
		package: getAppId(),
	},
	extra: {
		...config.extra,
		eas: {
			projectId: "8b6e4a0b-d4ae-4225-8cdd-0d67c1a8c2f2",
		},
		// Kod içinden erişilecek varyant değişkenleri
		variant: process.env.APP_VARIANT || "production",
		apiUrl: IS_DEV
			? "https://dev-api.example.com"
			: IS_PREVIEW
				? "https://preview-api.example.com"
				: "https://api.example.com",
	},
});
