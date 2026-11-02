
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";
import { getPlatformAdmin } from "@/lib/admin-auth";

function generateLicenseCode() {
  const random = randomBytes(16).toString("hex").toUpperCase();
  const groups = random.match(/.{1,8}/g);

  return `MAAX-${groups.join("-")}`;
}

function hashLicenseCode(code) {
  const normalized = code.replace(/[^A-Z0-9]/g, "").toUpperCase();

  return createHash("sha256")
    .update(normalized)
    .digest("hex");
}

export async function POST(request) {
  try {
    const session = await getPlatformAdmin();

    if (!session) {
      return NextResponse.json(
        { error: "Accès non autorisé." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      modules,
      duree_jours,
      type_client,
      proprietaire_id,
      client_nom,
      client_telephone,
    } = body;

    // Validation du type de client
    if (!["existant", "nouveau"].includes(type_client)) {
      return NextResponse.json(
        { error: "Type de client invalide." },
        { status: 400 }
      );
    }

    // Validation des modules
    const modulesAutorises = ["kiosque", "lavage"];

    if (
      !Array.isArray(modules) ||
      modules.length === 0 ||
      modules.some((module) => !modulesAutorises.includes(module)) ||
      new Set(modules).size !== modules.length
    ) {
      return NextResponse.json(
        { error: "Sélection de modules invalide." },
        { status: 400 }
      );
    }

    // Validation de la durée
    const duree = Number(duree_jours);

    if (
      !Number.isInteger(duree) ||
      duree < 1 ||
      duree > 3650
    ) {
      return NextResponse.json(
        { error: "Durée invalide." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Vérifier les modules actifs
    const { data: modulesExistants, error: modulesError } =
      await supabaseAdmin
        .from("modules")
        .select("code")
        .in("code", modules)
        .eq("actif", true);

    if (modulesError) throw modulesError;

    const codesExistants = (modulesExistants || []).map(
      (module) => module.code
    );

    if (
      modules.length !== codesExistants.length ||
      modules.some((module) => !codesExistants.includes(module))
    ) {
      return NextResponse.json(
        { error: "Un ou plusieurs modules sont indisponibles." },
        { status: 400 }
      );
    }

    let proprietaireId = null;
    let nomClient = null;
    let telephoneClient = null;

    if (type_client === "existant") {
      if (!proprietaire_id) {
        return NextResponse.json(
          { error: "Sélectionne un propriétaire." },
          { status: 400 }
        );
      }

      // On vérifie le compte et on récupère les vraies informations.
      const { data: proprietaire, error: proprietaireError } =
        await supabaseAdmin
          .from("users")
          .select("id, nom, telephone, role, actif")
          .eq("id", proprietaire_id)
          .eq("role", "admin")
          .eq("actif", true)
          .maybeSingle();

      if (proprietaireError) throw proprietaireError;

      if (!proprietaire) {
        return NextResponse.json(
          { error: "Propriétaire introuvable ou compte inactif." },
          { status: 404 }
        );
      }

      proprietaireId = proprietaire.id;
      nomClient = proprietaire.nom;
      telephoneClient = proprietaire.telephone;

    } else {
      // Nouveau client : aucune association de compte pour l'instant.
      nomClient = String(client_nom || "").trim();
      telephoneClient = String(client_telephone || "").trim();

      if (nomClient.length < 2 || nomClient.length > 150) {
        return NextResponse.json(
          { error: "Le nom du nouveau client est obligatoire." },
          { status: 400 }
        );
      }

      const chiffresTelephone = telephoneClient.replace(/\D/g, "");

      if (chiffresTelephone.length < 8 || chiffresTelephone.length > 15) {
        return NextResponse.json(
          { error: "Le numéro de téléphone du client est invalide." },
          { status: 400 }
        );
      }
    }

    // Génération sécurisée du code
    const code = generateLicenseCode();
    const codeHash = hashLicenseCode(code);

    const { data: licence, error: insertError } =
      await supabaseAdmin
        .from("licenses")
        .insert({
          code_hash: codeHash,
          modules,
          duree_jours: duree,
          statut: "disponible",
          proprietaire_id: proprietaireId,
          client_nom: nomClient,
          client_telephone: telephoneClient,
          created_by: session.user.id,
        })
        .select(
          "id, proprietaire_id, client_nom, client_telephone, modules, duree_jours, statut, date_creation"
        )
        .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message: "Licence générée avec succès.",
      code,
      licence,
    });

  } catch (error) {
    console.error("Erreur génération licence :", error);

    return NextResponse.json(
      { error: "Impossible de générer la licence." },
      { status: 500 }
    );
  }
}
