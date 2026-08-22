require("dotenv").config();
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
app.use(express.json());

if (!process.env.SESSION_SECRET) {
  console.warn(
    "SESSION_SECRET ist nicht gesetzt - es wird ein unsicherer Entwicklungs-Default verwendet. Bitte in .env setzen."
  );
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-only-insecure-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

app.use(express.static(path.join(__dirname, "..")));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
});

const ROLLEN_SEED = ["Ausbilder", "Fachbereichsleiter", "Lehrgangsorganisation", "Administrator", "Bildungsstättenleiter"];
const UNRESTRICTED_ROLLEN = ["Administrator", "Lehrgangsorganisation", "Bildungsstättenleiter"];
const ADMIN_SEED_USERNAME = "admin";
const ADMIN_SEED_PASSWORT = "Admin2026!";

async function bootstrapDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS benutzer (
      ID INT AUTO_INCREMENT PRIMARY KEY,
      Username VARCHAR(50) NOT NULL UNIQUE,
      PasswortHash VARCHAR(255) NOT NULL,
      Vorname VARCHAR(100) NOT NULL,
      Nachname VARCHAR(100) NOT NULL,
      Email VARCHAR(255),
      Telefon VARCHAR(50),
      ErstelltAm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rolle (
      ID INT AUTO_INCREMENT PRIMARY KEY,
      Bezeichnung VARCHAR(50) NOT NULL UNIQUE
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS benutzer_rolle (
      BenutzerID INT NOT NULL,
      RolleID INT NOT NULL,
      PRIMARY KEY (BenutzerID, RolleID),
      FOREIGN KEY (BenutzerID) REFERENCES benutzer(ID) ON DELETE CASCADE,
      FOREIGN KEY (RolleID) REFERENCES rolle(ID) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS benutzer_fachbereich (
      BenutzerID INT NOT NULL,
      FachbereichID INT NOT NULL,
      PRIMARY KEY (BenutzerID, FachbereichID),
      FOREIGN KEY (BenutzerID) REFERENCES benutzer(ID) ON DELETE CASCADE,
      FOREIGN KEY (FachbereichID) REFERENCES fachbereich(ID) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  for (const bezeichnung of ROLLEN_SEED) {
    await pool.query("INSERT IGNORE INTO rolle (Bezeichnung) VALUES (?)", [bezeichnung]);
  }

  const [[{ count }]] = await pool.query("SELECT COUNT(*) AS count FROM benutzer");
  if (count === 0) {
    const hash = await bcrypt.hash(ADMIN_SEED_PASSWORT, 10);
    const [result] = await pool.query(
      "INSERT INTO benutzer (Username, PasswortHash, Vorname, Nachname) VALUES (?, ?, ?, ?)",
      [ADMIN_SEED_USERNAME, hash, "Admin", "Administrator"]
    );
    const [[adminRolle]] = await pool.query("SELECT ID FROM rolle WHERE Bezeichnung = 'Administrator'");
    await pool.query("INSERT INTO benutzer_rolle (BenutzerID, RolleID) VALUES (?, ?)", [result.insertId, adminRolle.ID]);
    console.log(
      `Admin-Benutzer '${ADMIN_SEED_USERNAME}' wurde mit Passwort '${ADMIN_SEED_PASSWORT}' angelegt. Bitte nach dem ersten Login sofort ändern.`
    );
  }
}

// --- Auth-Hilfsfunktionen ---

async function loadUserAuthData(benutzerId) {
  const [rollenRows] = await pool.query(
    `SELECT r.Bezeichnung FROM benutzer_rolle br JOIN rolle r ON r.ID = br.RolleID WHERE br.BenutzerID = ?`,
    [benutzerId]
  );
  const [fachbereichRows] = await pool.query(`SELECT FachbereichID FROM benutzer_fachbereich WHERE BenutzerID = ?`, [
    benutzerId,
  ]);
  return {
    roles: rollenRows.map((r) => r.Bezeichnung),
    fachbereichIds: fachbereichRows.map((r) => r.FachbereichID),
  };
}

function sessionUserPayload(req) {
  return {
    ID: req.session.userId,
    Username: req.session.username,
    Vorname: req.session.vorname,
    Nachname: req.session.nachname,
    roles: req.session.roles || [],
    fachbereichIds: req.session.fachbereichIds || [],
  };
}

function isRestrictedUser(req) {
  const roles = req.session.roles || [];
  return !roles.some((r) => UNRESTRICTED_ROLLEN.includes(r));
}

function fachbereichInScope(req, fachbereichId) {
  if (!isRestrictedUser(req)) {
    return true;
  }
  if (fachbereichId == null) {
    return false;
  }
  return (req.session.fachbereichIds || []).includes(Number(fachbereichId));
}

async function resolveFachbereichForGruppe(gruppeId) {
  if (!gruppeId) {
    return null;
  }
  const [rows] = await pool.query("SELECT FachbereichID FROM gruppe WHERE ID = ?", [gruppeId]);
  return rows[0] ? rows[0].FachbereichID : null;
}

async function resolveFachbereichForMassnahme(massnahmeId) {
  if (!massnahmeId) {
    return null;
  }
  const [rows] = await pool.query(
    `SELECT g.FachbereichID FROM massnahme m LEFT JOIN gruppe g ON g.ID = m.GruppeID WHERE m.ID = ?`,
    [massnahmeId]
  );
  return rows[0] ? rows[0].FachbereichID : null;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Nicht angemeldet." });
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRoles = req.session.roles || [];
    if (!allowedRoles.some((r) => userRoles.includes(r))) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }
    next();
  };
}

// --- Auth-Routen ---

app.post("/api/login", async (req, res) => {
  const { Username, Passwort } = req.body;

  if (!Username || !Passwort) {
    return res.status(400).json({ error: "Benutzername und Passwort sind erforderlich." });
  }

  try {
    const [rows] = await pool.query(
      "SELECT ID, Username, PasswortHash, Vorname, Nachname FROM benutzer WHERE Username = ?",
      [Username]
    );

    const benutzer = rows[0];
    const passwortOk = benutzer && (await bcrypt.compare(Passwort, benutzer.PasswortHash));

    if (!benutzer || !passwortOk) {
      return res.status(401).json({ error: "Benutzername oder Passwort ist ungültig." });
    }

    const { roles, fachbereichIds } = await loadUserAuthData(benutzer.ID);

    req.session.userId = benutzer.ID;
    req.session.username = benutzer.Username;
    req.session.vorname = benutzer.Vorname;
    req.session.nachname = benutzer.Nachname;
    req.session.roles = roles;
    req.session.fachbereichIds = fachbereichIds;

    res.json(sessionUserPayload(req));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Anmeldung fehlgeschlagen." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

app.use("/api", requireAuth);

app.get("/api/me", (req, res) => {
  res.json(sessionUserPayload(req));
});

app.put("/api/me/passwort", async (req, res) => {
  const { AktuellesPasswort, NeuesPasswort, NeuesPasswortWiederholung } = req.body;

  if (!AktuellesPasswort || !NeuesPasswort || !NeuesPasswortWiederholung) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich." });
  }
  if (NeuesPasswort !== NeuesPasswortWiederholung) {
    return res.status(400).json({ error: "Die Passwort-Wiederholung stimmt nicht überein." });
  }
  if (NeuesPasswort.length < 8) {
    return res.status(400).json({ error: "Das neue Passwort muss mindestens 8 Zeichen lang sein." });
  }

  try {
    const [rows] = await pool.query("SELECT PasswortHash FROM benutzer WHERE ID = ?", [req.session.userId]);
    const benutzer = rows[0];

    if (!benutzer || !(await bcrypt.compare(AktuellesPasswort, benutzer.PasswortHash))) {
      return res.status(400).json({ error: "Das aktuelle Passwort ist nicht korrekt." });
    }

    const hash = await bcrypt.hash(NeuesPasswort, 10);
    await pool.query("UPDATE benutzer SET PasswortHash = ? WHERE ID = ?", [hash, req.session.userId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Passwort konnte nicht geändert werden." });
  }
});

app.get("/api/rollen", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT ID, Bezeichnung FROM rolle ORDER BY ID");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Rollen konnten nicht geladen werden." });
  }
});

// --- Benutzerverwaltung (admin-only) ---

async function attachRollenUndFachbereiche(benutzerRows) {
  if (benutzerRows.length === 0) {
    return [];
  }
  const ids = benutzerRows.map((b) => b.ID);
  const [rollenRows] = await pool.query(
    `SELECT br.BenutzerID, r.ID, r.Bezeichnung FROM benutzer_rolle br JOIN rolle r ON r.ID = br.RolleID WHERE br.BenutzerID IN (?)`,
    [ids]
  );
  const [fbRows] = await pool.query(
    `SELECT bf.BenutzerID, f.ID, f.BezeichnungLang FROM benutzer_fachbereich bf JOIN fachbereich f ON f.ID = bf.FachbereichID WHERE bf.BenutzerID IN (?)`,
    [ids]
  );

  return benutzerRows.map((b) => ({
    ...b,
    RolleIDs: rollenRows.filter((r) => r.BenutzerID === b.ID).map((r) => r.ID),
    RolleNamen: rollenRows.filter((r) => r.BenutzerID === b.ID).map((r) => r.Bezeichnung),
    FachbereichIDs: fbRows.filter((f) => f.BenutzerID === b.ID).map((f) => f.ID),
    FachbereichNamen: fbRows.filter((f) => f.BenutzerID === b.ID).map((f) => f.BezeichnungLang),
  }));
}

app.get("/api/benutzer", requireRole("Administrator"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT ID, Username, Vorname, Nachname, Email, Telefon, ErstelltAm FROM benutzer ORDER BY Nachname, Vorname"
    );
    res.json(await attachRollenUndFachbereiche(rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Benutzer konnten nicht geladen werden." });
  }
});

function readBenutzerBody(body, { requirePasswort }) {
  const { Username, Passwort, Vorname, Nachname, Email, Telefon, RolleIDs, FachbereichIDs } = body;

  if (!Username || !Vorname || !Nachname) {
    return { error: "Benutzername, Vorname und Nachname sind erforderlich." };
  }
  if (requirePasswort && !Passwort) {
    return { error: "Passwort ist erforderlich." };
  }

  return {
    values: {
      Username,
      Passwort: Passwort || null,
      Vorname,
      Nachname,
      Email: Email || null,
      Telefon: Telefon || null,
      RolleIDs: Array.isArray(RolleIDs) ? RolleIDs.map(Number) : [],
      FachbereichIDs: Array.isArray(FachbereichIDs) ? FachbereichIDs.map(Number) : [],
    },
  };
}

app.post("/api/benutzer", requireRole("Administrator"), async (req, res) => {
  const { error, values } = readBenutzerBody(req.body, { requirePasswort: true });

  if (error) {
    return res.status(400).json({ error });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const hash = await bcrypt.hash(values.Passwort, 10);
    const [result] = await conn.query(
      "INSERT INTO benutzer (Username, PasswortHash, Vorname, Nachname, Email, Telefon) VALUES (?, ?, ?, ?, ?, ?)",
      [values.Username, hash, values.Vorname, values.Nachname, values.Email, values.Telefon]
    );
    const benutzerId = result.insertId;

    for (const rolleId of values.RolleIDs) {
      await conn.query("INSERT INTO benutzer_rolle (BenutzerID, RolleID) VALUES (?, ?)", [benutzerId, rolleId]);
    }
    for (const fachbereichId of values.FachbereichIDs) {
      await conn.query("INSERT INTO benutzer_fachbereich (BenutzerID, FachbereichID) VALUES (?, ?)", [
        benutzerId,
        fachbereichId,
      ]);
    }

    await conn.commit();

    const [rows] = await pool.query(
      "SELECT ID, Username, Vorname, Nachname, Email, Telefon, ErstelltAm FROM benutzer WHERE ID = ?",
      [benutzerId]
    );
    const [withRelations] = await attachRollenUndFachbereiche(rows);
    res.status(201).json(withRelations);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Benutzername ist bereits vergeben." });
    }
    res.status(500).json({ error: "Benutzer konnte nicht gespeichert werden." });
  } finally {
    conn.release();
  }
});

