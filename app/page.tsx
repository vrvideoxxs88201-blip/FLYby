
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Chat = {
  conversation_id: string;
  other_user_id: string;
  other_username: string | null;
  other_full_name: string | null;
  other_avatar_url: string | null;
  is_group: boolean;
  conversation_created_at: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count?: number;
};

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
};

export default function Home() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [gifLoading, setGifLoading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<
  { id: string; url: string; preview: string }[]
>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showUsers, setShowUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const typingChannelRef = useRef<any>(null);
const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 const loadChats = useCallback(async () => {
  const { data, error } = await supabase.rpc("get_my_conversations");

  if (error) {
    setError(error.message);
    return;
  }

  const { data: unreadMessages, error: unreadError } = await supabase
    .from("messages")
    .select("conversation_id")
    .is("read_at", null)
    .neq("sender_id", userId);

  if (unreadError) {
    setError(unreadError.message);
    return;
  }

  const unreadCounts: Record<string, number> = {};

  (unreadMessages || []).forEach((message) => {
    unreadCounts[message.conversation_id] =
      (unreadCounts[message.conversation_id] || 0) + 1;
  });

  const updatedChats = (data || []).map((chat: Chat) => ({
    ...chat,
    unread_count: unreadCounts[chat.conversation_id] || 0,
  }));

  setChats(updatedChats);
}, [userId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, content, sender_id, created_at, read_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setMessages((data || []) as Message[]);
  }, []);
async function editMessage(messageId: string) {
  if (!editingContent.trim()) return;

  const { error } = await supabase
    .from("messages")
    .update({ content: editingContent.trim() })
    .eq("id", messageId)
    .eq("sender_id", userId);

  if (error) {
    setError(error.message);
    return;
  }

  setEditingMessageId(null);
  setEditingContent("");

  if (activeChat) {
    await loadMessages(activeChat.conversation_id);
  }
}

async function unsendMessage(messageId: string) {
  const confirmed = window.confirm(
    "Are you sure you want to unsend this message for everyone?"
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("sender_id", userId);

  if (error) {
    setError(error.message);
    return;
  }

  if (activeChat) {
    await loadMessages(activeChat.conversation_id);
  }
}
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
        .select("id, username, full_name, avatar_url")
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
  if (!userId) return;

  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    setNotificationsEnabled(true);
  }

  const notificationChannel = supabase
    .channel(`incoming-notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      (payload) => {
        const incoming = payload.new as {
          sender_id: string;
          conversation_id: string;
          content: string;
        };

       loadChats();

if (incoming.sender_id === userId) return;

        if (incoming.conversation_id !== activeChat?.conversation_id) {
          setUnreadCount((count) => count + 1);
        }

        if (
          notificationsEnabled &&
          document.hidden &&
          Notification.permission === "granted"
        ) {
          new Notification("New message on FLYby", {
            body: incoming.content,
          });
        }
      }
    )
        .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
      },
      (payload) => {
        const updated = payload.new as Message;

        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === updated.id
              ? { ...message, read_at: updated.read_at }
              : message
          )
        );
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(notificationChannel);
  };
}, [userId, activeChat?.conversation_id, notificationsEnabled, loadChats]);
useEffect(() => {
  if (!userId) return;

  const presenceChannel = supabase.channel("online-users", {
    config: {
      presence: {
        key: userId,
      },
    },
  });

  presenceChannel
    .on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      setOnlineUsers(Object.keys(state));
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
      }
    });

  return () => {
    supabase.removeChannel(presenceChannel);
  };
}, [userId]); 
useEffect(() => {
  if (!activeChat) {
    setMessages([]);
    return;
  } 
    loadMessages(activeChat.conversation_id);

    console.log("B is listening to:", activeChat.conversation_id);

const channel = supabase.channel(
  `messages-${activeChat.conversation_id}`
);

typingChannelRef.current = channel;

channel
    .on(
    "postgres_changes",
    {
      event: "DELETE",
      schema: "public",
      table: "messages",
    },
    () => {
      console.log("MESSAGE DELETED");
      loadMessages(activeChat.conversation_id);
      loadChats();
    }
  )
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${activeChat.conversation_id}`,
    },
    () => {
      console.log("MESSAGE UPDATED");
      loadMessages(activeChat.conversation_id);
      loadChats();
    }
  )
  .on(
    "broadcast",
    { event: "typing" },
    ({ payload }) => {
      if (payload.user_id !== userId) {
        setTypingUsers([payload.user_id]);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers([]);
        }, 2000);
      }
    }
  )
  .subscribe((status) => {
    console.log("Realtime status:", status);
  });

   return () => {
  typingChannelRef.current = null;

  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current);
  }

  setTypingUsers([]);
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
    async function searchGifs(query: string) {
    if (!query.trim()) {
      setGifResults([]);
      return;
    }

    setGifLoading(true);

    try {
      const response = await fetch(
        `/api/gif?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "GIF search failed.");
      }

      setGifResults(data.results || []);
    } catch (error) {
      console.error("GIF search error:", error);
      setGifResults([]);
      setError("Unable to search GIFs.");
    } finally {
      setGifLoading(false);
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
              onClick={async () => {
  setActiveChat(chat);
  setShowUsers(false);
  setError("");

  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", chat.conversation_id)
    .neq("sender_id", userId)
    .is("read_at", null);

  if (error) {
  console.error("Error marking messages as read:", error);
}

await loadChats();
}}
                className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${
                  activeChat?.conversation_id === chat.conversation_id
                    ? "bg-blue-600/20 ring-1 ring-blue-500/30"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-sm font-bold">
  {chat.other_avatar_url ? (
    <img
      src={chat.other_avatar_url}
      alt={name}
      className="h-full w-full object-cover"
    />
  ) : (
    name.slice(0, 2).toUpperCase()
  )}
</div>

                <div className="min-w-0 flex-1 max-md:hidden">
                  <div className="flex justify-between gap-2">
                   <span className="flex min-w-0 items-center gap-2">
  <span className="truncate text-sm font-semibold">
  {name}
</span>

<span
  className={`h-2 w-2 shrink-0 rounded-full ${
    onlineUsers.includes(chat.other_user_id)
      ? "bg-green-500"
      : "bg-slate-500"
  }`}
  title={
    onlineUsers.includes(chat.other_user_id)
      ? "Online"
      : "Offline"
  }
/> 

  {chat.unread_count ? (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">
      {chat.unread_count}
    </span>
  ) : null} 
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
                <div className="flex items-center gap-2">
  <h2 className="font-semibold">
    {activeChat.other_full_name ||
      activeChat.other_username ||
      "User"}
  </h2>

  <span
    className={`h-2 w-2 rounded-full ${
      onlineUsers.includes(activeChat.other_user_id)
        ? "bg-green-500"
        : "bg-slate-500"
    }`}
    title={
      onlineUsers.includes(activeChat.other_user_id)
        ? "Online"
        : "Offline"
    }
  />
</div>
                <p className="text-xs text-slate-400">
  {typingUsers.length > 0
    ? "DM is flying..."
    : "Private conversation"}
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
                    <button
            type="button"
            onClick={async () => {
              if (!("Notification" in window)) return;

              const permission = await Notification.requestPermission();

              setNotificationsEnabled(permission === "granted");
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
          >
            {notificationsEnabled
              ? "Notifications On"
              : "Enable Notifications"}

            {unreadCount > 0 && ` (${unreadCount})`}
          </button>
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
                    {editingMessageId === item.id ? (
  <div className="space-y-2">
    <textarea
      value={editingContent}
      onChange={(e) => setEditingContent(e.target.value)}
      className="w-full rounded-lg bg-white/10 p-2 text-sm text-white outline-none"
      rows={2}
    />

    <div className="flex gap-2">
      <button
        onClick={() => editMessage(item.id)}
        className="rounded-lg bg-green-600 px-3 py-1 text-xs text-white"
      >
        Save
      </button>

      <button
        onClick={() => {
          setEditingMessageId(null);
          setEditingContent("");
        }}
        className="rounded-lg bg-slate-600 px-3 py-1 text-xs text-white"
      >
        Cancel
      </button>
    </div>
  </div>
) : item.content.startsWith("GIF:") ? (
  <img
    src={item.content.slice(4)}
    alt="GIF"
    className="max-w-full rounded-lg"
  />
) : (
  <p className="break-words text-sm leading-6">
    {item.content}
  </p>
)}  

<p
  className={`mt-1 text-right text-[10px] ${
    own ? "text-blue-100" : "text-slate-400"
  }`}
>
  {formatTime(item.created_at)}{" "}
  {own && (item.read_at ? "✓✓ Seen" : "✓ Sent")}
</p>
{own && editingMessageId !== item.id && (
  <div className="mt-2 flex justify-end gap-3">
    <button
      onClick={() => {
        setEditingMessageId(item.id);
        setEditingContent(item.content);
      }}
      className="text-xs text-blue-100 hover:text-white"
    >
      Edit
    </button>

    <button
      onClick={() => unsendMessage(item.id)}
      className="text-xs text-red-200 hover:text-red-100"
    >
      Unsend
    </button>
  </div>
)}
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
            <button
  type="button"
  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
  className="rounded-xl bg-[#1b293b] px-2 py-2 text-xs hover:bg-slate-700"
>
  😊
</button> 
      <button
        type="button"
        onClick={() => setShowGifPicker(!showGifPicker)}
        className="rounded-xl bg-[#1b293b] px-2 py-2 text-xs hover:bg-slate-700"
      >
        GIF
      </button>
            <input
              value={message}
              onChange={(e) => { 
  setMessage(e.target.value);

  if (typingChannelRef.current && userId) {
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: userId },
    });
  } 
}}
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

            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 z-50 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#1b293b] p-3 shadow-xl">
                {["😀", "😂", "😍", "🥰", "😊", "😉", "❤️", "🔥", "👍", "👏", "🎉", "😭", "🙏", "😘", "😎", "🤔"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setMessage((current) => current + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="rounded-lg p-2 text-xl hover:bg-slate-700"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
                        {showGifPicker && (
              <div className="absolute bottom-20 left-16 z-50 w-80 rounded-xl border border-white/10 bg-[#1b293b] p-3 shadow-xl">
                <input
                  type="text"
                  value={gifSearch}
                  onChange={(e) => {
                    setGifSearch(e.target.value);
                    searchGifs(e.target.value);
                  }}
                  placeholder="Search GIFs..."
                  className="mb-3 w-full rounded-lg bg-[#111b2b] px-3 py-2 text-sm outline-none"
                />

                {gifLoading && (
                  <p className="text-sm text-gray-400">Searching GIFs...</p>
                )}

                <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
                  {gifResults.map((gif) => (
                    <button
  key={gif.id}
  type="button"
  disabled={sending}
  onClick={async () => {
    if (!activeChat || sending) return;

    setSending(true);
    setError("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: activeChat.conversation_id,
      sender_id: userId,
      content: `GIF:${gif.url}`,
    });

    setSending(false);

    if (error) {
      setError(error.message);
      return;
    }

    setShowGifPicker(false);
    setGifSearch("");
    setGifResults([]);
    await loadMessages(activeChat.conversation_id);
    await loadChats();
  }}
  className="rounded-lg overflow-hidden"
>
  <img
    src={gif.preview}
    alt="GIF"
    className="h-24 w-full cursor-pointer object-cover"
  />
</button>
                  ))}
                </div>
              </div>
            )}
          </form> 
        )}
      </section>
    </main>
  );
}
