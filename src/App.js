import BottomNav from "./components/Shared/BottomNav";
import MembersScreen from "./components/Members/MembersScreen";
import MemberFormModal from "./components/Members/MemberFormModal";
import BookkeepingScreen from "./components/Bookkeeping/BookkeepingScreen";
import React, { useState, useEffect, createContext, useContext } from "react";
import AlertModal from "./components/Shared/AlertModal";
import ReportsScreen from "./components/Reports/ReportsScreen";
import MeetingsScreen from "./components/Meetings/MeetingsScreen";
import BackupScreen from "./components/Backup/BackupScreen";
import MultiUserAccessInfo from "./components/MultiUser/MultiUserAccessInfo";
import { useAuth } from "./contexts/AuthContext"; // adjust path if needed
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import TailwindTest from './TailwindTest';
import TransactionForm from "./components/TransactionForm";
import { uploadBytesResumable} from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "./firebase";




import * as XLSX from "xlsx";

// NOTE: MultiUserAccessInfo is defined later in this file, so don't import it here.


// ✅ Firebase v9 modular imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signOut, 
  signInWithCustomToken,
  GoogleAuthProvider, 
  signInWithPopup,    
} from 'firebase/auth';
import { 
  getFirestore, 
  getDoc, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore';

const APP_ID = "shg-bookkeeping-app";


// --- keep your firebaseConfig as-is ---
const firebaseConfig = {
  apiKey: "AIzaSyDVKhGOfMw7eVg6hGszAGhadmxlHbzBVnk",
  authDomain: "shg-bookkeeping-app.firebaseapp.com",
  projectId: "shg-bookkeeping-app",
storageBucket: "shg-bookkeeping-app.firebasestorage.app",
  messagingSenderId: "119893719501",
  appId: "1:119893719501:web:a86cf7470bedc302466c84",
  measurementId: "G-2FXB7ZPRXP"
};

// Define contexts
const FirebaseContext = createContext(null);
const AuthContext = createContext(null);

// Format number in Indian style (₹ 1,00,000.00)
const formatINR = (num) => {
  const n = Number(num) || 0;
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};




const App = () => {
  const { currentUser, logout } = useAuth();
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  



  // profile info for header
  const [userProfile, setUserProfile] = useState({ displayName: "", photoURL: "" });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [members, setMembers] = useState([]);
  const [shgName, setShgName] = useState('');
  const [shgId, setShgId] = useState('');
  const [shgLogoUrl, setShgLogoUrl] = useState('');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberMobile, setNewMemberMobile] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberJoiningDate, setNewMemberJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMemberDesignation, setNewMemberDesignation] = useState('member');
  const [newMemberAddress, setNewMemberAddress] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertCopyContent, setAlertCopyContent] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showLoginScreen, setShowLoginScreen] = useState(false);
  // WhatsApp Reminder Modal states