app.put("/api/benutzer/:id", requireRole("Administrator"), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  const { error, values } = readBenutzerBody(req.body, { requirePasswort: false });

  if (error) {
    return res.status(400).json({ error });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let updateResult;
    if (values.Passwort) {
      const hash = await bcrypt.hash(values.Passwort, 10);
      [updateResult] = await conn.query(
        "UPDATE benutzer SET Username = ?, PasswortHash = ?, Vorname = ?, Nachname = ?, Email = ?, Telefon = ? WHERE ID = ?",
        [values.Username, hash, values.Vorname, values.Nachname, values.Email, values.Telefon, id]
      );
    } else {
      [updateResult] = await conn.query(
        "UPDATE benutzer SET Username = ?, Vorname = ?, Nachname = ?, Email = ?, Telefon = ? WHERE ID = ?",
        [values.Username, values.Vorname, values.Nachname, values.Email, values.Telefon, id]
      );
    }

    if (updateResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Benutzer wurde nicht gefunden." });
    }

    await conn.query("DELETE FROM benutzer_rolle WHERE BenutzerID = ?", [id]);
    for (const rolleId of values.RolleIDs) {
      await conn.query("INSERT INTO benutzer_rolle (BenutzerID, RolleID) VALUES (?, ?)", [id, rolleId]);
    }

    await conn.query("DELETE FROM benutzer_fachbereich WHERE BenutzerID = ?", [id]);
    for (const fachbereichId of values.FachbereichIDs) {
      await conn.query("INSERT INTO benutzer_fachbereich (BenutzerID, FachbereichID) VALUES (?, ?)", [
        id,
        fachbereichId,
      ]);
    }

    await conn.commit();

    const [rows] = await pool.query(
      "SELECT ID, Username, Vorname, Nachname, Email, Telefon, ErstelltAm FROM benutzer WHERE ID = ?",
      [id]
    );
    const [withRelations] = await attachRollenUndFachbereiche(rows);
    res.json(withRelations);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Benutzername ist bereits vergeben." });
    }
    res.status(500).json({ error: "Benutzer konnte nicht aktualisiert werden." });
  } finally {
    conn.release();
  }
});

