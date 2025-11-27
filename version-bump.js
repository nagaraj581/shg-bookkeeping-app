const fs = require("fs");

// Read package.json
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

// Split version: "0.1.0" -> [0, 1, 0]
let [major, minor, patch] = pkg.version.split(".").map(Number);

// Increase patch version
patch += 1;

// Build new version string
pkg.version = `${major}.${minor}.${patch}`;

// Save back to package.json
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));

console.log("🚀 Version bumped to", pkg.version);