const [showReminderModal, setShowReminderModal] = useState(false);
const [reminderMessage, setReminderMessage] = useState(
  localStorage.getItem("lastReminderMessage") || ""
);
useEffect(() => {
  if (reminderMessage.trim()) {
    localStorage.setItem("lastReminderMessage", reminderMessage);
  }
}, [reminderMessage]);

 


  // Bookkeeping states
  const [transactions, setTransactions] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [savingAmount, setSavingAmount] = useState('');
  const [savingDate, setSavingDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingType, setSavingType] = useState('Monthly Saving');

  // Loan states
  const [loans, setLoans] = useState([]);
  const [loanMemberId, setLoanMemberId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanInterestRate, setLoanInterestRate] = useState('');
  const [loanTermMonths, setLoanTermMonths] = useState('');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [loanDescription, setLoanDescription] = useState('');
  const [loanType, setLoanType] = useState('Book Loan');

  // Repayment states
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [principalRepaymentAmount, setPrincipalRepaymentAmount] = useState('');
  const [interestRepaymentAmount, setInterestRepaymentAmount] = useState('');
  const [repaymentDate, setRepaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Expense states
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Stationery');
  const [sbBalance, setSbBalance] = useState(0);
const [odBalance, setOdBalance] = useState(0);

  // Meeting states
  const [meetings, setMeetings] = useState([]);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [meetingMinutes, setMeetingMinutes] = useState('');
  const [selectedMeetingAttendees, setSelectedMeetingAttendees] = useState([]);

  // ---------- Transaction edit / delete state (paste near other useState declarations) ----------
const [editingTransaction, setEditingTransaction] = useState(null); // transaction object to edit
const [showTransactionModal, setShowTransactionModal] = useState(false);

// Filters for transactions (for Bookkeeping & Accounting lists)
const [txFilterMemberId, setTxFilterMemberId] = useState(''); // '' = all
const [txFilterType, setTxFilterType] = useState(''); // '' = all (Saving, Expense, Loan Disbursed, Loan Repayment, Bank Loan Repayment, Fine)

// ---------- Edit/Delete helpers ----------
const openEditTransaction = (tx) => {
  // ensure we have local string values for editing inputs
  setEditingTransaction({
    ...tx,
    // ensure amounts are strings for inputs
    amount: tx.amount !== undefined ? String(tx.amount) : '',
    principalRepaid: tx.principalRepaid !== undefined ? String(tx.principalRepaid) : '',
    interestRepaid: tx.interestRepaid !== undefined ? String(tx.interestRepaid) : '',
    date: tx.date ? tx.date.split('T')[0] : (new Date().toISOString().split('T')[0])
  });
  setShowTransactionModal(true);
};


const handleDeleteTransaction = (tx) => {
  setAlertMessage("Are you sure you want to delete this transaction? This action cannot be undone.");
  setConfirmAction(() => async () => {
    if (!db || !userId || !shgId) {
      setAlertMessage("App not ready: DB/user/SHG not initialized.");
      setShowAlert(true);
      setConfirmAction(null);
      return;
    }
    const projectId = getCurrentProjectId();
    try {
      await deleteDoc(doc(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`, tx.id));
      setAlertMessage("Transaction deleted.");
      setShowAlert(true);
    } catch (err) {
      console.error("delete transaction error", err);
      setAlertMessage("Failed to delete transaction: " + (err.message || err));
      setShowAlert(true);
    } finally {
      setConfirmAction(null);
    }
  });
  setShowAlert(true);
};

// App.js (inside the App component)
const handleSignOut = async () => {
  try {
    const { getAuth, signOut } = await import("firebase/auth");
    const authInstance = getAuth();
    await signOut(authInstance);

    // hide confirmation dialog
    setShowSignOutConfirm(false);

    // Reset state and go to login screen
    setUserId(null);
    setUserProfile({ displayName: "", photoURL: "" });
    setShowLoginScreen(true);
    console.log("✅ Signed out successfully");
  } catch (error) {
    console.error("❌ Sign-out error:", error);
    setAlertMessage(`Error signing out: ${error.message || error}`);
    setShowAlert(true);
  }
};


  // Helper function to get member name by ID
  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId);
    return member ? member.name : 'Unknown Member';
  };
  // Helper function to get member mobile by ID
  const getMemberMobile = (memberId) => {
    const member = members.find(m => m.id === memberId);
    return member ? member.mobile : '';
  };

  // ---- add inside App component, near other helpers ----
const fetchTransactions = async () => {
  try {
    if (!db || !userId || !shgId) {
      // not ready yet
      return;
    }
    const projectId = getCurrentProjectId();
    if (!projectId) return;

    const txColRef = collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`);
    const snapshot = await getDocs(txColRef);
    const transactionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // ensure consistent date ordering if needed
    transactionsData.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(transactionsData);
    console.log("fetchTransactions: loaded", transactionsData.length);
  } catch (err) {
    console.error("fetchTransactions error:", err);
    setAlertMessage(`Failed to fetch transactions: ${err.message || err}`);
    setShowAlert(true);
  }
};

// ---- paste inside the App component, near other helper functions ----
const exportTransactionsToXlsx = () => {
  try {
    if (!transactions || transactions.length === 0) {
      setAlertMessage("No transactions to export.");
      setShowAlert(true);
      return;
    }

    const rows = transactions.map(tx => {
      const member = members.find(m => m.id === tx.memberId);
      const memberName = member ? member.name : (tx.memberId || "N/A");

      const isoDate = tx.date && tx.date.toDate ? tx.date.toDate().toISOString() : (tx.date || "");
      const createdAtIso = tx.createdAt && tx.createdAt.toDate ? tx.createdAt.toDate().toISOString() : (tx.createdAt || "");

      return {
        ID: tx.id,
        Date_ISO: isoDate,
        Date_Local: isoDate ? new Date(isoDate).toLocaleString() : "",
        Type: tx.type || "",
        SubType_Category: tx.savingType || tx.loanType || tx.category || "",
        MemberId: tx.memberId || "",
        MemberName: memberName,
        Amount: Number(tx.amount || 0),
        PrincipalRepaid: tx.principalRepaid != null ? Number(tx.principalRepaid) : "",
        InterestRepaid: tx.interestRepaid != null ? Number(tx.interestRepaid) : "",
        Description: tx.description || "",
        RecordedBy: tx.recordedBy || "",
        CreatedAt_ISO: createdAtIso,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");

    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-").split("T").join("_").slice(0,19);
    const filename = `shg_transactions_${ts}.xlsx`;

    XLSX.writeFile(wb, filename);

    setAlertMessage(`Exported ${rows.length} transactions to ${filename}`);
    setShowAlert(true);
  } catch (err) {
    console.error("exportTransactionsToXlsx error:", err);
    setAlertMessage("Failed to export XLSX: " + (err.message || err));
    setShowAlert(true);
  }
};

  // Initialize Firebase and handle authentication
useEffect(() => {
  const initFirebase = async () => {
      let activeFirebaseConfig = firebaseConfig; // Start with the hardcoded config
      let initialAuthToken = null;
      let usingCanvasConfig = false;

      // Check if Canvas environment variables are available.
      if (typeof window.__firebase_config !== 'undefined' && typeof window.__initial_auth_token !== 'undefined') {
        try {
          activeFirebaseConfig = JSON.parse(window.__firebase_config);
          initialAuthToken = window.__initial_auth_token;
          usingCanvasConfig = true;
          console.log("Using Canvas-provided Firebase configuration.");
        } catch (e) {
          console.error("Error parsing __firebase_config from Canvas:", e);
          setAlertMessage(`Error parsing Canvas Firebase configuration: ${e.message}`);
          setShowAlert(true);
          activeFirebaseConfig = firebaseConfig;
          initialAuthToken = null; 
          usingCanvasConfig = false;
        }
      } else {
        console.log("Canvas Firebase configuration not found. Using hardcoded config.");
      }

      try {
        const app = initializeApp(activeFirebaseConfig);
        const firestore = getFirestore(app);
        const authInstance = getAuth(app);

        setDb(firestore);
        setAuth(authInstance);

onAuthStateChanged(authInstance, async (user) => {
        if (user) {
          setUserId(user.uid);

  // load SHG data (returns shgName if you added the return in loadShgData)
  const loadedShgName = await loadShgData(firestore, user.uid, activeFirebaseConfig?.projectId);
          const finalDisplayName = user.displayName || loadedShgName || "";
          const finalPhotoURL = user.photoURL || "";


          setUserProfile({
            displayName: finalDisplayName,
    photoURL: finalPhotoURL
          });

          setShowLoginScreen(false);
        } else {
          setUserId(null);
          setUserProfile({ displayName: "", photoURL: "" });
          setShowLoginScreen(true);
        }
        setLoading(false);
      });
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setAlertMessage(`Firebase initialization failed: ${error.message}`);
      setShowAlert(true);
      setLoading(false);
    }
  };

  initFirebase();
  }, []); 

// Load SHG data after authentication and db is ready 
const loadShgData = async (firestoreInstance, currentUserId, projectId) => {
  if (!firestoreInstance || !currentUserId || !projectId) return;

  try {
    console.log("DEBUG projectId:", projectId, "currentUserId:", currentUserId);

    const userShgDocRef = doc(
      firestoreInstance,
      "artifacts",
      projectId,
      "users",
      currentUserId,
      "shg_groups",
      "main"
    );

    console.log("DEBUG: reading SHG doc at:", userShgDocRef.path);

    const userShgDocSnap = await getDoc(userShgDocRef);

    if (userShgDocSnap.exists()) {
      const data = userShgDocSnap.data();
      setShgName(data.name || "My SHG");
      setShgId(data.id || userShgDocSnap.id);
      setShgLogoUrl(data.logoUrl || "");
      console.log("Loaded existing SHG:", data.name)
    return data.name || "My SHG";
    } else {
      console.log("SHG doc not found at path, creating new one:", userShgDocRef.path);
      const newShgData = {
        id: userShgDocRef.id,
        name: "My New SHG",
        createdAt: new Date().toISOString(),
        adminId: currentUserId,
        logoUrl: "",
      };
      await setDoc(userShgDocRef, newShgData);
      setShgName(newShgData.name);
      setShgId(newShgData.id);
      setShgLogoUrl(newShgData.logoUrl);
      console.log("Created new SHG:", newShgData.name)
      return newShgData.name;
    }
  } catch (error) {
    console.error("Error loading/creating SHG data:", error);
    setAlertMessage(`Error loading SHG data: ${error.message}`);
    setShowAlert(true);
  }
};

  const deleteShg = async () => {
    if (!db || !userId || !shgId) {
      setAlertMessage("SHG data not loaded or user not authenticated.");
      setShowAlert(true);
      return;
    }
    const projectId = getCurrentProjectId();

    setAlertMessage("Are you absolutely sure you want to delete this SHG? This action is irreversible and will delete ALL members, transactions, loans, and meetings associated with this SHG.");
    setConfirmAction(() => async () => {
        try {
            // Delete members and their subcollections (transactions, loans, meetings)
            const membersCollectionRef = collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/members`);
            const memberDocs = await getDocs(membersCollectionRef);
            await Promise.all(memberDocs.docs.map(async (memberDoc) => {
                const memberIdToDelete = memberDoc.id;

                // Delete associated transactions
                const memberTransactionsQuery = query(
                    collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`),
                    where("memberId", "==", memberIdToDelete)
                );
                const transactionDocs = await getDocs(memberTransactionsQuery);
                await Promise.all(transactionDocs.docs.map(d => deleteDoc(d.ref)));

                // Delete associated loans
                const memberLoansQuery = query(
                    collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/loans`),
                    where("memberId", "==", memberIdToDelete)
                );
                const loanDocs = await getDocs(memberLoansQuery);
                await Promise.all(loanDocs.docs.map(d => deleteDoc(d.ref)));

                // Delete the member document itself
                await deleteDoc(memberDoc.ref);
            }));

            // Delete all remaining transactions (if any not linked to a member)
            const allTransactionsRef = collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`);
            const allTransactionDocs = await getDocs(allTransactionsRef);
            await Promise.all(allTransactionDocs.docs.map(d => deleteDoc(d.ref)));

            // Delete all remaining loans (if any not linked to a member)
            const allLoansRef = collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/loans`);
            const allLoanDocs = await getDocs(allLoansRef);
            await Promise.all(allLoanDocs.docs.map(d => deleteDoc(d.ref)));

            // Delete all meetings
            const meetingsRef = collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/meetings`);
            const meetingDocs = await getDocs(meetingsRef);
            await Promise.all(meetingDocs.docs.map(d => deleteDoc(d.ref)));

            // Finally, delete the SHG main document
            const shgDocRef = doc(db, `artifacts/${projectId}/users/${userId}/shg_groups/main`)
            await deleteDoc(shgDocRef);

            // Clear local state and sign out
            setShgName('');
            setShgId('');
            setShgLogoUrl('');
            setMembers([]);
            setTransactions([]);
            setLoans([]);
            setMeetings([]);
            await signOut(auth); 
            setAlertMessage("SHG and all associated data deleted successfully. You have been signed out.");
            setShowAlert(true);
        } catch (error) {
            console.error("Error deleting SHG and its data:", error);
            setAlertMessage(`Error deleting SHG: ${error.message}`);
            setShowAlert(true);
        } finally {
            setConfirmAction(null);
            setAlertCopyContent(null);
        }
    });
    setShowAlert(true);
  };

const getCurrentProjectId = () => {
    try {
      if (db && db.app && db.app.options && db.app.options.projectId) {
        return db.app.options.projectId;
      }
      return (firebaseConfig && firebaseConfig.projectId) || null;
    } catch {
      return null;
    }
  };
  
  // Fetch members when db, userId, or shgId changes
  useEffect(() => {
    const projectId = getCurrentProjectId(); 
    if (db && userId && shgId && projectId) {
      const membersCollectionRef = collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/members`);
      const q = query(membersCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const membersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setMembers(membersData);
        console.log("Members fetched:", membersData);
      }, (error) => {
        console.error("Error fetching members:", error);
        setAlertMessage(`Error fetching members: ${error.message}`);
        setShowAlert(true);
      });

      return () => unsubscribe();
    }
  }, [db, userId, shgId]); 

  // Fetch transactions when db, userId, or shgId changes
  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (db && userId && shgId && projectId) {
      const transactionsCollectionRef = collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`);
      const q = query(transactionsCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        transactionsData.sort((a, b) => new Date(b.date) - new Date(a.date));
        setTransactions(transactionsData);
        console.log("Transactions fetched:", transactionsData);
      }, (error) => {
        console.error("Error fetching transactions:", error);
        setAlertMessage(`Error fetching transactions: ${error.message}`);
        setShowAlert(true);
      });

      return () => unsubscribe();
    }
  }, [db, userId, shgId]);

// 🔹 Compute SB / OD balances whenever transactions change
useEffect(() => {
  if (!transactions || transactions.length === 0) {
    setSbBalance(0);
    setOdBalance(0);
    return;
  }

  let sb = 0;
  let od = 0;

  transactions.forEach((t) => {
    const amount = Number(t.amount || 0);

    // --- Repayments (both SHG & Bank) ---
    if (t.type === "Loan Repayment" || t.type === "Bank Loan Repayment") {
      const principal = Number(t.principalRepaid || 0);
      const interest = Number(t.interestRepaid || 0);
      const repaid = principal + interest;

      const isBankRepayment =
        t.type === "Bank Loan Repayment" ||
        String(t.loanType || "").toLowerCase().includes("bank");

      if (isBankRepayment) {
        od += repaid; // ✅ OD Account: bank loan principal + interest
      } else {
        sb += repaid; // ✅ SB Account: internal/group loans
      }
      return; // done with this transaction
    }

    // --- Normal income/expense flow (SB only) ---
    switch (t.type) {
      case "Saving":
      case "General Saving":
      case "Fine":
        sb += amount;
        break;

      case "Expense":
      case "Loan Disbursed":
        sb -= amount;
        break;

      default:
        break;
    }
  });

  setSbBalance(sb);
  setOdBalance(od);
}, [transactions]);


  // Fetch loans when db, userId, or shgId changes
  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (db && userId && shgId && projectId) {
      const loansCollectionRef = collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/loans`);
      const q = query(loansCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLoans(loansData);
        console.log("Loans fetched:", loansData);
      }, (error) => {
        console.error("Error fetching loans:", error);
        setAlertMessage(`Error fetching loans: ${error.message}`);
        setShowAlert(true);
      });

      return () => unsubscribe();
    }
  }, [db, userId, shgId]);

  // Fetch meetings when db, userId, or shgId changes
  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (db && userId && shgId && projectId) {
      const meetingsCollectionRef = collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/meetings`);
      const q = query(meetingsCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const meetingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        meetingsData.sort((a, b) => new Date(b.date) - new Date(a.date)); 
        setMeetings(meetingsData);
        console.log("Meetings fetched:", meetingsData);
      }, (error) => {
        console.error("Error fetching meetings:", error);
        setAlertMessage(`Error fetching meetings: ${error.message}`);
        setShowAlert(true);
      });

      return () => unsubscribe();
    }
  }, [db, userId, shgId]);