app.delete("/api/benutzer/:id", requireRole("Administrator"), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  if (id === req.session.userId) {
    return res.status(400).json({ error: "Der eigene Account kann nicht gelöscht werden." });
  }

  try {
    const [result] = await pool.query("DELETE FROM benutzer WHERE ID = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Benutzer wurde nicht gefunden." });
    }

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Benutzer konnte nicht gelöscht werden." });
  }
});

// --- Fachbereiche ---

app.get("/api/fachbereiche", async (req, res) => {
  try {
    let query = "SELECT ID, BezeichnungLang, BezeichnungKurz, Kennung FROM fachbereich";
    const params = [];

    if (isRestrictedUser(req)) {
      const ids = req.session.fachbereichIds || [];
      if (ids.length === 0) {
        return res.json([]);
      }
      query += " WHERE ID IN (?)";
      params.push(ids);
    }

    query += " ORDER BY BezeichnungLang";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fachbereiche konnten nicht geladen werden." });
  }
});

app.post("/api/fachbereiche", requireRole("Administrator"), async (req, res) => {
  const { BezeichnungLang, BezeichnungKurz, Kennung } = req.body;

  if (!BezeichnungLang || !BezeichnungKurz) {
    return res.status(400).json({ error: "Bezeichnung und Kürzel sind erforderlich." });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO fachbereich (BezeichnungLang, BezeichnungKurz, Kennung) VALUES (?, ?, ?)",
      [BezeichnungLang, BezeichnungKurz, Kennung || null]
    );
    res.status(201).json({
      ID: result.insertId,
      BezeichnungLang,
      BezeichnungKurz,
      Kennung: Kennung || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fachbereich konnte nicht gespeichert werden." });
  }
});

app.put("/api/fachbereiche/:id", requireRole("Administrator"), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  const { BezeichnungLang, BezeichnungKurz, Kennung } = req.body;

  if (!BezeichnungLang || !BezeichnungKurz) {
    return res.status(400).json({ error: "Bezeichnung und Kürzel sind erforderlich." });
  }

  try {
    const [result] = await pool.query(
      "UPDATE fachbereich SET BezeichnungLang = ?, BezeichnungKurz = ?, Kennung = ? WHERE ID = ?",
      [BezeichnungLang, BezeichnungKurz, Kennung || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Fachbereich wurde nicht gefunden." });
    }

    res.json({ ID: id, BezeichnungLang, BezeichnungKurz, Kennung: Kennung || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fachbereich konnte nicht aktualisiert werden." });
  }
});

app.delete("/api/fachbereiche/:id", requireRole("Administrator"), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  try {
    const [result] = await pool.query("DELETE FROM fachbereich WHERE ID = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Fachbereich wurde nicht gefunden." });
    }

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fachbereich konnte nicht gelöscht werden." });
  }
});

