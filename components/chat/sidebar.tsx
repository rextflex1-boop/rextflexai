"use client";

import {
  LogOutIcon,
  MenuIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  Share2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import type { SessionSummary } from "@/lib/db";
import type { ChatUser } from "./rextflex-chat";
import { SettingsDialog } from "./settings-dialog";

export function Sidebar({
  activeSessionId,
  user,
}: {
  readonly activeSessionId?: string;
  readonly user: ChatUser;
}) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [search, setSearch] = useState("");

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => (session.title ?? "new chat").toLowerCase().includes(query));
  }, [sessions, search]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data: { sessions?: SessionSummary[] }) => {
        if (!cancelled) setSessions(data.sessions ?? []);
      })
      .catch(() => {
        // Sessions API not reachable (e.g. DATABASE_URL missing) — show an empty list.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleRename = async (session: SessionSummary) => {
    const nextTitle = window.prompt("Rename chat", session.title ?? "");
    if (!nextTitle || nextTitle.trim().length === 0) return;

    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, title: nextTitle } : s)));
    try {
      await fetch(`/api/sessions/${session.id}`, {
        body: JSON.stringify({ title: nextTitle }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
    } catch {
      // Best-effort — the row already updated optimistically.
    }
  };

  const handleShare = async (session: SessionSummary) => {
    try {
      await fetch(`/api/sessions/${session.id}`, {
        body: JSON.stringify({ isPublic: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
    } catch {
      // Best-effort — still try to give them the link below.
    }

    const url = `${window.location.origin}/share/${session.id}`;
    try {
      await navigator.clipboard.writeText(url);
      window.alert("Share link copied to clipboard!");
    } catch {
      window.prompt("Copy this link to share the chat:", url);
    }
  };

  const handleDelete = async (session: SessionSummary) => {
    if (!window.confirm("Delete this chat? This can't be undone.")) return;

    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    try {
      await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
    } catch {
      // Best-effort — row is already gone from the visible list.
    }
    if (session.id === activeSessionId) {
      window.location.assign("/");
    }
  };

  return (
    <>
      <Button
        aria-label="Open menu"
        className="pointer-events-auto fixed top-3 left-4 z-30"
        onClick={() => setOpen(true)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <MenuIcon className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-40 flex">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            type="button"
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r bg-background">
            <div className="flex items-center justify-between border-b p-3">
              <span className="font-medium text-sm">RextFlex Ai</span>
              <Button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <XIcon className="size-4" />
              </Button>
            </div>

            <div className="space-y-1 border-b p-2">
              <a
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                href="/"
              >
                <PlusIcon className="size-4" />
                New chat
              </a>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {sessions.length > 0 ? (
                <div className="relative mb-1 px-1">
                  <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 size-3.5 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-sm"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search chats"
                    value={search}
                  />
                </div>
              ) : null}
              <p className="px-2 py-1 text-muted-foreground text-xs uppercase tracking-wide">Chats</p>
              {filteredSessions.length === 0 ? (
                <p className="px-2 py-2 text-muted-foreground text-sm">
                  {sessions.length === 0 ? "No chats yet." : "No matches."}
                </p>
              ) : (
                filteredSessions.map((session) => (
                  <div
                    className="group flex items-center gap-1 rounded-md px-2 py-2 hover:bg-muted"
                    key={session.id}
                  >
                    <a className="min-w-0 flex-1 truncate text-sm" href={`/s/${session.id}`}>
                      {session.title || "New chat"}
                    </a>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label="Chat options"
                          className="opacity-0 group-hover:opacity-100"
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <MoreVerticalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => void handleRename(session)}>
                          <PencilIcon className="size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void handleShare(session)}>
                          <Share2Icon className="size-4" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void handleDelete(session)}
                          variant="destructive"
                        >
                          <Trash2Icon className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1 border-t p-2">
              <div className="flex items-center gap-2 px-2 py-1.5">
                {user.image ? (
                  // biome-ignore lint: simple avatar, no need for next/image here
                  <img alt="" className="size-6 shrink-0 rounded-full" src={user.image} />
                ) : (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
                  {user.email}
                </span>
              </div>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                onClick={() => setSettingsOpen(true)}
                type="button"
              >
                <SettingsIcon className="size-4" />
                Settings
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                onClick={() => void authClient.signOut().then(() => window.location.assign("/sign-in"))}
                type="button"
              >
                <LogOutIcon className="size-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <SettingsDialog onOpenChange={setSettingsOpen} open={settingsOpen} />
    </>
  );
}