useEffect(() => {
  const auth = getAuth();
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      setUserId(user.uid);   // ✅ store userId for Firestore paths
    } else {
      setUserId(null);
    }
  });
  return () => unsubscribe();
}, []);

const addOrUpdateMember = async () => {
  if (
    !db ||
    !userId ||
    !shgId ||
    !newMemberName.trim() ||
    !newMemberMobile.trim() ||
    !newMemberDesignation.trim()
  ) {
    setAlertMessage(
      "Please fill in Member Name, Mobile Number, and Designation."
    );
    setShowAlert(true);
    return;
  }
  const projectId = getCurrentProjectId();

  try {
// --- Normalize Mobile (robust) ---
let cleanDigits = String(newMemberMobile || "").replace(/\D/g, "");

// If there are fewer than 10 digits, reject
if (cleanDigits.length < 10) {
  setAlertMessage("Please enter a valid 10-digit mobile number.");
  setShowAlert(true);
  return;
}

// Otherwise take the last 10 digits as the local number (handles +91, 91, 0 prefixes, pasted strings, etc.)
const ten = cleanDigits.slice(-10);
const finalMobile = `+91${ten}`;

    // --- Member Data ---
    const memberData = {
      name: newMemberName.trim(),
      mobile: finalMobile,
      email: newMemberEmail.trim(),
      joiningDate: newMemberJoiningDate,
      designation: newMemberDesignation,
      address: newMemberAddress?.trim() || "", // NEW
      updatedAt: new Date().toISOString(),
    };

    if (editingMember) {
      // Update existing member
      const memberRef = doc(
        db,
        `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/members`,
        editingMember.id
      );
      await updateDoc(memberRef, memberData);
      setAlertMessage("Member updated successfully!");
    } else {
      // Add new member
      await addDoc(
        collection(
          db,
          `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/members`
        ),
        {
          ...memberData,
          createdAt: new Date().toISOString(),
          addedBy: userId,
        }
      );
      setAlertMessage("Member added successfully!");
    }

    // --- Reset form ---
    setShowAlert(true);
    setShowMemberModal(false);
    setNewMemberName("");
    setNewMemberMobile("");
    setNewMemberEmail("");
    setNewMemberJoiningDate(new Date().toISOString().split("T")[0]);
    setNewMemberDesignation("member");
    setNewMemberAddress(""); // reset address
    setEditingMember(null);
  } catch (error) {
    console.error("Error adding/updating member:", error);
    setAlertMessage(`Error adding/updating member: ${error.message}`);
    setShowAlert(true);
  }
};

  const handleDeleteMember = (memberId) => {
    setAlertMessage("Are you sure you want to delete this member? This will also delete their associated transactions and loans.");
    setConfirmAction(() => async () => {
      const projectId = getCurrentProjectId();
      try {
        const memberRef = doc(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/members`, memberId);
        await deleteDoc(memberRef);

        // Delete associated transactions
        const memberTransactionsQuery = query(
          collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`),
          where("memberId", "==", memberId)
        );
        const transactionDocs = await getDocs(memberTransactionsQuery);
        // Use Promise.all to await all deletions
        await Promise.all(transactionDocs.docs.map(d => deleteDoc(d.ref)));


        // Delete associated loans
        const memberLoansQuery = query(
          collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/loans`),
          where("memberId", "==", memberId)
        );
        const loanDocs = await getDocs(memberLoansQuery);
        // Use Promise.all to await all deletions
        await Promise.all(loanDocs.docs.map(d => deleteDoc(d.ref)));

        setAlertMessage("Member and associated data deleted successfully!");
        setShowAlert(true);
      } catch (error) {
        console.error("Error deleting member:", error);
        setAlertMessage(`Error deleting member: ${error.message}`);
        setShowAlert(true);
      } finally {
        setConfirmAction(null); 
        setAlertCopyContent(null);
      }
    });
    setShowAlert(true); 
  };


const openAddMemberModal = () => {
  setEditingMember(null);
  setNewMemberName('');
  setNewMemberMobile('');
  setNewMemberEmail('');
  setNewMemberJoiningDate(new Date().toISOString().split('T')[0]);
  setNewMemberDesignation('member');
  setNewMemberAddress(''); // clear address for new member
  setShowMemberModal(true);
};

// App.js — fixed openEditMemberModal
const openEditMemberModal = (member) => {
  if (!member) return; // guard first

  setEditingMember(member);
  setNewMemberName(member.name || "");

  // stored mobile may be "+919123456789" or "+91 91234 56789" or "9123456789"
  const storedMobile = String(member.mobile || "");
  const digits = storedMobile.replace(/\D/g, "");
  const localNumber = digits.slice(-10); // last 10 digits
  setNewMemberMobile(localNumber);

  setNewMemberEmail(member.email || "");
  setNewMemberJoiningDate(member.joiningDate || new Date().toISOString().split("T")[0]);
  setNewMemberDesignation(member.designation || "member");
  setNewMemberAddress(member.address || "");
  setShowMemberModal(true);
};

// Unified transaction helper
// Paste this **above** the existing `recordSaving` function
// -----------------------------
const addTransaction = async (transaction) => {
  // transaction = an object, e.g.
  // { type:'Saving'|'Loan Repayment'|'Expense'|'Loan Disbursed', memberId, amount, date, savingType, loanId, principalRepayment, interestRepayment, loanType, category, description }
  if (!db || !userId || !shgId) {
    setAlertMessage("App not ready: DB/user/SHG not initialized.");
    setShowAlert(true);
    return;
  }
  const projectId = getCurrentProjectId();
  try {
    // If this is a loan repayment, update the loan document first
    if (transaction.type === 'Loan Repayment' && transaction.loanId) {
      const loansColRef = collection(
  db,
  "artifacts",
  projectId,
  "users",
  userId,
  "shg_groups",
  shgId,
  "loans"
);

const loanRef = doc(loansColRef, transaction.loanId);
const loanSnap = await getDoc(loanRef);
      if (loanSnap.exists()) {
        const loan = loanSnap.data();
        const principal = parseFloat(transaction.principalRepayment || transaction.principalRepaid || 0);
        const interest = parseFloat(transaction.interestRepayment || transaction.interestRepaid || 0);
        const totalRepayment = principal + interest;

        let newOutstanding = (loan.outstandingAmount || 0) - principal;
        let newTotalRepaid = (loan.totalRepaid || 0) + totalRepayment;
        let newStatus = loan.status || 'active';
        if (newOutstanding <= 0) {
          newOutstanding = 0;
          newStatus = 'closed';
        }

        await updateDoc(loanRef, {
          outstandingAmount: newOutstanding,
          totalRepaid: newTotalRepaid,
          status: newStatus,
          updatedAt: serverTimestamp(),
        });

      


    // fill memberId and description if not provided
    transaction.memberId = transaction.memberId || loan.memberId;
    transaction.description = transaction.description || `Repayment for loan (${loan.loanType}) to ${getMemberName(loan.memberId)}`;
  }
}

    // Build transaction document to save
    const txDoc = {
      type: transaction.type,
      memberId: transaction.memberId || null,
      loanId: transaction.loanId || null,
      // amount: prefer explicit amount, otherwise compute from principal+interest if present
      amount: transaction.amount ? parseFloat(transaction.amount) :
              (transaction.principalRepayment ? parseFloat(transaction.principalRepayment || 0) + parseFloat(transaction.interestRepayment || 0) : 0),
      principalRepaid: transaction.principalRepayment || transaction.principalRepaid || null,
      interestRepaid: transaction.interestRepayment || transaction.interestRepaid || null,
      savingType: transaction.savingType || null,
      loanType: transaction.loanType || null,
      category: transaction.category || null,
      date: transaction.date || new Date().toISOString().split('T')[0],
      description: transaction.description || transaction.Description || '',
      createdAt: serverTimestamp(),
      recordedBy: userId,
    };

    await addDoc(collection(db, `artifacts/${projectId}/users/${userId}/shg_groups/${shgId}/transactions`), txDoc);
    setAlertMessage(`${transaction.type} recorded successfully!`);
    setShowAlert(true);
  } catch (error) {
    console.error("addTransaction error:", error);
    setAlertMessage(`Error recording ${transaction.type}: ${error.message}`);
    setShowAlert(true);
  }
};

const recordSaving = async () => {
  if (!db || !userId || !shgId || !selectedMemberId || !savingAmount || isNaN(parseFloat(savingAmount)) || parseFloat(savingAmount) <= 0 || !savingType.trim()) {
    setAlertMessage("Please select a member, enter a valid positive saving amount, and select a saving type.");
    setShowAlert(true);
    return;
  }
  

  // delegate to unified helper
  await addTransaction({
    type: 'Saving',
    memberId: selectedMemberId,
    amount: parseFloat(savingAmount),
    date: savingDate,
    savingType: savingType
  });

  // clear form fields (addTransaction already sets success alert)
  setSelectedMemberId('');
  setSavingAmount('');
  setSavingDate(new Date().toISOString().split('T')[0]);
  setSavingType('Monthly Saving');
};

// Firebase helpers used: addDoc, collection
// Make sure at top of file you have: import { addDoc, collection } from "firebase/firestore";


const recordLoanRepayment = async () => {
  if (!selectedLoanId || !principalRepaymentAmount) {
    setAlertMessage("Please select a loan and enter repayment amounts.");
    setShowAlert(true);
    return;
  }

  try {
    const loan = loans.find((l) => l.id === selectedLoanId);
    if (!loan) {
      setAlertMessage("Loan not found.");
      setShowAlert(true);
      return;
    }

    const txColRef = collection(
      db,
      "artifacts",
      APP_ID,
      "users",
      userId,
      "shg_groups",
      shgId,
      "transactions"
    );

    const dateISO = repaymentDate || new Date().toISOString().split("T")[0];
    const principal = Number(principalRepaymentAmount) || 0;
    const interest = Number(interestRepaymentAmount) || 0;

    const txData = {
      type: "Loan Repayment",
      loanId: selectedLoanId,
      memberId: loan.memberId,
      loanType: loan.loanType || "Book Loan", // ✅ ensure included
      principalRepaid: principal,
      interestRepaid: interest,
      amount: principal + interest,
      date: dateISO,
      description: `Repayment for ${loan.loanType}`,
      createdAt: serverTimestamp(),
      recordedBy: userId,
    };

    await addDoc(txColRef, txData);

    // ✅ Update loan doc totals
    const loanRef = doc(
      db,
      "artifacts",
      APP_ID,
      "users",
      userId,
      "shg_groups",
      shgId,
      "loans",
      selectedLoanId
    );
    await updateDoc(loanRef, {
      outstandingAmount: (loan.outstandingAmount || 0) - principal,
      totalRepaid: (loan.totalRepaid || 0) + principal + interest,
    });

    setAlertMessage("Loan repayment recorded successfully!");
    setShowAlert(true);

    // Clear fields
    setSelectedLoanId("");
    setPrincipalRepaymentAmount("");
    setInterestRepaymentAmount("");
    setRepaymentDate("");
  } catch (err) {
    console.error("recordLoanRepayment error:", err);
    setAlertMessage(`Error recording repayment: ${err.message}`);
    setShowAlert(true);
  }
};
const recordExpense = async () => {
  if (!db || !userId || !shgId) {
    setAlertMessage("App not ready: DB/user/SHG not initialized.");
    setShowAlert(true);
    return;
  }
  if (!expenseAmount || Number(expenseAmount) <= 0) {
    setAlertMessage("Enter a valid expense amount.");
    setShowAlert(true);
    return;
  }

  try {
    const txColRef = collection(
      db,
      "artifacts",
      APP_ID,
      "users",
      userId,
      "shg_groups",
      shgId,
      "transactions"
    );

    const isoDate = expenseDate || new Date().toISOString().split("T")[0];
    await addDoc(txColRef, {
      type: "Expense",
      amount: Number(expenseAmount),
      category: expenseCategory || "Other",
      description: expenseDescription || "",
      date: isoDate,
      createdAt: serverTimestamp(),
      recordedBy: userId,
    });

    setAlertMessage("Expense recorded successfully!");
    setShowAlert(true);
    setExpenseAmount("");
    setExpenseDate("");
    setExpenseDescription("");
    setExpenseCategory("Other");
  } catch (err) {
    console.error("recordExpense error:", err);
    setAlertMessage(`Error: ${err.message || err}`);
    setShowAlert(true);
  }
};


      // Function to send a general WhatsApp reminder to all members with a mobile number
// 💬 General WhatsApp Reminder (place inside App, not outside)
// Send General WhatsApp Reminder
const sendGeneralWhatsAppReminder = () => {
  let allNumbers = members.map(m => m.mobile).filter(Boolean);
  if (allNumbers.length === 0) {
    setAlertMessage("No members with mobile numbers to send reminders.");
    setShowAlert(true);
    return;
  }

  // open the new modal instead of alert
  setShowReminderModal(true);
};

// Copy all numbers to clipboard
const handleCopyNumbers = () => {
  const allNumbers = members.map(m => m.mobile).filter(Boolean);
  if (allNumbers.length === 0) return;

  const numbersList = allNumbers.join(", ");
  navigator.clipboard.writeText(numbersList);
  setShowReminderModal(false);
  setAlertMessage("✅ All member numbers copied to clipboard!");
  setShowAlert(true);
};

// Send via WhatsApp with prefilled message
const handleSendWhatsApp = () => {
  const text = encodeURIComponent(reminderMessage);
  const allNumbers = members.map(m => m.mobile).filter(Boolean);
  if (allNumbers.length === 0) return;

  const whatsappUrl = `https://wa.me/?text=${text}`;
  window.open(whatsappUrl, "_blank");

  setShowReminderModal(false);
  setReminderMessage("");
};

// Calculate current balance
 const currentBalance = transactions.reduce((sum, transaction) => {
    if (
      transaction.type === 'Saving' ||
      transaction.type === 'General Saving' ||  // ✅ include donations/bank credits
      transaction.type === 'Loan Repayment' ||
      transaction.type === 'Fine'    // ✅ fines now increase balance
    ) {
      return sum + (transaction.amount || 0);
    }
    if (
      transaction.type === 'Loan Disbursed' ||
      transaction.type === 'Expense'
    ) {
      return sum - (transaction.amount || 0);
    }
    return sum;
  }, 0);

  // Calculate total outstanding loans
  const totalOutstandingLoans = loans.reduce((sum, loan) => {
    return sum + loan.outstandingAmount;
  }, 0);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="text-xl font-semibold">Loading App...</div>
      </div>
    );
  }

  // If login screen is to be shown, render it instead of the main app
  if (showLoginScreen) {
    return <LoginScreen auth={auth} setShowLoginScreen={setShowLoginScreen} setAlertMessage={setAlertMessage} setShowAlert={setShowAlert} />;
  }

 // Add here, line 908
const updateShgDetails = async (newData = {}) => {
  try {
    if (!db || !userId) {
      setAlertMessage("Cannot update SHG: not authenticated or DB not initialized.");
      setShowAlert(true);
      return false;
    }

    const projectId = getCurrentProjectId();
    const shgDocRef = doc(
      db,
      "artifacts",
      projectId,
      "users",
      userId,
      "shg_groups",
      "main"
    );

    await updateDoc(shgDocRef, {
      ...newData,
      updatedAt: serverTimestamp()
    });

    if (newData.name !== undefined) setShgName(newData.name);
    if (newData.logoUrl !== undefined) setShgLogoUrl(newData.logoUrl);

    setAlertMessage("SHG details updated.");
    setShowAlert(true);
    return true;
  } catch (err) {
    console.error("Error updating SHG details:", err);
    setAlertMessage(`Error updating SHG details: ${err.message || err}`);
    setShowAlert(true);
    return false;
  }
};

return (
  <FirebaseContext.Provider value={{ db, auth }}>
    <AuthContext.Provider value={{ userId }}>
      <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100">
        {/* 🔔 Alert / Confirmation Modal */}
        <AlertModal
          show={showAlert}
          message={alertMessage}
          onClose={() => {
            setShowAlert(false);
            setConfirmAction(null);
            setAlertCopyContent(null);
          }}
          confirmAction={confirmAction}
          confirmLabel="Confirm"
          copyContent={alertCopyContent}
        />

        {/* 🧭 Header */}
{/* Header */}
<header className="sticky top-0 z-40 bg-gradient-to-r from-blue-50 to-white shadow-md rounded-b-md p-3 md:p-4 flex flex-wrap items-center justify-between">
  {/* Left: Logo + Name */}
  <div
    onClick={() => setCurrentPage("dashboard")}
    className="flex items-center gap-3 flex-shrink-0 cursor-pointer hover:opacity-90 transition"
  >
    <img
  src={
    shgLogoUrl?.startsWith("http")
      ? shgLogoUrl
      : "https://drive.usercontent.google.com/download?id=1jjrW9TxuRSvCQc_IqFKDEsBHxs2DtDcb&export=view"
  }
  alt="SHG Logo"
  onError={(e) => (e.target.src = "/logo192.png")}
  className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border border-blue-200 shadow-sm hover:scale-105 transition-transform duration-300 bg-white"
/>

    <h1 className="text-xl md:text-3xl font-extrabold text-blue-700 tracking-wide">
      {shgName || "SHG Group"}
    </h1>
  </div>

  {/* Right: User info + Sign Out */}
  <div className="flex items-center gap-3 mt-2 md:mt-0">
    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full shadow-sm border border-gray-200">
      <img
        src={currentUser?.photoURL || "/default-avatar.png"}
        alt="User"
        className="w-8 h-8 rounded-full border border-gray-300"
      />
      <span className="text-sm md:text-base font-medium text-gray-700">
        {currentUser?.displayName || "User"}
      </span>
    </div>

<button
  onClick={() => setShowSignOutConfirm(true)}
  className="px-3 py-1.5 text-sm md:text-base bg-red-500 hover:bg-red-600 text-white rounded-md transition"
>
  Sign Out
</button>
{showSignOutConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
    <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 text-center transform transition-all duration-300 scale-100 hover:scale-[1.02]">
      <h2 className="text-xl font-bold text-blue-700 mb-3">Confirm Sign Out</h2>
      <p className="text-gray-600 mb-5">
        Are you sure you want to sign out?
      </p>
      <div className="flex justify-center gap-4">
        <button
          onClick={handleSignOut}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-all duration-200"
        >
          Yes, Sign Out
        </button>
        <button
          onClick={() => setShowSignOutConfirm(false)}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-4 py-2 rounded-lg shadow-sm transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

  </div>
</header>

        {/* 🌐 Page Content */}
<main
  className="flex-1 p-4 md:p-6 overflow-auto"
  style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
>
          {currentPage === "dashboard" && (
            <DashboardScreen
              shgName={shgName}
              shgId={shgId}
              memberCount={members.length}
              currentBalance={currentBalance}
              totalOutstandingLoans={totalOutstandingLoans}
              setCurrentPage={setCurrentPage}
              members={members}
              getMemberMobile={getMemberMobile}
              setAlertMessage={setAlertMessage}
              setShowAlert={setShowAlert}
              setAlertCopyContent={setAlertCopyContent}
              setConfirmAction={setConfirmAction}
              sendGeneralWhatsAppReminder={sendGeneralWhatsAppReminder}
              sbBalance={sbBalance}
              odBalance={odBalance}
              balance={sbBalance + odBalance}
            />
          )}

{currentPage === "shgProfile" && (
  <ShgProfileScreen
    shgName={shgName}
    db={db}
    userId={userId}
    currentUser={currentUser}
    shgId={shgId}
    shgLogoUrl={shgLogoUrl}
    setShgLogoUrl={setShgLogoUrl}
    updateShgDetails={updateShgDetails}
    deleteShg={deleteShg}
    setAlertMessage={setAlertMessage}
    setShowAlert={setShowAlert}
  />
)}
          {currentPage === "members" && (
            <MembersScreen
              members={members}
              openAddMemberModal={openAddMemberModal}
              openEditMemberModal={openEditMemberModal}
              deleteMember={handleDeleteMember}
              getMemberName={getMemberName}
              getMemberMobile={getMemberMobile}
              setAlertMessage={setAlertMessage}
              setShowAlert={setShowAlert}
            />
          )}

          {currentPage === "bookkeeping" && (
            <BookkeepingScreen
              members={members}
              transactions={transactions}
              loans={loans}
              getMemberName={getMemberName}
              fetchTransactions={fetchTransactions}
              exportTransactionsToXlsx={exportTransactionsToXlsx}
              setConfirmAction={setConfirmAction}
              getMemberMobile={getMemberMobile}
              setAlertMessage={setAlertMessage}
              setShowAlert={setShowAlert}
              // Saving
              selectedMemberId={selectedMemberId}
              setSelectedMemberId={setSelectedMemberId}
              savingAmount={savingAmount}
              setSavingAmount={setSavingAmount}
              savingDate={savingDate}
              setSavingDate={setSavingDate}
              savingType={savingType}
              setSavingType={setSavingType}
              recordSaving={recordSaving}
              // Repayment
              selectedLoanId={selectedLoanId}
              setSelectedLoanId={setSelectedLoanId}
              principalRepaymentAmount={principalRepaymentAmount}
              setPrincipalRepaymentAmount={setPrincipalRepaymentAmount}
              interestRepaymentAmount={interestRepaymentAmount}
              setInterestRepaymentAmount={setInterestRepaymentAmount}
              repaymentDate={repaymentDate}
              setRepaymentDate={setRepaymentDate}
              recordLoanRepayment={recordLoanRepayment}
              // Expense
              expenseAmount={expenseAmount}
              setExpenseAmount={setExpenseAmount}
              expenseDate={expenseDate}
              setExpenseDate={setExpenseDate}
              expenseDescription={expenseDescription}
              setExpenseDescription={setExpenseDescription}
              expenseCategory={expenseCategory}
              setExpenseCategory={setExpenseCategory}
              recordExpense={recordExpense}
              // Table hooks
              openEditTransaction={openEditTransaction}
              handleDeleteTransaction={handleDeleteTransaction}
              // Firebase & helpers
              db={db}
              shgId={shgId}
              userId={userId}
            />
          )}

          {currentPage === "addTransaction" && (
  <div className="p-6">
    <TransactionForm db={db} userId={userId} shgId={shgId} />
  </div>
)}



{currentPage === "reports" && (
  <ReportsScreen
    transactions={transactions}
    loans={loans}
    members={members}
    getMemberName={getMemberName}
    currentBalance={currentBalance}
    totalOutstandingLoans={totalOutstandingLoans}
    setAlertMessage={setAlertMessage}
    setShowAlert={setShowAlert}
    db={db}
    userId={userId}
    shgId={shgId}
    getCurrentProjectId={getCurrentProjectId}
    exportTransactionsToXlsx={exportTransactionsToXlsx}
    sbBalance={sbBalance}     // ✅ From App.js (computed centrally)
    odBalance={odBalance}     // ✅ From App.js (computed centrally)
  />
)}

          {currentPage === "meetings" && (
            <MeetingsScreen
              db={db}
              userId={userId}
              shgId={shgId || "main"}
              members={members}
            />
          )}

          {currentPage === "multiUserInfo" && <MultiUserAccessInfo />}

          {currentPage === "backup" && (
            <BackupScreen db={db} userId={userId} shgId={shgId || "main"} />
          )}
        </main>

        {/* 🧭 Bottom Navigation */}
        <BottomNav
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />

        {/* 🧍 Member Modal */}
        <MemberFormModal
          show={showMemberModal}
          onClose={() => setShowMemberModal(false)}
          onSubmit={addOrUpdateMember}
          editingMember={editingMember}
          newMemberName={newMemberName}
          setNewMemberName={setNewMemberName}
          newMemberMobile={newMemberMobile}
          setNewMemberMobile={setNewMemberMobile}
          newMemberEmail={newMemberEmail}
          setNewMemberEmail={setNewMemberEmail}
          newMemberJoiningDate={newMemberJoiningDate}
          setNewMemberJoiningDate={setNewMemberJoiningDate}
          newMemberAddress={newMemberAddress}
          setNewMemberAddress={setNewMemberAddress}
          newMemberDesignation={newMemberDesignation}
          setNewMemberDesignation={setNewMemberDesignation}
        />
        {/* WhatsApp Reminder Modal */}
{showReminderModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-2xl font-bold mb-3 text-gray-800 dark:text-gray-100 text-center">
        📱 Send WhatsApp Reminder
      </h2>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
        Type your reminder message below. You can send it directly via WhatsApp
        or copy all member numbers.
      </p>

      <textarea
        rows="4"
        className="w-full p-3 border rounded-lg mb-4 dark:bg-gray-700 dark:text-white"
        placeholder="Enter your reminder message..."
        value={reminderMessage}
        onChange={(e) => setReminderMessage(e.target.value)}
      ></textarea>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
  💾 This message is auto-saved for next time.
</p>


      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button
          onClick={() => handleSendWhatsApp()}
          disabled={!reminderMessage.trim()}
          className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md disabled:bg-gray-400"
        >
          💬 Send via WhatsApp
        </button>

        <button
          onClick={handleCopyNumbers}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md"
        >
          📋 Copy Numbers
        </button>

        <button
          onClick={() => setShowReminderModal(false)}
          className="px-5 py-2 bg-gray-300 hover:bg-gray-400 rounded-md"
        >
              Cancel
             </button>
            </div>
          </div>
          </div>
         )}

      </div>
    </AuthContext.Provider>
  </FirebaseContext.Provider>
);
}