// --- Gruppen ---

app.get("/api/gruppen", async (req, res) => {
  try {
    let query = `SELECT g.ID, g.Bezeichnung, g.Kennung, g.FachbereichID, f.BezeichnungLang AS FachbereichBezeichnung
       FROM gruppe g
       LEFT JOIN fachbereich f ON f.ID = g.FachbereichID`;
    const params = [];

    if (isRestrictedUser(req)) {
      const ids = req.session.fachbereichIds || [];
      if (ids.length === 0) {
        return res.json([]);
      }
      query += " WHERE g.FachbereichID IN (?)";
      params.push(ids);
    }

    query += " ORDER BY g.Bezeichnung";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gruppen konnten nicht geladen werden." });
  }
});

app.post("/api/gruppen", async (req, res) => {
  const { Bezeichnung, Kennung, FachbereichID } = req.body;

  if (!Bezeichnung) {
    return res.status(400).json({ error: "Bezeichnung ist erforderlich." });
  }

  const fachbereichId = FachbereichID ? Number(FachbereichID) : null;

  if (!fachbereichInScope(req, fachbereichId)) {
    return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO gruppe (Bezeichnung, Kennung, FachbereichID) VALUES (?, ?, ?)",
      [Bezeichnung, Kennung || null, fachbereichId]
    );
    res.status(201).json({
      ID: result.insertId,
      Bezeichnung,
      Kennung: Kennung || null,
      FachbereichID: fachbereichId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gruppe konnte nicht gespeichert werden." });
  }
});

app.put("/api/gruppen/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  const { Bezeichnung, Kennung, FachbereichID } = req.body;

  if (!Bezeichnung) {
    return res.status(400).json({ error: "Bezeichnung ist erforderlich." });
  }

  const fachbereichId = FachbereichID ? Number(FachbereichID) : null;

  try {
    if (isRestrictedUser(req)) {
      const [existingRows] = await pool.query("SELECT FachbereichID FROM gruppe WHERE ID = ?", [id]);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: "Gruppe wurde nicht gefunden." });
      }
      if (!fachbereichInScope(req, existing.FachbereichID) || !fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
      }
    }

    const [result] = await pool.query(
      "UPDATE gruppe SET Bezeichnung = ?, Kennung = ?, FachbereichID = ? WHERE ID = ?",
      [Bezeichnung, Kennung || null, fachbereichId, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Gruppe wurde nicht gefunden." });
    }

    res.json({ ID: id, Bezeichnung, Kennung: Kennung || null, FachbereichID: fachbereichId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gruppe konnte nicht aktualisiert werden." });
  }
});

