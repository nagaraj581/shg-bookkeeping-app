import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

const MeetingsScreen = ({ db, userId, shgId = "main", members = [] }) => {
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [meetingToDelete, setMeetingToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  const projectId =
    db && db.app && db.app.options && db.app.options.projectId
      ? db.app.options.projectId
      : "shg-bookkeeping-app";

  const meetingsPath = `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/meetings`;
  const meetingsColRef =
    db && userId && shgId ? collection(db, meetingsPath) : null;

  // 🔹 Load meetings
  const fetchMeetings = async () => {
    if (!meetingsColRef) return;
    try {
      const snapshot = await getDocs(meetingsColRef);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setMeetings(data);
    } catch (err) {
      console.error("Error loading meetings:", err);
      showToast("❌ Error loading meetings");
    }
  };

  useEffect(() => {
    fetchMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId, shgId]);

  // 🔹 Save new meeting
  const handleSaveMeeting = async () => {
    if (!meetingsColRef) {
      showToast("⚠️ Database not ready.");
      return;
    }
    if (!date || !title) {
      showToast("⚠️ Please enter date and title.");
      return;
    }

    try {
      await addDoc(meetingsColRef, {
        date,
        title,
        notes,
        attendees,
        createdAt: serverTimestamp(),
      });

      showToast("✅ Meeting saved");
      setDate("");
      setTitle("");
      setNotes("");
      setAttendees([]);
      fetchMeetings();
    } catch (err) {
      console.error("Error saving meeting:", err);
      showToast("❌ Error saving meeting");
    }
  };

  // 🔹 Delete meeting with modal confirmation
  const confirmDeleteMeeting = (meeting) => {
    setMeetingToDelete(meeting);
  };

  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;

    try {
      const meetingDocRef = doc(db, meetingsPath, meetingToDelete.id);
      await deleteDoc(meetingDocRef);
      showToast("🗑️ Meeting deleted");
      setMeetingToDelete(null);
      fetchMeetings();
    } catch (err) {
      console.error("Error deleting meeting:", err);
      showToast("❌ Error deleting meeting");
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const toggleAttendee = (memberId) => {
    setAttendees((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const nameFromId = (id) =>
    members.find((m) => m.id === id)?.name || "Unknown";

  return (
    <div className="p-6 space-y-6 relative">
      <h2 className="text-2xl font-bold">Meetings</h2>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-green-100 text-green-800 px-4 py-2 rounded shadow-lg z-50">
          {toastMessage}
        </div>
      )}

      {/* Confirmation Modal */}
      {meetingToDelete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 text-center">
            <h3 className="text-lg font-semibold mb-3">
              🗑️ Delete this meeting?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleDeleteMeeting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Delete
              </button>
              <button
                onClick={() => setMeetingToDelete(null)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Meeting Form */}
      <div className="bg-white shadow p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Record New Meeting</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border p-2 w-full rounded"
          />
          <input
            type="text"
            placeholder="Meeting Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border p-2 w-full rounded"
          />
          <input
            type="text"
            placeholder="Notes / Agenda"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border p-2 w-full rounded"
          />
        </div>

        <div className="mb-2">
          <h4 className="font-semibold mb-1">Select Attendees:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {members.map((m) => (
              <label key={m.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={attendees.includes(m.id)}
                  onChange={() => toggleAttendee(m.id)}
                />
                <span>{m.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleSaveMeeting}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
        >
          Save Meeting
        </button>
      </div>

      {/* Meeting History */}
      <div className="bg-white shadow p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Meeting History</h3>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Date</th>
              <th className="border p-2">Title</th>
              <th className="border p-2">Notes</th>
              <th className="border p-2">Attendees</th>
              <th className="border p-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id}>
                <td className="border p-2">{m.date}</td>
                <td className="border p-2">{m.title}</td>
                <td className="border p-2">{m.notes}</td>
                <td className="border p-2">
                  {Array.isArray(m.attendees)
                    ? m.attendees.map((id) => nameFromId(id)).join(", ")
                    : ""}
                </td>
                <td className="border p-2 text-center">
                  <button
                    onClick={() => confirmDeleteMeeting(m)}
                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {meetings.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center text-gray-500 p-3">
                  No meetings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MeetingsScreen;
