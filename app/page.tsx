
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
};

type Chat = {
  conversation_id: string;
  other_user_id: string;
  other_username: string | null;
  other_full_name: string | null;
  is_group: boolean;
  conversation_created_at: string;
  last_message: string | null;
  last_message_at: string | null;
};

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
};

export default function Home() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showUsers, setShowUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadChats = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_conversations");

    if (error) {
      setError(error.message);
      return;
    }

    setChats((data || []) as Chat[]);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, content, sender_id, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setMessages((data || []) as Message[]);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      const id = session.user.id;
      setUserId(id);

      const { data: myProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .eq("id", id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError) {
        setError(profileError.message);
      } else {
        setProfile(myProfile as Profile | null);
      }

      await loadChats();

      if (mounted) {
        setLoading(false);
      }
    }

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login");
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router, loadChats]);

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    loadMessages(activeChat.conversation_id);

    const channel = supabase
  .channel(`messages-${activeChat.conversation_id}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${activeChat.conversation_id}`,
    },
    async () => {
      await loadMessages(activeChat.conversation_id);
      await loadChats();
    }
  )
  .subscribe((status) => {
    console.log("Realtime status:", status);
  });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat, loadMessages, loadChats]);

  async function openNewChat() {
    setError("");
    setShowUsers(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .neq("id", userId)
      .order("full_name", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setUsers((data || []) as Profile[]);
  }

  async function startConversation(otherUser: Profile) {
    setError("");

    const { data, error } = await supabase.rpc(
      "create_private_conversation",
      { p_other_user_id: otherUser.id }
    );

    if (error) {
      setError(error.message);
      return;
    }

    await loadChats();

    const conversation = data as string;

    const { data: existingChats, error: chatsError } =
      await supabase.rpc("get_my_conversations");

    if (chatsError) {
      setError(chatsError.message);
      return;
    }

    const found = (existingChats || []).find(
      (chat: Chat) => chat.conversation_id === conversation
    );

    if (found) {
      setActiveChat(found as Chat);
      setShowUsers(false);
    } else {
      setError("Conversation created, but it could not be loaded.");
    }
  }

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const content = message.trim();

    if (!content || !activeChat || sending) return;

    setSending(true);
    setError("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: activeChat.conversation_id,
      sender_id: userId,
      content,
    });

    setSending(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("");
    await loadMessages(activeChat.conversation_id);
    await loadChats();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const filteredChats = chats.filter((chat) => {
    const name = chat.other_full_name || chat.other_username || "User";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  function formatTime(value: string | null) {
    if (!value) return "";

    return new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1220] text-white">
        Loading FLYby...
      </main>
    );
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#0b1220] text-white">
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-white/10 bg-[#111b2b] max-md:w-[110px]">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold">
            N
          </div>

          <div className="max-md:hidden">
            <h1 className="text-xl font-bold">FLYby</h1>
            <p className="text-xs text-slate-400">Connect with everyone</p>
          </div>
        </div>

        <div className="p-4 max-md:px-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-xl border border-white/10 bg-[#1b293b] px-4 py-3 text-sm outline-none focus:border-blue-500 max-md:hidden"
          />
          <div className="hidden text-center text-slate-400 max-md:block">
            ⌕
          </div>
        </div>

        <div className="flex items-center justify-between px-5 pb-3 max-md:justify-center max-md:px-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 max-md:hidden">
            Messages
          </span>

          <button
            onClick={openNewChat}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500 max-md:px-2"
          >
            + <span className="max-md:hidden">New chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {filteredChats.map((chat) => {
            const name =
              chat.other_full_name || chat.other_username || "User";

            return (
              <button
                key={chat.conversation_id}
                onClick={() => {
                  setActiveChat(chat);
                  setShowUsers(false);
                  setError("");
                }}
                className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${
                  activeChat?.conversation_id === chat.conversation_id
                    ? "bg-blue-600/20 ring-1 ring-blue-500/30"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold">
                  {name.slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1 max-md:hidden">
                  <div className="flex justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatTime(chat.last_message_at)}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-xs text-slate-400">
                    {chat.last_message || "Start a conversation"}
                  </p>
                </div>
              </button>
            );
          })}

          {!showUsers && chats.length === 0 && (
            <p className="px-3 py-5 text-center text-xs text-slate-400 max-md:hidden">
              No conversations yet. Select New chat to find someone.
            </p>
          )}

          {showUsers && (
            <div className="p-2">
              <p className="mb-3 text-xs font-semibold uppercase text-slate-400 max-md:hidden">
                Find people
              </p>

              {users.map((person) => {
                const name =
                  person.full_name || person.username || "User";

                return (
                  <button
                    key={person.id}
                    onClick={() => startConversation(person)}
                    className="mb-2 flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 font-bold">
                      {name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 max-md:hidden">
                      <p className="truncate text-sm font-semibold">
                        {name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        @{person.username || "no-username"}
                      </p>
                    </div>
                  </button>
                );
              })}

              {users.length === 0 && (
                <p className="px-2 py-4 text-xs text-slate-400 max-md:hidden">
                  No other registered users yet.
                </p>
              )}

              <button
                onClick={() => setShowUsers(false)}
                className="mt-2 w-full rounded-lg bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
              >
                Close
              </button>
            </div>
          )}
        </div>

        
        
<div className="border-t border-white/10 p-4 max-md:px-2">
  <div className="flex items-center gap-3">
    <button
      onClick={() => router.push("/profile")}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5"
      title="Open your profile"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500 font-bold">
        {(profile?.full_name || "U").slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0 max-md:hidden">
        <p className="truncate text-sm font-semibold">
          {profile?.full_name || "Your Profile"}
        </p>
        <p className="truncate text-xs text-slate-400">
          @{profile?.username || "user"}
        </p>
      </div>
    </button>

    <button
      onClick={() => router.push("/profile")}
      title="Edit profile"
      className="rounded-lg p-2 text-lg text-slate-400 hover:bg-white/10 hover:text-white"
    >
      ⚙
    </button>

    <button
      onClick={logout}
      className="ml-auto text-xs text-slate-400 hover:text-white max-md:hidden"
    >
      Log out
    </button>
  </div>
</div>
</aside>


      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-white/10 bg-[#111b2b] px-6 max-md:px-3">
          {activeChat ? (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold">
                {(
                  activeChat.other_full_name ||
                  activeChat.other_username ||
                  "U"
                )
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div>
                <h2 className="font-semibold">
                  {activeChat.other_full_name ||
                    activeChat.other_username ||
                    "User"}
                </h2>
                <p className="text-xs text-slate-400">
                  Private conversation
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="font-semibold">Welcome to FLYby</h2>
              <p className="text-xs text-slate-400">
                Choose a conversation or start a new chat.
              </p>
            </div>
          )}
        </header>

        {error && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-3 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-[#0b1422] p-6 max-md:p-3">
          {!activeChat ? (
            <div className="m-auto max-w-sm text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600/20 text-4xl">
                N
              </div>
              <h2 className="text-xl font-semibold">Welcome to FLYby</h2>
              <p className="mt-2 text-sm text-slate-400">
                Start a private conversation with another registered user.
              </p>
              <button
                onClick={openNewChat}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            messages.map((item) => {
              const own = item.sender_id === userId;

              return (
                <div
                  key={item.id}
                  className={`flex ${own ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-lg ${
                      own
                        ? "rounded-br-sm bg-blue-600"
                        : "rounded-bl-sm border border-white/5 bg-[#1b293b]"
                    }`}
                  >
                    <p className="break-words text-sm leading-6">
                      {item.content}
                    </p>
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        own ? "text-blue-100" : "text-slate-400"
                      }`}
                    >
                      {formatTime(item.created_at)} {own ? "✓✓" : ""}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {activeChat && (
          <form
            onSubmit={sendMessage}
            className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-[#111b2b] p-4 max-md:gap-2 max-md:p-2"
          >
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a message..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1b293b] px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 max-md:px-3"
            >
              {sending ? "..." : "Send"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