app.delete("/api/gruppen/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  try {
    if (isRestrictedUser(req)) {
      const [existingRows] = await pool.query("SELECT FachbereichID FROM gruppe WHERE ID = ?", [id]);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: "Gruppe wurde nicht gefunden." });
      }
      if (!fachbereichInScope(req, existing.FachbereichID)) {
        return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
      }
    }

    const [result] = await pool.query("DELETE FROM gruppe WHERE ID = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Gruppe wurde nicht gefunden." });
    }

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gruppe konnte nicht gelöscht werden." });
  }
});

// --- Maßnahmen ---

app.get("/api/massnahmen", async (req, res) => {
  try {
    let query = `SELECT m.ID, m.Bezeichnung, m.VT, m.GruppeID, g.Bezeichnung AS GruppeBezeichnung,
              m.ZertDatum, m.PlanStart, m.PlanEnde
       FROM massnahme m
       LEFT JOIN gruppe g ON g.ID = m.GruppeID`;
    const params = [];

    if (isRestrictedUser(req)) {
      const ids = req.session.fachbereichIds || [];
      if (ids.length === 0) {
        return res.json([]);
      }
      query += " WHERE g.FachbereichID IN (?)";
      params.push(ids);
    }

    query += " ORDER BY m.Bezeichnung";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Maßnahmen konnten nicht geladen werden." });
  }
});

function readMassnahmeBody(body) {
  const { Bezeichnung, VT, GruppeID, ZertDatum, PlanStart, PlanEnde } = body;

  if (!Bezeichnung || !VT || !ZertDatum || !PlanStart || !PlanEnde) {
    return { error: "Bezeichnung, VT, Zert.-Datum, Plan-Start und Plan-Ende sind erforderlich." };
  }

  return {
    values: {
      Bezeichnung,
      VT,
      GruppeID: GruppeID ? Number(GruppeID) : null,
      ZertDatum,
      PlanStart,
      PlanEnde,
    },
  };
}

app.post("/api/massnahmen", async (req, res) => {
  const { error, values } = readMassnahmeBody(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const fachbereichId = await resolveFachbereichForGruppe(values.GruppeID);
    if (!fachbereichInScope(req, fachbereichId)) {
      return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
    }

    const [result] = await pool.query(
      "INSERT INTO massnahme (Bezeichnung, VT, GruppeID, ZertDatum, PlanStart, PlanEnde) VALUES (?, ?, ?, ?, ?, ?)",
      [values.Bezeichnung, values.VT, values.GruppeID, values.ZertDatum, values.PlanStart, values.PlanEnde]
    );
    res.status(201).json({ ID: result.insertId, ...values });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Maßnahme konnte nicht gespeichert werden." });
  }
});

