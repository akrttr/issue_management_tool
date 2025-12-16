import { useState, useEffect } from "react";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import TicketsTable from "./components/TicketsTable.jsx";
import Navigation from "./components/Navigation.jsx";
import TicketDetail from "./components/TicketDetail.jsx";
import UserList from "./components/UserList.jsx";
import UserForm from "./components/UserForm.jsx";
import ProfilePage from './components/ProfilePage';
import ProgressRequestsTable from "./components/ProgressRequestsTable.jsx";
import PauseManagement from "./components/PauseManagement.jsx";
import ProgressRequestManagement from "./components/ProgressRequestManagement.jsx";
import ActivityCalendar from "./components/ActivityCalendar.jsx";
import SatelliteTracker from './components/SatelliteTracker';



import { ToastContainer, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentPage, setCurrentPage] = useState("dashboard");
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState("new");
    const [currentUserId, setCurrentUserId] = useState(null);
    const [refreshTickets, setRefreshTickets] = useState(0);

    // ---------- INIT AUTH + INITIAL HISTORY STATE ----------
    useEffect(() => {
        const token = localStorage.getItem("token");
        const refreshToken = localStorage.getItem("refreshToken");

        if (token && refreshToken) {
            setIsAuthenticated(true);

            const initialPage = "dashboard";
            window.history.replaceState(
                { page: initialPage, state: {} },
                "",
                `/${initialPage}`
            );
        }
    }, []);


    useEffect(() => {
        const token = localStorage.getItem("token");
        const refreshToken = localStorage.getItem("refreshToken");
        if (token && refreshToken) {
            setIsAuthenticated(true);

            // initial history entry = dashboard
            const initialPage = "dashboard";
            window.history.replaceState(
                { page: initialPage, state: {} },
                "",
                `/${initialPage}`
            );
        }
    }, []);

    // Helper that applies navigation to React state
    const applyNavigation = (page, state = {}) => {
        setCurrentPage(page);

        if (page === "ticket-detail") {
            setSelectedTicketId(state.ticketId ?? null);
        } else if (page === "tickets") {
            setSelectedTicketId(null);
        }

        if (page === "user-form") {
            setSelectedUserId(state.userId ?? "new");
        } else if (page === "users") {
            setSelectedUserId(null);
        }
    };

    // ---------- BROWSER BACK/FORWARD SUPPORT ----------
    useEffect(() => {
        const handlePopState = (event) => {
            const page = event.state?.page || "dashboard";
            const state = event.state?.state || {};
            applyNavigation(page, state);
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Push to history + apply navigation
    const navigateWithHistory = (page, state = {}) => {
        window.history.pushState({ page, state }, "", `/${page}`);
        applyNavigation(page, state);
    };

    const handleLogin = (data) => {
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('displayName', data.displayName);
        localStorage.setItem('role', data.role);
        setIsAuthenticated(true);


        // after login make sure we start at dashboard in history
        const initialPage = "dashboard";
        window.history.replaceState(
            { page: initialPage, state: {} },
            "",
            `/${initialPage}`
        );
    };

    // Used by Navigation and some children
    const handleNavigate = (page, state = {}) => {
        navigateWithHistory(page, state);
    };

    // ---------- TICKETS ----------
    const handleViewTicket = (ticketId) => {
        navigateWithHistory("ticket-detail", { ticketId });
    };

    const handleEditTicket = (ticketId) => {
        navigateWithHistory("ticket-detail", { ticketId });
    };

    const handleCreateTicket = () => {
        navigateWithHistory("ticket-detail", { ticketId: "new" });
    };

    const handleCloseTicketDetail = () => {
        // refresh data, then go back to previous history entry
        setRefreshTickets((prev) => prev + 1);
        window.history.back();   // popstate listener will call applyNavigation
    };

    // ---------- USERS ----------
    const handleViewUser = (userId) => {
        console.log("Viewing user:", userId);
        // if you later add a separate user-detail page, navigate here similarly
        navigateWithHistory("user-form", { userId });
    };

    const handleEditUser = (userId) => {
        console.log("Editing user:", userId);
        setCurrentUserId(userId);
        navigateWithHistory("user-form", { userId });
    };

    const handleCreateUser = () => {
        navigateWithHistory("user-form", { userId: "new" });
    };

    const handleManagePermissions = (userId) => {
        // keep as-is if you later implement this page
        navigateWithHistory("user-permissions", { userId });
    };

    const handleCloseUserForm = () => {
        // just go back in browser history
        window.history.back();
    };

    const handleDeleteUser = (userID) => {
        console.log("handleDeleteUser");
        console.log(userID);
    };

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div>
            <Navigation currentPage={currentPage} onNavigate={handleNavigate} />

            <main>
                {currentPage === "dashboard" && (
                    <Dashboard
                        onCreateTicket={handleCreateTicket}
                        onNavigate={handleNavigate}
                    />
                )}

                {currentPage === "tickets" && (
                    <TicketsTable
                        onViewTicket={handleViewTicket}
                        onEditTicket={handleEditTicket}
                        onCreateTicket={handleCreateTicket}
                        refreshTrigger={refreshTickets}
                    />
                )}

                {currentPage === "ticket-detail" && (
                    <TicketDetail
                        ticketId={selectedTicketId}
                        onClose={handleCloseTicketDetail}
                        onNavigate={handleNavigate}

                    />
                )}

                {currentPage === "progress-requests" && (
                    <ProgressRequestsTable onNavigate={handleNavigate} />
                )}

                {currentPage === "calendar" && (
                    <ActivityCalendar onNavigate={handleNavigate} />
                )}

                {currentPage === "users" && (
                    <UserList
                        onViewUser={handleViewUser}
                        onEditUser={handleEditUser}
                        onCreateUser={handleCreateUser}
                        onDeleteUser={handleDeleteUser}
                        onManagePermissions={handleManagePermissions}
                    />
                )}

                {currentPage === "profile" && <ProfilePage />}

                {currentPage === "pause-management" && (
                    <PauseManagement
                        onViewTicket={handleViewTicket}
                        onNavigate={handleNavigate}
                    />
                )}

                {currentPage === "progress-management" && (
                    <ProgressRequestManagement
                        onViewTicket={handleViewTicket}
                        onNavigate={handleNavigate}
                    />
                )}

                {currentPage === "user-form" && (
                    <UserForm
                        userId={selectedUserId}
                        onClose={handleCloseUserForm}
                        onSave={() => {
                            handleCloseUserForm();
                            // Optionally refresh user list
                        }}
                    />
                )}
                <ToastContainer
                    position="top-right"
                    autoClose={4000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="colored"
                    transition={Slide}

                />

                {currentPage === "satellite-tracker" && (
                    <SatelliteTracker />

                )}

            </main>
        </div>
    );
}

export default App;
