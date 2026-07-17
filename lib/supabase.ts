"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null kalau env belum diisi — aplikasi tetap jalan penuh secara lokal.
 *  Sync itu tambahan, bukan syarat untuk memakai kanvas. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
