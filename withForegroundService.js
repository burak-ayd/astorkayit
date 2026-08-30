const { withAndroidManifest, withProjectBuildGradle } = require("@expo/config-plugins");
const path = require("path");

module.exports = function withNotifeeConfig(config) {
  // 1. AndroidManifest'e Foreground Service ekle
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    const notifeeService = application.service.find(
      (s) => s.$["android:name"] === "app.notifee.core.ForegroundService"
    );

    if (notifeeService) {
      notifeeService.$["android:foregroundServiceType"] = "dataSync";
    } else {
      application.service.push({
        $: {
          "android:name": "app.notifee.core.ForegroundService",
          "android:foregroundServiceType": "dataSync",
          "android:exported": "false",
        },
      });
    }

    return config;
  });

  // 2. build.gradle içine Notifee Maven Repo'sunu ekle
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let buildGradle = config.modResults.contents;
      const notifeeRepo = `maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }`;

      if (!buildGradle.includes("@notifee/react-native/android/libs")) {
        buildGradle = buildGradle.replace(
          /allprojects\s*{\s*repositories\s*{/,
          `allprojects {\n  repositories {\n    ${notifeeRepo}`
        );
        config.modResults.contents = buildGradle;
      }
    }
    return config;
  });

  return config;
};
