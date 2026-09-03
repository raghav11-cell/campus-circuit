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
  const [tab, setTab] = useState("browse");
  const [activeChat, setActiveChat] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

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
        <div className="text-xs text-[#B8A9C0]">{profile.college}</div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full">
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
function ProfileTab({ profile, onLogout }) {
  return (
    <div className="p-5">
      <div className="bg-[#2A1830] rounded-2xl overflow-hidden border border-white/5">
        <div className="aspect-[4/3]">
          <Avatar profile={profile} />
        </div>
        <div className="p-5">
          <h2 className="font-display text-2xl">
            {profile.name}
            {profile.age ? `, ${profile.age}` : ""}
          </h2>
          <p className="text-xs text-[#B8A9C0] mt-0.5">
            @{profile.username} · {profile.college}
          </p>
          {(profile.prompts || []).map((p, i) => (
            <div key={i} className="mt-3">
              <p className="text-[11px] text-[#6B5B73]">{p.q}</p>
              <p className="text-sm mt-0.5">{p.a}</p>
            </div>
          ))}
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
      </div>

      <button
        onClick={onLogout}
        className="w-full mt-4 py-3 rounded-full border border-white/10 text-[#B8A9C0] text-sm flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Log out
      </button>

      <div className="flex items-start gap-2 mt-4 px-1">
        <ShieldCheck size={14} className="text-[#6B5B73] mt-0.5 shrink-0" />
        <p className="text-[11px] text-[#6B5B73]">
          This is a test build for your college. Full version will add ID verification before wider launch.
        </p>
      </div>
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
