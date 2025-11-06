import { supabase } from "@/lib/supabase";

export function presenceChannel(name: string) {
  if (!supabase) return null;
  return supabase.channel(name, { config: { presence: { key: Math.random().toString(36).slice(2) } } });
}
