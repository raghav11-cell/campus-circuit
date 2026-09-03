import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import {
  Heart,
  X,
  MessageCircle,
  User,
  Users,
  Send,
  ArrowLeft,
  Sparkles,
  LogOut,
  Camera,
  Plus,
  Check,
  ShieldCheck,
  Settings,
  Grid3x3,
  Flag,
  Video,
  Bell,
  Search,
} from "lucide-react";

const INTENTS = [
  { id: "serious", label: "Serious Relationship", color: "#FF4D6D" },
  { id: "casual", label: "Casual Dating", color: "#FFB84D" },
  { id: "fwb", label: "Friends with Benefits", color: "#C77DFF" },
  { id: "friend", label: "Just Friends", color: "#4DD4C0" },
  { id: "online", label: "Online Friend", color: "#5DA9FF" },
  { id: "situationship", label: "Situationship", color: "#FF8C42" },
];

const PROMPT_OPTIONS = [
  "My ideal Sunday is...",
  "Green flag I bring:",
  "Unpopular opinion:",
  "Currently obsessed with...",
  "My love language is...",
  "Ask me about...",
  "Red flag I'm working on:",
  "Best way to win me over:",
];

const intentMeta = (id) => INTENTS.find((i) => i.id === id) || {};
const fontStyles = `
  .font-display { font-family: 'Fraunces', serif; }
  .font-sans { font-family: 'Inter', sans-serif; }
`;