app.put("/api/massnahmen/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  const { error, values } = readMassnahmeBody(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    if (isRestrictedUser(req)) {
      const [existingRows] = await pool.query("SELECT GruppeID FROM massnahme WHERE ID = ?", [id]);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: "Maßnahme wurde nicht gefunden." });
      }
      const existingFachbereichId = await resolveFachbereichForGruppe(existing.GruppeID);
      const newFachbereichId = await resolveFachbereichForGruppe(values.GruppeID);
      if (!fachbereichInScope(req, existingFachbereichId) || !fachbereichInScope(req, newFachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
      }
    }

    const [result] = await pool.query(
      "UPDATE massnahme SET Bezeichnung = ?, VT = ?, GruppeID = ?, ZertDatum = ?, PlanStart = ?, PlanEnde = ? WHERE ID = ?",
      [values.Bezeichnung, values.VT, values.GruppeID, values.ZertDatum, values.PlanStart, values.PlanEnde, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Maßnahme wurde nicht gefunden." });
    }

    res.json({ ID: id, ...values });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Maßnahme konnte nicht aktualisiert werden." });
  }
});

app.delete("/api/massnahmen/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  try {
    if (isRestrictedUser(req)) {
      const [existingRows] = await pool.query("SELECT GruppeID FROM massnahme WHERE ID = ?", [id]);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: "Maßnahme wurde nicht gefunden." });
      }
      const fachbereichId = await resolveFachbereichForGruppe(existing.GruppeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
      }
    }

    const [result] = await pool.query("DELETE FROM massnahme WHERE ID = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Maßnahme wurde nicht gefunden." });
    }

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Maßnahme konnte nicht gelöscht werden." });
  }
});

// --- Teilnehmende ---

app.get("/api/teilnehmer", async (req, res) => {
  try {
    let query = `SELECT t.ID, t.Vorname, t.Nachname, t.Geburtsdatum, t.MassnahmeID, m.Bezeichnung AS MassnahmeBezeichnung,
              m.VT, m.GruppeID, g.Bezeichnung AS GruppeBezeichnung, g.Kennung AS GruppeKennung, g.FachbereichID,
              f.BezeichnungLang AS FachbereichBezeichnung,
              t.Startdatum, t.Endedatum, t.Email, t.Telefon
       FROM teilnehmer t
       LEFT JOIN massnahme m ON m.ID = t.MassnahmeID
       LEFT JOIN gruppe g ON g.ID = m.GruppeID
       LEFT JOIN fachbereich f ON f.ID = g.FachbereichID`;
    const params = [];

    if (isRestrictedUser(req)) {
      const ids = req.session.fachbereichIds || [];
      if (ids.length === 0) {
        return res.json([]);
      }
      query += " WHERE f.ID IN (?)";
      params.push(ids);
    }

    query += " ORDER BY t.Nachname, t.Vorname";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Teilnehmende konnten nicht geladen werden." });
  }
});

function readTeilnehmerBody(body) {
  const { Vorname, Nachname, Geburtsdatum, MassnahmeID, Startdatum, Endedatum, Email, Telefon } = body;

  if (!Vorname || !Nachname || !Geburtsdatum || !MassnahmeID || !Startdatum || !Endedatum) {
    return { error: "Vorname, Nachname, Geburtsdatum, Maßnahme, Startdatum und Endedatum sind erforderlich." };
  }

  return {
    values: {
      Vorname,
      Nachname,
      Geburtsdatum,
      MassnahmeID: Number(MassnahmeID),
      Startdatum,
      Endedatum,
      Email: Email || null,
      Telefon: Telefon || null,
    },
  };
}

app.post("/api/teilnehmer", async (req, res) => {
  const { error, values } = readTeilnehmerBody(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const fachbereichId = await resolveFachbereichForMassnahme(values.MassnahmeID);
    if (!fachbereichInScope(req, fachbereichId)) {
      return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
    }

    const [result] = await pool.query(
      "INSERT INTO teilnehmer (Vorname, Nachname, Geburtsdatum, MassnahmeID, Startdatum, Endedatum, Email, Telefon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [values.Vorname, values.Nachname, values.Geburtsdatum, values.MassnahmeID, values.Startdatum, values.Endedatum, values.Email, values.Telefon]
    );
    res.status(201).json({ ID: result.insertId, ...values });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Teilnehmer konnte nicht gespeichert werden." });
  }
});