// Login Screen Component 
 const LoginScreen = ({ auth, setAlertMessage, setShowAlert }) => {
  const handleGoogleSignIn = async () => {
    if (!auth) {
      setAlertMessage("Firebase Auth is not initialized.");
      setShowAlert(true);
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setAlertMessage("Signed in with Google successfully!");
      setShowAlert(true);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      let errorMessage = "Failed to sign in with Google.";
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Google sign-in popup was closed.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Sign-in already in progress or popup blocked.";
      }
      setAlertMessage(`${errorMessage} Please try again. Error: ${error.message}`);
      setShowAlert(true);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 mb-6">Welcome to SHG Manager</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-8">
          Sign in to access your Self-Help Group data.
        </p>
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-200 ease-in-out text-lg font-semibold mb-4"
        >
          {/* eslint-disable-next-line no-undef */} 
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.24 10.27c.45 0 .9-.05 1.33-.14C14.77 8.92 15.65 7.18 15.65 5c0-1.72-.47-3.32-1.3-4.5h-.01c.62.9 1 2 1 3.12 0 2.92-2.18 5.37-5 5.37-1.3 0-2.48-.48-3.4-1.29-.86-.77-1.4-1.85-1.4-3.08 0-2.28 1.45-4.22 3.48-5.11 1.9-.84 4.09-.59 5.86.64.9.61 1.63 1.48 2.12 2.47a.78.78 0 0 0 1.25-.56.78.78 0 0 0-.56-1.25c-.75-1.12-1.8-2.06-3.04-2.67C12.19 0 9.77.26 7.7 1.49c-2.47 1.55-3.9 4.34-3.9 7.42 0 1.93.58 3.73 1.6 5.23 1 1.4 2.5 2.53 4.1 3.15.7.26 1.4.39 2.1.39.22 0 .44-.01.66-.03.7-.09 1.39-.24 2.05-.44 1.1-.34 2.11-.86 3.03-1.6.45-.37.86-.78 1.22-1.2.3-.33.56-.69.76-1.07.1-.19.2-.38.28-.58.07-.18.12-.37.17-.56.04-.15.08-.3.1-.46.02-.09.04-.19.05-.28.01-.06.02-.12.02-.19l.01-.06V12.92c0-.52-.4-.95-.92-.95H12.24zM12 12c-2.67 0-4.85-2.18-4.85-4.85s2.18-4.85 4.85-4.85 4.85 2.18 4.85 4.85S14.67 12 12 12z"/></svg>
          <span>Sign In with Google</span>
        </button>
      </div>
    </div>
  );
};



