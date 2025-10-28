// src/components/Shared/AlertModal.js 
import React, { useState } from "react";

/**
 * AlertModal
 * Reusable alert / confirm / copy modal used across the app.
 * Props:
 *  - show: boolean
 *  - message: string (can include newlines)
 *  - onClose: function
 *  - confirmAction: function (optional) - called when Confirm is clicked
 *  - confirmLabel: string (optional) - label for confirm button (default: "Confirm")
 *  - copyContent: string (optional) - if present, shows "Copy" button and copies this string to clipboard
 */
const AlertModal = ({
  show,
  message = "",
  onClose = () => {},
  confirmAction = null,
  confirmLabel = "Confirm",
  copyContent = null,
}) => {
  const [busy, setBusy] = useState(false);


  if (!show) return null;

  const handleCopy = () => {
    if (!copyContent) return;
    try {
      navigator.clipboard.writeText(copyContent);
      alert("📋 Numbers copied to clipboard!");
    } catch (err) {
      console.error("Copy failed", err);
      alert("Failed to copy numbers. Try manually.");
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction || busy) return;
    setBusy(true);
    try {
      await confirmAction();
    } catch (err) {
      console.error("confirmAction error", err);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  const onBackdropClick = () => {
    if (!busy) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      aria-modal="true"
      role="dialog"
      onClick={onBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4 whitespace-pre-wrap">
          {message}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {/* ✅ Copy Button */}
          {copyContent && (
            <button
              onClick={handleCopy}
              disabled={busy}
              className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition duration-200 ease-in-out disabled:opacity-50 flex items-center gap-2"
            >
              📋 Copy Numbers
            </button>
          )}

          {/* ✅ Confirm Button (can be used for WhatsApp launch or delete confirm) */}
          {confirmAction && (
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition duration-200 ease-in-out disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? "Processing..." : confirmLabel === "Confirm" ? "✅ Confirm" : confirmLabel}
            </button>
          )}

          {/* Cancel / OK */}
          <button
            onClick={() => !busy && onClose()}
            className={`px-5 py-2 ${
              copyContent || confirmAction
                ? "bg-gray-300 text-gray-800 hover:bg-gray-400"
                : "bg-blue-600 text-white hover:bg-blue-700"
            } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition duration-200 ease-in-out disabled:opacity-50 flex items-center gap-2`}
            disabled={busy}
          >
            {copyContent || confirmAction ? "Cancel" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