app.put("/api/teilnehmer/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  const { error, values } = readTeilnehmerBody(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    if (isRestrictedUser(req)) {
      const [existingRows] = await pool.query("SELECT MassnahmeID FROM teilnehmer WHERE ID = ?", [id]);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: "Teilnehmer wurde nicht gefunden." });
      }
      const existingFachbereichId = await resolveFachbereichForMassnahme(existing.MassnahmeID);
      const newFachbereichId = await resolveFachbereichForMassnahme(values.MassnahmeID);
      if (!fachbereichInScope(req, existingFachbereichId) || !fachbereichInScope(req, newFachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
      }
    }

    const [result] = await pool.query(
      "UPDATE teilnehmer SET Vorname = ?, Nachname = ?, Geburtsdatum = ?, MassnahmeID = ?, Startdatum = ?, Endedatum = ?, Email = ?, Telefon = ? WHERE ID = ?",
      [values.Vorname, values.Nachname, values.Geburtsdatum, values.MassnahmeID, values.Startdatum, values.Endedatum, values.Email, values.Telefon, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Teilnehmer wurde nicht gefunden." });
    }

    res.json({ ID: id, ...values });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Teilnehmer konnte nicht aktualisiert werden." });
  }
});

app.delete("/api/teilnehmer/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  try {
    if (isRestrictedUser(req)) {
      const [existingRows] = await pool.query("SELECT MassnahmeID FROM teilnehmer WHERE ID = ?", [id]);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: "Teilnehmer wurde nicht gefunden." });
      }
      const fachbereichId = await resolveFachbereichForMassnahme(existing.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
      }
    }

    const [result] = await pool.query("DELETE FROM teilnehmer WHERE ID = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Teilnehmer wurde nicht gefunden." });
    }

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Teilnehmer konnte nicht gelöscht werden." });
  }
});

// --- Aktivitäten ---

const AKTIVITAET_ARTEN = ["Gesprächsprotokoll", "Aktennotiz", "Kontaktversuch"];

