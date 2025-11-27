const { execSync } = require("child_process");

try {
  console.log("📦 Exporting Firestore backup...");
  execSync("firebase firestore:export ./firestore-backup", { stdio: "inherit" });
  console.log("✅ Firestore backup complete");
} catch (err) {
  console.error("❌ Firestore backup failed:", err.message);
}
