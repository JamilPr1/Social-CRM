"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { fetchAccounts } from "@/lib/client-cache";

interface MetaAccount {
  id: string;
  pageName: string;
}

interface Conversation {
  id: string;
  accountId?: string;
  pageName?: string;
  participants?: { data: Array<{ id: string; name: string }> };
  messages?: {
    data: Array<{
      message: string;
      from: { id: string; name: string };
      created_time: string;
    }>;
  };
}

export default function MessagesPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, startSync] = useTransition();
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchAccounts<MetaAccount>().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccount(accs.length > 1 ? "all" : accs[0].id);
    });
  }, []);

  const loadConversations = useCallback(async (accountId: string, sync = false) => {
    const res = await fetch(
      `/api/messages?accountId=${accountId}${sync ? "&sync=true" : ""}`
    );
    const data = await res.json();
    setConversations(data.conversations || []);
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    setLoading(true);
    setSelectedConvo(null);
    loadConversations(selectedAccount).finally(() => setLoading(false));
  }, [selectedAccount, loadConversations]);

  function handleSync() {
    startSync(async () => {
      await loadConversations(selectedAccount, true);
    });
  }

  async function handleSend() {
    if (!replyText.trim() || !selectedConvo) return;
    const accountId = selectedConvo.accountId || selectedAccount;
    const recipient = selectedConvo.participants?.data?.find(
      (p) => p.id !== accountId
    );
    if (!recipient || accountId === "all") return;

    setSending(true);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          recipientId: recipient.id,
          message: replyText,
        }),
      });
      setReplyText("");
      await loadConversations(selectedAccount);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-[var(--muted)] mt-1">Facebook Page inbox and DMs</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 border border-[var(--border)] hover:bg-[var(--card-hover)] px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>

      {accounts.length > 0 && (
        <div className="mb-6">
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
          >
            {accounts.length > 1 && <option value="all">All pages</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.pageName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-240px)]">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] font-medium text-sm">
            Conversations
          </div>
          <div className="overflow-y-auto h-full">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-[var(--background)] rounded animate-pulse" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-[var(--muted)]">No conversations</p>
            ) : (
              conversations.map((convo) => {
                const participant = convo.participants?.data?.[0];
                const lastMsg = convo.messages?.data?.[0];
                return (
                  <button
                    key={convo.id}
                    onClick={() => setSelectedConvo(convo)}
                    className={`w-full text-left p-4 border-b border-[var(--border)] hover:bg-[var(--card-hover)] transition-colors ${
                      selectedConvo?.id === convo.id ? "bg-[var(--primary)]/10" : ""
                    }`}
                  >
                    <p className="font-medium text-sm">{participant?.name || "Unknown"}</p>
                    {convo.pageName && selectedAccount === "all" && (
                      <p className="text-xs text-[var(--primary)]">{convo.pageName}</p>
                    )}
                    <p className="text-xs text-[var(--muted)] truncate mt-1">
                      {lastMsg?.message || "No messages"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col">
          {selectedConvo ? (
            <>
              <div className="p-4 border-b border-[var(--border)] font-medium text-sm">
                {selectedConvo.participants?.data?.[0]?.name || "Conversation"}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(selectedConvo.messages?.data || [])
                  .slice()
                  .reverse()
                  .map((msg, i) => (
                    <div
                      key={i}
                      className={`max-w-[70%] p-3 rounded-xl text-sm ${
                        msg.from.id !== selectedConvo.participants?.data?.[0]?.id
                          ? "ml-auto bg-[var(--primary)] text-white"
                          : "bg-[var(--background)]"
                      }`}
                    >
                      <p>{msg.message}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {formatDate(msg.created_time)}
                      </p>
                    </div>
                  ))}
              </div>
              <div className="p-4 border-t border-[var(--border)] flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="bg-[var(--primary)] text-white px-6 py-2.5 rounded-lg text-sm disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--muted)] text-sm">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
