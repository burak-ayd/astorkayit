const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withBuildOptimizations(config) {
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
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
        }
    }
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

// res/ altındaki gereksiz fontları derleme anında temizleyen görev
afterEvaluate {
    tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Resources") }.configureEach { mergeTask ->
        mergeTask.doLast {
            // Raw ve Font klasörlerindeki kullanılmayan vector icon fontlarını temizle
            def targetDir = mergeTask.outputDir.asFile.orNull ?: mergeTask.outputDir.get().asFile
            if (targetDir && targetDir.exists()) {
                fileTree(dir: targetDir).matching {
                    // Sadece MaterialIcons.ttf kalsın, diğer vector-icons fontlarını sil
                    include "**/font*/*.ttf", "**/raw*/*.ttf"
                    exclude "**/materialicons*.ttf", "**/MaterialIcons*.ttf"
                }.each { file ->
                    file.delete()
                }
            }
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
