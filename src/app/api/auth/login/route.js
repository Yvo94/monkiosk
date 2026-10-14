
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function normalizePhone(value) {
  const input = String(value || "")
    .trim()
    .replace(/[\s().-]/g, "");

  if (input.startsWith("+")) return input;
  if (input.startsWith("225")) return `+${input}`;

  if (/^\d{10}$/.test(input)) return `+225${input}`;

  return input;
}

export async function POST(request) {
  try {
    const { telephone, password } = await request.json();
    const phone = normalizePhone(telephone);

    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !password) {
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !publishableKey || !serviceKey) {
      throw new Error("Configuration Supabase incomplète.");
    }

    // Client administratif : uniquement côté serveur.
    const admin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("Numéro saisi :", telephone);
    console.log("Numéro normalisé :", phone);
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, telephone, auth_email, actif")
      .eq("telephone", phone)
      .maybeSingle();
      console.log("Diagnostic connexion MonKiosk :", {
      telephoneTrouve: Boolean(profile),
      erreurRechercheProfil: profileError?.message || null,
      compteActif: profile?.actif ?? null,
      emailAuthPresent: Boolean(profile?.auth_email),
    });

    if (
      profileError ||
      !profile ||
      !profile.actif ||
      !profile.auth_email
    ) {
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    // La session de connexion sera enregistrée dans des cookies.
    const cookiesToSet = [];

    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet.push(...cookies);
        },
      },
    });

    const { error: authError } =
      await supabase.auth.signInWithPassword({
        email: profile.auth_email,
        password,
      });
      console.log("Erreur authentification Supabase :", authError?.message || null);

    if (authError) {
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });

    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (error) {
    console.error("Erreur API de connexion MonKiosk :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue pendant la connexion." },
      { status: 500 }
    );
  }
}
