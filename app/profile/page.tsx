
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, username, bio, avatar_url")
        .eq("id", user.id)
        .single();

      if (error) {
        setError(error.message);
      } else if (data) {
        setFullName(data.full_name || "");
        setUsername(data.username || "");
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || "");
      }

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  async function saveProfile() {
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setError("Please enter a username.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", user.id);

    if (error) {
      setError(error.message);
      return;
    }

    alert("Profile saved successfully!");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d19] text-white flex items-center justify-center">
        Loading profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d19] text-white p-6">
      <div className="max-w-xl mx-auto pt-8">
        <Link
          href="/"
          className="text-blue-400 hover:text-blue-300"
        >
          ← Back to FLYby
        </Link>

        <div className="mt-8 rounded-2xl border border-white/10 bg-[#111a2b] p-7">
          <h1 className="text-3xl font-bold">My Profile</h1>

          <p className="text-gray-400 mt-2">
            Manage your FLYby account information.
          </p>

          <div className="mt-8 flex justify-center">
            <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                (fullName || username || "U").charAt(0).toUpperCase()
              )}
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Full name
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg bg-[#080d19] border border-white/10 p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="w-full rounded-lg bg-[#080d19] border border-white/10 p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people a little about yourself..."
                rows={4}
                className="w-full rounded-lg bg-[#080d19] border border-white/10 p-3 outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Profile picture URL
              </label>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Paste an image URL"
                className="w-full rounded-lg bg-[#080d19] border border-white/10 p-3 outline-none focus:border-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={saveProfile}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 p-3 font-semibold"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
