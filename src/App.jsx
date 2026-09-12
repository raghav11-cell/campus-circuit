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
  Repeat2,
  Share2,
  Bookmark,
  Pin,
  AtSign,
  Hash,
  UserPlus,
  MoreHorizontal,
  Palette,
  Lock,
  Reply,
  Edit3,
} from "lucide-react";

const INTENTS = [
  { id: "serious", label: "Serious Relationship", color: "#FF4D6D" },
  { id: "casual", label: "Casual Dating", color: "#FFB84D" },
  { id: "fwb", label: "Friends with Benefits", color: "#C77DFF" },
  { id: "friend", label: "Just Friends", color: "#4DD4C0" },
  { id: "online", label: "Online Friend", color: "#5DA9FF" },
  { id: "situationship", label: "Situationship", color: "#FF8C42" },
  { id: "other", label: "Other", color: "#9AA5B1" },
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

function calculateAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function wordCount(str) {
  return str.trim() ? str.trim().split(/\s+/).length : 0;
}

function PasswordField({ value, onChange, placeholder, label }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      {label && <label className="text-xs text-[var(--cc-muted)] block mb-1.5">{label}</label>}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          minLength={6}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 pr-12 outline-none focus:border-[#FF4D6D]"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--cc-dim)] text-xs"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function Avatar({ profile, size = "w-full h-full", textSize = "text-5xl" }) {
  const photo = profile?.photos?.[0];
  if (photo) {
    return <img src={photo} alt={profile.name} className={`${size} object-cover`} />;
  }
  return (
    <div className={`${size} flex items-center justify-center bg-gradient-to-br from-[#FF4D6D]/30 via-[#C77DFF]/20 to-[#5DA9FF]/20`}>
      <span className={`font-display ${textSize} text-[var(--cc-text)]/90`}>
        {profile?.name?.[0]?.toUpperCase() || "?"}
      </span>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("browse");
  const [activeChat, setActiveChat] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [viewingProfileId, setViewingProfileId] = useState(null);
  const [pendingSignup, setPendingSignup] = useState(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("cc_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  useEffect(() => {
    const seen = localStorage.getItem("cc_seen_intro");
    if (!seen) setShowIntro(true);

    const savedPending = localStorage.getItem("cc_pending_signup");
    if (savedPending) {
      try {
        setPendingSignup(JSON.parse(savedPending));
      } catch (e) {}
    }

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

  useEffect(() => {
    if (!profile) return;
    async function pingPresence() {
      await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", profile.id);
    }
    pingPresence();
    const interval = setInterval(pingPresence, 60000);
    return () => clearInterval(interval);
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--cc-bg)]">
        <p className="text-[var(--cc-muted)] text-sm">loading...</p>
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
    return <AuthScreen onSignedUp={setPendingSignup} />;
  }

  if (!profile) {
    return <CreateProfile userId={session.user.id} initialData={pendingSignup} onDone={loadProfile} />;
  }

  return (
    <div className="h-screen bg-[var(--cc-bg)] text-[var(--cc-text)] font-sans flex flex-col overflow-hidden">
      <style>{fontStyles}</style>

      <header className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/5 max-w-md mx-auto w-full shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[#FFB84D]" />
          <span className="font-display text-lg tracking-tight">Campus Circuit</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSearch(true)} className="text-[var(--cc-muted)]">
            <Search size={20} />
          </button>
          <button onClick={() => setShowNotifications(true)} className="relative text-[var(--cc-muted)]">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF4D6D] text-white text-[10px] flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <div className="text-xs text-[var(--cc-muted)]">{profile.college}</div>
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
          onStartChat={(matchRow) => {
            setViewingProfileId(null);
            setActiveChat(matchRow);
            setTab("chatroom");
          }}
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
          onOpenChat={async (matchId) => {
            const { data } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
            setShowNotifications(false);
            if (data) {
              setActiveChat(data);
              setTab("chatroom");
            } else {
              setTab("matches");
            }
          }}
        />
      )}

      <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full">
        {tab === "browse" && <BrowseTab profile={profile} />}
        {tab === "explore" && <FeedTab profile={profile} onOpenProfile={setViewingProfileId} />}
        {tab === "matches" && (
          <MatchesTab
            myId={profile.id}
            onOpen={(m) => {
              setActiveChat(m);
              setTab("chatroom");
            }}
          />
        )}
        {tab === "profile" && (
          <ProfileTab
            profile={profile}
            onLogout={handleLogout}
            onUpdate={loadProfile}
            onOpenProfile={setViewingProfileId}
          />
        )}
        {tab === "chatroom" && activeChat && (
          <ChatRoom match={activeChat} myId={profile.id} onBack={() => setTab("matches")} />
        )}
      </main>

      {tab !== "chatroom" && (
        <nav className="flex border-t border-white/5 bg-[var(--cc-bg)] max-w-md mx-auto w-full shrink-0">
          {[
            { id: "browse", icon: Heart, label: "Browse" },
            { id: "matches", icon: MessageCircle, label: "Message" },
            { id: "explore", icon: Grid3x3, label: "Explore" },
            { id: "profile", icon: User, label: "Account" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                tab === t.id ? "text-[#FF4D6D]" : "text-[var(--cc-dim)]"
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

function NotificationsPanel({ myId, onClose, onRead, onNavigate, onOpenChat }) {
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
    if (n.type === "like") return `${name} hunted you`;
    if (n.type === "match") return `You matched with ${name}`;
    if (n.type === "message") return `${name} sent you a message`;
    if (n.type === "comment") return `${name} commented on your post`;
    if (n.type === "repost") return `${name} reposted your post`;
    if (n.type === "tagged") return `${name} tagged you in a post`;
    if (n.type === "saved") return `${name} saved your post`;
    return "";
  }

  function iconFor(type) {
    if (type === "like") return <Heart size={16} className="text-[#FF4D6D]" />;
    if (type === "match") return <Sparkles size={16} className="text-[#FFB84D]" />;
    if (type === "comment") return <MessageCircle size={16} className="text-[#4DD4C0]" />;
    if (type === "repost") return <Repeat2 size={16} className="text-[#4DD4C0]" />;
    if (type === "tagged") return <UserPlus size={16} className="text-[#5DA9FF]" />;
    if (type === "saved") return <Bookmark size={16} className="text-[#FFB84D]" />;
    return <MessageCircle size={16} className="text-[#5DA9FF]" />;
  }

  async function confirmTag(n, accept) {
    if (!n.post_id) return;
    if (accept) {
      const { data: post } = await supabase.from("posts").select("confirmed_tag_ids").eq("id", n.post_id).maybeSingle();
      const next = Array.from(new Set([...(post?.confirmed_tag_ids || []), myId]));
      await supabase.from("posts").update({ confirmed_tag_ids: next }).eq("id", n.post_id);
    }
    await supabase.from("notifications").delete().eq("id", n.id);
    setItems((prev) => prev.filter((i) => i.id !== n.id));
  }

  function handleClick(n) {
    if (n.type === "tagged" && n.post_id) return; // handled by confirm/decline buttons instead
    if ((n.type === "message" || n.type === "match") && n.match_id) {
      onOpenChat(n.match_id);
      return;
    }
    const dest = n.type === "like" || n.type === "tagged" ? "profile" : "matches";
    onNavigate(dest);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-30 flex items-start justify-center px-4 pt-16">
      <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-md max-h-[75vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="font-display text-xl">Notifications</h2>
          <button onClick={onClose} className="text-[var(--cc-muted)]">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading && <p className="text-center text-[var(--cc-muted)] text-sm py-8">loading...</p>}
          {!loading && items.length === 0 && (
            <p className="text-center text-[var(--cc-dim)] text-sm py-8">No notifications yet.</p>
          )}
          {items.map((n) => (
            <div key={n.id} className="border-b border-white/5">
              <button
                onClick={() => handleClick(n)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                  <Avatar profile={n.profiles} textSize="text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{messageFor(n)}</p>
                  <p className="text-[11px] text-[var(--cc-dim)] mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {iconFor(n.type)}
              </button>
              {n.type === "tagged" && n.post_id && (
                <div className="flex gap-2 px-5 pb-3 -mt-1">
                  <button
                    onClick={() => confirmTag(n, true)}
                    className="px-3 py-1.5 rounded-full bg-[#FF4D6D] text-white text-xs"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => confirmTag(n, false)}
                    className="px-3 py-1.5 rounded-full border border-white/10 text-[var(--cc-muted)] text-xs"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
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
    <div className="fixed inset-0 bg-[var(--cc-bg)] z-30 flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <button onClick={onClose} className="text-[var(--cc-muted)]">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 relative">
            <SearchIcon />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or @username"
              className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#FF4D6D]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {loading && <p className="text-center text-[var(--cc-muted)] text-sm py-8">searching...</p>}
          {!loading && query.trim() && results.length === 0 && (
            <p className="text-center text-[var(--cc-dim)] text-sm py-8">No one found.</p>
          )}
          <div className="space-y-2.5 pb-6">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpenProfile(p.id)}
                className="w-full flex items-center gap-3 bg-[var(--cc-surface)] rounded-xl p-3 border border-white/5 text-left"
              >
                <div className="w-11 h-11 rounded-full overflow-hidden shrink-0">
                  <Avatar profile={p} textSize="text-lg" />
                </div>
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--cc-dim)]">
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
    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cc-dim)]" />
  );
}

// ---------------- USER PROFILE VIEW (someone else's profile) ----------------
function UserProfileView({ userId, myId, onBack, onOpenProfile, onStartChat }) {
  const [target, setTarget] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [huntCount, setHuntCount] = useState(null);
  const [huntedCount, setHuntedCount] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [crushed, setCrushed] = useState(false);
  const [crushBusy, setCrushBusy] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [showCrushList, setShowCrushList] = useState(null); // "hunt" | "hunted" | null
  const [hasStory, setHasStory] = useState(false);
  const [showPhotoChoice, setShowPhotoChoice] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [nextProfiles, setNextProfiles] = useState([]); // [{profile, seen}]
  const carouselRef = useRef(null);

  useEffect(() => {
    load();
    setPhotoIndex(0);
  }, [userId]);

  async function load() {
    setLoading(true);
    const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setTarget(p);

    const { data: mine } = await supabase.from("profiles").select("*").eq("id", myId).maybeSingle();
    setMyProfile(mine);

    const { count: huntedC } = await supabase
      .from("crushes")
      .select("*", { count: "exact", head: true })
      .eq("target_id", userId);
    setHuntedCount(huntedC ?? 0);

    const { count: huntC } = await supabase
      .from("crushes")
      .select("*", { count: "exact", head: true })
      .eq("sender_id", userId);
    setHuntCount(huntC ?? 0);

    const { data: activeStories } = await supabase
      .from("stories")
      .select("id")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    setHasStory((activeStories || []).length > 0);

    if (userId !== myId) {
      const { data: myCrush } = await supabase
        .from("crushes")
        .select("id")
        .eq("sender_id", myId)
        .eq("target_id", userId)
        .maybeSingle();
      setCrushed(!!myCrush);

      await supabase.from("profile_views").insert({ profile_id: userId, viewer_id: myId });

      // "up next" — a couple of other profiles, with a seen/unseen signal
      const { data: others } = await supabase.from("profiles").select("*").neq("id", userId).neq("id", myId).limit(10);
      const { data: myViews } = await supabase.from("profile_views").select("profile_id").eq("viewer_id", myId);
      const seenSet = new Set((myViews || []).map((v) => v.profile_id));
      const picks = (others || []).slice(0, 2).map((prof) => ({ profile: prof, seen: seenSet.has(prof.id) }));
      setNextProfiles(picks);
    }

    setLoading(false);
  }

  async function toggleCrush() {
    setCrushBusy(true);
    if (crushed) {
      await supabase.from("crushes").delete().eq("sender_id", myId).eq("target_id", userId);
      setCrushed(false);
      const [u1, u2] = [myId, userId].sort();
      await supabase
        .from("matches")
        .update({ is_official: false })
        .eq("user1_id", u1)
        .eq("user2_id", u2)
        .eq("is_official", true);
    } else {
      await supabase.from("crushes").insert({ sender_id: myId, target_id: userId });
      setCrushed(true);
    }
    setCrushBusy(false);
  }

  async function sendMessage() {
    setStartingChat(true);
    const [user1_id, user2_id] = [myId, userId].sort();
    const { data: existing } = await supabase
      .from("matches")
      .select("*")
      .eq("user1_id", user1_id)
      .eq("user2_id", user2_id)
      .maybeSingle();
    let matchRow = existing;
    if (!matchRow) {
      const { data: created } = await supabase
        .from("matches")
        .insert({ user1_id, user2_id })
        .select()
        .maybeSingle();
      matchRow = created;
    }
    setStartingChat(false);
    if (matchRow) onStartChat(matchRow);
  }

  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setPhotoIndex(idx);
  }

  // "Vibe match" — how many things this person shares with me
  function vibeScore() {
    if (!myProfile || !target) return null;
    const bits = [];
    const sharedIntents = (target.intents || []).filter((i) => (myProfile.intents || []).includes(i));
    if (sharedIntents.length > 0) bits.push(`${sharedIntents.length} shared intent${sharedIntents.length > 1 ? "s" : ""}`);
    if (myProfile.age && target.age && Math.abs(myProfile.age - target.age) <= 2) bits.push("similar age");
    if (myProfile.college && target.college && myProfile.college === target.college) bits.push("same college");
    if (myProfile.city && target.city && myProfile.city === target.city) bits.push("same city");
    return bits;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[var(--cc-bg)] z-30 flex items-center justify-center">
        <p className="text-[var(--cc-muted)] text-sm">loading...</p>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="fixed inset-0 bg-[var(--cc-bg)] z-30 flex flex-col items-center justify-center gap-3">
        <p className="text-[var(--cc-muted)] text-sm">Profile not found.</p>
        <button onClick={onBack} className="text-[#FF4D6D] text-sm">
          Go back
        </button>
      </div>
    );
  }

  const isMe = userId === myId;
  const photos = target.photos || [];
  const vibe = vibeScore();

  return (
    <div className="fixed inset-0 bg-[var(--cc-bg)] z-30 flex flex-col">
      {lightbox && lightbox.url && (
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

      <div className="flex items-center gap-3 px-5 py-4 shrink-0 max-w-md mx-auto w-full">
        <button onClick={onBack} className="text-[var(--cc-muted)]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl">@{target.username}</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto w-full pb-28">
          {photos.length > 0 ? (
            <div>
              <div
                ref={carouselRef}
                onScroll={handleCarouselScroll}
                className="flex overflow-x-auto snap-x snap-mandatory"
              >
                {photos.map((url, i) => (
                  <button
                    key={url}
                    onClick={() => setLightbox({ url, type: "image" })}
                    className="w-full shrink-0 snap-center aspect-[3/4]"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              {photos.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 py-2.5">
                  {photos.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === photoIndex ? "w-5 bg-[#FF4D6D]" : "w-1.5 bg-white/15"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => (hasStory ? setShowPhotoChoice(true) : null)}
              className="w-full aspect-[3/4] flex items-center justify-center"
            >
              <Avatar profile={target} textSize="text-5xl" />
            </button>
          )}

          <div className="px-5 pt-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display text-2xl leading-tight">
                {target.name}
                {target.show_details && target.age ? `, ${target.age}` : ""}
              </h2>
              {hasStory && (
                <button
                  onClick={() => setShowPhotoChoice(true)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF4D6D]/15 text-[#FF4D6D] border border-[#FF4D6D]/30"
                >
                  story
                </button>
              )}
            </div>
            {target.show_details && (target.city || target.college) && (
              <p className="text-xs text-[var(--cc-muted)] mb-2">
                {target.city}
                {target.college ? ` · ${target.college}` : ""}
              </p>
            )}

            {vibe && vibe.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#4DD4C0]/10 border border-[#4DD4C0]/30 rounded-full px-3 py-1.5 w-fit mb-4 mt-2">
                <Sparkles size={12} className="text-[#4DD4C0]" />
                <span className="text-[11px] text-[#4DD4C0]">{vibe.join(" · ")}</span>
              </div>
            )}

            {showPhotoChoice && (
              <div
                className="fixed inset-0 bg-black/70 z-40 flex items-end sm:items-center justify-center px-6"
                onClick={() => setShowPhotoChoice(false)}
              >
                <div
                  className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-xs p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowPhotoChoice(false);
                      setLightbox({ url: target.photos?.[0], type: "image" });
                    }}
                    className="w-full py-3 text-sm text-center border-b border-white/5"
                  >
                    View profile photo
                  </button>
                  <button
                    onClick={() => {
                      setShowPhotoChoice(false);
                      setShowStoryViewer(true);
                    }}
                    className="w-full py-3 text-sm text-center text-[#FF4D6D]"
                  >
                    View story
                  </button>
                </div>
              </div>
            )}

            {showStoryViewer && (
              <SingleUserStoryViewer userId={userId} myId={myId} profile={target} onClose={() => setShowStoryViewer(false)} />
            )}

            {target.bio && <p className="text-sm text-[var(--cc-text)]/90 mb-4">{target.bio}</p>}

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <button
                onClick={() => setShowCrushList("hunt")}
                className="bg-[var(--cc-surface)] rounded-xl py-3 text-center border border-white/5"
              >
                <p className="font-display text-lg">{huntCount === null ? "—" : huntCount}</p>
                <p className="text-[10px] text-[var(--cc-dim)] mt-0.5">Hunt</p>
              </button>
              <button
                onClick={() => setShowCrushList("hunted")}
                className="bg-[var(--cc-surface)] rounded-xl py-3 text-center border border-white/5"
              >
                <p className="font-display text-lg">{huntedCount === null ? "—" : huntedCount}</p>
                <p className="text-[10px] text-[var(--cc-dim)] mt-0.5">Hunted</p>
              </button>
            </div>

            {showCrushList && (
              <CrushListModal
                targetId={userId}
                mode={showCrushList}
                onClose={() => setShowCrushList(null)}
                onOpenProfile={onOpenProfile}
              />
            )}

            {(target.prompts || []).length > 0 && (
              <div className="space-y-3 mb-5">
                {target.prompts.map((p, i) => (
                  <div key={i} className="bg-[var(--cc-surface)] rounded-xl p-4 border border-white/5">
                    <p className="text-[11px] text-[#FFB84D]">{p.q}</p>
                    <p className="text-sm mt-1">{p.a}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-6">
              <p className="text-[11px] text-[var(--cc-dim)] mb-2">looking for</p>
              <div className="flex flex-wrap gap-1.5">
                {(target.intents || []).map((id) => {
                  const meta = intentMeta(id);
                  const shared = (myProfile?.intents || []).includes(id);
                  return (
                    <span
                      key={id}
                      className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{ backgroundColor: meta.color + (shared ? "33" : "22"), color: meta.color }}
                    >
                      {shared && <Check size={10} />}
                      {id === "other" ? target.intent_other || "Other" : meta.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {!isMe && nextProfiles.length > 0 && (
              <div>
                <p className="text-[11px] text-[var(--cc-dim)] mb-2">up next</p>
                <div className="flex gap-2.5">
                  {nextProfiles.map((np) => (
                    <button
                      key={np.profile.id}
                      onClick={() => onOpenProfile(np.profile.id)}
                      className="flex-1 bg-[var(--cc-surface)] rounded-xl p-2.5 border border-white/5 text-left relative"
                    >
                      <div className="w-full aspect-square rounded-lg overflow-hidden mb-1.5 relative">
                        <Avatar profile={np.profile} textSize="text-lg" />
                        {np.seen && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                            <Check size={11} className="text-[#4DD4C0]" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium truncate">{np.profile.name}</p>
                      {np.seen && <p className="text-[9px] text-[#4DD4C0]">already seen</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isMe && (
        <div className="shrink-0 border-t border-white/5 bg-[var(--cc-bg)] px-5 py-3 max-w-md mx-auto w-full">
          <div className="flex gap-2.5">
            <button
              onClick={toggleCrush}
              disabled={crushBusy}
              className={`flex-1 py-3 rounded-full border text-sm flex items-center justify-center gap-1.5 ${
                crushed ? "bg-[#FF4D6D]/15 border-[#FF4D6D] text-[#FF4D6D]" : "border-white/10 text-[var(--cc-muted)]"
              }`}
            >
              <Heart size={16} fill={crushed ? "#FF4D6D" : "none"} />
              {crushed ? "Hunted" : "Hunt"}
            </button>
            <button
              onClick={sendMessage}
              disabled={startingChat}
              className="flex-1 py-3 rounded-full bg-[#FF4D6D] text-white text-sm flex items-center justify-center gap-1.5"
            >
              <MessageCircle size={16} />
              {startingChat ? "Opening..." : "Message"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- CRUSH LIST (public) ----------------
function CrushListModal({ targetId, mode, onClose, onOpenProfile }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const isHunted = mode === "hunted";

  useEffect(() => {
    (async () => {
      const { data } = isHunted
        ? await supabase.from("crushes").select("sender_id").eq("target_id", targetId)
        : await supabase.from("crushes").select("target_id").eq("sender_id", targetId);
      const ids = (data || []).map((c) => (isHunted ? c.sender_id : c.target_id));
      if (ids.length === 0) {
        setPeople([]);
        setLoading(false);
        return;
      }
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      setPeople(profs || []);
      setLoading(false);
    })();
  }, [targetId, mode]);

  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-end sm:items-center justify-center px-4">
      <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="font-display text-xl">{isHunted ? "Hunted by" : "Hunting"}</h2>
          <button onClick={onClose} className="text-[var(--cc-muted)]">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {loading && <p className="text-center text-[var(--cc-muted)] text-sm py-6">loading...</p>}
          {!loading && people.length === 0 && (
            <p className="text-center text-[var(--cc-dim)] text-sm py-6">Nothing here yet.</p>
          )}
          <div className="space-y-2.5">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onClose();
                  onOpenProfile(p.id);
                }}
                className="w-full flex items-center gap-3 bg-[var(--cc-surface)] rounded-xl p-3 border border-white/5 text-left"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                  <Avatar profile={p} textSize="text-base" />
                </div>
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--cc-dim)]">@{p.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SingleUserStoryViewer({ userId, myId, profile, onClose }) {
  const [stories, setStories] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      setStories(data || []);
    })();
  }, [userId]);

  if (stories === null) return null;
  if (stories.length === 0) return null;

  return (
    <StoryViewer
      data={{ groups: [{ profile, userId, stories }], startIndex: 0 }}
      myId={myId}
      onClose={onClose}
    />
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
    <div className="min-h-screen bg-[var(--cc-bg)] text-[var(--cc-text)] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6">
        <div className="flex justify-end pt-6">
          <button onClick={onDone} className="text-xs text-[var(--cc-dim)]">
            Skip
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 -mt-10">
          <div className="text-6xl">{s.icon}</div>
          <h1 className="font-display text-3xl leading-tight max-w-xs">{s.title}</h1>
          <p className="text-[var(--cc-muted)] text-sm max-w-xs">{s.subtitle}</p>
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthScreen({ onSignedUp }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [state, setStateVal] = useState("");
  const [city, setCity] = useState("");
  const [mobile, setMobile] = useState("");
  const [college, setCollege] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const age = calculateAge(dob);
  const signupValid =
    EMAIL_RE.test(email) &&
    password.length >= 6 &&
    name.trim() &&
    dob &&
    age !== null &&
    age >= 18 &&
    country.trim() &&
    state.trim() &&
    city.trim() &&
    mobile.trim().length >= 7;

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (mode === "signup" && !EMAIL_RE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "signup" && dob && age < 18) {
      setError("You must be 18 or older to join.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        const pending = { name, dob, age, country, state, city, mobile, college };
        localStorage.setItem("cc_pending_signup", JSON.stringify(pending));
        onSignedUp(pending);

        if (!signUpData.session) {
          // email confirmation is required — no session yet
          setMode("signup-sent");
        }
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
    mode === "forgot" || mode === "forgot-sent"
      ? "Reset your password"
      : mode === "signup-sent"
      ? "Confirm your email"
      : "Campus Circuit";

  return (
    <div className="min-h-screen bg-[var(--cc-bg)] text-[var(--cc-text)] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 pt-12 pb-10">
        <h1 className="font-display text-3xl leading-tight">{title}</h1>
        <p className="text-[var(--cc-muted)] text-sm mt-2 mb-6">
          {mode === "forgot"
            ? "Enter the email on your account and we'll send you a reset link."
            : mode === "forgot-sent"
            ? "Check your inbox — tap the link we sent to set a new password."
            : mode === "signup-sent"
            ? "We sent a confirmation link to your email. Tap it to activate your account, then come back and log in."
            : mode === "signup"
            ? "Say what you're actually looking for. No guessing games."
            : "Welcome back."}
        </p>

        {mode === "signup-sent" && (
          <div className="space-y-3">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium"
            >
              Open my email
            </a>
            <button
              onClick={() => setMode("login")}
              className="w-full py-3 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm"
            >
              Back to log in
            </button>
          </div>
        )}

        {mode === "forgot-sent" && (
          <div className="space-y-3">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium"
            >
              Open my email
            </a>
            <button
              onClick={() => setMode("login")}
              className="w-full py-3 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm"
            >
              Back to log in
            </button>
          </div>
        )}

        {mode !== "forgot-sent" && mode !== "signup-sent" && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-[var(--cc-muted)] block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
              />
            </div>

            {mode !== "forgot" && (
              <PasswordField
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
                className="text-xs text-[var(--cc-muted)] block"
              >
                Forgot password?
              </button>
            )}

            {mode === "signup" && (
              <>
                <div className="pt-2 border-t border-white/5">
                  <label className="text-xs text-[var(--cc-muted)] block mb-1.5 mt-3">Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya"
                    className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--cc-muted)] block mb-1.5">Date of birth *</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                  />
                  {dob && age !== null && (
                    <p className={`text-[11px] mt-1 ${age >= 18 ? "text-[var(--cc-dim)]" : "text-[#FF4D6D]"}`}>
                      {age >= 18 ? `Age ${age}` : "You must be 18 or older to join."}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-[var(--cc-muted)] block mb-1.5">Country *</label>
                    <input
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="India"
                      className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-[var(--cc-muted)] block mb-1.5">State *</label>
                    <input
                      required
                      value={state}
                      onChange={(e) => setStateVal(e.target.value)}
                      placeholder="Uttar Pradesh"
                      className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--cc-muted)] block mb-1.5">City *</label>
                  <input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Meerut"
                    className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--cc-muted)] block mb-1.5">Mobile number *</label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit number"
                    className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                  />
                  <p className="text-[10px] text-[var(--cc-dim)] mt-1">
                    Not verified yet in this test build — kept private either way.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-[var(--cc-muted)] block mb-1.5">College (optional)</label>
                  <input
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g. DU, IIT Delhi"
                    className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
                  />
                </div>
              </>
            )}

            {error && <p className="text-[#FF4D6D] text-xs">{error}</p>}
            <button
              disabled={busy || (mode === "signup" && !signupValid)}
              className="w-full py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium disabled:opacity-40"
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

        {(mode === "signup" || mode === "login") && (
          <button
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="text-xs text-[var(--cc-muted)] mt-5 text-center"
          >
            {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
          </button>
        )}
        {mode === "forgot" && (
          <button onClick={() => setMode("login")} className="text-xs text-[var(--cc-muted)] mt-5 text-center">
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
    <div className="min-h-screen bg-[var(--cc-bg)] text-[var(--cc-text)] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 pt-16">
        <h1 className="font-display text-3xl leading-tight">Set a new password</h1>
        {done ? (
          <p className="text-[#4DD4C0] text-sm mt-4">Password updated. Taking you back in...</p>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-6">
            <PasswordField
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
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
function CreateProfile({ userId, initialData, onDone }) {
  const [step, setStep] = useState(0); // 0 username/bio/gender, 1 photo, 2 intents, 3 prompts, 4 review
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [intents, setIntents] = useState([]);
  const [intentOther, setIntentOther] = useState("");
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const data = initialData || {};

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
      const { data: existing } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      setUsernameStatus(existing ? "taken" : "available");
    }, 500);
    return () => clearTimeout(timeout);
  }, [username]);

  function handleBioChange(val) {
    if (wordCount(val) <= 101) setBio(val);
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, 6 - photos.length);
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file);
      if (!error) {
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        setPhotos((prev) => [...prev, pub.publicUrl]);
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

  const step0Valid =
    username.length >= 3 &&
    usernameStatus === "available" &&
    bio.trim().length > 0 &&
    gender &&
    (!intents.includes("other") || intentOther.trim());
  const step1Valid = photos.length >= 1;
  const step2Valid = intents.length > 0 && (!intents.includes("other") || intentOther.trim());

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
      name: data.name,
      username,
      dob: data.dob || null,
      age: data.age,
      country: data.country,
      state: data.state,
      city: data.city,
      mobile: data.mobile,
      college: data.college || null,
      gender,
      bio,
      photos,
      intents,
      intent_other: intents.includes("other") ? intentOther.trim() : null,
      prompts: selectedPrompts.filter((p) => p.a.trim()),
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("username") ? "That username was just taken — try another." : error.message
      );
      return;
    }
    localStorage.removeItem("cc_pending_signup");
    onDone();
  }

  const totalSteps = 5;

  return (
    <div className="min-h-screen bg-[var(--cc-bg)] text-[var(--cc-text)] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 pt-8">
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-[#FF4D6D]" : "bg-white/10"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h1 className="font-display text-2xl mb-1">Almost there</h1>
            <div>
              <label className="text-xs text-[var(--cc-muted)] block mb-1.5">Username *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--cc-dim)] text-sm">@</span>
                <input
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="yourname"
                  className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl pl-8 pr-4 py-3 outline-none focus:border-[#FF4D6D]"
                />
              </div>
              {usernameStatus === "checking" && <p className="text-[11px] text-[var(--cc-dim)] mt-1">checking...</p>}
              {usernameStatus === "available" && (
                <p className="text-[11px] text-[#4DD4C0] mt-1">@{username} is available</p>
              )}
              {usernameStatus === "taken" && <p className="text-[11px] text-[#FF4D6D] mt-1">Already taken</p>}
              {usernameStatus === "invalid" && (
                <p className="text-[11px] text-[#FF4D6D] mt-1">At least 3 characters</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-[var(--cc-muted)]">Bio *</label>
                <span className="text-[11px] text-[var(--cc-dim)]">{wordCount(bio)}/101 words</span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => handleBioChange(e.target.value)}
                placeholder="Tell people a bit about you..."
                rows={4}
                className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D] resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--cc-muted)] block mb-1.5">Gender *</label>
              <div className="flex gap-2">
                {["Woman", "Man", "Other"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`px-4 py-2 rounded-full text-sm border ${
                      gender === g ? "bg-[#FF4D6D] border-[#FF4D6D] text-white" : "border-white/10 text-[var(--cc-muted)]"
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
            <h1 className="font-display text-2xl mb-1">Profile photo</h1>
            <p className="text-sm text-[var(--cc-muted)] mb-4">Required. Real photos build trust. You can add more later.</p>
            <div className="grid grid-cols-3 gap-2.5">
              {photos.map((url) => (
                <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-[var(--cc-surface)]">
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
                  className="aspect-square rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-[var(--cc-dim)]"
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
            <p className="text-sm text-[var(--cc-muted)] mb-4">Pick as many as apply — this is how we match you.</p>
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
                        : { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "var(--cc-surface)" }
                    }
                  >
                    <span className="text-sm" style={{ color: active ? intent.color : "var(--cc-text)" }}>
                      {intent.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {intents.includes("other") && (
              <input
                value={intentOther}
                onChange={(e) => setIntentOther(e.target.value)}
                placeholder="Tell us what you're looking for..."
                className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 mt-3 outline-none focus:border-[#FF4D6D]"
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display text-2xl mb-1">Show some personality</h1>
            <p className="text-sm text-[var(--cc-muted)] mb-4">
              Optional, but profiles with prompts get way more matches.
            </p>
            <div className="space-y-3">
              {selectedPrompts.map((p, i) => (
                <div key={i} className="bg-[var(--cc-surface)] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <select
                      value={p.q}
                      onChange={(e) => updatePromptQuestion(i, e.target.value)}
                      className="bg-transparent text-[#FFB84D] text-sm font-medium outline-none"
                    >
                      {PROMPT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt} className="bg-[var(--cc-surface)]">
                          {opt}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => removePrompt(i)} className="text-[var(--cc-dim)]">
                      <X size={16} />
                    </button>
                  </div>
                  <textarea
                    value={p.a}
                    onChange={(e) => updatePromptAnswer(i, e.target.value)}
                    placeholder="Type your answer..."
                    rows={2}
                    className="w-full bg-transparent text-sm outline-none resize-none placeholder-[var(--cc-dim)]"
                  />
                </div>
              ))}
              {selectedPrompts.length < 3 && (
                <button
                  onClick={addPromptSlot}
                  className="w-full py-3 rounded-xl border border-dashed border-white/20 text-[var(--cc-muted)] text-sm flex items-center justify-center gap-2"
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
            <p className="text-sm text-[var(--cc-muted)] mb-4">This is what others will see.</p>
            <div className="bg-[var(--cc-surface)] rounded-2xl overflow-hidden border border-white/5">
              <div className="aspect-[4/3]">
                <Avatar profile={{ name: data.name, photos }} />
              </div>
              <div className="p-4">
                <h2 className="font-display text-xl">
                  {data.name}, {data.age}
                </h2>
                <p className="text-xs text-[var(--cc-muted)]">
                  @{username} · {data.city}, {data.state}
                </p>
                {data.college && <p className="text-xs text-[var(--cc-dim)] mt-0.5">{data.college}</p>}
                {bio && <p className="text-sm mt-3 text-[var(--cc-text)]/90">{bio}</p>}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {intents.map((id) => {
                    const meta = intentMeta(id);
                    return (
                      <span
                        key={id}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: meta.color + "22", color: meta.color }}
                      >
                        {id === "other" ? intentOther : meta.label}
                      </span>
                    );
                  })}
                </div>
                {selectedPrompts
                  .filter((p) => p.a.trim())
                  .map((p, i) => (
                    <div key={i} className="mt-3">
                      <p className="text-[11px] text-[var(--cc-dim)]">{p.q}</p>
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
              className="px-5 py-3 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm"
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
  const [groups, setGroups] = useState([]);
  const [myStories, setMyStories] = useState([]);
  const [viewerData, setViewerData] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: hunters } = await supabase.from("crushes").select("sender_id").eq("target_id", profile.id);
    const hunterIds = new Set((hunters || []).map((h) => h.sender_id));

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

    // Only show stories from people who have hunted you.
    const others = Object.values(byUser)
      .filter((g) => g.userId !== profile.id && hunterIds.has(g.userId))
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
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-[var(--cc-bg)]">
                <Avatar profile={profile} textSize="text-lg" />
              </div>
            </div>
            {myStories.length === 0 && (
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#FF4D6D] flex items-center justify-center border-2 border-[var(--cc-bg)]">
                <Plus size={11} className="text-white" />
              </div>
            )}
          </div>
          <span className="text-[10px] text-[var(--cc-muted)]">Your story</span>
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
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-[var(--cc-bg)]">
                <Avatar profile={g.profile} textSize="text-lg" />
              </div>
            </div>
            <span className="text-[10px] text-[var(--cc-muted)] max-w-[56px] truncate">{g.profile?.name}</span>
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
  const [sentEmoji, setSentEmoji] = useState(null);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const videoRef = useRef(null);
  const STICKERS = ["❤️", "🔥", "😂", "😮", "👏", "😢"];

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
        if (paused) return;
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

  // Sending a story reaction/reply always goes through, even if the other
  // person hasn't replied to your last message yet (that rule only applies
  // to regular chat, not story replies).
  async function sendStoryReply(text) {
    if (group.userId === myId) return;
    setPaused(true);
    const [user1_id, user2_id] = [myId, group.userId].sort();
    let { data: match } = await supabase
      .from("matches")
      .select("id")
      .eq("user1_id", user1_id)
      .eq("user2_id", user2_id)
      .maybeSingle();
    if (!match) {
      const { data: created } = await supabase
        .from("matches")
        .insert({ user1_id, user2_id })
        .select("id")
        .maybeSingle();
      match = created;
    }
    if (match) {
      await supabase.from("messages").insert({ match_id: match.id, sender_id: myId, content: text });
    }
    setSentEmoji(text);
    setTimeout(() => {
      setSentEmoji(null);
      setPaused(false);
    }, 900);
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

          {sentEmoji && (
            <div className="absolute inset-x-0 bottom-20 flex justify-center pointer-events-none">
              <div className="bg-white/15 backdrop-blur px-4 py-2 rounded-full text-white text-sm">
                {sentEmoji} sent
              </div>
            </div>
          )}
        </div>

        {group.userId !== myId && (
          <div className="flex items-center justify-center gap-3 px-4 py-3">
            {STICKERS.map((s) => (
              <button
                key={s}
                onClick={() => sendStoryReply(s)}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg active:scale-90 transition-transform"
              >
                {s}
              </button>
            ))}
          </div>
        )}
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
  const [mySaves, setMySaves] = useState({});
  const [openPost, setOpenPost] = useState(null);
  const [postMenuFor, setPostMenuFor] = useState(null);
  const seenIds = useRef(new Set());
  const markedRef = useRef(new Set());
  const observerRef = useRef(null);

  useEffect(() => {
    load();
    return () => observerRef.current?.disconnect();
  }, []);

  function observePost(node, postId) {
    if (!node) return;
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.dataset.postId;
              if (id && !markedRef.current.has(id)) {
                markedRef.current.add(id);
                supabase.from("post_views").insert({ post_id: id, viewer_id: profile.id }).then(() => {});
              }
            }
          });
        },
        { threshold: 0.6 }
      );
    }
    node.dataset.postId = postId;
    observerRef.current.observe(node);
  }

  // Relevance score: same interests > close in age (within ~2yrs) > same college > same state/city > everything else.
  function relevanceScore(authorProfile) {
    if (!authorProfile) return 0;
    let score = 0;
    const sharedIntents = (authorProfile.intents || []).filter((i) => (profile.intents || []).includes(i)).length;
    if (sharedIntents > 0) score += 10000 + sharedIntents * 10;
    if (authorProfile.age != null && profile.age != null) {
      const diff = Math.abs(authorProfile.age - profile.age);
      if (diff <= 2) score += 1000 - diff * 100;
    }
    if (authorProfile.college && profile.college && authorProfile.college === profile.college) score += 100;
    if (authorProfile.state && profile.state && authorProfile.state === profile.state) score += 20;
    if (authorProfile.city && profile.city && authorProfile.city === profile.city) score += 10;
    return score;
  }

  async function load() {
    setLoading(true);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("posts")
      .select("*, profiles(name, username, photos, intents, age, college, state, city)")
      .gte("created_at", twoDaysAgo)
      .order("created_at", { ascending: false });

    const { data: myViews } = await supabase.from("post_views").select("post_id").eq("viewer_id", profile.id);
    const seenSet = new Set((myViews || []).map((v) => v.post_id));
    seenIds.current = seenSet;

    const { data: allLikes } = await supabase.from("post_likes").select("post_id, user_id");
    const likeCounts = {};
    (allLikes || []).forEach((l) => {
      likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
    });

    const { data: allComments } = await supabase.from("post_comments").select("post_id");
    const commentCounts = {};
    (allComments || []).forEach((c) => {
      commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
    });

    const withCounts = (data || []).map((p) => ({
      ...p,
      like_count: likeCounts[p.id] || 0,
      comment_count: commentCounts[p.id] || 0,
      _seen: seenSet.has(p.id),
      _score: relevanceScore(p.profiles),
    }));

    // Unseen posts first, ranked by relevance (interests > age > college > state/city > rest);
    // already-seen posts follow the same ranking, after unseen ones.
    const byRelevance = (a, b) => b._score - a._score;
    const unseen = withCounts.filter((p) => !p._seen).sort(byRelevance);
    const seen = withCounts.filter((p) => p._seen).sort(byRelevance);
    setPosts([...unseen, ...seen]);

    const likeMap = {};
    (allLikes || []).filter((l) => l.user_id === profile.id).forEach((l) => (likeMap[l.post_id] = true));
    setMyLikes(likeMap);

    const { data: saves } = await supabase.from("saved_posts").select("post_id").eq("user_id", profile.id);
    const saveMap = {};
    (saves || []).forEach((s) => (saveMap[s.post_id] = true));
    setMySaves(saveMap);

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

  async function toggleSave(post) {
    const saved = mySaves[post.id];
    setMySaves((prev) => ({ ...prev, [post.id]: !saved }));
    if (saved) {
      await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", profile.id);
    } else {
      await supabase.from("saved_posts").insert({ post_id: post.id, user_id: profile.id });
    }
  }

  function sharePost(post) {
    const url = post.media_url;
    if (navigator.share) {
      navigator.share({ title: "Campus Circuit", text: post.caption || "Check this out", url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      alert("Link copied!");
    }
  }

  async function deletePost(postId) {
    if (!confirm("Delete this post? This can't be undone.")) return;
    await supabase.from("posts").delete().eq("id", postId);
    setPostMenuFor(null);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
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
      {openPost && (
        <PostDetail
          post={openPost}
          myId={profile.id}
          onClose={() => {
            setOpenPost(null);
            load();
          }}
          onOpenProfile={onOpenProfile}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl">Explore</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="w-9 h-9 rounded-full bg-[#FF4D6D] flex items-center justify-center text-white"
        >
          <Plus size={18} />
        </button>
      </div>

      <StoriesBar profile={profile} />

      {loading && <p className="text-center text-[var(--cc-muted)] text-sm py-8">loading...</p>}

      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Grid3x3 size={32} className="text-[var(--cc-dim)]" />
          <p className="text-[var(--cc-muted)] text-sm">No posts from the last 2 days yet.</p>
        </div>
      )}

      <div className="space-y-5">
        {posts.map((post) => (
          <div
            key={post.id}
            ref={(node) => observePost(node, post.id)}
            className="bg-[var(--cc-surface)] rounded-2xl overflow-hidden border border-white/5"
          >
            <div className="flex items-center gap-2.5 p-3">
              <button onClick={() => onOpenProfile(post.user_id)} className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                <Avatar profile={post.profiles} textSize="text-sm" />
              </button>
              <button onClick={() => onOpenProfile(post.user_id)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{post.profiles?.name}</p>
                <p className="text-[11px] text-[var(--cc-dim)]">@{post.profiles?.username}</p>
              </button>
              {post.user_id === profile.id ? (
                <button onClick={() => setPostMenuFor(postMenuFor === post.id ? null : post.id)} className="text-[var(--cc-dim)] p-1">
                  <MoreHorizontal size={17} />
                </button>
              ) : (
                <button onClick={() => setReportTarget(post.id)} className="text-[var(--cc-dim)] p-1">
                  <Flag size={15} />
                </button>
              )}
            </div>

            {postMenuFor === post.id && (
              <div className="px-3 pb-2 flex justify-end">
                <button
                  onClick={() => deletePost(post.id)}
                  className="text-xs text-[#FF4D6D] px-3 py-1.5 rounded-full border border-[#FF4D6D]/30"
                >
                  Delete post
                </button>
              </div>
            )}

            <button className="block w-full bg-black" onClick={() => setOpenPost(post)}>
              {post.media_type === "video" ? (
                <video src={post.media_url} controls className="w-full max-h-[480px] object-contain" />
              ) : (
                <img src={post.media_url} alt="" className="w-full max-h-[480px] object-cover" />
              )}
            </button>

            <div className="p-3">
              <div className="flex items-center gap-4">
                <button onClick={() => toggleLike(post)} className="flex items-center gap-1.5">
                  <Heart
                    size={19}
                    className={myLikes[post.id] ? "text-[#FF4D6D]" : "text-[var(--cc-muted)]"}
                    fill={myLikes[post.id] ? "#FF4D6D" : "none"}
                  />
                  <span className="text-xs text-[var(--cc-muted)]">{post.like_count || 0}</span>
                </button>
                <button onClick={() => setOpenPost(post)} className="flex items-center gap-1.5">
                  <MessageCircle size={18} className="text-[var(--cc-muted)]" />
                  <span className="text-xs text-[var(--cc-muted)]">{post.comment_count || 0}</span>
                </button>
                <button onClick={() => sharePost(post)} className="text-[var(--cc-muted)]">
                  <Share2 size={17} />
                </button>
                <button onClick={() => toggleSave(post)} className="ml-auto text-[var(--cc-muted)]">
                  <Bookmark size={17} fill={mySaves[post.id] ? "var(--cc-text)" : "none"} />
                </button>
              </div>
              {post.caption && (
                <p className="text-sm mt-2">
                  <button onClick={() => onOpenProfile(post.user_id)} className="font-medium">
                    {post.profiles?.name}
                  </button>{" "}
                  {post.caption}
                </p>
              )}
              {(post.hashtags || []).length > 0 && (
                <p className="text-xs text-[#5DA9FF] mt-1">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
              )}
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
  const [taggedUsers, setTaggedUsers] = useState([]); // [{id, name, username}]
  const [showTagPicker, setShowTagPicker] = useState(false);
  const fileInputRef = useRef(null);
  const MAX_MB = 20;

  function extractHashtags(text) {
    const matches = text.match(/#([a-zA-Z0-9_]+)/g) || [];
    return [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
  }

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
      tagged_user_ids: taggedUsers.map((u) => u.id),
      hashtags: extractHashtags(caption),
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
      <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">New post</h2>
          <button onClick={onClose} className="text-[var(--cc-muted)]">
            <X size={20} />
          </button>
        </div>

        {!preview && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-square rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-[var(--cc-dim)]"
          >
            <div className="flex gap-3">
              <Camera size={22} />
              <Video size={22} />
            </div>
            <span className="text-xs">Tap to choose a photo or video</span>
            <span className="text-[10px] text-[var(--cc-dim)]">Max {MAX_MB}MB</span>
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
          placeholder="Write a caption... use #hashtags too"
          rows={2}
          className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 mt-4 outline-none focus:border-[#FF4D6D] resize-none text-sm"
        />

        <button
          onClick={() => setShowTagPicker(true)}
          className="w-full flex items-center gap-2 text-sm text-[var(--cc-muted)] mt-2.5 py-1"
        >
          <UserPlus size={15} />
          {taggedUsers.length > 0 ? `Tagged: ${taggedUsers.map((u) => "@" + u.username).join(", ")}` : "Tag people"}
        </button>

        {showTagPicker && (
          <TagPeoplePicker
            selected={taggedUsers}
            onChange={setTaggedUsers}
            onClose={() => setShowTagPicker(false)}
          />
        )}

        <div className="mt-4">
          <p className="text-xs text-[var(--cc-muted)] mb-2">Who can see this?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setVisibility("public")}
              className={`flex-1 py-2.5 rounded-xl border text-sm ${
                visibility === "public"
                  ? "bg-[#FF4D6D]/15 border-[#FF4D6D] text-[#FF4D6D]"
                  : "border-white/10 text-[var(--cc-muted)]"
              }`}
            >
              Everyone
            </button>
            <button
              onClick={() => setVisibility("matches_only")}
              className={`flex-1 py-2.5 rounded-xl border text-sm ${
                visibility === "matches_only"
                  ? "bg-[#FF4D6D]/15 border-[#FF4D6D] text-[#FF4D6D]"
                  : "border-white/10 text-[var(--cc-muted)]"
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

// ---------------- TAG PEOPLE PICKER ----------------
function TagPeoplePicker({ selected, onChange, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const q = query.trim();
      const { data } = await supabase
        .from("profiles")
        .select("id, name, username, photos")
        .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(15);
      setResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function toggle(p) {
    const exists = selected.find((u) => u.id === p.id);
    if (exists) {
      onChange(selected.filter((u) => u.id !== p.id));
    } else {
      onChange([...selected, { id: p.id, name: p.name, username: p.username }]);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-40 flex items-end sm:items-center justify-center px-4">
      <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-md p-5 max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg">Tag people</h3>
          <button onClick={onClose} className="text-[var(--cc-muted)]">
            <X size={20} />
          </button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or @username"
          className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#FF4D6D] mb-3"
        />
        <div className="overflow-y-auto flex-1 space-y-2">
          {results.map((p) => {
            const isSelected = selected.some((u) => u.id === p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p)}
                className={`w-full flex items-center gap-3 rounded-xl p-2.5 border text-left ${
                  isSelected ? "bg-[#FF4D6D]/15 border-[#FF4D6D]" : "bg-[var(--cc-surface)] border-white/5"
                }`}
              >
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                  <Avatar profile={p} textSize="text-sm" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{p.name}</p>
                  <p className="text-xs text-[var(--cc-dim)]">@{p.username}</p>
                </div>
                {isSelected && <Check size={16} className="text-[#FF4D6D]" />}
              </button>
            );
          })}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm">
          Done
        </button>
      </div>
    </div>
  );
}

// ---------------- POST DETAIL (comments) ----------------
function PostDetail({ post, myId, onClose, onOpenProfile }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // { id, username }
  const [commentLikes, setCommentLikes] = useState({});
  const [menuFor, setMenuFor] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const isPostOwner = myId === post.user_id;
  const pinnedCount = comments.filter((c) => c.pinned).length;

  async function deletePostAndClose() {
    if (!confirm("Delete this post? This can't be undone.")) return;
    await supabase.from("posts").delete().eq("id", post.id);
    onClose();
  }

  useEffect(() => {
    load();
    supabase.from("post_views").insert({ post_id: post.id, viewer_id: myId }).then(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("post_comments")
      .select("*, profiles(name, username, photos)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments(data || []);

    const ids = (data || []).map((c) => c.id);
    if (ids.length > 0) {
      const { data: likes } = await supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", ids);
      const counts = {};
      const mine = {};
      (likes || []).forEach((l) => {
        counts[l.comment_id] = (counts[l.comment_id] || 0) + 1;
        if (l.user_id === myId) mine[l.comment_id] = true;
      });
      setCommentLikes({ counts, mine });
    }

    const { data: myLike } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", myId)
      .maybeSingle();
    setLiked(!!myLike);

    setLoading(false);
  }

  async function toggleLike() {
    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", myId);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: myId });
    }
  }

  async function sendComment() {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    setReplyTo(null);
    await supabase.from("post_comments").insert({
      post_id: post.id,
      user_id: myId,
      content,
      parent_comment_id: replyTo?.id || null,
    });
    load();
  }

  async function toggleCommentLike(comment) {
    const isLiked = commentLikes.mine?.[comment.id];
    if (isLiked) {
      await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", myId);
    } else {
      await supabase.from("comment_likes").insert({ comment_id: comment.id, user_id: myId });
    }
    load();
  }

  async function deleteComment(comment) {
    await supabase.from("post_comments").delete().eq("id", comment.id);
    setMenuFor(null);
    load();
  }

  async function toggleHide(comment) {
    await supabase.from("post_comments").update({ hidden: !comment.hidden }).eq("id", comment.id);
    setMenuFor(null);
    load();
  }

  async function togglePin(comment) {
    if (!comment.pinned && pinnedCount >= 2) {
      alert("You can pin up to 2 comments only.");
      setMenuFor(null);
      return;
    }
    await supabase.from("post_comments").update({ pinned: !comment.pinned }).eq("id", comment.id);
    setMenuFor(null);
    load();
  }

  const topLevel = comments.filter((c) => !c.parent_comment_id && (!c.hidden || isPostOwner));
  const pinned = topLevel.filter((c) => c.pinned);
  const rest = topLevel.filter((c) => !c.pinned);
  const ordered = [...pinned, ...rest];
  const repliesFor = (id) => comments.filter((c) => c.parent_comment_id === id && (!c.hidden || isPostOwner));

  function CommentRow({ comment, isReply }) {
    const count = commentLikes.counts?.[comment.id] || 0;
    const isLiked = commentLikes.mine?.[comment.id];
    const mine = comment.user_id === myId;
    return (
      <div className={`flex gap-2.5 ${isReply ? "ml-9 mt-2.5" : "mt-4"}`}>
        <button onClick={() => onOpenProfile(comment.user_id)} className="w-7 h-7 rounded-full overflow-hidden shrink-0">
          <Avatar profile={comment.profiles} textSize="text-xs" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="bg-[var(--cc-surface)] rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5">
              <button onClick={() => onOpenProfile(comment.user_id)} className="text-xs font-medium">
                {comment.profiles?.name}
              </button>
              {comment.pinned && <Pin size={10} className="text-[#FFB84D]" />}
              {comment.hidden && <span className="text-[9px] text-[var(--cc-dim)]">(hidden)</span>}
            </div>
            <p className="text-sm mt-0.5 break-words">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-[10px] text-[var(--cc-dim)]">{timeAgo(comment.created_at)}</span>
            <button onClick={() => toggleCommentLike(comment)} className="flex items-center gap-1">
              <Heart size={11} className={isLiked ? "text-[#FF4D6D]" : "text-[var(--cc-dim)]"} fill={isLiked ? "#FF4D6D" : "none"} />
              {count > 0 && <span className="text-[10px] text-[var(--cc-dim)]">{count}</span>}
            </button>
            <button
              onClick={() => setReplyTo({ id: comment.id, username: comment.profiles?.username })}
              className="text-[10px] text-[var(--cc-dim)]"
            >
              Reply
            </button>
            <button onClick={() => setMenuFor(menuFor === comment.id ? null : comment.id)} className="text-[10px] text-[var(--cc-dim)]">
              •••
            </button>
          </div>
          {menuFor === comment.id && (
            <div className="flex flex-wrap gap-2 mt-1.5 px-1">
              {(mine || isPostOwner) && (
                <button onClick={() => deleteComment(comment)} className="text-[10px] text-[#FF4D6D]">
                  Delete
                </button>
              )}
              {isPostOwner && (
                <button onClick={() => toggleHide(comment)} className="text-[10px] text-[var(--cc-muted)]">
                  {comment.hidden ? "Unhide" : "Hide"}
                </button>
              )}
              {isPostOwner && (
                <button onClick={() => togglePin(comment)} className="text-[10px] text-[var(--cc-muted)]">
                  {comment.pinned ? "Unpin" : "Pin"}
                </button>
              )}
              <button onClick={() => setReportTarget({ type: "comment", id: comment.id })} className="text-[10px] text-[var(--cc-muted)]">
                Report
              </button>
            </div>
          )}
          {!isReply &&
            repliesFor(comment.id).map((r) => <CommentRow key={r.id} comment={r} isReply />)}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[var(--cc-bg)] z-40 flex flex-col">
      {reportTarget && (
        <ReportModal
          reporterId={myId}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          onClose={() => setReportTarget(null)}
        />
      )}
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <button onClick={onClose} className="text-[var(--cc-muted)]">
            <ArrowLeft size={20} />
          </button>
          <span className="font-display text-lg">Post</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2.5 p-3">
            <button onClick={() => onOpenProfile(post.user_id)} className="w-8 h-8 rounded-full overflow-hidden shrink-0">
              <Avatar profile={post.profiles} textSize="text-sm" />
            </button>
            <button onClick={() => onOpenProfile(post.user_id)} className="flex-1 text-left">
              <p className="text-sm font-medium">{post.profiles?.name}</p>
              <p className="text-[11px] text-[var(--cc-dim)]">@{post.profiles?.username}</p>
            </button>
            {isPostOwner ? (
              <button onClick={() => setPostMenuOpen((v) => !v)} className="text-[var(--cc-dim)] p-1">
                <MoreHorizontal size={17} />
              </button>
            ) : (
              <button onClick={() => setReportTarget({ type: "post", id: post.id })} className="text-[var(--cc-dim)] p-1">
                <Flag size={15} />
              </button>
            )}
          </div>
          {postMenuOpen && (
            <div className="px-3 pb-2 flex justify-end">
              <button
                onClick={deletePostAndClose}
                className="text-xs text-[#FF4D6D] px-3 py-1.5 rounded-full border border-[#FF4D6D]/30"
              >
                Delete post
              </button>
            </div>
          )}

          <div className="bg-black">
            {post.media_type === "video" ? (
              <video src={post.media_url} controls className="w-full max-h-[420px] object-contain" />
            ) : (
              <img src={post.media_url} alt="" className="w-full max-h-[420px] object-cover" />
            )}
          </div>

          <div className="p-3 border-b border-white/5">
            <button onClick={toggleLike} className="flex items-center gap-1.5">
              <Heart size={19} className={liked ? "text-[#FF4D6D]" : "text-[var(--cc-muted)]"} fill={liked ? "#FF4D6D" : "none"} />
              <span className="text-xs text-[var(--cc-muted)]">{likeCount}</span>
            </button>
            {post.caption && (
              <p className="text-sm mt-2">
                <button onClick={() => onOpenProfile(post.user_id)} className="font-medium">
                  {post.profiles?.name}
                </button>{" "}
                {post.caption}
              </p>
            )}
            {(post.hashtags || []).length > 0 && (
              <p className="text-xs text-[#5DA9FF] mt-1">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
            )}
          </div>

          <div className="px-3 pb-4">
            {loading && <p className="text-center text-[var(--cc-muted)] text-sm py-6">loading comments...</p>}
            {!loading && ordered.length === 0 && (
              <p className="text-center text-[var(--cc-dim)] text-sm py-6">No comments yet. Say something.</p>
            )}
            {ordered.map((c) => (
              <CommentRow key={c.id} comment={c} />
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-white/5">
          {replyTo && (
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-[11px] text-[var(--cc-dim)]">Replying to @{replyTo.username}</span>
              <button onClick={() => setReplyTo(null)} className="text-[11px] text-[var(--cc-dim)]">
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendComment()}
              placeholder="Add a comment... use @username to tag"
              className="flex-1 bg-[var(--cc-surface)] border border-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#FF4D6D]"
            />
            <button
              onClick={sendComment}
              className="w-10 h-10 rounded-full bg-[#FF4D6D] flex items-center justify-center text-white shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
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
      <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-xs p-5">
        {done ? (
          <p className="text-sm text-[#4DD4C0] text-center py-4">Report submitted. Thank you.</p>
        ) : (
          <>
            <h3 className="font-display text-lg mb-1">Report this {targetType}</h3>
            <p className="text-xs text-[var(--cc-muted)] mb-3">Tell us what's wrong — this stays confidential.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="What's happening..."
              className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF4D6D] resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm">
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
  const [photoIndex, setPhotoIndex] = useState(0);
  const carouselRef = useRef(null);

  useEffect(() => {
    loadPool();
  }, []);

  useEffect(() => {
    setPhotoIndex(0);
    if (carouselRef.current) carouselRef.current.scrollLeft = 0;
  }, [index]);

  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setPhotoIndex(idx);
  }

  async function loadPool() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").neq("id", profile.id);
    setPool(data || []);
    setLoading(false);
  }

  const visible = pool.filter((p) => !passed[p.id]);
  const current = visible[index];

  function vibeBits(target) {
    if (!target) return [];
    const bits = [];
    const sharedIntents = (target.intents || []).filter((i) => (profile.intents || []).includes(i));
    if (sharedIntents.length > 0) bits.push(`${sharedIntents.length} shared intent${sharedIntents.length > 1 ? "s" : ""}`);
    if (profile.age && target.age && Math.abs(profile.age - target.age) <= 2) bits.push("similar age");
    if (profile.college && target.college && profile.college === target.college) bits.push("same college");
    if (profile.city && target.city && profile.city === target.city) bits.push("same city");
    return bits;
  }

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
      await supabase.from("matches").insert({ user1_id, user2_id, is_official: true }).select();
      setMatchToast(target);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-[var(--cc-muted)] text-sm">loading profiles...</div>;
  }

  const vibe = current ? vibeBits(current) : [];
  const photos = current?.photos || [];

  return (
    <div className="p-5 relative min-h-[calc(100vh-140px)] flex flex-col justify-center">
      {matchToast && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-20 px-6">
          <div className="bg-[var(--cc-surface)] rounded-2xl p-6 text-center border border-[#FF4D6D]/30 max-w-xs">
            <Sparkles size={28} className="text-[#FFB84D] mx-auto mb-2" />
            <h3 className="font-display text-2xl">It's a match!</h3>
            <p className="text-sm text-[var(--cc-muted)] mt-2">
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
          <Users size={32} className="text-[var(--cc-dim)]" />
          <p className="text-[var(--cc-muted)] text-sm">
            No more profiles right now. Invite more classmates to join — matching gets better with more people.
          </p>
        </div>
      )}

      {current && (
        <>
          <div className="bg-[var(--cc-surface)] rounded-2xl overflow-hidden border border-white/5">
            {photos.length > 0 ? (
              <div>
                <div
                  ref={carouselRef}
                  onScroll={handleCarouselScroll}
                  className="flex overflow-x-auto snap-x snap-mandatory"
                >
                  {photos.map((url) => (
                    <div key={url} className="w-full shrink-0 snap-center aspect-[4/3]">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                {photos.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 py-2">
                    {photos.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i === photoIndex ? "w-5 bg-[#FF4D6D]" : "w-1.5 bg-white/15"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-[4/3]">
                <Avatar profile={current} />
              </div>
            )}
            <div className="p-5">
              <h2 className="font-display text-2xl">
                {current.name}
                {current.age ? `, ${current.age}` : ""}
              </h2>
              <p className="text-xs text-[var(--cc-muted)] mt-0.5">
                {current.city}
                {current.college ? ` · ${current.college}` : ""}
              </p>

              {vibe.length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#4DD4C0]/10 border border-[#4DD4C0]/30 rounded-full px-3 py-1.5 w-fit mt-2.5">
                  <Sparkles size={12} className="text-[#4DD4C0]" />
                  <span className="text-[11px] text-[#4DD4C0]">{vibe.join(" · ")}</span>
                </div>
              )}

              {current.bio && <p className="text-sm mt-3 text-[var(--cc-text)]/80 line-clamp-2">{current.bio}</p>}
              {(current.prompts || []).slice(0, 1).map((p, i) => (
                <div key={i} className="mt-3">
                  <p className="text-[11px] text-[var(--cc-dim)]">{p.q}</p>
                  <p className="text-sm mt-0.5 text-[var(--cc-text)]/90">{p.a}</p>
                </div>
              ))}
              <div className="mt-4">
                <p className="text-[11px] text-[var(--cc-dim)] mb-2">looking for</p>
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
                        {id === "other" ? current.intent_other || "Other" : meta.label}
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
              className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center text-[var(--cc-muted)]"
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
  const [unlockFor, setUnlockFor] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

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
        const isUser1 = m.user1_id === myId;
        const otherId = isUser1 ? m.user2_id : m.user1_id;
        const { data: otherProfile } = await supabase
          .from("profiles")
          .select("name, photos, last_seen")
          .eq("id", otherId)
          .maybeSingle();

        const { data: lastMsgs } = await supabase
          .from("messages")
          .select("content, sender_id, read_at, created_at")
          .eq("match_id", m.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const lastMsg = lastMsgs?.[0];

        const online = otherProfile?.last_seen
          ? Date.now() - new Date(otherProfile.last_seen).getTime() < 3 * 60 * 1000
          : false;

        return {
          ...m,
          otherId,
          otherName: otherProfile?.name || "Someone",
          otherPhoto: otherProfile?.photos?.[0],
          online,
          nickname: isUser1 ? m.user1_nickname : m.user2_nickname,
          pinned: isUser1 ? m.user1_pinned : m.user2_pinned,
          lockPin: isUser1 ? m.user1_lock_pin : m.user2_lock_pin,
          lastMsg,
          unread: lastMsg && lastMsg.sender_id !== myId && !lastMsg.read_at,
        };
      })
    );

    enriched.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    setMatches(enriched);
    setLoading(false);
  }

  function openChat(m) {
    if (m.lockPin) {
      setUnlockFor(m);
      setPinInput("");
      setPinError("");
      return;
    }
    onOpen(m);
  }

  function tryUnlock() {
    if (pinInput === unlockFor.lockPin) {
      const target = unlockFor;
      setUnlockFor(null);
      onOpen(target);
    } else {
      setPinError("Wrong PIN");
    }
  }

  if (loading) return <div className="p-8 text-center text-[var(--cc-muted)] text-sm">loading matches...</div>;

  if (matches.length === 0) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center px-8 text-center gap-3">
        <MessageCircle size={32} className="text-[var(--cc-dim)]" />
        <p className="text-[var(--cc-muted)] text-sm">No conversations yet. Message someone from their profile to start.</p>
      </div>
    );
  }

  const officialCount = matches.filter((m) => m.is_official).length;

  return (
    <div className="p-5 space-y-2.5">
      {unlockFor && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center px-6">
          <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-xs p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={16} className="text-[#FF4D6D]" />
              <h3 className="font-display text-lg">Locked chat</h3>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, ""));
                setPinError("");
              }}
              placeholder="4-digit PIN"
              className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-[#FF4D6D]"
              autoFocus
            />
            {pinError && <p className="text-[#FF4D6D] text-xs text-center mt-2">{pinError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setUnlockFor(null)}
                className="flex-1 py-2.5 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm"
              >
                Cancel
              </button>
              <button
                onClick={tryUnlock}
                disabled={pinInput.length !== 4}
                className="flex-1 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm disabled:opacity-40"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-1 px-1">
        <Sparkles size={14} className="text-[#FFB84D]" />
        <p className="text-xs text-[var(--cc-muted)]">
          <span className="font-medium text-[var(--cc-text)]">{officialCount}</span> Matches
        </p>
      </div>
      {matches.map((m) => {
        const displayName = m.nickname || m.otherName;
        return (
          <button
            key={m.id}
            onClick={() => openChat(m)}
            className="w-full flex items-center gap-3 bg-[var(--cc-surface)] rounded-xl p-3.5 text-left border border-white/5 relative"
          >
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full overflow-hidden">
                {m.nickname ? (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FF4D6D]/30 to-[#5DA9FF]/20">
                    <span className="font-display text-lg">{m.nickname[0]?.toUpperCase()}</span>
                  </div>
                ) : (
                  <Avatar profile={{ name: m.otherName, photos: m.otherPhoto ? [m.otherPhoto] : [] }} textSize="text-lg" />
                )}
              </div>
              {m.online && (
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#4DD4C0] border-2 border-[var(--cc-surface)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{displayName}</p>
                {m.pinned && <Pin size={11} className="text-[#FFB84D] shrink-0" />}
                {m.lockPin && <Lock size={11} className="text-[var(--cc-dim)] shrink-0" />}
              </div>
              <p className={`text-xs truncate ${m.unread ? "text-[var(--cc-text)] font-medium" : "text-[var(--cc-dim)]"}`}>
                {m.lastMsg ? m.lastMsg.content : m.is_official ? "Matched" : "Chatting"}
              </p>
            </div>
            {m.unread && <div className="w-2 h-2 rounded-full bg-[#FF4D6D] shrink-0" />}
            {m.is_official && !m.unread && <Sparkles size={16} className="text-[#FFB84D] shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

// ---------------- PROFILE ----------------
function ProfileTab({ profile, onLogout, onUpdate, onOpenProfile }) {
  const [huntCount, setHuntCount] = useState(null);
  const [huntedCount, setHuntedCount] = useState(null);
  const [postCount, setPostCount] = useState(null);
  const [impressions, setImpressions] = useState(null);
  const [view, setView] = useState("main"); // main | edit | settings
  const [lightbox, setLightbox] = useState(null);
  const [showCrushList, setShowCrushList] = useState(null); // "hunt" | "hunted" | null
  const [hasStory, setHasStory] = useState(false);
  const [showPhotoChoice, setShowPhotoChoice] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const { count: huntedC } = await supabase
      .from("crushes")
      .select("*", { count: "exact", head: true })
      .eq("target_id", profile.id);
    setHuntedCount(huntedC ?? 0);

    const { count: huntC } = await supabase
      .from("crushes")
      .select("*", { count: "exact", head: true })
      .eq("sender_id", profile.id);
    setHuntCount(huntC ?? 0);

    const { count: pCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id);
    setPostCount(pCount ?? 0);

    if (profile.show_impressions) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count: vCount } = await supabase
        .from("profile_views")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .gte("created_at", startOfMonth.toISOString());
      setImpressions(vCount ?? 0);
    }

    const { data: activeStories } = await supabase
      .from("stories")
      .select("id")
      .eq("user_id", profile.id)
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    setHasStory((activeStories || []).length > 0);
  }

  function shareProfile() {
    const url = `${window.location.origin}/?u=${profile.username}`;
    if (navigator.share) {
      navigator.share({ title: profile.name, text: `Check out @${profile.username} on Campus Circuit`, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      alert("Profile link copied!");
    }
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
    return (
      <SettingsScreen
        profile={profile}
        onBack={() => setView("main")}
        onLogout={onLogout}
        onUpdate={onUpdate}
      />
    );
  }

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
          className="w-9 h-9 rounded-full bg-[var(--cc-surface)] flex items-center justify-center text-[var(--cc-muted)]"
        >
          <Settings size={17} />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <button
          onClick={() => (hasStory ? setShowPhotoChoice(true) : setLightbox(profile.photos?.[0]))}
          className={`w-20 h-20 rounded-full overflow-hidden shrink-0 border-2 ${
            hasStory ? "border-[#FF4D6D]" : "border-[#FF4D6D]/40"
          }`}
        >
          <Avatar profile={profile} textSize="text-2xl" />
        </button>
        <div className="flex-1">
          <h2 className="font-display text-xl leading-tight">
            {profile.name}
            {profile.show_details && profile.age ? `, ${profile.age}` : ""}
          </h2>
          <p className="text-xs text-[var(--cc-muted)] mt-0.5">
            @{profile.username}
            {profile.show_details && profile.city ? ` · ${profile.city}${profile.state ? `, ${profile.state}` : ""}` : ""}
          </p>
          {profile.show_details && profile.college && (
            <p className="text-[11px] text-[var(--cc-dim)] mt-0.5">{profile.college}</p>
          )}
        </div>
      </div>

      {showPhotoChoice && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-end sm:items-center justify-center px-6" onClick={() => setShowPhotoChoice(false)}>
          <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-xs p-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setShowPhotoChoice(false);
                setLightbox(profile.photos?.[0]);
              }}
              className="w-full py-3 text-sm text-center border-b border-white/5"
            >
              View profile photo
            </button>
            <button
              onClick={() => {
                setShowPhotoChoice(false);
                setShowStoryViewer(true);
              }}
              className="w-full py-3 text-sm text-center text-[#FF4D6D]"
            >
              View my story
            </button>
          </div>
        </div>
      )}

      {showStoryViewer && (
        <SingleUserStoryViewer userId={profile.id} myId={profile.id} profile={profile} onClose={() => setShowStoryViewer(false)} />
      )}

      {profile.bio && <p className="text-sm text-[var(--cc-text)]/90 mb-5">{profile.bio}</p>}

      <div className="grid grid-cols-2 gap-2.5 mb-2">
        <button
          onClick={() => setShowCrushList("hunt")}
          className="bg-[var(--cc-surface)] rounded-xl py-3 text-center border border-white/5"
        >
          <p className="font-display text-xl">{huntCount === null ? "—" : huntCount}</p>
          <p className="text-[11px] text-[var(--cc-dim)] mt-0.5">Hunt</p>
        </button>
        <button
          onClick={() => setShowCrushList("hunted")}
          className="bg-[var(--cc-surface)] rounded-xl py-3 text-center border border-white/5"
        >
          <p className="font-display text-xl">{huntedCount === null ? "—" : huntedCount}</p>
          <p className="text-[11px] text-[var(--cc-dim)] mt-0.5">Hunted</p>
        </button>
      </div>

      {profile.show_impressions && (
        <div className="bg-[var(--cc-surface)] rounded-xl py-2.5 text-center border border-white/5 mb-2">
          <p className="text-xs text-[var(--cc-muted)]">
            <span className="font-display text-base mr-1">{impressions === null ? "—" : impressions}</span>
            Impressions this month
          </p>
        </div>
      )}

      {showCrushList && (
        <CrushListModal targetId={profile.id} mode={showCrushList} onClose={() => setShowCrushList(null)} onOpenProfile={() => {}} />
      )}

      <p className="text-[10px] text-[var(--cc-dim)] mb-5 px-1">
        Post and Impressions are only visible to you. Hunt &amp; Hunted (count and who) are public. Matches are shown in Message.
      </p>

      <div className="flex gap-2.5 mb-5">
        <button
          onClick={() => setView("edit")}
          className="flex-1 py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium"
        >
          Edit Profile
        </button>
        <button
          onClick={shareProfile}
          className="px-4 py-3 rounded-full border border-white/10 text-[var(--cc-muted)] flex items-center justify-center"
        >
          <Share2 size={16} />
        </button>
      </div>

      {(profile.prompts || []).length > 0 && (
        <div className="space-y-3 mb-5">
          {profile.prompts.map((p, i) => (
            <div key={i} className="bg-[var(--cc-surface)] rounded-xl p-4 border border-white/5">
              <p className="text-[11px] text-[#FFB84D]">{p.q}</p>
              <p className="text-sm mt-1">{p.a}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5">
        <p className="text-[11px] text-[var(--cc-dim)] mb-2">you're looking for</p>
        <div className="flex flex-wrap gap-1.5">
          {(profile.intents || []).map((id) => {
            const meta = intentMeta(id);
            return (
              <span
                key={id}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: meta.color + "22", color: meta.color }}
              >
                {id === "other" ? profile.intent_other || "Other" : meta.label}
              </span>
            );
          })}
        </div>
      </div>

      {(profile.photos || []).length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] text-[var(--cc-dim)] mb-2">your photos</p>
          <div className="grid grid-cols-3 gap-1.5">
            {profile.photos.map((url) => (
              <button
                key={url}
                onClick={() => setLightbox(url)}
                className="aspect-square rounded-lg overflow-hidden bg-[var(--cc-surface)]"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 mt-6 px-1 pb-4">
        <ShieldCheck size={14} className="text-[var(--cc-dim)] mt-0.5 shrink-0" />
        <p className="text-[11px] text-[var(--cc-dim)]">
          This is a test build for your college. Full version will add ID verification before wider launch.
        </p>
      </div>
    </div>
  );
}

// ---------------- OWN POSTS (grid / repost / tagged, with pinning) ----------------
function OwnPostsSection({ profileId, pinnedIds, onUpdate, myId, onOpenProfile }) {
  const [tab, setTab] = useState("posts"); // posts | reposts | tagged
  const [posts, setPosts] = useState([]);
  const [reposts, setReposts] = useState([]);
  const [tagged, setTagged] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPost, setOpenPost] = useState(null);

  useEffect(() => {
    load();
  }, [tab]);

  async function load() {
    setLoading(true);
    if (tab === "posts") {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(name, username, photos)")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });
      setPosts(data || []);
    } else if (tab === "reposts") {
      const { data } = await supabase
        .from("reposts")
        .select("*, posts(*, profiles(name, username, photos))")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });
      setReposts(data || []);
    } else {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(name, username, photos)")
        .contains("confirmed_tag_ids", [profileId])
        .order("created_at", { ascending: false });
      setTagged(data || []);
    }
    setLoading(false);
  }

  async function togglePin(postId) {
    const isPinned = pinnedIds.includes(postId);
    let next;
    if (isPinned) {
      next = pinnedIds.filter((id) => id !== postId);
    } else {
      if (pinnedIds.length >= 3) {
        alert("You can pin up to 3 posts only.");
        return;
      }
      next = [...pinnedIds, postId];
    }
    await supabase.from("profiles").update({ pinned_post_ids: next }).eq("id", profileId);
    onUpdate();
  }

  const list = tab === "posts" ? posts : tab === "reposts" ? reposts.map((r) => r.posts) : tagged;
  const orderedList =
    tab === "posts"
      ? [...list].sort((a, b) => (pinnedIds.includes(b.id) ? 1 : 0) - (pinnedIds.includes(a.id) ? 1 : 0))
      : list;

  return (
    <div>
      {openPost && (
        <PostDetail
          post={openPost}
          myId={myId}
          onClose={() => {
            setOpenPost(null);
            load();
          }}
          onOpenProfile={onOpenProfile}
        />
      )}

      <div className="flex border-t border-b border-white/5 mb-2">
        {[
          { id: "posts", icon: Grid3x3 },
          { id: "reposts", icon: Repeat2 },
          { id: "tagged", icon: UserPlus },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 flex items-center justify-center border-b-2 ${
              tab === t.id ? "border-[#FF4D6D] text-[#FF4D6D]" : "border-transparent text-[var(--cc-dim)]"
            }`}
          >
            <t.icon size={18} />
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-[var(--cc-dim)] text-sm py-6">loading...</p>}
      {!loading && orderedList.length === 0 && (
        <p className="text-center text-[var(--cc-dim)] text-sm py-6">Nothing here yet.</p>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {orderedList.filter(Boolean).map((post) => (
          <div key={post.id} className="relative aspect-square rounded-lg overflow-hidden bg-[var(--cc-surface)] group">
            <button onClick={() => setOpenPost(post)} className="w-full h-full">
              {post.media_type === "video" ? (
                <video src={post.media_url} className="w-full h-full object-cover" />
              ) : (
                <img src={post.media_url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
            {tab === "posts" && (
              <button
                onClick={() => togglePin(post.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
              >
                <Pin size={12} className={pinnedIds.includes(post.id) ? "text-[#FFB84D]" : "text-white"} />
              </button>
            )}
          </div>
        ))}
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
        <button onClick={onBack} className="text-[var(--cc-muted)]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl">{mode === "followers" ? "Followers" : "Following"}</h1>
      </div>

      {loading && <p className="text-center text-[var(--cc-muted)] text-sm py-8">loading...</p>}

      {!loading && people.length === 0 && (
        <p className="text-center text-[var(--cc-dim)] text-sm py-8">
          {mode === "followers" ? "No one has liked you yet." : "You haven't liked anyone yet."}
        </p>
      )}

      <div className="space-y-2.5">
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-3 bg-[var(--cc-surface)] rounded-xl p-3 border border-white/5">
            <div className="w-11 h-11 rounded-full overflow-hidden shrink-0">
              <Avatar profile={p} textSize="text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-[var(--cc-dim)]">@{p.username}</p>
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
  const [bio, setBio] = useState(profile.bio || "");
  const [gender, setGender] = useState(profile.gender || "");
  const [photos, setPhotos] = useState(profile.photos || []);
  const [uploading, setUploading] = useState(false);
  const [intents, setIntents] = useState(profile.intents || []);
  const [intentOther, setIntentOther] = useState(profile.intent_other || "");
  const [selectedPrompts, setSelectedPrompts] = useState(profile.prompts || []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  function toggleIntent(id) {
    setIntents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleBioChange(val) {
    if (wordCount(val) <= 101) setBio(val);
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
  const canSave =
    name.trim() &&
    ageNum >= 18 &&
    photos.length >= 1 &&
    intents.length > 0 &&
    gender &&
    bio.trim() &&
    (!intents.includes("other") || intentOther.trim());

  async function save() {
    setBusy(true);
    setError("");
    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        age: ageNum,
        college: college || null,
        bio,
        gender,
        photos,
        intents,
        intent_other: intents.includes("other") ? intentOther.trim() : null,
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
        <button onClick={onCancel} className="text-[var(--cc-muted)]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl">Edit profile</h1>
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-[11px] text-[var(--cc-dim)] mb-2">photos</p>
          <div className="grid grid-cols-3 gap-2.5">
            {photos.map((url) => (
              <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-[var(--cc-surface)]">
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
                className="aspect-square rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-[var(--cc-dim)]"
              >
                {uploading ? <span className="text-xs">uploading...</span> : <Plus size={18} />}
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
        </div>

        <div>
          <label className="text-xs text-[var(--cc-muted)] block mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-[var(--cc-muted)] block mb-1.5">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
            />
          </div>
          <div className="flex-[2]">
            <label className="text-xs text-[var(--cc-muted)] block mb-1.5">College</label>
            <input
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-[var(--cc-muted)] block mb-1.5">Gender</label>
          <div className="flex gap-2">
            {["Woman", "Man", "Other"].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-4 py-2 rounded-full text-sm border ${
                  gender === g ? "bg-[#FF4D6D] border-[#FF4D6D] text-white" : "border-white/10 text-[var(--cc-muted)]"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-[var(--cc-muted)]">Bio</label>
            <span className="text-[11px] text-[var(--cc-dim)]">{wordCount(bio)}/101 words</span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => handleBioChange(e.target.value)}
            rows={4}
            className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D] resize-none"
          />
        </div>

        <div>
          <p className="text-[11px] text-[var(--cc-dim)] mb-2">looking for</p>
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
                      : { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "var(--cc-surface)" }
                  }
                >
                  <span className="text-sm" style={{ color: active ? intent.color : "var(--cc-text)" }}>
                    {intent.label}
                  </span>
                </button>
              );
            })}
          </div>
          {intents.includes("other") && (
            <input
              value={intentOther}
              onChange={(e) => setIntentOther(e.target.value)}
              placeholder="Tell us what you're looking for..."
              className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 mt-2.5 outline-none focus:border-[#FF4D6D]"
            />
          )}
        </div>

        <div>
          <p className="text-[11px] text-[var(--cc-dim)] mb-2">prompts</p>
          <div className="space-y-3">
            {selectedPrompts.map((p, i) => (
              <div key={i} className="bg-[var(--cc-surface)] rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <select
                    value={p.q}
                    onChange={(e) => updatePromptQuestion(i, e.target.value)}
                    className="bg-transparent text-[#FFB84D] text-sm font-medium outline-none"
                  >
                    {PROMPT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-[var(--cc-surface)]">
                        {opt}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => removePrompt(i)} className="text-[var(--cc-dim)]">
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  value={p.a}
                  onChange={(e) => updatePromptAnswer(i, e.target.value)}
                  rows={2}
                  className="w-full bg-transparent text-sm outline-none resize-none placeholder-[var(--cc-dim)]"
                />
              </div>
            ))}
            {selectedPrompts.length < 3 && (
              <button
                onClick={addPromptSlot}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 text-[var(--cc-muted)] text-sm flex items-center justify-center gap-2"
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
function SettingsScreen({ profile, onBack, onLogout, onUpdate }) {
  const [showDetails, setShowDetails] = useState(profile.show_details || false);
  const [showImpressions, setShowImpressions] = useState(profile.show_impressions || false);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("cc_theme") || "dark");

  function applyTheme(next) {
    setTheme(next);
    localStorage.setItem("cc_theme", next);
    document.documentElement.setAttribute("data-theme", next);
    setShowThemePicker(false);
  }

  const themeLabel = { dark: "Dark", light: "Light" }[theme];

  async function toggle() {
    const next = !showDetails;
    setShowDetails(next);
    setSaving(true);
    await supabase.from("profiles").update({ show_details: next }).eq("id", profile.id);
    setSaving(false);
    onUpdate();
  }

  async function toggleImpressions() {
    const next = !showImpressions;
    setShowImpressions(next);
    setSaving(true);
    await supabase.from("profiles").update({ show_impressions: next }).eq("id", profile.id);
    setSaving(false);
    onUpdate();
  }

  if (showSaved) {
    return <SavedPostsScreen myId={profile.id} onBack={() => setShowSaved(false)} />;
  }

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-[var(--cc-muted)]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl">Settings</h1>
      </div>

      <div className="bg-[var(--cc-surface)] rounded-xl p-4 border border-white/5 mb-2.5">
        <div className="flex items-center justify-between">
          <div className="pr-3">
            <p className="text-sm font-medium">Personal account</p>
            <p className="text-[11px] text-[var(--cc-dim)] mt-0.5">
              Show your age, city, state & college on your profile. Off by default.
            </p>
          </div>
          <button
            onClick={toggle}
            disabled={saving}
            className={`w-11 h-6 rounded-full shrink-0 relative transition-colors ${
              showDetails ? "bg-[#FF4D6D]" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                showDetails ? "left-5.5" : "left-0.5"
              }`}
              style={{ left: showDetails ? "22px" : "2px" }}
            />
          </button>
        </div>
      </div>

      <div className="bg-[var(--cc-surface)] rounded-xl p-4 border border-white/5 mb-2.5">
        <div className="flex items-center justify-between">
          <div className="pr-3">
            <p className="text-sm font-medium">Show impressions</p>
            <p className="text-[11px] text-[var(--cc-dim)] mt-0.5">
              See how many people viewed your profile this month. Only visible to you. Off by default.
            </p>
          </div>
          <button
            onClick={toggleImpressions}
            disabled={saving}
            className={`w-11 h-6 rounded-full shrink-0 relative transition-colors ${
              showImpressions ? "bg-[#FF4D6D]" : "bg-white/15"
            }`}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: showImpressions ? "22px" : "2px" }}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        <button
          onClick={() => setShowThemePicker(true)}
          className="w-full flex items-center justify-between gap-3 bg-[var(--cc-surface)] rounded-xl p-4 text-left border border-white/5"
        >
          <span className="flex items-center gap-3">
            <Palette size={18} className="text-[var(--cc-muted)]" />
            <span className="text-sm">Theme</span>
          </span>
          <span className="text-xs text-[var(--cc-dim)]">{themeLabel}</span>
        </button>
        <button
          onClick={() => setShowSaved(true)}
          className="w-full flex items-center gap-3 bg-[var(--cc-surface)] rounded-xl p-4 text-left border border-white/5"
        >
          <Bookmark size={18} className="text-[var(--cc-muted)]" />
          <span className="text-sm">Saved posts</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 bg-[var(--cc-surface)] rounded-xl p-4 text-left border border-white/5"
        >
          <LogOut size={18} className="text-[var(--cc-muted)]" />
          <span className="text-sm">Log out</span>
        </button>
      </div>

      {showThemePicker && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-end sm:items-center justify-center px-4">
          <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-xs p-5">
            <h3 className="font-display text-lg mb-3">Choose theme</h3>
            <div className="space-y-2">
              {[
                { id: "dark", label: "Dark", hint: "Default look" },
                { id: "light", label: "Light", hint: "Bright background" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTheme(t.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left ${
                    theme === t.id ? "border-[#FF4D6D] bg-[#FF4D6D]/10" : "border-white/10"
                  }`}
                >
                  <span>
                    <span className="text-sm block">{t.label}</span>
                    <span className="text-[11px] text-[var(--cc-dim)]">{t.hint}</span>
                  </span>
                  {theme === t.id && <Check size={16} className="text-[#FF4D6D]" />}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowThemePicker(false)}
              className="w-full mt-4 py-2.5 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-[var(--cc-dim)] mt-6 px-1">
        Need to delete your account or report a problem? That's not automated yet in this test build —
        reach out to whoever invited you to the pilot.
      </p>
    </div>
  );
}

// ---------------- SAVED POSTS ----------------
function SavedPostsScreen({ myId, onBack }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("saved_posts")
        .select("post_id, posts(*)")
        .eq("user_id", myId)
        .order("created_at", { ascending: false });
      setPosts((data || []).map((s) => s.posts).filter(Boolean));
      setLoading(false);
    })();
  }, [myId]);

  return (
    <div className="p-5">
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-30 flex items-center justify-center px-4"
          onClick={() => setLightbox(null)}
        >
          {lightbox.media_type === "video" ? (
            <video src={lightbox.media_url} controls autoPlay className="max-h-[80vh] max-w-full rounded-xl" />
          ) : (
            <img src={lightbox.media_url} alt="" className="max-h-[80vh] max-w-full rounded-xl object-contain" />
          )}
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-[var(--cc-muted)]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl">Saved posts</h1>
      </div>
      {loading && <p className="text-center text-[var(--cc-dim)] text-sm py-6">loading...</p>}
      {!loading && posts.length === 0 && (
        <p className="text-center text-[var(--cc-dim)] text-sm py-8">No saved posts yet.</p>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => setLightbox(post)}
            className="aspect-square rounded-lg overflow-hidden bg-[var(--cc-surface)]"
          >
            {post.media_type === "video" ? (
              <video src={post.media_url} className="w-full h-full object-cover" />
            ) : (
              <img src={post.media_url} alt="" className="w-full h-full object-cover" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- CHAT ----------------
function ChatRoom({ match, myId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [matchRow, setMatchRow] = useState(match);
  const [otherProfile, setOtherProfile] = useState(null);
  const [myCrushedThem, setMyCrushedThem] = useState(false);
  const [theyCrushedMe, setTheyCrushedMe] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [justMatched, setJustMatched] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showNicknameEdit, setShowNicknameEdit] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [showLockSetup, setShowLockSetup] = useState(false);
  const [lockPinInput, setLockPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlockPinInput, setUnlockPinInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [msgMenuFor, setMsgMenuFor] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const bottomRef = useRef(null);

  const isUser1 = matchRow.user1_id === myId;
  const otherId = isUser1 ? matchRow.user2_id : matchRow.user1_id;
  const myConfirmed = isUser1 ? matchRow.user1_confirmed : matchRow.user2_confirmed;
  const myNickname = isUser1 ? matchRow.user1_nickname : matchRow.user2_nickname;
  const myPinned = isUser1 ? matchRow.user1_pinned : matchRow.user2_pinned;
  const myLockPin = isUser1 ? matchRow.user1_lock_pin : matchRow.user2_lock_pin;
  const myClearedAt = isUser1 ? matchRow.user1_cleared_at : matchRow.user2_cleared_at;
  const displayName = myNickname || otherProfile?.name || "Them";

  useEffect(() => {
    setUnlocked(!myLockPin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    load();
    loadRelationship();
    const channel = supabase
      .channel(`messages:${matchRow.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchRow.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev.filter((m) => !(m._optimistic && m.content === payload.new.content)), payload.new];
          });
          if (payload.new.sender_id === otherId) {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", payload.new.id).then(() => {});
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `match_id=eq.${matchRow.id}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchRow.id, unlocked]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("blocks").select("id").eq("blocker_id", myId).eq("blocked_id", otherId).maybeSingle();
      setBlocked(!!data);
    })();
  }, [otherId, myId]);

  async function load() {
    let q = supabase.from("messages").select("*").eq("match_id", matchRow.id).order("created_at", { ascending: true });
    if (myClearedAt) q = q.gt("created_at", myClearedAt);
    const { data } = await q;
    setMessages(data || []);
    const { data: p } = await supabase.from("profiles").select("name, photos, last_seen").eq("id", otherId).maybeSingle();
    setOtherProfile(p);
    setLoading(false);

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("match_id", matchRow.id)
      .eq("sender_id", otherId)
      .is("read_at", null);
  }

  async function loadRelationship() {
    const { data: mine } = await supabase
      .from("crushes")
      .select("id")
      .eq("sender_id", myId)
      .eq("target_id", otherId)
      .maybeSingle();
    setMyCrushedThem(!!mine);
    const { data: theirs } = await supabase
      .from("crushes")
      .select("id")
      .eq("sender_id", otherId)
      .eq("target_id", myId)
      .maybeSingle();
    setTheyCrushedMe(!!theirs);
  }

  async function toggleCrush() {
    if (myCrushedThem) {
      await supabase.from("crushes").delete().eq("sender_id", myId).eq("target_id", otherId);
      setMyCrushedThem(false);
      if (matchRow.is_official) {
        await supabase.from("matches").update({ is_official: false }).eq("id", matchRow.id);
        setMatchRow((prev) => ({ ...prev, is_official: false }));
      }
    } else {
      await supabase.from("crushes").insert({ sender_id: myId, target_id: otherId });
      setMyCrushedThem(true);
    }
  }

  async function confirmMatch() {
    if (!myCrushedThem) {
      alert("Crush them first — tap the heart icon above — before you can confirm a match.");
      return;
    }
    setConfirming(true);
    const payload = isUser1 ? { user1_confirmed: true } : { user2_confirmed: true };
    const { data } = await supabase.from("matches").update(payload).eq("id", matchRow.id).select().maybeSingle();
    let updated = data || { ...matchRow, ...payload };

    const bothConfirmed = updated.user1_confirmed && updated.user2_confirmed;
    if (bothConfirmed && myCrushedThem && theyCrushedMe && !updated.is_official) {
      const { data: off } = await supabase
        .from("matches")
        .update({ is_official: true })
        .eq("id", matchRow.id)
        .select()
        .maybeSingle();
      updated = off || { ...updated, is_official: true };
      setJustMatched(true);
    }
    setMatchRow(updated);
    setConfirming(false);
  }

  const myMsgCount = messages.filter((m) => m.sender_id === myId).length;
  const theirMsgCount = messages.filter((m) => m.sender_id === otherId).length;
  const canSend = (theirMsgCount > 0 || myMsgCount === 0) && !blocked;

  async function send() {
    if (!text.trim() || !canSend) return;
    const content = text.trim();
    const replyId = replyingTo?.id || null;
    setText("");
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      match_id: matchRow.id,
      sender_id: myId,
      content,
      reply_to_id: replyId,
      created_at: new Date().toISOString(),
      read_at: null,
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { data, error } = await supabase
      .from("messages")
      .insert({ match_id: matchRow.id, sender_id: myId, content, reply_to_id: replyId })
      .select()
      .maybeSingle();

    if (data) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    } else if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  }

  function canEdit(m) {
    return m.sender_id === myId && !m.deleted_for_everyone && Date.now() - new Date(m.created_at).getTime() < 10 * 60 * 1000;
  }

  function canDeleteForEveryone(m) {
    if (m.sender_id !== myId || m.deleted_for_everyone) return false;
    if (!m.read_at) return true;
    return Date.now() - new Date(m.created_at).getTime() < 60 * 60 * 1000;
  }

  async function saveEdit() {
    if (!editText.trim()) return;
    await supabase.from("messages").update({ content: editText.trim(), edited: true }).eq("id", editingId);
    setMessages((prev) => prev.map((m) => (m.id === editingId ? { ...m, content: editText.trim(), edited: true } : m)));
    setEditingId(null);
    setEditText("");
    setMsgMenuFor(null);
  }

  async function deleteForEveryone(m) {
    if (!confirm("Delete this message for everyone?")) return;
    await supabase.from("messages").update({ deleted_for_everyone: true, content: "" }).eq("id", m.id);
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_for_everyone: true, content: "" } : x)));
    setMsgMenuFor(null);
  }

  async function clearChat() {
    const field = isUser1 ? "user1_cleared_at" : "user2_cleared_at";
    const now = new Date().toISOString();
    await supabase.from("matches").update({ [field]: now }).eq("id", matchRow.id);
    setMatchRow((prev) => ({ ...prev, [field]: now }));
    setMessages([]);
    setShowClearConfirm(false);
    setShowMenu(false);
  }

  async function toggleBlock() {
    if (blocked) {
      await supabase.from("blocks").delete().eq("blocker_id", myId).eq("blocked_id", otherId);
      setBlocked(false);
    } else {
      await supabase.from("blocks").insert({ blocker_id: myId, blocked_id: otherId });
      setBlocked(true);
    }
    setShowBlockConfirm(false);
    setShowMenu(false);
  }

  function shareChat() {
    const text = `Chat with ${otherProfile?.name || "someone"} on Campus Circuit`;
    if (navigator.share) {
      navigator.share({ title: "Campus Circuit", text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      alert("Copied!");
    }
    setShowMenu(false);
  }

  async function saveNickname() {
    const field = isUser1 ? "user1_nickname" : "user2_nickname";
    const value = nicknameInput.trim() || null;
    await supabase.from("matches").update({ [field]: value }).eq("id", matchRow.id);
    setMatchRow((prev) => ({ ...prev, [field]: value }));
    setShowNicknameEdit(false);
  }

  async function togglePin() {
    const field = isUser1 ? "user1_pinned" : "user2_pinned";
    if (!myPinned) {
      const { count } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .or(`and(user1_id.eq.${myId},user1_pinned.eq.true),and(user2_id.eq.${myId},user2_pinned.eq.true)`);
      if ((count ?? 0) >= 2) {
        alert("You can pin up to 2 chats only.");
        return;
      }
    }
    const next = !myPinned;
    await supabase.from("matches").update({ [field]: next }).eq("id", matchRow.id);
    setMatchRow((prev) => ({ ...prev, [field]: next }));
  }

  async function setupLock() {
    if (!/^\d{4}$/.test(lockPinInput)) {
      alert("Enter a 4-digit PIN.");
      return;
    }
    const { count } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`and(user1_id.eq.${myId},user1_lock_pin.not.is.null),and(user2_id.eq.${myId},user2_lock_pin.not.is.null)`);
    if ((count ?? 0) >= 4) {
      alert("You can lock up to 4 chats only.");
      return;
    }
    const field = isUser1 ? "user1_lock_pin" : "user2_lock_pin";
    await supabase.from("matches").update({ [field]: lockPinInput }).eq("id", matchRow.id);
    setMatchRow((prev) => ({ ...prev, [field]: lockPinInput }));
    setShowLockSetup(false);
    setLockPinInput("");
  }

  async function removeLock() {
    const field = isUser1 ? "user1_lock_pin" : "user2_lock_pin";
    await supabase.from("matches").update({ [field]: null }).eq("id", matchRow.id);
    setMatchRow((prev) => ({ ...prev, [field]: null }));
  }

  function attemptUnlock() {
    if (unlockPinInput === myLockPin) {
      setUnlocked(true);
      setUnlockError("");
    } else {
      setUnlockError("Wrong PIN");
    }
  }

  const messageById = {};
  messages.forEach((m) => (messageById[m.id] = m));

  const isOnline =
    otherProfile?.last_seen && Date.now() - new Date(otherProfile.last_seen).getTime() < 3 * 60 * 1000;

  if (!unlocked) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 gap-4">
        <Lock size={28} className="text-[var(--cc-muted)]" />
        <p className="text-sm text-[var(--cc-muted)]">This chat is locked</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={unlockPinInput}
          onChange={(e) => setUnlockPinInput(e.target.value.replace(/\D/g, ""))}
          placeholder="4-digit PIN"
          className="w-32 text-center bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D] tracking-widest"
        />
        {unlockError && <p className="text-[#FF4D6D] text-xs">{unlockError}</p>}
        <button onClick={attemptUnlock} className="px-6 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm">
          Unlock
        </button>
        <button onClick={onBack} className="text-xs text-[var(--cc-dim)]">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {justMatched && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 px-6">
          <div className="bg-[var(--cc-surface)] rounded-2xl p-6 text-center border border-[#FF4D6D]/30 max-w-xs">
            <Sparkles size={28} className="text-[#FFB84D] mx-auto mb-2" />
            <h3 className="font-display text-2xl">You matched!</h3>
            <p className="text-sm text-[var(--cc-muted)] mt-2">
              You and {displayName} confirmed each other. It's official.
            </p>
            <button
              onClick={() => setJustMatched(false)}
              className="w-full mt-5 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {showNicknameEdit && (
        <div
          className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center px-6"
          onClick={() => setShowNicknameEdit(false)}
        >
          <div
            className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-xs p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg mb-1">Chat nickname</h3>
            <p className="text-[11px] text-[var(--cc-dim)] mb-3">
              Only you see this — it replaces their name and photo in this chat.
            </p>
            <input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder={otherProfile?.name}
              className="w-full bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#FF4D6D] mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNicknameEdit(false)}
                className="flex-1 py-2.5 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm"
              >
                Cancel
              </button>
              <button onClick={saveNickname} className="flex-1 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showLockSetup && (
        <div
          className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center px-6"
          onClick={() => setShowLockSetup(false)}
        >
          <div
            className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-xs p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg mb-1">Lock this chat</h3>
            <p className="text-[11px] text-[var(--cc-dim)] mb-3">Set a 4-digit PIN. Up to 4 chats can be locked.</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={lockPinInput}
              onChange={(e) => setLockPinInput(e.target.value.replace(/\D/g, ""))}
              placeholder="4-digit PIN"
              className="w-full text-center bg-[var(--cc-surface)] border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-[#FF4D6D] tracking-widest mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowLockSetup(false)}
                className="flex-1 py-2.5 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm"
              >
                Cancel
              </button>
              <button onClick={setupLock} className="flex-1 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm">
                Lock
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
        <button onClick={onBack} className="text-[var(--cc-muted)]">
          <ArrowLeft size={20} />
        </button>
        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
          {myNickname ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FF4D6D]/30 to-[#5DA9FF]/20">
              <span className="font-display text-sm">{myNickname[0]?.toUpperCase()}</span>
            </div>
          ) : (
            <Avatar profile={otherProfile} textSize="text-sm" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg truncate leading-tight">{displayName}</p>
          {isOnline && <p className="text-[10px] text-[#4DD4C0]">Active now</p>}
        </div>
        <button onClick={toggleCrush} className="p-1">
          <Heart
            size={20}
            className={myCrushedThem ? "text-[#FF4D6D]" : "text-[var(--cc-dim)]"}
            fill={myCrushedThem ? "#FF4D6D" : "none"}
          />
        </button>
        <button onClick={() => setShowMenu((v) => !v)} className="text-[var(--cc-muted)] p-1">
          <MoreHorizontal size={19} />
        </button>
      </div>

      {showMenu && (
        <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => {
              setNicknameInput(myNickname || "");
              setShowNicknameEdit(true);
              setShowMenu(false);
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[var(--cc-muted)]"
          >
            {myNickname ? "Edit nickname" : "Set nickname"}
          </button>
          <button
            onClick={() => {
              togglePin();
              setShowMenu(false);
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[var(--cc-muted)]"
          >
            {myPinned ? "Unpin chat" : "Pin chat"}
          </button>
          {myLockPin ? (
            <button
              onClick={() => {
                removeLock();
                setShowMenu(false);
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[var(--cc-muted)]"
            >
              Remove lock
            </button>
          ) : (
            <button
              onClick={() => {
                setShowLockSetup(true);
                setShowMenu(false);
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[var(--cc-muted)]"
            >
              Lock chat
            </button>
          )}
          <button
            onClick={() => {
              setShowSearch(true);
              setShowMenu(false);
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[var(--cc-muted)]"
          >
            Search
          </button>
          <button
            onClick={shareChat}
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[var(--cc-muted)]"
          >
            Share
          </button>
          <button
            onClick={() => {
              setShowClearConfirm(true);
              setShowMenu(false);
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[var(--cc-muted)]"
          >
            Clear chat
          </button>
          <button
            onClick={() => {
              setShowReport(true);
              setShowMenu(false);
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-[var(--cc-muted)]"
          >
            Report
          </button>
          <button
            onClick={() => setShowBlockConfirm(true)}
            className="text-xs px-3 py-1.5 rounded-full border border-[#FF4D6D]/30 text-[#FF4D6D]"
          >
            {blocked ? "Unblock" : "Block"}
          </button>
        </div>
      )}

      {showSearch && (
        <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 shrink-0">
          <Search size={14} className="text-[var(--cc-dim)]" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in this chat..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
            }}
            className="text-[var(--cc-dim)]"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center px-6">
          <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-xs p-5">
            <h3 className="font-display text-lg mb-1">Clear chat?</h3>
            <p className="text-[11px] text-[var(--cc-dim)] mb-4">
              This clears messages on your side only. {displayName} will still see them.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm"
              >
                Cancel
              </button>
              <button onClick={clearChat} className="flex-1 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm">
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {showBlockConfirm && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center px-6">
          <div className="bg-[var(--cc-bg)] border border-white/10 rounded-2xl w-full max-w-xs p-5">
            <h3 className="font-display text-lg mb-1">{blocked ? "Unblock" : "Block"} {displayName}?</h3>
            <p className="text-[11px] text-[var(--cc-dim)] mb-4">
              {blocked ? "They'll be able to message you again." : "They won't be able to message you anymore."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-full border border-white/10 text-[var(--cc-muted)] text-sm"
              >
                Cancel
              </button>
              <button onClick={toggleBlock} className="flex-1 py-2.5 rounded-full bg-[#FF4D6D] text-white text-sm">
                {blocked ? "Unblock" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal reporterId={myId} targetType="user" targetId={otherId} onClose={() => setShowReport(false)} />
      )}

      {matchRow.is_official ? (
        <div className="px-4 py-2 bg-[#FFB84D]/10 border-b border-white/5 flex items-center gap-2 shrink-0">
          <Sparkles size={13} className="text-[#FFB84D]" />
          <span className="text-[11px] text-[#FFB84D]">Matched</span>
        </div>
      ) : (
        <div className="px-4 py-2.5 bg-[var(--cc-surface)] border-b border-white/5 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-[var(--cc-muted)]">
            {myConfirmed ? "Waiting for them to confirm..." : "Confirm to make it official."}
          </p>
          <button
            onClick={confirmMatch}
            disabled={myConfirmed || confirming}
            className="text-[11px] px-3 py-1.5 rounded-full bg-[#FF4D6D] text-white disabled:opacity-40 shrink-0"
          >
            {myConfirmed ? "Confirmed" : "Confirm Match"}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-end gap-2.5">
        {loading && <p className="text-xs text-[var(--cc-dim)] text-center">loading chat...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-[var(--cc-dim)] text-center mb-2">
            No messages yet. Break the ice — say something real.
          </p>
        )}
        {messages
          .filter((m) => !searchQuery.trim() || m.content.toLowerCase().includes(searchQuery.trim().toLowerCase()))
          .map((m) => {
          const repliedMsg = m.reply_to_id ? messageById[m.reply_to_id] : null;
          const isMine = m.sender_id === myId;
          const isEditing = editingId === m.id;
          return (
            <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"} group`}>
              {repliedMsg && (
                <div
                  className={`max-w-[75%] px-3 py-1.5 rounded-t-xl text-[11px] opacity-70 border-l-2 ${
                    isMine ? "border-white/40 bg-[#FF4D6D]/40" : "border-[#FF4D6D] bg-[var(--cc-surface)]"
                  }`}
                >
                  {repliedMsg.content.slice(0, 60)}
                </div>
              )}

              {isEditing ? (
                <div className="max-w-[75%] w-full">
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className="w-full bg-[var(--cc-surface)] border border-[#FF4D6D] rounded-xl px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex gap-2 mt-1 justify-end">
                    <button onClick={() => setEditingId(null)} className="text-[10px] text-[var(--cc-dim)]">
                      Cancel
                    </button>
                    <button onClick={saveEdit} className="text-[10px] text-[#FF4D6D]">
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-1.5">
                  {!isMine && !m.deleted_for_everyone && (
                    <button
                      onClick={() => setReplyingTo(m)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--cc-dim)] transition-opacity"
                    >
                      <Reply size={13} />
                    </button>
                  )}
                  <div
                    onClick={() => !m.deleted_for_everyone && setMsgMenuFor(msgMenuFor === m.id ? null : m.id)}
                    className={`max-w-[75%] px-3.5 py-2 text-sm cursor-pointer ${
                      m.deleted_for_everyone
                        ? "italic text-[var(--cc-dim)] border border-white/10 rounded-2xl"
                        : isMine
                        ? "bg-[#FF4D6D] text-white rounded-2xl rounded-tr-sm"
                        : "bg-[var(--cc-surface)] text-[var(--cc-text)] rounded-2xl rounded-tl-sm"
                    }`}
                  >
                    {m.deleted_for_everyone ? "This message was deleted" : m.content}
                    {m.edited && !m.deleted_for_everyone && (
                      <span className={`text-[9px] ml-1.5 ${isMine ? "text-white/70" : "text-[var(--cc-dim)]"}`}>
                        (edited)
                      </span>
                    )}
                  </div>
                  {isMine && !m.deleted_for_everyone && (
                    <button
                      onClick={() => setReplyingTo(m)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--cc-dim)] transition-opacity"
                    >
                      <Reply size={13} />
                    </button>
                  )}
                </div>
              )}

              {msgMenuFor === m.id && !isEditing && (
                <div className="flex gap-2 mt-1 px-1">
                  <button
                    onClick={() => {
                      setReplyingTo(m);
                      setMsgMenuFor(null);
                    }}
                    className="text-[10px] text-[var(--cc-muted)]"
                  >
                    Reply
                  </button>
                  {canEdit(m) && (
                    <button
                      onClick={() => {
                        setEditingId(m.id);
                        setEditText(m.content);
                        setMsgMenuFor(null);
                      }}
                      className="text-[10px] text-[var(--cc-muted)]"
                    >
                      Edit
                    </button>
                  )}
                  {canDeleteForEveryone(m) && (
                    <button onClick={() => deleteForEveryone(m)} className="text-[10px] text-[#FF4D6D]">
                      Delete for everyone
                    </button>
                  )}
                </div>
              )}

              {isMine && !m.deleted_for_everyone && (
                <span className="text-[9px] text-[var(--cc-dim)] mt-0.5 mr-1">{m.read_at ? "Seen" : "Sent"}</span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!canSend && (
        <p className="text-[11px] text-[var(--cc-dim)] text-center pb-1.5 shrink-0">
          Wait for them to reply before sending another message.
        </p>
      )}

      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--cc-surface)] border-t border-white/5 shrink-0">
          <p className="text-[11px] text-[var(--cc-muted)] truncate flex-1">
            Replying to: {replyingTo.content.slice(0, 40)}
          </p>
          <button onClick={() => setReplyingTo(null)} className="text-[var(--cc-dim)] ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="p-3 border-t border-white/5 flex gap-2 shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={blocked ? "You blocked this person" : canSend ? "Type a message..." : "Waiting for a reply..."}
          disabled={!canSend}
          className="flex-1 bg-[var(--cc-surface)] border border-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#FF4D6D] disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!canSend}
          className="w-10 h-10 rounded-full bg-[#FF4D6D] flex items-center justify-center text-white shrink-0 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
