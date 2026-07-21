import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebase";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

const MultiUserInfo = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);

useEffect(() => {
  const fetchUsers = async () => {
    const projectId = "shg-bookkeeping-app";

    const ref = collection(
      db,
      "artifacts",
      projectId,
      "users"
    );

    const snap = await getDocs(ref);

    const list = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setUsers(list);
  };

  fetchUsers();
}, []);

  if (!currentUser) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Multi User Info</h2>
        <p>No user is logged in.</p>
      </div>
    );
  }

  return (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4">Multi User Info</h2>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">  {users.map((user) => {
    const isOnline = user.lastSeen
      ? Date.now() - user.lastSeen.seconds * 1000 < 2 * 60 * 1000
      : false;

    return (
      <div
        key={user.id}
className="bg-white shadow rounded-lg p-3 w-full"      >
        <div className="flex items-center space-x-4">

          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
            {user.name?.[0] || "U"}
          </div>

          {/* Info */}
          <div>
            <p className="font-semibold">
              {user.name || "No Name"}
            </p>

            <p className="text-gray-600 text-sm">
              {user.email}
            </p>

            {user.lastSeen && (
              <p className="text-xs text-gray-400 mt-1">
                Last seen:{" "}
                {new Date(user.lastSeen.seconds * 1000).toLocaleString()}
              </p>
            )}

            {/* Online status */}
            <p
              className={`text-xs mt-1 ${
                isOnline ? "text-green-500" : "text-gray-400"
              }`}
            >
              ● {isOnline ? "Online" : "Offline"}
            </p>
          </div>

        </div>
      </div>
    );
  })}
</div>
  </div>
);
};

export default MultiUserInfo;
