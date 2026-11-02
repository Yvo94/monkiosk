import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function getPlatformAdmin() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !publishableKey || !serviceKey) {
      throw new Error("Configuration Supabase incomplète.");
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Les cookies ne peuvent pas toujours être modifiés
            // depuis un composant serveur.
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: platformAdmin, error } = await admin
      .from("maax_platform_admins")
      .select("id, user_id, role, actif")
      .eq("user_id", user.id)
      .eq("actif", true)
      .maybeSingle();

    if (error || !platformAdmin) {
      return null;
    }

    return {
      user,
      admin: platformAdmin,
    };
  } catch (error) {
    console.error("Erreur de vérification administrateur :", error);
    return null;
  }
}