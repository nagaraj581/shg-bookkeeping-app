import React from "react";

// Members Screen Component (defensive: tolerates undefined members)
const MembersScreen = ({
  members = [], // default to empty array if parent doesn't pass it yet
  openAddMemberModal = () => {},
  openEditMemberModal = () => {},
  deleteMember = () => {},
}) => {
  // ensure we have an array to work with
  const safeMembers = Array.isArray(members) ? members : [];

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-extrabold text-blue-800 dark:text-blue-300">SHG Members</h2>
        <button
          onClick={openAddMemberModal}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 
                     transition duration-200 ease-in-out flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
               xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          <span>Add Member</span>
        </button>
      </div>

      {safeMembers.length === 0 ? (
        <p className="text-center text-lg text-gray-600 dark:text-gray-400 py-8">
          No members yet. Add your first member!
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 rounded-lg">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 
                               dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 
                               dark:text-gray-300 uppercase tracking-wider">Designation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 
                               dark:text-gray-300 uppercase tracking-wider">Mobile</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 
                               dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 
                               dark:text-gray-300 uppercase tracking-wider">Joined</th>
                <th className="relative px-6 py-3"><span className="sr-only">Edit/Delete</span></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {safeMembers.map((member, idx) => {
                const key = member?.id ?? member?.uid ?? idx;
                const name = member?.name ?? "—";
                const designation = member?.designation ?? "—";
                const mobile = member?.mobile ?? "—";
                const email = member?.email ?? "—";
                const joiningDate = member?.joiningDate ?? "—";

                return (
                  <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium 
                                   text-gray-900 dark:text-gray-100">{name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm 
                                   text-gray-500 dark:text-gray-300">{designation}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm 
                                   text-gray-500 dark:text-gray-300">{mobile}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm 
                                   text-gray-500 dark:text-gray-300">{email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm 
                                   text-gray-500 dark:text-gray-300">{joiningDate}</td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
  {member.address || "—"}
</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <button
                        onClick={() => openEditMemberModal(member)}
                        className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteMember(member?.id ?? key)}
                        className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="h-20 md:h-25" aria-hidden="true" />
    </div>
  );
};

export default MembersScreen;