function Avatar({ profile, size = "w-full h-full", textSize = "text-5xl" }) {
  const photo = profile?.photos?.[0];
  if (photo) {
    return <img src={photo} alt={profile.name} className={`${size} object-cover`} />;
  }
  return (
    <div className={`${size} flex items-center justify-center bg-gradient-to-br from-[#FF4D6D]/30 via-[#C77DFF]/20 to-[#5DA9FF]/20`}>
      <span className={`font-display ${textSize} text-[#F5EDE4]/90`}>
        {profile?.name?.[0]?.toUpperCase() || "?"}
      </span>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("feed");
  const [activeChat, setActiveChat] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [viewingProfileId, setViewingProfileId] = useState(null);

  useEffect(() => {
    const seen = localStorage.getItem("cc_seen_intro");
    if (!seen) setShowIntro(true);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    loadProfile();
  }, [session]);

  useEffect(() => {
    if (!profile) return;
    loadUnreadCount();
    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        () => setUnreadCount((c) => c + 1)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile?.id]);

  async function loadUnreadCount() {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("read", false);
    setUnreadCount(count ?? 0);
  }

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    if (!error) setProfile(data);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    setTab("browse");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1B0F23]">
        <p className="text-[#B8A9C0] text-sm">loading...</p>
      </div>
    );
  }

  if (showIntro) {
    return (
      <WelcomeIntro
        onDone={() => {
          localStorage.setItem("cc_seen_intro", "1");
          setShowIntro(false);
        }}
      />
    );
  }

  if (recoveryMode) {
    return <ResetPasswordScreen onDone={() => setRecoveryMode(false)} />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!profile) {
    return <CreateProfile userId={session.user.id} onDone={loadProfile} />;
  }

  return (
    <div className="min-h-screen bg-[#1B0F23] text-[#F5EDE4] font-sans flex flex-col">
      <style>{fontStyles}</style>

      <header className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/5 max-w-md mx-auto w-full">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[#FFB84D]" />
          <span className="font-display text-lg tracking-tight">Campus Circuit</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSearch(true)} className="text-[#B8A9C0]">
            <Search size={20} />
          </button>
          <button onClick={() => setShowNotifications(true)} className="relative text-[#B8A9C0]">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF4D6D] text-white text-[10px] flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <div className="text-xs text-[#B8A9C0]">{profile.college}</div>
        </div>
      </header>

      {showSearch && (
        <SearchScreen
          onClose={() => setShowSearch(false)}
          onOpenProfile={(id) => {
            setShowSearch(false);
            setViewingProfileId(id);
          }}
        />
      )}

      {viewingProfileId && (
        <UserProfileView
          userId={viewingProfileId}
          myId={profile.id}
          onBack={() => setViewingProfileId(null)}
          onOpenProfile={(id) => setViewingProfileId(id)}
        />
      )}

      {showNotifications && (
        <NotificationsPanel
          myId={profile.id}
          onClose={() => setShowNotifications(false)}
          onRead={() => setUnreadCount(0)}
          onNavigate={(t) => {
            setShowNotifications(false);
            setTab(t);
          }}
        />
      )}

      <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full">
        {tab === "feed" && <FeedTab profile={profile} onOpenProfile={setViewingProfileId} />}
        {tab === "browse" && <BrowseTab profile={profile} />}
        {tab === "matches" && (
          <MatchesTab
            myId={profile.id}
            onOpen={(m) => {
              setActiveChat(m);
              setTab("chatroom");
            }}
          />
        )}
        {tab === "profile" && <ProfileTab profile={profile} onLogout={handleLogout} onUpdate={loadProfile} />}
        {tab === "chatroom" && activeChat && (
          <ChatRoom match={activeChat} myId={profile.id} onBack={() => setTab("matches")} />
        )}
      </main>

      {tab !== "chatroom" && (
        <nav className="flex border-t border-white/5 bg-[#1B0F23] max-w-md mx-auto w-full">
          {[
            { id: "feed", icon: Grid3x3, label: "Feed" },
            { id: "browse", icon: Heart, label: "Browse" },
            { id: "matches", icon: MessageCircle, label: "Matches" },
            { id: "profile", icon: User, label: "You" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                tab === t.id ? "text-[#FF4D6D]" : "text-[#6B5B73]"
              }`}
            >
              <t.icon size={20} />
              <span className="text-[11px]">{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// ---------------- NOTIFICATIONS ----------------
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationsPanel({ myId, onClose, onRead, onNavigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*, profiles!notifications_actor_id_fkey(name, username, photos)")
      .eq("user_id", myId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data || []);
    setLoading(false);

    await supabase.from("notifications").update({ read: true }).eq("user_id", myId).eq("read", false);
    onRead();
  }

  function messageFor(n) {
    const name = n.profiles?.name || "Someone";
    if (n.type === "like") return `${name} liked you`;
    if (n.type === "match") return `You matched with ${name}`;
    if (n.type === "message") return `${name} sent you a message`;
    return "";
  }

  function iconFor(type) {
    if (type === "like") return <Heart size={16} className="text-[#FF4D6D]" />;
    if (type === "match") return <Sparkles size={16} className="text-[#FFB84D]" />;
    return <MessageCircle size={16} className="text-[#5DA9FF]" />;
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-30 flex items-start justify-center px-4 pt-16">
      <div className="bg-[#1B0F23] border border-white/10 rounded-2xl w-full max-w-md max-h-[75vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="font-display text-xl">Notifications</h2>
          <button onClick={onClose} className="text-[#B8A9C0]">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading && <p className="text-center text-[#B8A9C0] text-sm py-8">loading...</p>}
          {!loading && items.length === 0 && (
            <p className="text-center text-[#6B5B73] text-sm py-8">No notifications yet.</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => onNavigate(n.type === "like" ? "profile" : "matches")}
              className="w-full flex items-center gap-3 px-5 py-3 border-b border-white/5 text-left hover:bg-white/5"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                <Avatar profile={n.profiles} textSize="text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{messageFor(n)}</p>
                <p className="text-[11px] text-[#6B5B73] mt-0.5">{timeAgo(n.created_at)}</p>
              </div>
              {iconFor(n.type)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- SEARCH ----------------
function SearchScreen({ onClose, onOpenProfile }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const q = query.trim();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(20);
      setResults(data || []);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="fixed inset-0 bg-[#1B0F23] z-30 flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <button onClick={onClose} className="text-[#B8A9C0]">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 relative">
            <SearchIcon />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or @username"
              className="w-full bg-[#2A1830] border border-white/10 rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#FF4D6D]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {loading && <p className="text-center text-[#B8A9C0] text-sm py-8">searching...</p>}
          {!loading && query.trim() && results.length === 0 && (
            <p className="text-center text-[#6B5B73] text-sm py-8">No one found.</p>
          )}
          <div className="space-y-2.5 pb-6">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpenProfile(p.id)}
                className="w-full flex items-center gap-3 bg-[#2A1830] rounded-xl p-3 border border-white/5 text-left"
              >
                <div className="w-11 h-11 rounded-full overflow-hidden shrink-0">
                  <Avatar profile={p} textSize="text-lg" />
                </div>
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[#6B5B73]">
                    @{p.username} · {p.college}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B5B73]" />
  );
}

// ---------------- USER PROFILE VIEW (someone else's profile) ----------------
function UserProfileView({ userId, myId, onBack, onOpenProfile }) {
  const [target, setTarget] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(null);
  const [followingCount, setFollowingCount] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    load();
  }, [userId]);

  async function load() {
    setLoading(true);
    const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setTarget(p);

    const { data: postData } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setPosts(postData || []);

    const { count: followers } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("liked_id", userId);
    setFollowerCount(followers ?? 0);

    const { count: following } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("liker_id", userId);
    setFollowingCount(following ?? 0);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#1B0F23] z-30 flex items-center justify-center">
        <p className="text-[#B8A9C0] text-sm">loading...</p>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="fixed inset-0 bg-[#1B0F23] z-30 flex flex-col items-center justify-center gap-3">
        <p className="text-[#B8A9C0] text-sm">Profile not found.</p>
        <button onClick={onBack} className="text-[#FF4D6D] text-sm">
          Go back
        </button>
      </div>
    );
  }

  const isMe = userId === myId;

  return (
    <div className="fixed inset-0 bg-[#1B0F23] z-30 overflow-y-auto">
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-40 flex items-center justify-center px-4"
          onClick={() => setLightbox(null)}
        >
          {lightbox.type === "video" ? (
            <video src={lightbox.url} controls autoPlay className="max-h-[80vh] max-w-full rounded-xl" />
          ) : (
            <img src={lightbox.url} alt="" className="max-h-[80vh] max-w-full rounded-xl object-contain" />
          )}
        </div>
      )}

      <div className="max-w-md mx-auto w-full p-5">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="text-[#B8A9C0]">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display text-xl">@{target.username}</h1>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border-2 border-[#FF4D6D]/40">
            <Avatar profile={target} textSize="text-2xl" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl leading-tight">
              {target.name}
              {target.age ? `, ${target.age}` : ""}
            </h2>
            <p className="text-xs text-[#B8A9C0] mt-0.5">{target.college}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="bg-[#2A1830] rounded-xl py-3 text-center border border-white/5">
            <p className="font-display text-lg">{followerCount === null ? "—" : followerCount}</p>
            <p className="text-[10px] text-[#6B5B73] mt-0.5">Followers</p>
          </div>
          <div className="bg-[#2A1830] rounded-xl py-3 text-center border border-white/5">
            <p className="font-display text-lg">{followingCount === null ? "—" : followingCount}</p>
            <p className="text-[10px] text-[#6B5B73] mt-0.5">Following</p>
          </div>
          <div className="bg-[#2A1830] rounded-xl py-3 text-center border border-white/5">
            <p className="font-display text-lg">{posts.length}</p>
            <p className="text-[10px] text-[#6B5B73] mt-0.5">Posts</p>
          </div>
        </div>

        {(target.prompts || []).length > 0 && (
          <div className="space-y-3 mb-5">
            {target.prompts.map((p, i) => (
              <div key={i} className="bg-[#2A1830] rounded-xl p-4 border border-white/5">
                <p className="text-[11px] text-[#FFB84D]">{p.q}</p>
                <p className="text-sm mt-1">{p.a}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mb-5">
          <p className="text-[11px] text-[#6B5B73] mb-2">looking for</p>
          <div className="flex flex-wrap gap-1.5">
            {(target.intents || []).map((id) => {
              const meta = intentMeta(id);
              return (
                <span
                  key={id}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: meta.color + "22", color: meta.color }}
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>

        {!isMe && (
          <p className="text-[11px] text-[#6B5B73] mb-5">
            {isMe ? "" : "Posts marked \"matches only\" will only show here if you and " + target.name + " have matched."}
          </p>
        )}

        {posts.length > 0 ? (
          <div>
            <p className="text-[11px] text-[#6B5B73] mb-2">posts</p>
            <div className="grid grid-cols-3 gap-1.5">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => setLightbox({ url: post.media_url, type: post.media_type })}
                  className="aspect-square rounded-lg overflow-hidden bg-[#2A1830] relative"
                >
                  {post.media_type === "video" ? (
                    <video src={post.media_url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                  )}
                  {post.visibility === "matches_only" && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                      <ShieldCheck size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-center text-[#6B5B73] text-sm py-8">No posts to show.</p>
        )}
      </div>
    </div>
  );
}

// ---------------- WELCOME INTRO ----------------
function WelcomeIntro({ onDone }) {
  const [step, setStep] = useState(0);
  const slides = [
    {
      icon: "✨",
      title: "Say what you actually want.",
      subtitle: "No more mixed signals. Tell us your intent up front — serious, casual, friends, whatever it is.",
    },
    {
      icon: "🎯",
      title: "No guessing games.",
      subtitle: "You'll only match with people looking for the same thing you are. No more wasted conversations.",
    },
    {
      icon: "🎓",
      title: "Built for students only.",
      subtitle: "A space that's just for college students — not the whole internet.",
    },
  ];
  const isLast = step === slides.length - 1;
  const s = slides[step];

  return (
    <div className="min-h-screen bg-[#1B0F23] text-[#F5EDE4] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6">
        <div className="flex justify-end pt-6">
          <button onClick={onDone} className="text-xs text-[#6B5B73]">
            Skip
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 -mt-10">
          <div className="text-6xl">{s.icon}</div>
          <h1 className="font-display text-3xl leading-tight max-w-xs">{s.title}</h1>
          <p className="text-[#B8A9C0] text-sm max-w-xs">{s.subtitle}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-[#FF4D6D]" : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => (isLast ? onDone() : setStep((s) => s + 1))}
          className="w-full py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium mb-10"
        >
          {isLast ? "Get started" : "Next"}
        </button>
      </div>
    </div>
  );
}

// ---------------- AUTH ----------------
function AuthScreen() {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMode("forgot-sent");
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setBusy(false);
  }

  const title =
    mode === "forgot" || mode === "forgot-sent" ? "Reset your password" : "Campus Circuit";

  return (
    <div className="min-h-screen bg-[#1B0F23] text-[#F5EDE4] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 pt-16">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-[#FFB84D]" />
          <span className="text-xs text-[#B8A9C0] tracking-wide">student-only</span>
        </div>
        <h1 className="font-display text-3xl leading-tight">{title}</h1>
        <p className="text-[#B8A9C0] text-sm mt-2 mb-8">
          {mode === "forgot"
            ? "Enter the email on your account and we'll send you a reset link."
            : mode === "forgot-sent"
            ? "Check your inbox — tap the link we sent to set a new password."
            : "Say what you're actually looking for. No guessing games."}
        </p>

        {mode !== "forgot-sent" && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-[#B8A9C0] block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <label className="text-xs text-[#B8A9C0] block mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                />
              </div>
            )}
            {mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
                className="text-xs text-[#B8A9C0] block"
              >
                Forgot password?
              </button>
            )}
            {error && <p className="text-[#FF4D6D] text-xs">{error}</p>}
            <button
              disabled={busy}
              className="w-full py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium disabled:opacity-50"
            >
              {busy
                ? "Please wait..."
                : mode === "signup"
                ? "Create account"
                : mode === "login"
                ? "Log in"
                : "Send reset link"}
            </button>
          </form>
        )}

        {mode === "forgot-sent" && (
          <button
            onClick={() => setMode("login")}
            className="w-full py-3 rounded-full border border-white/10 text-[#B8A9C0] text-sm"
          >
            Back to log in
          </button>
        )}

        {(mode === "signup" || mode === "login") && (
          <button
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="text-xs text-[#B8A9C0] mt-5 text-center"
          >
            {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
          </button>
        )}
        {mode === "forgot" && (
          <button onClick={() => setMode("login")} className="text-xs text-[#B8A9C0] mt-5 text-center">
            Back to log in
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------- RESET PASSWORD ----------------
function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(onDone, 1500);
  }

  return (
    <div className="min-h-screen bg-[#1B0F23] text-[#F5EDE4] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 pt-16">
        <h1 className="font-display text-3xl leading-tight">Set a new password</h1>
        {done ? (
          <p className="text-[#4DD4C0] text-sm mt-4">Password updated. Taking you back in...</p>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-6">
            <div>
              <label className="text-xs text-[#B8A9C0] block mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
              />
            </div>
            {error && <p className="text-[#FF4D6D] text-xs">{error}</p>}
            <button
              disabled={busy}
              className="w-full py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Saving..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------- CREATE PROFILE (multi-step) ----------------
function CreateProfile({ userId, onDone }) {
  const [step, setStep] = useState(0); // 0 basics, 1 photos, 2 intents, 3 prompts, 4 review
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("");
  const [age, setAge] = useState("");
  const [college, setCollege] = useState("");
  const [gender, setGender] = useState("");
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [intents, setIntents] = useState([]);
  const [selectedPrompts, setSelectedPrompts] = useState([]); // [{q,a}]
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  function toggleIntent(id) {
    setIntents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleUsernameChange(raw) {
    setUsername(raw.toLowerCase().replace(/[^a-z0-9_.]/g, ""));
  }

  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus(username ? "invalid" : "");
      return;
    }
    setUsernameStatus("checking");
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 500);
    return () => clearTimeout(timeout);
  }, [username]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, 6 - photos.length);
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        setPhotos((prev) => [...prev, data.publicUrl]);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(url) {
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  function addPromptSlot() {
    if (selectedPrompts.length >= 3) return;
    const used = selectedPrompts.map((p) => p.q);
    const next = PROMPT_OPTIONS.find((p) => !used.includes(p));
    if (next) setSelectedPrompts((prev) => [...prev, { q: next, a: "" }]);
  }

  function updatePromptQuestion(index, q) {
    setSelectedPrompts((prev) => prev.map((p, i) => (i === index ? { ...p, q } : p)));
  }

  function updatePromptAnswer(index, a) {
    setSelectedPrompts((prev) => prev.map((p, i) => (i === index ? { ...p, a } : p)));
  }

  function removePrompt(index) {
    setSelectedPrompts((prev) => prev.filter((_, i) => i !== index));
  }

  const ageNum = parseInt(age, 10);
  const step0Valid =
    name.trim() && college.trim() && username.length >= 3 && usernameStatus === "available" && ageNum >= 18 && ageNum < 100;
  const step1Valid = photos.length >= 1;
  const step2Valid = intents.length > 0;

  function canContinue() {
    if (step === 0) return step0Valid;
    if (step === 1) return step1Valid;
    if (step === 2) return step2Valid;
    return true;
  }

  async function save() {
    setBusy(true);
    setError("");
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      name,
      username,
      age: ageNum,
      college,
      gender,
      photos,
      intents,
      prompts: selectedPrompts.filter((p) => p.a.trim()),
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("username") ? "That username was just taken — try another." : error.message
      );
      return;
    }
    onDone();
  }

  const totalSteps = 5;

  return (
    <div className="min-h-screen bg-[#1B0F23] text-[#F5EDE4] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 pt-8">
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-[#FF4D6D]" : "bg-white/10"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h1 className="font-display text-2xl mb-1">The basics</h1>
            <div>
              <label className="text-xs text-[#B8A9C0] block mb-1.5">Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya"
                className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
              />
            </div>
            <div>
              <label className="text-xs text-[#B8A9C0] block mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B5B73] text-sm">@</span>
                <input
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="yourname"
                  className="w-full bg-[#2A1830] border border-white/10 rounded-xl pl-8 pr-4 py-3 outline-none focus:border-[#FF4D6D]"
                />
              </div>
              {usernameStatus === "checking" && <p className="text-[11px] text-[#6B5B73] mt-1">checking...</p>}
              {usernameStatus === "available" && (
                <p className="text-[11px] text-[#4DD4C0] mt-1">@{username} is available</p>
              )}
              {usernameStatus === "taken" && <p className="text-[11px] text-[#FF4D6D] mt-1">Already taken</p>}
              {usernameStatus === "invalid" && (
                <p className="text-[11px] text-[#FF4D6D] mt-1">At least 3 characters</p>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-[#B8A9C0] block mb-1.5">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="18+"
                  className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                />
              </div>
              <div className="flex-[2]">
                <label className="text-xs text-[#B8A9C0] block mb-1.5">College</label>
                <input
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. DU, IIT Delhi"
                  className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                />
              </div>
            </div>
            {age && ageNum < 18 && <p className="text-[11px] text-[#FF4D6D]">Must be 18 or older to join.</p>}
            <div>
              <label className="text-xs text-[#B8A9C0] block mb-1.5">Gender (optional)</label>
              <div className="flex gap-2">
                {["Woman", "Man", "Other"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`px-4 py-2 rounded-full text-sm border ${
                      gender === g ? "bg-[#FF4D6D] border-[#FF4D6D] text-white" : "border-white/10 text-[#B8A9C0]"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-display text-2xl mb-1">Add photos</h1>
            <p className="text-sm text-[#B8A9C0] mb-4">At least 1, up to 6. Real photos build trust.</p>
            <div className="grid grid-cols-3 gap-2.5">
              {photos.map((url) => (
                <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-[#2A1830]">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-[#6B5B73]"
                >
                  {uploading ? (
                    <span className="text-xs">uploading...</span>
                  ) : (
                    <>
                      <Camera size={20} />
                      <Plus size={14} />
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              className="hidden"
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-display text-2xl mb-1">What are you into?</h1>
            <p className="text-sm text-[#B8A9C0] mb-4">Pick as many as apply — this is how we match you.</p>
            <div className="grid grid-cols-1 gap-2.5">
              {INTENTS.map((intent) => {
                const active = intents.includes(intent.id);
                return (
                  <button
                    key={intent.id}
                    type="button"
                    onClick={() => toggleIntent(intent.id)}
                    className="text-left px-4 py-3 rounded-xl border transition-all"
                    style={
                      active
                        ? { backgroundColor: intent.color + "22", borderColor: intent.color }
                        : { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#2A1830" }
                    }
                  >
                    <span className="text-sm" style={{ color: active ? intent.color : "#F5EDE4" }}>
                      {intent.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display text-2xl mb-1">Show some personality</h1>
            <p className="text-sm text-[#B8A9C0] mb-4">
              Optional, but profiles with prompts get way more matches.
            </p>
            <div className="space-y-3">
              {selectedPrompts.map((p, i) => (
                <div key={i} className="bg-[#2A1830] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <select
                      value={p.q}
                      onChange={(e) => updatePromptQuestion(i, e.target.value)}
                      className="bg-transparent text-[#FFB84D] text-sm font-medium outline-none"
                    >
                      {PROMPT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt} className="bg-[#2A1830]">
                          {opt}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => removePrompt(i)} className="text-[#6B5B73]">
                      <X size={16} />
                    </button>
                  </div>
                  <textarea
                    value={p.a}
                    onChange={(e) => updatePromptAnswer(i, e.target.value)}
                    placeholder="Type your answer..."
                    rows={2}
                    className="w-full bg-transparent text-sm outline-none resize-none placeholder-[#6B5B73]"
                  />
                </div>
              ))}
              {selectedPrompts.length < 3 && (
                <button
                  onClick={addPromptSlot}
                  className="w-full py-3 rounded-xl border border-dashed border-white/20 text-[#B8A9C0] text-sm flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add a prompt
                </button>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="font-display text-2xl mb-1">Review your profile</h1>
            <p className="text-sm text-[#B8A9C0] mb-4">This is what others will see.</p>
            <div className="bg-[#2A1830] rounded-2xl overflow-hidden border border-white/5">
              <div className="aspect-[4/3]">
                <Avatar profile={{ name, photos }} />
              </div>
              <div className="p-4">
                <h2 className="font-display text-xl">
                  {name}, {age}
                </h2>
                <p className="text-xs text-[#B8A9C0]">
                  @{username} · {college}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {intents.map((id) => {
                    const meta = intentMeta(id);
                    return (
                      <span
                        key={id}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: meta.color + "22", color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    );
                  })}
                </div>
                {selectedPrompts
                  .filter((p) => p.a.trim())
                  .map((p, i) => (
                    <div key={i} className="mt-3">
                      <p className="text-[11px] text-[#6B5B73]">{p.q}</p>
                      <p className="text-sm mt-0.5">{p.a}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-[#FF4D6D] text-xs mt-3">{error}</p>}

        <div className="pb-8 pt-6 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-5 py-3 rounded-full border border-white/10 text-[#B8A9C0] text-sm"
            >
              Back
            </button>
          )}
          <button
            disabled={!canContinue() || busy}
            onClick={() => (step < 4 ? setStep((s) => s + 1) : save())}
            className="flex-1 py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium disabled:opacity-30"
          >
            {step < 4 ? "Continue" : busy ? "Saving..." : "Enter Campus Circuit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- STORIES ----------------
function StoriesBar({ profile }) {
  const [groups, setGroups] = useState([]); // [{ profile, stories: [], allViewed }]
  const [myStories, setMyStories] = useState([]);
  const [viewerData, setViewerData] = useState(null); // { groups, startIndex }
  const [showCreate, setShowCreate] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: stories } = await supabase
      .from("stories")
      .select("*, profiles(name, username, photos)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    const { data: views } = await supabase.from("story_views").select("story_id").eq("viewer_id", profile.id);
    const viewedIds = new Set((views || []).map((v) => v.story_id));

    const byUser = {};
    (stories || []).forEach((s) => {
      if (!byUser[s.user_id]) byUser[s.user_id] = { profile: s.profiles, userId: s.user_id, stories: [] };
      byUser[s.user_id].stories.push(s);
    });

    const mine = byUser[profile.id]?.stories || [];
    setMyStories(mine);

    const others = Object.values(byUser)
      .filter((g) => g.userId !== profile.id)
      .map((g) => ({ ...g, allViewed: g.stories.every((s) => viewedIds.has(s.id)) }));
    setGroups(others);
  }

  function openViewer(startIndex, includeMine) {
    const all = includeMine ? [{ profile, userId: profile.id, stories: myStories }, ...groups] : groups;
    setViewerData({ groups: all, startIndex });
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("File too big — keep it under 20MB.");
      return;
    }
    const mediaType = file.type.startsWith("video") ? "video" : "image";
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("stories").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("stories").getPublicUrl(path);
      await supabase.from("stories").insert({ user_id: profile.id, media_url: data.publicUrl, media_type: mediaType });
      load();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowCreate(false);
  }

  return (
    <div className="mb-5">
      {viewerData && (
        <StoryViewer
          data={viewerData}
          myId={profile.id}
          onClose={() => {
            setViewerData(null);
            load();
          }}
        />
      )}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />

      <div className="flex gap-3.5 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => (myStories.length > 0 ? openViewer(0, true) : fileInputRef.current?.click())}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="relative w-14 h-14">
            <div
              className={`w-14 h-14 rounded-full p-[2px] ${
                myStories.length > 0 ? "bg-gradient-to-br from-[#FF4D6D] to-[#FFB84D]" : "bg-white/10"
              }`}
            >
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#1B0F23]">
                <Avatar profile={profile} textSize="text-lg" />
              </div>
            </div>
            {myStories.length === 0 && (
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#FF4D6D] flex items-center justify-center border-2 border-[#1B0F23]">
                <Plus size={11} className="text-white" />
              </div>
            )}
          </div>
          <span className="text-[10px] text-[#B8A9C0]">Your story</span>
        </button>

        {groups.map((g, i) => (
          <button
            key={g.userId}
            onClick={() => openViewer(myStories.length > 0 ? i + 1 : i, myStories.length > 0)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div
              className={`w-14 h-14 rounded-full p-[2px] ${
                g.allViewed ? "bg-white/10" : "bg-gradient-to-br from-[#FF4D6D] to-[#FFB84D]"
              }`}
            >
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#1B0F23]">
                <Avatar profile={g.profile} textSize="text-lg" />
              </div>
            </div>
            <span className="text-[10px] text-[#B8A9C0] max-w-[56px] truncate">{g.profile?.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StoryViewer({ data, myId, onClose }) {
  const [groupIndex, setGroupIndex] = useState(data.startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const videoRef = useRef(null);

  const group = data.groups[groupIndex];
  const story = group?.stories[storyIndex];
  const DURATION = 5000;

  useEffect(() => {
    if (!story) return;
    setProgress(0);
    markViewed(story.id);

    if (story.media_type === "image") {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const pct = Math.min(100, ((Date.now() - startRef.current) / DURATION) * 100);
        setProgress(pct);
        if (pct >= 100) next();
      }, 50);
    }
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  async function markViewed(storyId) {
    if (group.userId === myId) return;
    await supabase.from("story_views").insert({ story_id: storyId, viewer_id: myId }).select().maybeSingle();
  }

  function next() {
    clearInterval(timerRef.current);
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < data.groups.length - 1) {
      setGroupIndex((i) => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }

  function prev() {
    clearInterval(timerRef.current);
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      setGroupIndex((i) => i - 1);
      setStoryIndex(0);
    }
  }

  function handleVideoProgress() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  }

  if (!story) return null;

  return (
    <div className="fixed inset-0 bg-black z-40 flex items-center justify-center">
      <div className="w-full h-full max-w-md relative flex flex-col">
        <div className="flex gap-1 px-3 pt-3">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white"
                style={{
                  width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 px-3 pt-3">
          <div className="w-8 h-8 rounded-full overflow-hidden">
            <Avatar profile={group.profile} textSize="text-sm" />
          </div>
          <span className="text-white text-sm font-medium">{group.profile?.name}</span>
          <span className="text-white/60 text-xs">{timeAgo(story.created_at)}</span>
          <button onClick={onClose} className="ml-auto text-white/80 p-1">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 relative mt-3">
          <div className="absolute inset-0 flex">
            <button className="w-1/3 h-full" onClick={prev} />
            <button className="w-2/3 h-full" onClick={next} />
          </div>
          {story.media_type === "video" ? (
            <video
              ref={videoRef}
              src={story.media_url}
              autoPlay
              playsInline
              onTimeUpdate={handleVideoProgress}
              onEnded={next}
              className="w-full h-full object-contain"
            />
          ) : (
            <img src={story.media_url} alt="" className="w-full h-full object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- FEED ----------------
function FeedTab({ profile, onOpenProfile }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [myLikes, setMyLikes] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*, profiles(name, username, photos)")
      .order("created_at", { ascending: false });

    const { data: allLikes } = await supabase.from("post_likes").select("post_id, user_id");
    const counts = {};
    (allLikes || []).forEach((l) => {
      counts[l.post_id] = (counts[l.post_id] || 0) + 1;
    });
    const withCounts = (data || []).map((p) => ({ ...p, like_count: counts[p.id] || 0 }));
    setPosts(withCounts);

    const map = {};
    (allLikes || []).filter((l) => l.user_id === profile.id).forEach((l) => (map[l.post_id] = true));
    setMyLikes(map);
    setLoading(false);
  }

  async function toggleLike(post) {
    const liked = myLikes[post.id];
    setMyLikes((prev) => ({ ...prev, [post.id]: !liked }));
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, like_count: (p.like_count || 0) + (liked ? -1 : 1) } : p))
    );
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", profile.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: profile.id });
    }
  }

  return (
    <div className="p-5">
      {showCreate && (
        <CreatePost
          userId={profile.id}
          onClose={() => setShowCreate(false)}
          onPosted={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {reportTarget && (
        <ReportModal
          reporterId={profile.id}
          targetType="post"
          targetId={reportTarget}
          onClose={() => setReportTarget(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl">Feed</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="w-9 h-9 rounded-full bg-[#FF4D6D] flex items-center justify-center text-white"
        >
          <Plus size={18} />
        </button>
      </div>

      <StoriesBar profile={profile} />

      {loading && <p className="text-center text-[#B8A9C0] text-sm py-8">loading feed...</p>}

      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Grid3x3 size={32} className="text-[#6B5B73]" />
          <p className="text-[#B8A9C0] text-sm">No posts yet. Be the first to share something.</p>
        </div>
      )}

      <div className="space-y-5">
        {posts.map((post) => (
          <div key={post.id} className="bg-[#2A1830] rounded-2xl overflow-hidden border border-white/5">
            <div className="flex items-center gap-2.5 p-3">
              <button onClick={() => onOpenProfile(post.user_id)} className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                <Avatar profile={post.profiles} textSize="text-sm" />
              </button>
              <button onClick={() => onOpenProfile(post.user_id)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{post.profiles?.name}</p>
                <p className="text-[11px] text-[#6B5B73]">@{post.profiles?.username}</p>
              </button>
              <button onClick={() => setReportTarget(post.id)} className="text-[#6B5B73] p-1">
                <Flag size={15} />
              </button>
            </div>

            <div className="bg-black">
              {post.media_type === "video" ? (
                <video src={post.media_url} controls className="w-full max-h-[480px] object-contain" />
              ) : (
                <img src={post.media_url} alt="" className="w-full max-h-[480px] object-cover" />
              )}
            </div>

            <div className="p-3">
              <button onClick={() => toggleLike(post)} className="flex items-center gap-1.5">
                <Heart
                  size={19}
                  className={myLikes[post.id] ? "text-[#FF4D6D]" : "text-[#B8A9C0]"}
                  fill={myLikes[post.id] ? "#FF4D6D" : "none"}
                />
                <span className="text-xs text-[#B8A9C0]">{post.like_count || 0}</span>
              </button>
              {post.caption && <p className="text-sm mt-2">{post.caption}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreatePost({ userId, onClose, onPosted }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const MAX_MB = 20;

  function handlePick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File too big — keep it under ${MAX_MB}MB.`);
      return;
    }
    setError("");
    setFile(f);
    setMediaType(f.type.startsWith("video") ? "video" : "image");
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    const ext = file.name.split(".").pop();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("posts").upload(path, file);
    if (upErr) {
      setBusy(false);
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("posts").getPublicUrl(path);
    const { error: insErr } = await supabase.from("posts").insert({
      user_id: userId,
      media_url: data.publicUrl,
      media_type: mediaType,
      caption: caption.trim() || null,
      visibility,
    });
    setBusy(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onPosted();
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-30 flex items-end sm:items-center justify-center px-4">
      <div className="bg-[#1B0F23] border border-white/10 rounded-2xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">New post</h2>
          <button onClick={onClose} className="text-[#B8A9C0]">
            <X size={20} />
          </button>
        </div>

        {!preview && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-square rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-[#6B5B73]"
          >
            <div className="flex gap-3">
              <Camera size={22} />
              <Video size={22} />
            </div>
            <span className="text-xs">Tap to choose a photo or video</span>
            <span className="text-[10px] text-[#6B5B73]">Max {MAX_MB}MB</span>
          </button>
        )}

        {preview && (
          <div className="rounded-xl overflow-hidden bg-black relative">
            {mediaType === "video" ? (
              <video src={preview} controls className="w-full max-h-72 object-contain" />
            ) : (
              <img src={preview} alt="" className="w-full max-h-72 object-cover" />
            )}
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
            >
              <X size={15} className="text-white" />
            </button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handlePick} className="hidden" />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption (optional)..."
          rows={2}
          className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 mt-4 outline-none focus:border-[#FF4D6D] resize-none text-sm"
        />

        <div className="mt-4">
          <p className="text-xs text-[#B8A9C0] mb-2">Who can see this?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setVisibility("public")}
              className={`flex-1 py-2.5 rounded-xl border text-sm ${
                visibility === "public"
                  ? "bg-[#FF4D6D]/15 border-[#FF4D6D] text-[#FF4D6D]"
                  : "border-white/10 text-[#B8A9C0]"
              }`}
            >
              Everyone
            </button>
            <button
              onClick={() => setVisibility("matches_only")}
              className={`flex-1 py-2.5 rounded-xl border text-sm ${
                visibility === "matches_only"
                  ? "bg-[#FF4D6D]/15 border-[#FF4D6D] text-[#FF4D6D]"
                  : "border-white/10 text-[#B8A9C0]"
              }`}
            >
              Only my matches
            </button>
          </div>
        </div>

        {error && <p className="text-[#FF4D6D] text-xs mt-2">{error}</p>}

        <button
          disabled={!file || busy}
          onClick={submit}
          className="w-full py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium disabled:opacity-30 mt-4"
        >
          {busy ? "Posting..." : "Share post"}
        </button>
      </div>
    </div>
  );
}

function ReportModal({ reporterId, targetType, targetId, onClose }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    await supabase.from("reports").insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: String(targetId),
      reason: reason.trim() || null,
    });
    setBusy(false);
    setDone(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-30 flex items-center justify-center px-6">
      <div className="bg-[#1B0F23] border border-white/10 rounded-2xl w-full max-w-xs p-5">
        {done ? (
          <p className="text-sm text-[#4DD4C0] text-center py-4">Report submitted. Thank you.</p>
        ) : (
          <>
            <h3 className="font-display text-lg mb-1">Report this {targetType}</h3>
            <p className="text-xs text-[#B8A9C0] mb-3">Tell us what's wrong — this stays confidential.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="What's happening..."
              className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF4D6D] resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-full border border-white/10 text-[#B8A9C0] text-sm">
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={submit}
                className="flex-1 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm disabled:opacity-50"
              >
                {busy ? "Sending..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- BROWSE ----------------
function BrowseTab({ profile }) {
  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [passed, setPassed] = useState({});
  const [matchToast, setMatchToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPool();
  }, []);

  async function loadPool() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").neq("id", profile.id);
    setPool(data || []);
    setLoading(false);
  }

  const visible = pool.filter((p) => !passed[p.id]);
  const current = visible[index];

  async function swipe(target, liked) {
    setPassed((prev) => ({ ...prev, [target.id]: true }));

    if (!liked) return;

    await supabase.from("likes").insert({ liker_id: profile.id, liked_id: target.id });

    const { data: reverseLike } = await supabase
      .from("likes")
      .select("id")
      .eq("liker_id", target.id)
      .eq("liked_id", profile.id)
      .maybeSingle();

    if (reverseLike) {
      const [user1_id, user2_id] = [profile.id, target.id].sort();
      await supabase.from("matches").insert({ user1_id, user2_id }).select();
      setMatchToast(target);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-[#B8A9C0] text-sm">loading profiles...</div>;
  }

  return (
    <div className="p-5 relative">
      {matchToast && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-20 px-6">
          <div className="bg-[#2A1830] rounded-2xl p-6 text-center border border-[#FF4D6D]/30 max-w-xs">
            <Sparkles size={28} className="text-[#FFB84D] mx-auto mb-2" />
            <h3 className="font-display text-2xl">It's a match!</h3>
            <p className="text-sm text-[#B8A9C0] mt-2">
              You and {matchToast.name} both liked each other.
            </p>
            <button
              onClick={() => setMatchToast(null)}
              className="w-full mt-5 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm"
            >
              Keep browsing
            </button>
          </div>
        </div>
      )}

      {!current && (
        <div className="h-full min-h-[400px] flex flex-col items-center justify-center px-8 text-center gap-3">
          <Users size={32} className="text-[#6B5B73]" />
          <p className="text-[#B8A9C0] text-sm">
            No more profiles right now. Invite more classmates to join — matching gets better with more people.
          </p>
        </div>
      )}

      {current && (
        <>
          <div className="bg-[#2A1830] rounded-2xl overflow-hidden border border-white/5">
            <div className="aspect-[4/3]">
              <Avatar profile={current} />
            </div>
            <div className="p-5">
              <h2 className="font-display text-2xl">
                {current.name}
                {current.age ? `, ${current.age}` : ""}
              </h2>
              <p className="text-xs text-[#B8A9C0] mt-0.5">{current.college}</p>
              {(current.prompts || []).slice(0, 1).map((p, i) => (
                <div key={i} className="mt-3">
                  <p className="text-[11px] text-[#6B5B73]">{p.q}</p>
                  <p className="text-sm mt-0.5 text-[#F5EDE4]/90">{p.a}</p>
                </div>
              ))}
              <div className="mt-4">
                <p className="text-[11px] text-[#6B5B73] mb-2">looking for</p>
                <div className="flex flex-wrap gap-1.5">
                  {(current.intents || []).map((id) => {
                    const meta = intentMeta(id);
                    const shared = profile.intents?.includes(id);
                    return (
                      <span
                        key={id}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{
                          backgroundColor: meta.color + (shared ? "33" : "1a"),
                          color: meta.color,
                          opacity: shared ? 1 : 0.55,
                        }}
                      >
                        {meta.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mt-6">
            <button
              onClick={() => swipe(current, false)}
              className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center text-[#B8A9C0]"
            >
              <X size={22} />
            </button>
            <button
              onClick={() => swipe(current, true)}
              className="w-16 h-16 rounded-full bg-[#FF4D6D] flex items-center justify-center text-white shadow-lg shadow-[#FF4D6D]/20"
            >
              <Heart size={24} fill="white" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- MATCHES ----------------
function MatchesTab({ myId, onOpen }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("matches")
      .select("*")
      .or(`user1_id.eq.${myId},user2_id.eq.${myId}`);

    if (!data) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      data.map(async (m) => {
        const otherId = m.user1_id === myId ? m.user2_id : m.user1_id;
        const { data: otherProfile } = await supabase
          .from("profiles")
          .select("name, photos")
          .eq("id", otherId)
          .maybeSingle();
        return {
          ...m,
          otherId,
          otherName: otherProfile?.name || "Someone",
          otherPhoto: otherProfile?.photos?.[0],
        };
      })
    );
    setMatches(enriched);
    setLoading(false);
  }

  if (loading) return <div className="p-8 text-center text-[#B8A9C0] text-sm">loading matches...</div>;

  if (matches.length === 0) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center px-8 text-center gap-3">
        <MessageCircle size={32} className="text-[#6B5B73]" />
        <p className="text-[#B8A9C0] text-sm">No matches yet. Keep browsing — mutual likes show up here.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-2.5">
      {matches.map((m) => (
        <button
          key={m.id}
          onClick={() => onOpen(m)}
          className="w-full flex items-center gap-3 bg-[#2A1830] rounded-xl p-3.5 text-left border border-white/5"
        >
          <div className="w-11 h-11 rounded-full overflow-hidden shrink-0">
            <Avatar profile={{ name: m.otherName, photos: m.otherPhoto ? [m.otherPhoto] : [] }} textSize="text-lg" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{m.otherName}</p>
            <p className="text-xs text-[#6B5B73]">Tap to chat</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------- PROFILE ----------------
function ProfileTab({ profile, onLogout, onUpdate }) {
  const [matchCount, setMatchCount] = useState(null);
  const [followerCount, setFollowerCount] = useState(null);
  const [followingCount, setFollowingCount] = useState(null);
  const [view, setView] = useState("main"); // main | edit | settings | followers | following
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const { count: mCount } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`);
    setMatchCount(mCount ?? 0);

    const { count: followers } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("liked_id", profile.id);
    setFollowerCount(followers ?? 0);

    const { count: following } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("liker_id", profile.id);
    setFollowingCount(following ?? 0);
  }

  if (view === "edit") {
    return (
      <EditProfile
        profile={profile}
        onDone={() => {
          onUpdate();
          setView("main");
        }}
        onCancel={() => setView("main")}
      />
    );
  }

  if (view === "settings") {
    return <SettingsScreen onBack={() => setView("main")} onLogout={onLogout} />;
  }

  if (view === "followers" || view === "following") {
    return (
      <FollowListScreen
        myId={profile.id}
        mode={view}
        onBack={() => setView("main")}
      />
    );
  }

  const photos = profile.photos || [];

  return (
    <div className="p-5">
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-30 flex items-center justify-center px-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-[80vh] max-w-full rounded-xl object-contain" />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl">Your profile</h1>
        <button
          onClick={() => setView("settings")}
          className="w-9 h-9 rounded-full bg-[#2A1830] flex items-center justify-center text-[#B8A9C0]"
        >
          <Settings size={17} />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border-2 border-[#FF4D6D]/40">
          <Avatar profile={profile} textSize="text-2xl" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-xl leading-tight">
            {profile.name}
            {profile.age ? `, ${profile.age}` : ""}
          </h2>
          <p className="text-xs text-[#B8A9C0] mt-0.5">
            @{profile.username} · {profile.college}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <button
          onClick={() => setView("followers")}
          className="bg-[#2A1830] rounded-xl py-3 text-center border border-white/5"
        >
          <p className="font-display text-xl">{followerCount === null ? "—" : followerCount}</p>
          <p className="text-[11px] text-[#6B5B73] mt-0.5">Followers</p>
        </button>
        <button
          onClick={() => setView("following")}
          className="bg-[#2A1830] rounded-xl py-3 text-center border border-white/5"
        >
          <p className="font-display text-xl">{followingCount === null ? "—" : followingCount}</p>
          <p className="text-[11px] text-[#6B5B73] mt-0.5">Following</p>
        </button>
        <div className="bg-[#2A1830] rounded-xl py-3 text-center border border-white/5">
          <p className="font-display text-xl">{matchCount === null ? "—" : matchCount}</p>
          <p className="text-[11px] text-[#6B5B73] mt-0.5">Matches</p>
        </div>
        <div className="bg-[#2A1830] rounded-xl py-3 text-center border border-white/5">
          <p className="font-display text-xl">{photos.length}</p>
          <p className="text-[11px] text-[#6B5B73] mt-0.5">Photos</p>
        </div>
      </div>

      <p className="text-[10px] text-[#6B5B73] -mt-3 mb-5 px-1">
        Only visible to you — no one else can see who likes you until you match.
      </p>

      <button
        onClick={() => setView("edit")}
        className="w-full py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium mb-5"
      >
        Edit Profile
      </button>

      {(profile.prompts || []).length > 0 && (
        <div className="space-y-3 mb-5">
          {profile.prompts.map((p, i) => (
            <div key={i} className="bg-[#2A1830] rounded-xl p-4 border border-white/5">
              <p className="text-[11px] text-[#FFB84D]">{p.q}</p>
              <p className="text-sm mt-1">{p.a}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5">
        <p className="text-[11px] text-[#6B5B73] mb-2">you're looking for</p>
        <div className="flex flex-wrap gap-1.5">
          {(profile.intents || []).map((id) => {
            const meta = intentMeta(id);
            return (
              <span
                key={id}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: meta.color + "22", color: meta.color }}
              >
                {meta.label}
              </span>
            );
          })}
        </div>
      </div>

      {photos.length > 0 && (
        <div>
          <p className="text-[11px] text-[#6B5B73] mb-2">your photos</p>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((url) => (
              <button
                key={url}
                onClick={() => setLightbox(url)}
                className="aspect-square rounded-lg overflow-hidden bg-[#2A1830]"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 mt-6 px-1 pb-4">
        <ShieldCheck size={14} className="text-[#6B5B73] mt-0.5 shrink-0" />
        <p className="text-[11px] text-[#6B5B73]">
          This is a test build for your college. Full version will add ID verification before wider launch.
        </p>
      </div>
    </div>
  );
}

// ---------------- FOLLOW LIST ----------------
function FollowListScreen({ myId, mode, onBack }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [mode]);

  async function load() {
    setLoading(true);
    if (mode === "followers") {
      const { data } = await supabase.from("likes").select("liker_id").eq("liked_id", myId);
      const ids = (data || []).map((l) => l.liker_id);
      if (ids.length === 0) {
        setPeople([]);
        setLoading(false);
        return;
      }
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
      setPeople(profiles || []);
    } else {
      const { data } = await supabase.from("likes").select("liked_id").eq("liker_id", myId);
      const ids = (data || []).map((l) => l.liked_id);
      if (ids.length === 0) {
        setPeople([]);
        setLoading(false);
        return;
      }
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
      setPeople(profiles || []);
    }
    setLoading(false);
  }

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-[#B8A9C0]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl">{mode === "followers" ? "Followers" : "Following"}</h1>
      </div>

      {loading && <p className="text-center text-[#B8A9C0] text-sm py-8">loading...</p>}

      {!loading && people.length === 0 && (
        <p className="text-center text-[#6B5B73] text-sm py-8">
          {mode === "followers" ? "No one has liked you yet." : "You haven't liked anyone yet."}
        </p>
      )}

      <div className="space-y-2.5">
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-3 bg-[#2A1830] rounded-xl p-3 border border-white/5">
            <div className="w-11 h-11 rounded-full overflow-hidden shrink-0">
              <Avatar profile={p} textSize="text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-[#6B5B73]">@{p.username}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- EDIT PROFILE ----------------
function EditProfile({ profile, onDone, onCancel }) {
  const [name, setName] = useState(profile.name || "");
  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const [college, setCollege] = useState(profile.college || "");
  const [gender, setGender] = useState(profile.gender || "");
  const [photos, setPhotos] = useState(profile.photos || []);
  const [uploading, setUploading] = useState(false);
  const [intents, setIntents] = useState(profile.intents || []);
  const [selectedPrompts, setSelectedPrompts] = useState(profile.prompts || []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  function toggleIntent(id) {
    setIntents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, 6 - photos.length);
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        setPhotos((prev) => [...prev, data.publicUrl]);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(url) {
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  function addPromptSlot() {
    if (selectedPrompts.length >= 3) return;
    const used = selectedPrompts.map((p) => p.q);
    const next = PROMPT_OPTIONS.find((p) => !used.includes(p));
    if (next) setSelectedPrompts((prev) => [...prev, { q: next, a: "" }]);
  }

  function updatePromptQuestion(index, q) {
    setSelectedPrompts((prev) => prev.map((p, i) => (i === index ? { ...p, q } : p)));
  }

  function updatePromptAnswer(index, a) {
    setSelectedPrompts((prev) => prev.map((p, i) => (i === index ? { ...p, a } : p)));
  }

  function removePrompt(index) {
    setSelectedPrompts((prev) => prev.filter((_, i) => i !== index));
  }

  const ageNum = parseInt(age, 10);
  const canSave = name.trim() && college.trim() && ageNum >= 18 && photos.length >= 1 && intents.length > 0;

  async function save() {
    setBusy(true);
    setError("");
    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        age: ageNum,
        college,
        gender,
        photos,
        intents,
        prompts: selectedPrompts.filter((p) => p.a.trim()),
      })
      .eq("id", profile.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onCancel} className="text-[#B8A9C0]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl">Edit profile</h1>
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-[11px] text-[#6B5B73] mb-2">photos</p>
          <div className="grid grid-cols-3 gap-2.5">
            {photos.map((url) => (
              <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-[#2A1830]">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(url)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ))}
            {photos.length < 6 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-[#6B5B73]"
              >
                {uploading ? <span className="text-xs">uploading...</span> : <Plus size={18} />}
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
        </div>

        <div>
          <label className="text-xs text-[#B8A9C0] block mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-[#B8A9C0] block mb-1.5">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
            />
          </div>
          <div className="flex-[2]">
            <label className="text-xs text-[#B8A9C0] block mb-1.5">College</label>
            <input
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-[#B8A9C0] block mb-1.5">Gender</label>
          <div className="flex gap-2">
            {["Woman", "Man", "Other"].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-4 py-2 rounded-full text-sm border ${
                  gender === g ? "bg-[#FF4D6D] border-[#FF4D6D] text-white" : "border-white/10 text-[#B8A9C0]"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] text-[#6B5B73] mb-2">looking for</p>
          <div className="grid grid-cols-1 gap-2">
            {INTENTS.map((intent) => {
              const active = intents.includes(intent.id);
              return (
                <button
                  key={intent.id}
                  onClick={() => toggleIntent(intent.id)}
                  className="text-left px-4 py-2.5 rounded-xl border"
                  style={
                    active
                      ? { backgroundColor: intent.color + "22", borderColor: intent.color }
                      : { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#2A1830" }
                  }
                >
                  <span className="text-sm" style={{ color: active ? intent.color : "#F5EDE4" }}>
                    {intent.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[11px] text-[#6B5B73] mb-2">prompts</p>
          <div className="space-y-3">
            {selectedPrompts.map((p, i) => (
              <div key={i} className="bg-[#2A1830] rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <select
                    value={p.q}
                    onChange={(e) => updatePromptQuestion(i, e.target.value)}
                    className="bg-transparent text-[#FFB84D] text-sm font-medium outline-none"
                  >
                    {PROMPT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#2A1830]">
                        {opt}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => removePrompt(i)} className="text-[#6B5B73]">
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  value={p.a}
                  onChange={(e) => updatePromptAnswer(i, e.target.value)}
                  rows={2}
                  className="w-full bg-transparent text-sm outline-none resize-none placeholder-[#6B5B73]"
                />
              </div>
            ))}
            {selectedPrompts.length < 3 && (
              <button
                onClick={addPromptSlot}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 text-[#B8A9C0] text-sm flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add a prompt
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-[#FF4D6D] text-xs">{error}</p>}

        <button
          disabled={!canSave || busy}
          onClick={save}
          className="w-full py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium disabled:opacity-30 mb-8"
        >
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ---------------- SETTINGS ----------------
function SettingsScreen({ onBack, onLogout }) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-[#B8A9C0]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl">Settings</h1>
      </div>

      <div className="space-y-2.5">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 bg-[#2A1830] rounded-xl p-4 text-left border border-white/5"
        >
          <LogOut size={18} className="text-[#B8A9C0]" />
          <span className="text-sm">Log out</span>
        </button>
      </div>

      <p className="text-[11px] text-[#6B5B73] mt-6 px-1">
        Need to delete your account or report a problem? That's not automated yet in this test build —
        reach out to whoever invited you to the pilot.
      </p>
    </div>
  );
}

// ---------------- CHAT ----------------
function ChatRoom({ match, myId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const otherName = match.otherName || "Them";

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`messages:${match.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${match.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function load() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", match.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
  }

  async function send() {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    await supabase.from("messages").insert({ match_id: match.id, sender_id: myId, content });
  }

  return (
    <div className="flex flex-col min-h-[70vh]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button onClick={onBack} className="text-[#B8A9C0]">
          <ArrowLeft size={20} />
        </button>
        <span className="font-display text-lg">{otherName}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loading && <p className="text-xs text-[#6B5B73] text-center">loading chat...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-[#6B5B73] text-center mt-6">
            No messages yet. Break the ice — say something real.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === myId ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                m.sender_id === myId ? "bg-[#FF4D6D] text-white" : "bg-[#2A1830] text-[#F5EDE4]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-white/5 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="flex-1 bg-[#2A1830] border border-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#FF4D6D]"
        />
        <button
          onClick={send}
          className="w-10 h-10 rounded-full bg-[#FF4D6D] flex items-center justify-center text-white shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
