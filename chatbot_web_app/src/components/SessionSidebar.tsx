import React, { useMemo } from "react";
import { formatDistanceToNow, isToday, isYesterday, isWithinInterval, subDays } from "date-fns";
import { ChatSession } from "../types/chat";

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

type GroupedSessions = {
  label: string;
  sessions: ChatSession[];
};

function groupSessions(sessions: ChatSession[]): GroupedSessions[] {
  const now = new Date();
  const groups: GroupedSessions[] = [
    { label: "Hôm nay", sessions: [] },
    { label: "Hôm qua", sessions: [] },
    { label: "7 ngày trước", sessions: [] },
    { label: "Cũ hơn", sessions: [] },
  ];

  for (const session of sessions) {
    const date = session.last_activity ? new Date(session.last_activity) : new Date(session.created_at);
    if (isToday(date)) {
      groups[0].sessions.push(session);
    } else if (isYesterday(date)) {
      groups[1].sessions.push(session);
    } else if (isWithinInterval(date, { start: subDays(now, 7), end: now })) {
      groups[2].sessions.push(session);
    } else {
      groups[3].sessions.push(session);
    }
  }

  return groups.filter((g) => g.sessions.length > 0);
}

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

const SessionItem: React.FC<{
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ session, isActive, onSelect, onDelete }) => {
  const date = session.last_activity ? new Date(session.last_activity) : new Date(session.created_at);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });
  const preview = session.preview
    ? truncate(session.preview, 45)
    : truncate(session.id, 20);

  return (
    <div
      className={`group relative flex flex-col px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-orange-50 dark:bg-gray-700"
          : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
      onClick={onSelect}
    >
      <span className="text-sm text-slate-800 dark:text-slate-200 leading-snug pr-6 truncate">
        {preview}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{timeAgo}</span>

      {/* Delete button — shown on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
        title="Xóa cuộc trò chuyện"
      >
        <span className="material-symbols-outlined text-base leading-none">close</span>
      </button>
    </div>
  );
};

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewChat,
  onDeleteSession,
  isOpen,
  onToggle,
}) => {
  const groupedSessions = useMemo(() => groupSessions(sessions), [sessions]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-30 md:z-auto top-0 left-0 h-full flex flex-col bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 overflow-hidden ${
          isOpen ? "w-64" : "w-0 md:w-0"
        }`}
      >
        <div className="flex flex-col h-full min-w-[16rem]">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img
                src="/avatar.png"
                alt="Chatbot Logo"
                className="w-7 h-7 rounded-full object-cover"
              />
              <span className="font-semibold text-sm" style={{ color: '#E87722' }}>VietLegal</span>
            </div>
            {/* Sidebar close/toggle icon */}
            <button
              onClick={onToggle}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Ẩn thanh bên"
            >
              <span className="material-symbols-outlined text-xl leading-none">chevron_left</span>
            </button>
          </div>

          {/* New conversation button — above session list */}
          <div className="px-2 pt-2 pb-1 shrink-0">
            <button
              onClick={onNewChat}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: "#E87722" }}
            >
              <span className="material-symbols-outlined text-base leading-none">edit_square</span>
              Cuộc trò chuyện mới
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
            {groupedSessions.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 px-2 py-4 text-center">
                Chưa có cuộc trò chuyện nào
              </p>
            ) : (
              groupedSessions.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-2 mb-1 uppercase tracking-wide">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.sessions.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isActive={session.id === activeSessionId}
                        onSelect={() => onSessionSelect(session.id)}
                        onDelete={() => onDeleteSession(session.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default SessionSidebar;
