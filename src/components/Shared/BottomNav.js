import React from "react";

const NavItem = ({ icon, label, onClick, active }) => {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center transition-all duration-200 ${
        active
          ? "text-blue-600 scale-110"
          : "text-gray-600 hover:text-blue-500"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
};

export default function BottomNav({ currentPage, setCurrentPage }) {
  return (
<nav
  className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg border-t flex justify-around items-center z-50"
  style={{ height: "calc(4rem + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
  role="navigation"
  aria-label="Main navigation"
>
        <NavItem
        icon="🏠"
        label="Dashboard"
        onClick={() => setCurrentPage("dashboard")}
        active={currentPage === "dashboard"}
      />
      <NavItem
        icon="⚙️"
        label="SHG Profile"
        onClick={() => setCurrentPage("shgProfile")}
        active={currentPage === "shgProfile"}
      />
      <NavItem
        icon="👥"
        label="Members"
        onClick={() => setCurrentPage("members")}
        active={currentPage === "members"}
      />
      <NavItem
        icon="💰"
        label="Bookkeeping"
        onClick={() => setCurrentPage("bookkeeping")}
        active={currentPage === "bookkeeping"}
      />
<NavItem
  icon="📈"
  label="Reports"
  onClick={() => setCurrentPage("reports")}
  active={currentPage === "reports"}
/>
      <NavItem
        icon="🗓️"
        label="Meetings"
        onClick={() => setCurrentPage("meetings")}
        active={currentPage === "meetings"}
      />
      <NavItem
        icon="🔐"
        label="Multi-User Info"
        onClick={() => setCurrentPage("multiUserInfo")}
        active={currentPage === "multiUserInfo"}
      />
<NavItem
  icon="💾"
  label="Backup"
  onClick={() => setCurrentPage("backup")}
  active={currentPage === "backup"}
/>
    </nav>
  );
}
