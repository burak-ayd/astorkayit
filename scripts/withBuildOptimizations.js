const { withAppBuildGradle, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withBuildOptimizations(config) {
	// 1. ProGuard kurallarını kalıcı olarak proguard-rules.pro'ya ekle
	config = withDangerousMod(config, [
		"android",
		async (config) => {
			const proguardFile = path.join(
				config.modRequest.platformProjectRoot,
				"app",
				"proguard-rules.pro",
			);
			if (fs.existsSync(proguardFile)) {
				let content = fs.readFileSync(proguardFile, "utf8");
				const rulesMarker = "# --- Astor Kayıt Background Task ProGuard Rules ---";
				if (!content.includes(rulesMarker)) {
					const rules = `
${rulesMarker}
-keep class expo.modules.adapters.react.apploader.** { *; }
-keep class expo.modules.apploader.** { *; }
-keep public class * extends expo.modules.apploader.HeadlessAppLoader { *; }
-keep class expo.modules.taskManager.** { *; }
-keep class expo.modules.backgroundtask.** { *; }
-keep class androidx.work.** { *; }
# --- Astor Kayıt Background Task ProGuard Rules End ---
`;
					fs.writeFileSync(proguardFile, content + rules, "utf8");
				}
			}
			return config;
		},
	]);

	// 2. build.gradle optimizasyonları
	return withAppBuildGradle(config, (config) => {
		if (config.modResults.language === "groovy") {
			let contents = config.modResults.contents;

			// Eski bloğu temizle
			contents = contents.replace(
				/\/\/ --- Expo Build Optimizations Start ---[\s\S]*?\/\/ --- Expo Build Optimizations End ---\n?/g,
				"",
			);

			const optimizationBlock = `
// --- Expo Build Optimizations Start ---
android {
    
    packagingOptions {
        jniLibs {
            useLegacyPackaging = false
            keepDebugSymbols.clear()
        }
        resources {
            excludes += [
                "META-INF/*.version",
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE*",
                "META-INF/NOTICE*",
                "META-INF/INDEX.LIST"
            ]
        }
    }
}
// --- Expo Build Optimizations End ---
`;
			contents += `\n${optimizationBlock}`;
			config.modResults.contents = contents;
		}
		return config;
	});
};

