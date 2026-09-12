"use client";

import { CopyIcon, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const TONE_PRESETS = ["Professional", "Friendly & casual", "Concise", "Enthusiastic"];

type Persona = { readonly id: string; readonly instructions: string; readonly name: string };

export function SettingsDialog({
  onOpenChange,
  open,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [tone, setTone] = useState("");
  const [savedTone, setSavedTone] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
  const [promptDraft, setPromptDraft] = useState("");
  const [usage, setUsage] = useState<{ userMessages: number; assistantMessages: number; totalChars: number }>({ userMessages: 0, assistantMessages: 0, totalChars: 0 });

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [showNewPersona, setShowNewPersona] = useState(false);
  const [newName, setNewName] = useState("");
  const [newInstructions, setNewInstructions] = useState("");

  useEffect(() => {
    setTheme(getStoredTheme());
    try {
      const raw = localStorage.getItem("rextflex:saved-prompts");
      setSavedPrompts(raw ? JSON.parse(raw) : []);
      const usageRaw = localStorage.getItem("rextflex:usage");
      if (usageRaw) setUsage(JSON.parse(usageRaw));
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: { tone?: string }) => {
        setTone(data.tone ?? "");
        setSavedTone(data.tone ?? "");
      })
      .catch(() => {
        // Settings API not reachable (e.g. DATABASE_URL missing) — leave blank.
      });

    fetch("/api/personas")
      .then((res) => res.json())
      .then((data: { activePersonaId: string | null; personas?: Persona[] }) => {
        setPersonas(data.personas ?? []);
        setActivePersonaId(data.activePersonaId);
      })
      .catch(() => {
        // Personas API not reachable — leave the list empty.
      });
  }, [open]);

  const selectTheme = (mode: ThemeMode) => {
    setTheme(mode);
    applyTheme(mode);
  };

  const saveTone = async () => {
    setStatus("saving");
    try {
      await fetch("/api/settings", {
        body: JSON.stringify({ tone }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      setSavedTone(tone);
      setStatus("saved");
    } catch {
      setStatus("idle");
    }
  };

  const selectPersona = async (personaId: string | null) => {
    setActivePersonaId(personaId);
    try {
      await fetch("/api/personas/active", {
        body: JSON.stringify({ personaId }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
    } catch {
      // Best-effort — the UI already reflects the choice.
    }
  };

  const createPersona = async () => {
    if (!newName.trim() || !newInstructions.trim()) return;
    try {
      const res = await fetch("/api/personas", {
        body: JSON.stringify({ instructions: newInstructions, name: newName }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data: { id?: string } = await res.json();
      if (data.id) {
        const created = { id: data.id, instructions: newInstructions, name: newName };
        setPersonas((prev) => [...prev, created]);
        await selectPersona(created.id);
      }
    } catch {
      // Best-effort — form stays open so they can retry.
      return;
    }
    setNewName("");
    setNewInstructions("");
    setShowNewPersona(false);
  };

  const removePersona = async (persona: Persona) => {
    setPersonas((prev) => prev.filter((p) => p.id !== persona.id));
    if (activePersonaId === persona.id) setActivePersonaId(null);
    try {
      await fetch(`/api/personas/${persona.id}`, { method: "DELETE" });
    } catch {
      // Best-effort — already removed from the visible list.
    }
  };

  const hasChanges = tone !== savedTone;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Ye app ke sabhi chats pe apply hoga.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <div className="space-y-2">
            <span className="font-medium text-sm">Usage</span>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-2"><div className="text-lg font-semibold">{usage.userMessages}</div><div className="text-muted-foreground text-[11px]">Your messages</div></div>
              <div className="rounded-lg border p-2"><div className="text-lg font-semibold">{usage.assistantMessages}</div><div className="text-muted-foreground text-[11px]">AI replies</div></div>
              <div className="rounded-lg border p-2"><div className="text-lg font-semibold">{usage.totalChars.toLocaleString()}</div><div className="text-muted-foreground text-[11px]">Characters</div></div>
            </div>
            <p className="text-muted-foreground text-xs">Local usage tracking for this device.</p>
          </div>

          <div className="space-y-2">
            <span className="font-medium text-sm">Shortcuts & workflow</span>
            <p className="text-muted-foreground text-xs">Enter to send • Shift+Enter for a new line • Stop uses the same send button while generating.</p>
          </div>

          <div className="space-y-2">
            <span className="font-medium text-sm">Theme</span>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((mode) => (
                <Button
                  className="flex-1 capitalize"
                  key={mode}
                  onClick={() => selectTheme(mode)}
                  size="sm"
                  type="button"
                  variant={theme === mode ? "default" : "outline"}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="font-medium text-sm">Persona</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  activePersonaId === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => void selectPersona(null)}
                type="button"
              >
                Default
              </button>
              {personas.map((persona) => (
                <div className="group relative" key={persona.id}>
                  <button
                    className={cn(
                      "rounded-full border py-1 pr-6 pl-2.5 text-xs transition-colors",
                      activePersonaId === persona.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => void selectPersona(persona.id)}
                    type="button"
                  >
                    {persona.name}
                  </button>
                  <button
                    aria-label={`Delete ${persona.name}`}
                    className="-translate-y-1/2 absolute top-1/2 right-1.5 rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                    onClick={() => void removePersona(persona)}
                    type="button"
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              ))}
              <button
                className="flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-muted-foreground text-xs hover:text-foreground"
                onClick={() => setShowNewPersona((v) => !v)}
                type="button"
              >
                <PlusIcon className="size-3" />
                New
              </button>
            </div>

            {showNewPersona ? (
              <div className="space-y-2 rounded-md border p-2">
                <Input
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Persona name, e.g. Coding mode"
                  value={newName}
                />
                <Textarea
                  onChange={(event) => setNewInstructions(event.target.value)}
                  placeholder="Instructions, e.g. Answer with code first, explanation after. Be terse."
                  rows={2}
                  value={newInstructions}
                />
                <Button
                  disabled={!newName.trim() || !newInstructions.trim()}
                  onClick={() => void createPersona()}
                  size="sm"
                  type="button"
                >
                  Save persona
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <span className="font-medium text-sm">Saved prompts</span>
            <div className="flex gap-2">
              <Input onChange={(event) => setPromptDraft(event.target.value)} placeholder="Save a reusable prompt…" value={promptDraft} />
              <Button
                disabled={!promptDraft.trim()}
                onClick={() => {
                  const next = [...savedPrompts, promptDraft.trim()].slice(-20);
                  setSavedPrompts(next);
                  localStorage.setItem("rextflex:saved-prompts", JSON.stringify(next));
                  setPromptDraft("");
                }}
                size="sm"
                type="button"
              >Save</Button>
            </div>
            {savedPrompts.length ? (
              <div className="space-y-1">
                {savedPrompts.map((prompt) => (
                  <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs" key={prompt}>
                    <span className="min-w-0 flex-1 truncate">{prompt}</span>
                    <button
                      aria-label="Use saved prompt"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("rextflex:insert-prompt", { detail: prompt }));
                        onOpenChange(false);
                      }}
                      type="button"
                    >Use</button>
                    <button
                      aria-label="Copy saved prompt"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => void navigator.clipboard.writeText(prompt)}
                      type="button"
                    ><CopyIcon className="size-3.5" /></button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <span className="font-medium text-sm">AI tone (used when no persona is selected)</span>
            <div className="flex flex-wrap gap-1.5">
              {TONE_PRESETS.map((preset) => (
                <button
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    tone === preset
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  key={preset}
                  onClick={() => setTone(preset)}
                  type="button"
                >
                  {preset}
                </button>
              ))}
            </div>
            <Textarea
              onChange={(event) => setTone(event.target.value)}
              placeholder="e.g. Friendly, keep replies short, use simple language…"
              rows={3}
              value={tone}
            />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={!hasChanges || status === "saving"} onClick={saveTone} type="button">
            {status === "saving" ? "Saving…" : status === "saved" && !hasChanges ? "Saved" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
