// Profile photo, or a coloured circle with initials when there isn't one (or it fails to load).

import { useEffect, useState } from "react";

const TINTS = [
  "bg-sage-light/70 text-sage-dark",
  "bg-coral-light/60 text-coral",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

export function initialsOf(name?: string | null, email?: string | null): string {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

function tintFor(key: string): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

export default function Avatar({ user, size = 40, className = "" }: {
  user: { name?: string | null; email?: string | null; avatarUrl?: string | null } | null | undefined;
  size?: number; className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user?.avatarUrl]);
  const style = { width: size, height: size };

  if (user?.avatarUrl && !broken) {
    return <img src={user.avatarUrl} alt="" style={style} onError={() => setBroken(true)}
      className={`rounded-full object-cover shrink-0 ${className}`} />;
  }
  const key = (user?.email || user?.name || "?").toLowerCase();
  return (
    <div style={{ ...style, fontSize: size * 0.38 }} aria-hidden="true"
      className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${tintFor(key)} ${className}`}>
      {initialsOf(user?.name, user?.email)}
    </div>
  );
}
