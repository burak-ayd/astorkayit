// scripts/run-android.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const targetVariant = process.env.APP_VARIANT || "production";
const stateFilePath = path.join(__dirname, "..", ".last_variant");
const androidDir = path.join(__dirname, "..", "android");

let lastVariant = null;
if (fs.existsSync(stateFilePath)) {
	lastVariant = fs.readFileSync(stateFilePath, "utf8").trim();
}

const androidExists = fs.existsSync(androidDir);
const isVariantChanged = lastVariant !== targetVariant;

console.log(`\n📦 Hedef Varyant: ${targetVariant}`);
console.log(`📌 Son Kullanılan Varyant: ${lastVariant || "Yok"}`);

if (!androidExists || isVariantChanged) {
	console.log(
		`\n🔄 Varyant değişti veya android klasörü yok. 'expo prebuild --clean' çalıştırılıyor...`,
	);
	execSync("npx expo prebuild --clean", {
		stdio: "inherit",
		env: process.env,
	});
	fs.writeFileSync(stateFilePath, targetVariant, "utf8");
} else {
	console.log(
		`\n⚡ Varyant aynı (${targetVariant}), önbellek korunarak hızlı build alınıyor...`,
	);
}

console.log(`\n🚀 Uygulama başlatılıyor (expo run:android)...`);
execSync("npx expo run:android", { stdio: "inherit", env: process.env });