app.get("/api/aktivitaeten", async (req, res) => {
  const teilnehmerId = Number(req.query.teilnehmerId);

  if (!Number.isInteger(teilnehmerId)) {
    return res.status(400).json({ error: "Teilnehmer ist erforderlich." });
  }

  try {
    const [teilnehmerRows] = await pool.query("SELECT MassnahmeID FROM teilnehmer WHERE ID = ?", [teilnehmerId]);
    const teilnehmer = teilnehmerRows[0];
    if (!teilnehmer) {
      return res.status(404).json({ error: "Teilnehmer wurde nicht gefunden." });
    }

    if (isRestrictedUser(req)) {
      const fachbereichId = await resolveFachbereichForMassnahme(teilnehmer.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diesen Teilnehmer." });
      }
    }

    const [rows] = await pool.query(
      "SELECT ID, TeilnehmerID, Art, Thema, Bearbeiter, Bemerkung, Wiedervorlage, ErstelltAm FROM aktivitaet WHERE TeilnehmerID = ? ORDER BY ErstelltAm DESC",
      [teilnehmerId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Aktivitäten konnten nicht geladen werden." });
  }
});

app.post("/api/aktivitaeten", async (req, res) => {
  const { TeilnehmerID, Art, Thema, Bemerkung, Wiedervorlage } = req.body;
  const teilnehmerId = Number(TeilnehmerID);
  const thema = typeof Thema === "string" ? Thema.trim() : "";

  if (!Number.isInteger(teilnehmerId) || !AKTIVITAET_ARTEN.includes(Art)) {
    return res.status(400).json({ error: "Teilnehmer und eine gültige Art sind erforderlich." });
  }
  if (thema.length > 60) {
    return res.status(400).json({ error: "Thema darf höchstens 60 Zeichen lang sein." });
  }

  try {
    const [teilnehmerRows] = await pool.query("SELECT MassnahmeID FROM teilnehmer WHERE ID = ?", [teilnehmerId]);
    const teilnehmer = teilnehmerRows[0];
    if (!teilnehmer) {
      return res.status(404).json({ error: "Teilnehmer wurde nicht gefunden." });
    }

    if (isRestrictedUser(req)) {
      const fachbereichId = await resolveFachbereichForMassnahme(teilnehmer.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diesen Teilnehmer." });
      }
    }

    const bearbeiter = `${req.session.vorname} ${req.session.nachname}`;

    const [result] = await pool.query(
      "INSERT INTO aktivitaet (TeilnehmerID, Art, Thema, Bearbeiter, Bemerkung, Wiedervorlage) VALUES (?, ?, ?, ?, ?, ?)",
      [teilnehmerId, Art, thema || null, bearbeiter, Bemerkung || null, Wiedervorlage || null]
    );

    const [rows] = await pool.query(
      "SELECT ID, TeilnehmerID, Art, Thema, Bearbeiter, Bemerkung, Wiedervorlage, ErstelltAm FROM aktivitaet WHERE ID = ?",
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Aktivität konnte nicht gespeichert werden." });
  }
});

app.get("/api/aktivitaeten/summary", async (req, res) => {
  try {
    let query = `SELECT a.TeilnehmerID, COUNT(*) AS Anzahl,
        MAX(CASE WHEN a.ErstelltAm >= (NOW() - INTERVAL 14 DAY) THEN 1 ELSE 0 END) AS HatAktuelle
       FROM aktivitaet a`;
    const params = [];

    if (isRestrictedUser(req)) {
      const ids = req.session.fachbereichIds || [];
      if (ids.length === 0) {
        return res.json([]);
      }
      query += ` JOIN teilnehmer t ON t.ID = a.TeilnehmerID
         JOIN massnahme m ON m.ID = t.MassnahmeID
         JOIN gruppe g ON g.ID = m.GruppeID
         WHERE g.FachbereichID IN (?)`;
      params.push(ids);
    }

    query += " GROUP BY a.TeilnehmerID";

    const [rows] = await pool.query(query, params);
    res.json(rows.map((row) => ({ TeilnehmerID: row.TeilnehmerID, Anzahl: row.Anzahl, HatAktuelle: Boolean(row.HatAktuelle) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Aktivitäten-Übersicht konnte nicht geladen werden." });
  }
});

// --- Anwesenheiten ---

app.get("/api/anwesenheitsstatus", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT ID, Bezeichnung, Kurzzeichen FROM anwesenheitsstatus ORDER BY ID"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Anwesenheitsstatus konnte nicht geladen werden." });
  }
});

app.get("/api/anwesenheiten", async (req, res) => {
  const monat = req.query.monat;

  if (!/^\d{4}-\d{2}$/.test(monat || "")) {
    return res.status(400).json({ error: "Ungültiger Monat (Format YYYY-MM erwartet)." });
  }

  try {
    let rows;

    if (isRestrictedUser(req)) {
      const ids = req.session.fachbereichIds || [];
      if (ids.length === 0) {
        return res.json([]);
      }
      [rows] = await pool.query(
        `SELECT a.ID, a.TeilnehmerID, a.Datum, a.StatusID
         FROM anwesenheit a
         JOIN teilnehmer t ON t.ID = a.TeilnehmerID
         JOIN massnahme m ON m.ID = t.MassnahmeID
         JOIN gruppe g ON g.ID = m.GruppeID
         WHERE DATE_FORMAT(a.Datum, '%Y-%m') = ? AND g.FachbereichID IN (?)`,
        [monat, ids]
      );
    } else {
      [rows] = await pool.query(
        "SELECT ID, TeilnehmerID, Datum, StatusID FROM anwesenheit WHERE DATE_FORMAT(Datum, '%Y-%m') = ?",
        [monat]
      );
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Anwesenheiten konnten nicht geladen werden." });
  }
});

app.put("/api/anwesenheiten", async (req, res) => {
  const { TeilnehmerID, Datum, StatusID } = req.body;
  const teilnehmerId = Number(TeilnehmerID);

  if (!Number.isInteger(teilnehmerId) || !/^\d{4}-\d{2}-\d{2}$/.test(Datum || "")) {
    return res.status(400).json({ error: "Teilnehmer und Datum sind erforderlich." });
  }

  try {
    if (isRestrictedUser(req)) {
      const [rows] = await pool.query("SELECT MassnahmeID FROM teilnehmer WHERE ID = ?", [teilnehmerId]);
      const teilnehmer = rows[0];
      if (!teilnehmer) {
        return res.status(404).json({ error: "Teilnehmer wurde nicht gefunden." });
      }
      const fachbereichId = await resolveFachbereichForMassnahme(teilnehmer.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diesen Fachbereich." });
      }
    }

    if (!StatusID) {
      await pool.query("DELETE FROM anwesenheit WHERE TeilnehmerID = ? AND Datum = ?", [teilnehmerId, Datum]);
      return res.status(204).end();
    }

    const statusId = Number(StatusID);
    if (!Number.isInteger(statusId)) {
      return res.status(400).json({ error: "Ungültiger Status." });
    }

    await pool.query(
      `INSERT INTO anwesenheit (TeilnehmerID, Datum, StatusID) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE StatusID = VALUES(StatusID)`,
      [teilnehmerId, Datum, statusId]
    );

    res.json({ TeilnehmerID: teilnehmerId, Datum, StatusID: statusId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Anwesenheit konnte nicht gespeichert werden." });
  }
});

const port = process.env.PORT || 3000;

bootstrapDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Standortmanager Server läuft auf http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Datenbank-Bootstrap fehlgeschlagen:", err);
    process.exit(1);
  });