// Dashboard Screen Component


const DashboardScreen = ({
  shgName,
  shgId,
  memberCount,
  currentBalance,
  totalOutstandingLoans,
  setCurrentPage,
  members,
  getMemberMobile,
  setAlertMessage,
  setShowAlert,
  setAlertCopyContent,
  setConfirmAction,
  sendGeneralWhatsAppReminder,
  sbBalance = 0,
  odBalance = 0,
  balance = 0, // ✅ combined total already computed in App.js
}) => {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg animate-fade-in">
      {/* Header */}
      <h2 className="text-3xl font-extrabold text-blue-800 dark:text-blue-300 mb-6">
        Welcome, {shgName}!
      </h2>

{/* Main stats - compact height */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
  <StatCard
    title="Total Members"
    value={memberCount}
    icon="👥"
    color="bg-green-100 dark:bg-green-700 text-green-800 dark:text-green-200"
    className="p-3 text-base"
  />
  <StatCard
    title="Total Combined Balance"
    value={`₹ ${formatINR(currentBalance)}`}
    icon="📊"
    color="bg-blue-100 dark:bg-blue-700 text-blue-800 dark:text-blue-200"
    className="p-3 text-base"
  />
  <StatCard
    title="Outstanding Loans"
    value={`₹ ${formatINR(totalOutstandingLoans)}`}
    icon="💸"
    color="bg-red-100 dark:bg-red-700 text-red-800 dark:text-red-200"
    className="p-3 text-base"
  />
</div>

{/* Account balances - compact */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
  <div className="rounded-lg shadow-sm p-3 bg-blue-50 dark:bg-blue-900/20">
    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">🏦 SB Account</h4>
    <p className="text-2xl font-bold text-blue-600 dark:text-blue-300 mt-1">
      ₹{formatINR(sbBalance)}
    </p>
  </div>

  <div className="rounded-lg shadow-sm p-3 bg-purple-50 dark:bg-purple-900/20">
    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">💳 OD Account</h4>
    <p className="text-2xl font-bold text-purple-600 dark:text-purple-300 mt-1">
      ₹{formatINR(odBalance)}
    </p>
  </div>
</div>

     {/* Quick Actions Section */}
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActionButton
          label="View Members"
          icon="👥"
          onClick={() => setCurrentPage("members")}
        />
        <ActionButton
          label="Record Saving"
          icon="💰"
          onClick={() => setCurrentPage("bookkeeping")}
        />
        <ActionButton
  label="Add Transaction"
  icon="🧾"
  onClick={() => setCurrentPage("addTransaction")}
/>

        <ActionButton
          label="New Loan"
          icon="💸"
          onClick={() => setCurrentPage("bookkeeping")}
        />
        <ActionButton
          label="Record Expense"
          icon="➖"
          onClick={() => setCurrentPage("bookkeeping")}
        />
        <ActionButton
          label="View Reports"
          icon="📈"
          onClick={() => setCurrentPage("reports")}
        />
        <ActionButton
          label="Schedule Meeting"
          icon="🗓️"
          onClick={() => setCurrentPage("meetings")}
        />
      </div>
    </div>
  );
};


const StatCard = ({ title, value, icon, color }) => (
  <div className={`p-5 rounded-lg shadow-md flex items-center space-x-4 ${color}`}>
    <span className="text-4xl">{icon}</span>
    <div>
      <h4 className="text-sm font-medium opacity-80">{title}</h4>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

const ActionButton = ({ label, icon, onClick, color = "bg-blue-500 hover:bg-blue-600" }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center p-4 text-white rounded-lg shadow-md ${color} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 ease-in-out text-lg font-semibold`}
  >
    <span className="mr-2 text-2xl">{icon}</span> {label}
  </button>
);

// SHG Profile Screen Component

const ShgProfileScreen = ({
  shgName,
  db, userId, shgId, currentUser, shgLogoUrl, setShgLogoUrl,
  updateShgDetails,
  deleteShg,
}) => {
  const [editingName, setEditingName] = useState(shgName);
  const [editingLogoUrl, setEditingLogoUrl] = useState(shgLogoUrl);
  

  useEffect(() => {
    setEditingName(shgName);
    setEditingLogoUrl(shgLogoUrl);
  }, [shgName, shgLogoUrl]);

  const handleUpdate = () => {
    updateShgDetails({
      name: editingName,
      logoUrl: editingLogoUrl, // ✅ Just saves the URL you paste
    });
    alert("✅ SHG Profile updated successfully!");
  };

  const handleDelete = () => {
    deleteShg();
  };
  const [uploadProgress, setUploadProgress] = useState(0);
const [uploading, setUploading] = useState(false);

const handleLogoUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!db) {
    alert("❌ Firestore not initialized. Please try again later.");
    return;
  }

  setUploading(true);
  setUploadProgress(0);

  try {
    const projectId = db?.app?.options?.projectId || "shg-bookkeeping-app";
    const uid = userId || currentUser?.uid;
    const shgGroupId = "main";

    if (!projectId || !uid) {
      alert("❌ Upload failed: missing user or project ID");
      setUploading(false);
      return;
    }

    const fileRef = ref(
      storage,
      `artifacts/${projectId}/logos/${Date.now()}_${file.name}`
    );

    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload failed:", error);
        alert("❌ Logo upload failed");
        setUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setUploading(false);
        setUploadProgress(100);

        // ✅ Proper Firestore doc ref
        const shgDocRef = doc(
          db,
          "artifacts",
          projectId,
          "users",
          uid,
          "shg_groups",
          shgGroupId
        );

        await updateDoc(shgDocRef, { logoUrl: downloadURL });
        setShgLogoUrl(downloadURL);
        alert("✅ SHG logo updated successfully!");
      }
    );
  } catch (err) {
    console.error("Error uploading logo:", err);
    alert("❌ Something went wrong during upload!");
    setUploading(false);
  }
};


  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg animate-fade-in">
      <h2 className="text-3xl font-extrabold text-blue-800 dark:text-blue-300 mb-6">
        SHG Profile
      </h2>

      <div className="space-y-6">
        {/* SHG Name */}
        <div>
          <label
            htmlFor="shgName"
            className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            SHG Name
          </label>
          <input
            type="text"
            id="shgName"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

{/* SHG Logo Upload */}
<div className="space-y-2">
  <label className="block font-semibold text-gray-700">SHG Logo</label>
  <div className="flex items-center gap-4">
    <img
      src={
        shgLogoUrl ||
        "https://firebasestorage.googleapis.com/v0/b/YOUR_DEFAULT_IMAGE_PATH"
      }
      alt="SHG Logo Preview"
      className="w-16 h-16 rounded-full border border-gray-300 object-cover shadow-sm"
    />
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleLogoUpload}
        disabled={uploading}
        className="block text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 file:mr-2 file:py-1 file:px-3 file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
      />
      {uploading && (
        <p className="text-sm text-gray-500 mt-1">
          Uploading... {Math.round(uploadProgress)}%
        </p>
      )}
    </div>
  </div>
</div>

        {/* SHG ID */}
        <div>
          <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            SHG ID
          </label>
          <p className="font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md text-sm break-all">
            {shgId}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-4 pt-4">
          <button
            onClick={handleUpdate}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-200 ease-in-out text-lg font-semibold"
          >
            Save Changes
          </button>
          <button
            onClick={handleDelete}
            className="px-6 py-3 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition duration-200 ease-in-out text-lg font-semibold"
          >
            Delete SHG
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
