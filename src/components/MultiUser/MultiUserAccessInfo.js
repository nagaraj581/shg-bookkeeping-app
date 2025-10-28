import React from "react";
import { useAuth } from "../../contexts/AuthContext";

const MultiUserInfo = () => {
  const { currentUser } = useAuth();

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

      <div className="bg-white shadow rounded-lg p-4 max-w-md">
        <div className="flex items-center space-x-4">
          {currentUser.photoURL && (
            <img
              src={currentUser.photoURL}
              alt="Profile"
              className="w-12 h-12 rounded-full"
            />
          )}
          <div>
            <p className="font-semibold">{currentUser.displayName || "No Name"}</p>
            <p className="text-gray-600">{currentUser.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiUserInfo;
