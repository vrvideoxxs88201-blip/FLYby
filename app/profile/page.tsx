
"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Your image must be smaller than 5 MB.");
      return;
    }

    setUploading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      setUploading(false);
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${user.id}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    setAvatarUrl(data.publicUrl);
    setUploading(false);
  }

  async function saveProfile() {
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

          <div className="mt-8 flex flex-col items-center">
            <div className="w-28 h-28 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold overflow-hidden border-2 border-white/10">
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

            <label className="mt-4 cursor-pointer rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-2 text-sm font-semibold">
              {uploading ? "Uploading..." : "Upload Profile Picture"}

              <input
                type="file"
                accept="image/*"
                onChange={uploadAvatar}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <p className="text-xs text-gray-500 mt-2">
              Choose an image. Maximum size: 5 MB.
            </p>
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

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={saveProfile}
              disabled={uploading}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 p-3 font-semibold"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
