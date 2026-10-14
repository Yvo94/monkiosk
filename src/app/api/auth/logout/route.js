
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !publishableKey) {
      throw new Error("Configuration Supabase incomplète.");
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Erreur de déconnexion :", error.message);

      return NextResponse.json(
        { error: "Impossible de terminer la déconnexion." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur API de déconnexion :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue pendant la déconnexion." },
      { status: 500 }
    );
  }
}
