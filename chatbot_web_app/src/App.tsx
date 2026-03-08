import React, { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import Chat from "./components/Chat";
import SessionSidebar from "./components/SessionSidebar";
import { v4 as uuidv4 } from "uuid";
import { ChatSession } from "./types/chat";
import apiService from "./services/api.service";
import "./App.css";

const SESSION_KEY = "chatbotVietLegalSessionId";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

function App() {
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await apiService.getActiveSessions();
      setSessions(data.sessions);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    }
  }, []);

  useEffect(() => {
    // Restore or create session on mount
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      setActiveSessionId(saved);
    } else {
      const newId = uuidv4();
      localStorage.setItem(SESSION_KEY, newId);
      setActiveSessionId(newId);
      apiService.createSession(newId).catch(() => {});
    }

    // Dark mode preference
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    }

    fetchSessions();
  }, [fetchSessions]);

  const handleNewChat = useCallback(async () => {
    const newId = uuidv4();
    try {
      await apiService.createSession(newId);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
    localStorage.setItem(SESSION_KEY, newId);
    setActiveSessionId(newId);
    await fetchSessions();
    // Close sidebar on mobile after selecting
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [fetchSessions]);

  const handleSessionSelect = useCallback(
    (sessionId: string) => {
      localStorage.setItem(SESSION_KEY, sessionId);
      setActiveSessionId(sessionId);
      fetchSessions();
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    },
    [fetchSessions]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await apiService.deleteSession(sessionId);
      } catch (err) {
        console.error("Failed to delete session:", err);
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      // If deleted session was active, start a new one
      if (sessionId === activeSessionId) {
        await handleNewChat();
      }
    },
    [activeSessionId, handleNewChat]
  );

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem("darkMode", String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className="flex h-screen font-display transition-colors duration-300 overflow-hidden"
        style={{
          background: isDarkMode
            ? "linear-gradient(90deg, #1a5a8a, #a54520, #b88924)"
            : "linear-gradient(90deg, #2280c3, #d95c26, #e8b130)",
        }}
      >
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
        />

        <div className="flex-1 overflow-hidden min-w-0">
          {activeSessionId && (
            <Chat
              key={activeSessionId}
              sessionId={activeSessionId}
              onToggleDarkMode={toggleDarkMode}
              isDarkMode={isDarkMode}
              onSidebarToggle={() => setSidebarOpen((o) => !o)}
              isSidebarOpen={sidebarOpen}
              onMessageSent={fetchSessions}
            />
          )}
        </div>
      </div>

      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

export default App;
