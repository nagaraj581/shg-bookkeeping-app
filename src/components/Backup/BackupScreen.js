import React, { useState } from "react";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import JSZip from "jszip";

const BackupScreen = ({ db, userId, shgId }) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [message, setMessage] = useState("");
  const [lastBackup, setLastBackup] = useState(
    localStorage.getItem("lastBackup") || ""
  );

  // 🔹 Fetch Firestore collection
  const fetchCollection = async (name) => {
    const projectId = db?.app?.options?.projectId || "shg-bookkeeping-app";
    const querySnapshot = await getDocs(
      collection(
        db,
        "artifacts",
        projectId,
        "users",
        userId,
        "shg_groups",
        shgId,
        name
      )
    );
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  };

  // 🔹 Fetch all collections
  const fetchAllData = async () => {
    const collections = ["members", "transactions", "loans", "meetings"];
    const data = {};
    for (const name of collections) {
      try {
        data[name] = await fetchCollection(name);
      } catch (err) {
        console.error(`Error fetching ${name}:`, err);
        data[name] = [];
      }
    }
    return data;
  };

  // 🔹 Export Excel + JSON into one ZIP
  const exportToZip = async (data) => {
    const zip = new JSZip();

    const wb = XLSX.utils.book_new();
    Object.keys(data).forEach((sheetName) => {
      const ws = XLSX.utils.json_to_sheet(data[sheetName]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    zip.file("SHG_Backup.xlsx", excelBuffer);

    const jsonString = JSON.stringify(data, null, 2);
    zip.file("SHG_Backup.json", jsonString);

    const meta = `Backup created on: ${new Date().toLocaleString()}`;
    zip.file("meta.txt", meta);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const filename = `SHG_Backup_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "_")}.zip`;
    saveAs(zipBlob, filename);
  };

  // 🔹 Backup handler
  const handleBackup = async () => {
    setIsBackingUp(true);
    setMessage("Fetching data from Firestore...");

    try {
      const data = await fetchAllData();
      setMessage("Preparing ZIP backup...");
      await exportToZip(data);

      const timestamp = new Date().toLocaleString();
      localStorage.setItem("lastBackup", timestamp);
      setLastBackup(timestamp);
      setMessage("✅ Backup completed successfully!");
    } catch (error) {
      console.error("Backup failed:", error);
      setMessage("❌ Backup failed. Check console for details.");
    } finally {
      setIsBackingUp(false);
    }
  };

  // 🔹 Preview Restore Data before writing
  const handleRestorePreview = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsRestoring(true);
    setMessage("Reading backup file...");

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      const previewSummary = {};

      for (const name of Object.keys(backupData)) {
        const newItems = backupData[name];
        if (!Array.isArray(newItems)) continue;

        const existing = await fetchCollection(name);
        const existingIds = new Set(existing.map((d) => d.id));

        let newCount = 0;
        let existingCount = 0;

        newItems.forEach((item) => {
          if (existingIds.has(item.id)) existingCount++;
          else newCount++;
        });

        previewSummary[name] = {
          total: newItems.length,
          newCount,
          existingCount,
        };
      }

      setPreviewData({ summary: previewSummary, backupData });
      setMessage("✅ Preview ready. Review summary before restoring.");
    } catch (err) {
      console.error("Restore preview failed:", err);
      setMessage("❌ Failed to read or parse JSON file.");
    } finally {
      setIsRestoring(false);
      event.target.value = ""; // reset input for re-use
    }
  };

  // 🔹 Confirm and perform restore
  const confirmRestore = async () => {
    if (!previewData) return;

    const { backupData } = previewData;
    const projectId = db?.app?.options?.projectId || "shg-bookkeeping-app";

    setIsRestoring(true);
    setMessage("Restoring data into Firestore...");

    try {
      for (const name of Object.keys(backupData)) {
        const items = backupData[name];
        if (!Array.isArray(items)) continue;

        for (const item of items) {
          try {
            const docRef = doc(
              db,
              "artifacts",
              projectId,
              "users",
              userId,
              "shg_groups",
              shgId,
              name,
              item.id || `${Date.now()}-${Math.random()}`
            );
            await setDoc(docRef, item, { merge: true });
          } catch (err) {
            console.error(`Error restoring ${name} item:`, err);
          }
        }
      }

      setMessage("✅ Restore completed successfully!");
      setPreviewData(null);
    } catch (err) {
      console.error("Restore failed:", err);
      setMessage("❌ Restore failed. See console for details.");
    } finally {
      setIsRestoring(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="p-6 max-w-2xl mx-auto bg-white shadow-lg rounded-2xl">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Backup & Restore
      </h2>

      <p className="text-gray-600 mb-4">
        You can back up or restore your SHG data. The restore feature previews
        all changes before merging new records.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <button
          onClick={handleBackup}
          disabled={isBackingUp}
          className={`px-5 py-2.5 rounded-xl text-white font-semibold transition-all ${
            isBackingUp
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isBackingUp ? "Backing up..." : "Backup Now"}
        </button>

        <label
          className={`px-5 py-2.5 rounded-xl text-white font-semibold transition-all cursor-pointer ${
            isRestoring
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isRestoring ? "Analyzing..." : "Restore (Preview)"}
          <input
            type="file"
            accept=".json"
            onChange={handleRestorePreview}
            disabled={isRestoring}
            className="hidden"
          />
        </label>
      </div>

{previewData && (
  <div className="mt-4 border p-4 rounded-md bg-gray-50 shadow-sm">
    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
      <span>🧾</span> Restore Preview Summary
    </h3>

    <ul className="text-sm space-y-2">
      {Object.entries(previewData.summary).map(([name, stats]) => {
        const hasNew = stats.newCount > 0;
        return (
          <li
            key={name}
            className={`flex justify-between items-center px-3 py-2 rounded-md ${
              hasNew
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-gray-100 border border-gray-200 text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  hasNew ? "bg-green-500" : "bg-gray-400"
                }`}
              ></span>
              <span className="capitalize font-medium">{name}</span>
            </div>
            <div className="text-xs sm:text-sm">
              total: <strong>{stats.total}</strong> &nbsp;|&nbsp; new:{" "}
              <strong>{stats.newCount}</strong> &nbsp;|&nbsp; existing:{" "}
              <strong>{stats.existingCount}</strong>
            </div>
          </li>
        );
      })}
    </ul>

    <div className="flex justify-end">
      <button
        onClick={confirmRestore}
        className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
      >
        ✅ Confirm Restore
      </button>
    </div>
  </div>
)}

      {message && (
        <div
          className={`mt-4 p-3 rounded-md text-sm ${
            message.startsWith("✅")
              ? "bg-green-100 text-green-700"
              : message.startsWith("❌")
              ? "bg-red-100 text-red-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {message}
        </div>
      )}

      {lastBackup && (
        <p className="mt-4 text-gray-500 text-sm">
          Last backup: <span className="font-medium">{lastBackup}</span>
        </p>
      )}
    </div>
  );
};

export default BackupScreen;
