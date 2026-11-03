import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import { getPlatformAdmin } from "@/lib/admin-auth";

// --------------------------------------------------
// GÉNÉRATION DU CODE
// --------------------------------------------------

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

// --------------------------------------------------
// CHIFFREMENT / DÉCHIFFREMENT
// --------------------------------------------------

function getEncryptionKey() {
  const key = process.env.LICENSE_ENCRYPTION_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      "La clé LICENSE_ENCRYPTION_KEY est absente ou invalide."
    );
  }

  return Buffer.from(key, "hex");
}

function encryptLicenseCode(code) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(code, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decryptLicenseCode(encryptedValue) {
  if (!encryptedValue) return null;

  try {
    const parts = encryptedValue.split(":");

    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedCode] = parts;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedCode, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch {
    return null;
  }
}

// --------------------------------------------------
// CLIENT SUPABASE ADMIN
// --------------------------------------------------

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// --------------------------------------------------
// GET : HISTORIQUE DES LICENCES
// --------------------------------------------------

export async function GET() {
  try {
    const session = await getPlatformAdmin();

    if (!session) {
      return NextResponse.json(
        { error: "Accès non autorisé." },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: licences, error: licencesError } =
      await supabaseAdmin
        .from("licenses")
        .select(
          "id, proprietaire_id, client_nom, client_telephone, modules, duree_jours, statut, date_creation, code_chiffre"
        )
        .order("date_creation", { ascending: false })
        .limit(500);

    if (licencesError) throw licencesError;

    const listeLicences = licences || [];

    const proprietairesIds = [
      ...new Set(
        listeLicences
          .map((licence) => licence.proprietaire_id)
          .filter(Boolean)
      ),
    ];

    let proprietaires = [];

    if (proprietairesIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, nom, telephone")
        .in("id", proprietairesIds);

      if (error) throw error;

      proprietaires = data || [];
    }

    const proprietairesMap = new Map(
      proprietaires.map((proprietaire) => [
        proprietaire.id,
        proprietaire,
      ])
    );

    const historique = listeLicences.map((licence) => {
      const proprietaire = licence.proprietaire_id
        ? proprietairesMap.get(licence.proprietaire_id)
        : null;

      const estOrpheline =
        !licence.proprietaire_id &&
        !licence.client_nom;

      const code = decryptLicenseCode(licence.code_chiffre);

      return {
        id: licence.id,
        proprietaire_id: licence.proprietaire_id,

        client_nom:
          proprietaire?.nom ||
          licence.client_nom ||
          null,

        client_telephone:
          proprietaire?.telephone ||
          licence.client_telephone ||
          null,

        client_affichage:
          proprietaire?.nom ||
          licence.client_nom ||
          "Sans client",

        est_orpheline: estOrpheline,

        modules: licence.modules,
        duree_jours: licence.duree_jours,
        statut: licence.statut,
        date_creation: licence.date_creation,

        code,
        code_disponible: Boolean(code),
      };
    });

    return NextResponse.json({
      success: true,
      total: historique.length,
      historique,
    });

  } catch (error) {
    console.error("Erreur récupération historique licences :", error);

    return NextResponse.json(
      { error: "Impossible de récupérer l'historique des licences." },
      { status: 500 }
    );
  }
}

// --------------------------------------------------
// POST : GÉNÉRATION D'UNE LICENCE
// --------------------------------------------------

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

    if (!["existant", "nouveau", "sans_client"].includes(type_client)) {
      return NextResponse.json(
        { error: "Type de client invalide." },
        { status: 400 }
      );
    }

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

    const supabaseAdmin = getSupabaseAdmin();

    let proprietaireId = null;
    let nomClient = null;
    let telephoneClient = null;

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

    // CLIENT EXISTANT
    if (type_client === "existant") {
      if (!proprietaire_id) {
        return NextResponse.json(
          { error: "Sélectionne un propriétaire." },
          { status: 400 }
        );
      }

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
    }

    // NOUVEAU CLIENT
    else if (type_client === "nouveau") {
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

    // LICENCE ORPHELINE
    else if (type_client === "sans_client") {
      proprietaireId = null;
      nomClient = null;
      telephoneClient = null;
    }

    const code = generateLicenseCode();
    const codeHash = hashLicenseCode(code);
    const codeChiffre = encryptLicenseCode(code);

    const { data: licence, error: insertError } =
      await supabaseAdmin
        .from("licenses")
        .insert({
          code_hash: codeHash,
          code_chiffre: codeChiffre,
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
      message:
        type_client === "sans_client"
          ? "Licence orpheline générée avec succès."
          : "Licence générée avec succès.",
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

// --------------------------------------------------
// PATCH : DÉSACTIVATION OU RATTACHEMENT D'UNE LICENCE
// --------------------------------------------------

export async function PATCH(request) {
  try {
    const session = await getPlatformAdmin();

    if (!session) {
      return NextResponse.json(
        { error: "Accès non autorisé." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const { action, licence_id, proprietaire_id } = body;

    const supabaseAdmin = getSupabaseAdmin();

    // --------------------------------------------------
    // ACTION 1 : DÉSACTIVER UNE LICENCE
    // --------------------------------------------------

    if (action === "desactiver") {
      if (!licence_id) {
        return NextResponse.json(
          { error: "Identifiant de licence obligatoire." },
          { status: 400 }
        );
      }

      const { data: licence, error: desactivationError } =
        await supabaseAdmin
          .from("licenses")
          .update({
            statut: "revoquee",
            updated_at: new Date().toISOString(),
          })
          .eq("id", licence_id)
          .in("statut", ["disponible", "active"])
          .select(
            "id, proprietaire_id, client_nom, client_telephone, modules, duree_jours, statut, date_creation"
          )
          .maybeSingle();

      if (desactivationError) throw desactivationError;

      if (!licence) {
        return NextResponse.json(
          {
            error:
              "Cette licence est introuvable, déjà révoquée ou ne peut plus être désactivée.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Licence désactivée avec succès.",
        licence,
      });
    }

    // --------------------------------------------------
    // ACTION 2 : RATTACHER UNE LICENCE ORPHELINE
    // --------------------------------------------------

    if (!licence_id || !proprietaire_id) {
      return NextResponse.json(
        { error: "Licence et propriétaire obligatoires." },
        { status: 400 }
      );
    }

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
        { error: "Client introuvable ou compte inactif." },
        { status: 404 }
      );
    }

    const { data: licence, error: rattachementError } =
      await supabaseAdmin
        .from("licenses")
        .update({
          proprietaire_id: proprietaire.id,
          client_nom: proprietaire.nom,
          client_telephone: proprietaire.telephone,
        })
        .eq("id", licence_id)
        .is("proprietaire_id", null)
        .is("client_nom", null)
        .select(
          "id, proprietaire_id, client_nom, client_telephone, modules, duree_jours, statut, date_creation"
        )
        .maybeSingle();

    if (rattachementError) throw rattachementError;

    if (!licence) {
      return NextResponse.json(
        {
          error:
            "Cette licence n'est plus orpheline ou elle est introuvable. Actualise l'historique.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Licence rattachée au client avec succès.",
      licence,
    });

  } catch (error) {
    console.error("Erreur modification licence :", error);

    return NextResponse.json(
      { error: "Impossible de modifier cette licence." },
      { status: 500 }
    );
  }
}