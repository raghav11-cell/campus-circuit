import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";

const INTENTS = [
  { id: "serious", label: "Serious Relationship", color: "#FF4D6D" },
  { id: "casual", label: "Casual Dating", color: "#FFB84D" },
  { id: "fwb", label: "Friends with Benefits", color: "#C77DFF" },
  { id: "friend", label: "Just Friends", color: "#4DD4C0" },
  { id: "online", label: "Online Friend", color: "#5DA9FF" },
  { id: "situationship", label: "Situationship", color: "#FF8C42" },
];

const intentMeta = (id) => INTENTS.find((i) => i.id === id) || {};
const fontStyles = `
  .font-display { font-family: 'Fraunces', serif; }
  .font-sans { font-family: 'Inter', sans-serif; }
`;

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("browse");
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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
        <div className="text-xs text-[#B8A9C0]">{profile.college}</div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full">
        {tab === "browse" && <BrowseTab profile={profile} onMatch={() => refreshHint()} />}
        {tab === "matches" && (
          <MatchesTab
            myId={profile.id}
            onOpen={(m) => {
              setActiveChat(m);
              setTab("chatroom");
            }}
          />
        )}
        {tab === "profile" && <ProfileTab profile={profile} onLogout={handleLogout} />}
        {tab === "chatroom" && activeChat && (
          <ChatRoom match={activeChat} myId={profile.id} onBack={() => setTab("matches")} />
        )}
      </main>

      {tab !== "chatroom" && (
        <nav className="flex border-t border-white/5 bg-[#1B0F23] max-w-md mx-auto w-full">
          {[
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

  function refreshHint() {}
}

// ---------------- AUTH ----------------
function AuthScreen() {
  const [mode, setMode] = useState("signup"); // signup | login
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
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-[#1B0F23] text-[#F5EDE4] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 pt-16">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-[#FFB84D]" />
          <span className="text-xs text-[#B8A9C0] tracking-wide">student-only</span>
        </div>
        <h1 className="font-display text-3xl leading-tight">Campus Circuit</h1>
        <p className="text-[#B8A9C0] text-sm mt-2 mb-8">
          Say what you're actually looking for. No guessing games.
        </p>

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
          {error && <p className="text-[#FF4D6D] text-xs">{error}</p>}
          <button
            disabled={busy}
            className="w-full py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="text-xs text-[#B8A9C0] mt-5 text-center"
        >
          {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

// ---------------- CREATE PROFILE ----------------
function CreateProfile({ userId, onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [intents, setIntents] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleIntent(id) {
    setIntents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const canContinue = step === 0 ? name.trim() && college.trim() : intents.length > 0;

  async function save() {
    setBusy(true);
    setError("");
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      name,
      college,
      bio,
      gender,
      intents,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="min-h-screen bg-[#1B0F23] text-[#F5EDE4] font-sans flex flex-col">
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-6 pt-12">
        <h1 className="font-display text-2xl mb-1">Set up your profile</h1>
        <p className="text-[#B8A9C0] text-sm mb-6">This is what others will see.</p>

        {step === 0 && (
          <div className="space-y-4">
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
              <label className="text-xs text-[#B8A9C0] block mb-1.5">College</label>
              <input
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="e.g. DU, IIT Delhi..."
                className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D]"
              />
            </div>
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
            <div>
              <label className="text-xs text-[#B8A9C0] block mb-1.5">Short bio (optional)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Two lines about you..."
                className="w-full bg-[#2A1830] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF4D6D] resize-none"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="text-sm text-[#B8A9C0] mb-4">
              What are you open to? Pick as many as apply — this is how we match you.
            </p>
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

        {error && <p className="text-[#FF4D6D] text-xs mt-3">{error}</p>}

        <div className="pb-8 pt-6 flex gap-3">
          {step === 1 && (
            <button
              onClick={() => setStep(0)}
              className="px-5 py-3 rounded-full border border-white/10 text-[#B8A9C0] text-sm"
            >
              Back
            </button>
          )}
          <button
            disabled={!canContinue || busy}
            onClick={() => (step === 0 ? setStep(1) : save())}
            className="flex-1 py-3 rounded-full bg-[#FF4D6D] text-white text-sm font-medium disabled:opacity-30"
          >
            {step === 0 ? "Continue" : busy ? "Saving..." : "Start matching"}
          </button>
        </div>
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
    setIndex((i) => i);

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
            <div className="h-40 bg-gradient-to-br from-[#FF4D6D]/30 via-[#C77DFF]/20 to-[#5DA9FF]/20 flex items-center justify-center">
              <span className="font-display text-5xl text-[#F5EDE4]/90">
                {current.name?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="p-5">
              <h2 className="font-display text-2xl">{current.name}</h2>
              <p className="text-xs text-[#B8A9C0] mt-0.5">{current.college}</p>
              {current.bio && <p className="text-sm text-[#F5EDE4]/90 mt-3">{current.bio}</p>}
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
          .select("name")
          .eq("id", otherId)
          .maybeSingle();
        return { ...m, otherId, otherName: otherProfile?.name || "Someone" };
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
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FF4D6D]/40 to-[#C77DFF]/40 flex items-center justify-center font-display text-lg">
            {m.otherName[0]?.toUpperCase()}
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
function ProfileTab({ profile, onLogout }) {
  return (
    <div className="p-5">
      <div className="bg-[#2A1830] rounded-2xl p-5 border border-white/5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF4D6D]/40 to-[#5DA9FF]/40 flex items-center justify-center font-display text-2xl mb-3">
          {profile.name?.[0]?.toUpperCase()}
        </div>
        <h2 className="font-display text-2xl">{profile.name}</h2>
        <p className="text-xs text-[#B8A9C0] mt-0.5">{profile.college}</p>
        {profile.bio && <p className="text-sm mt-3 text-[#F5EDE4]/90">{profile.bio}</p>}
        <div className="mt-4">
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
      </div>

      <button
        onClick={onLogout}
        className="w-full mt-4 py-3 rounded-full border border-white/10 text-[#B8A9C0] text-sm flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Log out
      </button>

      <p className="text-[11px] text-[#6B5B73] mt-4 px-1">
        This is a test build for your college. Full version will add photo/ID verification before wider launch.
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
