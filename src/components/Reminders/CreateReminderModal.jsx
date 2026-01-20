import React from "react";

const CreateReminderModal = ({
  show,
  onClose,

  // language
  language,
  setLanguage,

  // member
  members,
  selectedMemberId,
  setSelectedMemberId,

  // fields
  savingAmount,
  setSavingAmount,
  fineAmount,
  setFineAmount,
  outstandingLoan,
  interestAmount,
  setInterestAmount,

  dueDate,
  setDueDate,
  handleGenerate,
}) => {
  if (!show) return null;

  const isKannada = language === "kn";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2 className="text-2xl font-bold text-center text-blue-700 mb-4">
          🔔 {isKannada ? "ಪಾವತಿ ರಿಮೈಂಡರ್" : "Create Payment Reminder"}
        </h2>

        {/* Language toggle */}
        <div className="flex justify-center gap-2 mb-4">
          <button
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 rounded ${
              language === "en"
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage("kn")}
            className={`px-3 py-1 rounded ${
              language === "kn"
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
          >
            ಕನ್ನಡ
          </button>
        </div>

        {/* Member selection */}
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1">
            {isKannada ? "ಸದಸ್ಯ ಆಯ್ಕೆ" : "Select Member"}
          </label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="">
              {isKannada ? "ಸದಸ್ಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ" : "Choose member"}
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Saving */}
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1">
            {isKannada ? "ಮಾಸಿಕ ಉಳಿತಾಯ" : "Monthly Saving"}
          </label>
          <input
            type="number"
            value={savingAmount}
            onChange={(e) => setSavingAmount(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>

        {/* Fine */}
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1">
            {isKannada ? "ದಂಡ (ಇದ್ದರೆ)" : "Fine (if any)"}
          </label>
          <input
            type="number"
            value={fineAmount}
            onChange={(e) => setFineAmount(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>

        {/* Outstanding loan (read only) */}
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1">
            {isKannada ? "ಬಾಕಿ ಸಾಲ ಮೊತ್ತ" : "Outstanding Loan"}
          </label>
          <input
            type="number"
            value={outstandingLoan}
            disabled
            className="w-full border rounded p-2 bg-gray-100"
          />
        </div>

        {/* Interest */}
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1">
            {isKannada ? "ಬಡ್ಡಿ" : "Interest"}
          </label>
          <input
            type="number"
            value={interestAmount}
            onChange={(e) => setInterestAmount(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>

        {/* Due date */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">
            {isKannada ? "ಕೊನೆಯ ದಿನಾಂಕ" : "Due Date"}
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            {isKannada ? "ರದ್ದುಮಾಡಿ" : "Cancel"}
          </button>
          <button
  onClick={handleGenerate}
  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
>
  {isKannada ? "ರಿಮೈಂಡರ್ ರಚಿಸಿ" : "Generate Reminder"}
</button>

        </div>
      </div>
    </div>
  );
};

export default CreateReminderModal;
