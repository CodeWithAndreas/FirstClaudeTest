require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const multer = require("multer");

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

const publicRoot = path.join(__dirname, "..");
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(publicRoot, "index.html")));
app.get("/dokument-vorschau.html", (req, res) => res.sendFile(path.join(publicRoot, "dokument-vorschau.html")));
app.use("/css", express.static(path.join(publicRoot, "css")));
app.use("/js", express.static(path.join(publicRoot, "js")));
app.use("/assets", express.static(path.join(publicRoot, "assets")));

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

const ROLLEN_SEED = ["Ausbilder", "Fachbereichsleiter", "Lehrgangsorganisation", "Administrator", "Bildungsstättenleiter", "Auditor"];
const UNRESTRICTED_ROLLEN = ["Administrator", "Lehrgangsorganisation", "Bildungsstättenleiter"];
const ADMIN_SEED_USERNAME = "admin";
const ADMIN_SEED_PASSWORT = "Admin2026!";

const BUNDESLAENDER = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
];
const GESCHAEFTSBEREICHE = ["Zentrale", "West", "Ost", "Nord", "Süd", "MaxQ", "IFTP"];
const BILDUNGSSTAETTE_SCHLUESSEL = [
  "bildungsstaette_name",
  "bildungsstaette_strasse",
  "bildungsstaette_hausnummer",
  "bildungsstaette_plz",
  "bildungsstaette_ort",
  "bildungsstaette_bundesland",
  "bildungsstaette_email",
  "bildungsstaette_telefon",
  "bildungsstaette_geschaeftsbereich",
];
const UNTERNEHMEN_TEXT_SCHLUESSEL = ["unternehmen_name", "unternehmen_bezeichnung"];
const LOGO_ERLAUBTE_MIMETYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

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
      Aktiv TINYINT(1) NOT NULL DEFAULT 1,
      ErstelltAm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  const [benutzerSpalten] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'benutzer' AND COLUMN_NAME = 'Aktiv'`
  );
  if (benutzerSpalten.length === 0) {
    await pool.query("ALTER TABLE benutzer ADD COLUMN Aktiv TINYINT(1) NOT NULL DEFAULT 1");
  }

  const [aktivitaetSpalten] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'aktivitaet'
       AND COLUMN_NAME IN ('BearbeiterID', 'WiedervorlageErledigt')`
  );
  const vorhandeneAktivitaetSpalten = aktivitaetSpalten.map((row) => row.COLUMN_NAME);
  if (!vorhandeneAktivitaetSpalten.includes("BearbeiterID")) {
    await pool.query("ALTER TABLE aktivitaet ADD COLUMN BearbeiterID INT DEFAULT NULL");
    await pool.query("ALTER TABLE aktivitaet ADD INDEX idx_Aktivitaet_BearbeiterID (BearbeiterID)");
  }
  if (!vorhandeneAktivitaetSpalten.includes("WiedervorlageErledigt")) {
    await pool.query("ALTER TABLE aktivitaet ADD COLUMN WiedervorlageErledigt TINYINT(1) NOT NULL DEFAULT 0");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dokument (
      ID INT NOT NULL AUTO_INCREMENT,
      TeilnehmerID INT NOT NULL,
      Titel VARCHAR(255) NOT NULL,
      Schlagworte VARCHAR(500) DEFAULT NULL,
      Dokumentart VARCHAR(60) NOT NULL,
      Vertraulich TINYINT(1) NOT NULL DEFAULT 0,
      Loeschdatum DATE NOT NULL,
      Dateiname VARCHAR(255) NOT NULL,
      GespeicherterDateiname VARCHAR(255) NOT NULL,
      Dateigroesse INT NOT NULL,
      MimeType VARCHAR(150) DEFAULT NULL,
      HochgeladenAm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (ID),
      KEY fk_Dokument_Teilnehmer_idx (TeilnehmerID),
      CONSTRAINT fk_Dokument_Teilnehmer FOREIGN KEY (TeilnehmerID) REFERENCES teilnehmer (ID) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leistungskontrolle (
      ID INT NOT NULL AUTO_INCREMENT,
      Art VARCHAR(60) NOT NULL,
      Bezeichnung VARCHAR(255) NOT NULL,
      Beschreibung TEXT NOT NULL,
      Durchfuehrungsdatum DATE NOT NULL,
      Gesamtpunkte DECIMAL(6,2) DEFAULT NULL,
      Loeschdatum DATE DEFAULT NULL,
      Lagerort VARCHAR(255) NOT NULL,
      ErstelltAm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (ID)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leistungskontrolle_massnahme (
      LeistungskontrolleID INT NOT NULL,
      MassnahmeID INT NOT NULL,
      PRIMARY KEY (LeistungskontrolleID, MassnahmeID),
      KEY fk_LKMassnahme_Massnahme_idx (MassnahmeID),
      CONSTRAINT fk_LKMassnahme_LK FOREIGN KEY (LeistungskontrolleID) REFERENCES leistungskontrolle (ID) ON DELETE CASCADE,
      CONSTRAINT fk_LKMassnahme_Massnahme FOREIGN KEY (MassnahmeID) REFERENCES massnahme (ID) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leistungskontrolle_teilnehmer (
      LeistungskontrolleID INT NOT NULL,
      TeilnehmerID INT NOT NULL,
      Ergebnispunkte DECIMAL(6,2) DEFAULT NULL,
      Note VARCHAR(20) DEFAULT NULL,
      Korrekturdatum DATE DEFAULT NULL,
      BesprochenAmDatum DATE DEFAULT NULL,
      PRIMARY KEY (LeistungskontrolleID, TeilnehmerID),
      KEY fk_LKTeilnehmer_Teilnehmer_idx (TeilnehmerID),
      CONSTRAINT fk_LKTeilnehmer_LK FOREIGN KEY (LeistungskontrolleID) REFERENCES leistungskontrolle (ID) ON DELETE CASCADE,
      CONSTRAINT fk_LKTeilnehmer_Teilnehmer FOREIGN KEY (TeilnehmerID) REFERENCES teilnehmer (ID) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS einstellung (
      Schluessel VARCHAR(100) NOT NULL,
      Wert VARCHAR(500) DEFAULT NULL,
      PRIMARY KEY (Schluessel)
    ) ENGINE=InnoDB
  `);
  await pool.query("INSERT IGNORE INTO einstellung (Schluessel, Wert) VALUES ('loeschfrist_offset_jahre', '3')");
  await pool.query("INSERT IGNORE INTO einstellung (Schluessel, Wert) VALUES ('dokumentenpfad', '')");
  await pool.query("INSERT IGNORE INTO einstellung (Schluessel, Wert) VALUES ('log_max_dateigroesse_mb', '')");
  for (const schluessel of BILDUNGSSTAETTE_SCHLUESSEL) {
    await pool.query("INSERT IGNORE INTO einstellung (Schluessel, Wert) VALUES (?, '')", [schluessel]);
  }
  for (const schluessel of [...UNTERNEHMEN_TEXT_SCHLUESSEL, "unternehmen_logo_dateiname"]) {
    await pool.query("INSERT IGNORE INTO einstellung (Schluessel, Wert) VALUES (?, '')", [schluessel]);
  }

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

function hasRole(req, roleName) {
  return (req.session.roles || []).includes(roleName);
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

async function getEinstellung(schluessel, fallback = null) {
  const [rows] = await pool.query("SELECT Wert FROM einstellung WHERE Schluessel = ?", [schluessel]);
  return rows[0] ? rows[0].Wert : fallback;
}

async function resolveUploadVerzeichnis() {
  const konfiguriert = await getEinstellung("dokumentenpfad", "");
  const zielpfad = konfiguriert && konfiguriert.trim() ? konfiguriert.trim() : path.join(__dirname, "uploads");
  fs.mkdirSync(zielpfad, { recursive: true });
  return zielpfad;
}

// --- Unternehmen: Logo ---

const LOGO_VERZEICHNIS = path.join(__dirname, "logo");

function ensureLogoVerzeichnis() {
  fs.mkdirSync(LOGO_VERZEICHNIS, { recursive: true });
}

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!LOGO_ERLAUBTE_MIMETYPES.includes(file.mimetype)) {
      cb(new Error("UNGUELTIGER_DATEITYP"));
      return;
    }
    cb(null, true);
  },
});

// --- Systemlogs: Dateioperationen ---

const LOGS_VERZEICHNIS = path.join(__dirname, "logs");
const DATEIOPERATIONEN_LOG_DATEI = path.join(LOGS_VERZEICHNIS, "dateioperationen.log");
const STANDARD_LOG_MAX_MB = 50;

async function resolveLogMaxBytes() {
  const wert = await getEinstellung("log_max_dateigroesse_mb", "");
  const mb = Number(wert);
  return (Number.isFinite(mb) && mb > 0 ? mb : STANDARD_LOG_MAX_MB) * 1024 * 1024;
}

function rotiereDateioperationenLogFallsNoetig(maxBytes) {
  try {
    const stat = fs.statSync(DATEIOPERATIONEN_LOG_DATEI);
    if (stat.size >= maxBytes) {
      const suffix = new Date().toISOString().replace(/[:.]/g, "-");
      fs.renameSync(DATEIOPERATIONEN_LOG_DATEI, path.join(LOGS_VERZEICHNIS, `dateioperationen.${suffix}.log`));
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

async function resolveTeilnehmerName(teilnehmerId) {
  if (!teilnehmerId) {
    return "";
  }
  const [rows] = await pool.query("SELECT Vorname, Nachname FROM teilnehmer WHERE ID = ?", [teilnehmerId]);
  return rows[0] ? `${rows[0].Nachname}, ${rows[0].Vorname}` : "";
}

async function logDateioperation(art, { dateiname, teilnehmer, username }) {
  try {
    fs.mkdirSync(LOGS_VERZEICHNIS, { recursive: true });
    const maxBytes = await resolveLogMaxBytes();
    rotiereDateioperationenLogFallsNoetig(maxBytes);
    const zeile = [new Date().toISOString(), art, dateiname || "-", teilnehmer || "-", username || "-"].join(" | ");
    fs.appendFileSync(DATEIOPERATIONEN_LOG_DATEI, `${zeile}\n`, "utf8");
  } catch (err) {
    console.error("Dateioperation konnte nicht protokolliert werden:", err);
  }
}

function leseDateioperationenLog() {
  fs.mkdirSync(LOGS_VERZEICHNIS, { recursive: true });
  const dateien = fs
    .readdirSync(LOGS_VERZEICHNIS)
    .filter((name) => /^dateioperationen(\..+)?\.log$/.test(name))
    .sort()
    .reverse();

  const eintraege = [];
  for (const datei of dateien) {
    const inhalt = fs.readFileSync(path.join(LOGS_VERZEICHNIS, datei), "utf8");
    inhalt
      .split("\n")
      .map((zeile) => zeile.trim())
      .filter(Boolean)
      .forEach((zeile) => {
        const teile = zeile.split(" | ");
        if (teile.length < 5) {
          return;
        }
        const [Zeitstempel, Art, Dateiname, Teilnehmer, Benutzer] = teile;
        eintraege.push({ Zeitstempel, Art, Dateiname, Teilnehmer, Benutzer });
      });
  }

  eintraege.sort((a, b) => (a.Zeitstempel < b.Zeitstempel ? 1 : a.Zeitstempel > b.Zeitstempel ? -1 : 0));
  return eintraege;
}

const ENV_PFAD = path.join(__dirname, ".env");

function quoteEnvWert(wert) {
  return `"${String(wert).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function writeEnvUpdates(updates) {
  let inhalt = "";
  try {
    inhalt = fs.readFileSync(ENV_PFAD, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }

  fs.writeFileSync(`${ENV_PFAD}.bak`, inhalt);

  const zeilen = inhalt.split(/\r?\n/);
  const gesehen = new Set();

  const neueZeilen = zeilen.map((zeile) => {
    const treffer = zeile.match(/^([A-Z_]+)=/);
    if (treffer && Object.prototype.hasOwnProperty.call(updates, treffer[1])) {
      gesehen.add(treffer[1]);
      return `${treffer[1]}=${quoteEnvWert(updates[treffer[1]])}`;
    }
    return zeile;
  });

  for (const [schluessel, wert] of Object.entries(updates)) {
    if (!gesehen.has(schluessel)) {
      neueZeilen.push(`${schluessel}=${quoteEnvWert(wert)}`);
    }
  }

  fs.writeFileSync(ENV_PFAD, neueZeilen.join("\n"));
}

async function testDatenbankVerbindung({ host, port, user, password, database }) {
  const testVerbindung = await mysql.createConnection({
    host,
    port: Number(port),
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 5000,
  });
  await testVerbindung.end();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        cb(null, await resolveUploadVerzeichnis());
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

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
      "SELECT ID, Username, PasswortHash, Vorname, Nachname, Aktiv FROM benutzer WHERE Username = ?",
      [Username]
    );

    const benutzer = rows[0];
    const passwortOk = benutzer && (await bcrypt.compare(Passwort, benutzer.PasswortHash));

    if (!benutzer || !passwortOk) {
      return res.status(401).json({ error: "Benutzername oder Passwort ist ungültig." });
    }

    if (!benutzer.Aktiv) {
      return res.status(401).json({ error: "Dieses Benutzerkonto wurde deaktiviert." });
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
    Aktiv: Boolean(b.Aktiv),
    RolleIDs: rollenRows.filter((r) => r.BenutzerID === b.ID).map((r) => r.ID),
    RolleNamen: rollenRows.filter((r) => r.BenutzerID === b.ID).map((r) => r.Bezeichnung),
    FachbereichIDs: fbRows.filter((f) => f.BenutzerID === b.ID).map((f) => f.ID),
    FachbereichNamen: fbRows.filter((f) => f.BenutzerID === b.ID).map((f) => f.BezeichnungLang),
  }));
}

app.get("/api/benutzer", requireRole("Administrator"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT ID, Username, Vorname, Nachname, Email, Telefon, Aktiv, ErstelltAm FROM benutzer ORDER BY Nachname, Vorname"
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
      "SELECT ID, Username, Vorname, Nachname, Email, Telefon, Aktiv, ErstelltAm FROM benutzer WHERE ID = ?",
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
      "SELECT ID, Username, Vorname, Nachname, Email, Telefon, Aktiv, ErstelltAm FROM benutzer WHERE ID = ?",
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

app.put("/api/benutzer/:id/passwort", requireRole("Administrator"), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  const { NeuesPasswort, NeuesPasswortWiederholung } = req.body;

  if (!NeuesPasswort || !NeuesPasswortWiederholung) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich." });
  }
  if (NeuesPasswort !== NeuesPasswortWiederholung) {
    return res.status(400).json({ error: "Die Passwort-Wiederholung stimmt nicht überein." });
  }
  if (NeuesPasswort.length < 8) {
    return res.status(400).json({ error: "Das neue Passwort muss mindestens 8 Zeichen lang sein." });
  }

  try {
    const hash = await bcrypt.hash(NeuesPasswort, 10);
    const [result] = await pool.query("UPDATE benutzer SET PasswortHash = ? WHERE ID = ?", [hash, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Benutzer wurde nicht gefunden." });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Passwort konnte nicht geändert werden." });
  }
});

app.put("/api/benutzer/:id/aktiv", requireRole("Administrator"), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  const aktiv = Boolean(req.body.Aktiv);

  if (id === req.session.userId && !aktiv) {
    return res.status(400).json({ error: "Der eigene Account kann nicht deaktiviert werden." });
  }

  try {
    const [result] = await pool.query("UPDATE benutzer SET Aktiv = ? WHERE ID = ?", [aktiv, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Benutzer wurde nicht gefunden." });
    }

    res.json({ success: true, Aktiv: aktiv });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Status konnte nicht geändert werden." });
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
    let query = `SELECT g.ID, g.Bezeichnung, g.Kennung, g.FachbereichID, f.BezeichnungLang AS FachbereichBezeichnung,
              (SELECT COUNT(*) FROM massnahme m WHERE m.GruppeID = g.ID) AS MassnahmenAnzahl
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
      if (!hasRole(req, "Fachbereichsleiter")) {
        return res.status(403).json({ error: "Keine Berechtigung zum Löschen von Gruppen." });
      }
      const [countRows] = await pool.query("SELECT COUNT(*) AS anzahl FROM massnahme WHERE GruppeID = ?", [id]);
      if (countRows[0].anzahl > 0) {
        return res
          .status(400)
          .json({ error: "Gruppe hat noch zugeordnete Maßnahmen und kann nicht gelöscht werden." });
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
      return res.status(403).json({ error: "Keine Berechtigung zum Löschen von Maßnahmen." });
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
      return res.status(403).json({ error: "Keine Berechtigung zum Löschen von Teilnehmenden." });
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
      "SELECT ID, TeilnehmerID, Art, Thema, Bearbeiter, Bemerkung, Wiedervorlage, WiedervorlageErledigt, ErstelltAm FROM aktivitaet WHERE TeilnehmerID = ? ORDER BY ErstelltAm DESC",
      [teilnehmerId]
    );
    res.json(rows.map((row) => ({ ...row, WiedervorlageErledigt: Boolean(row.WiedervorlageErledigt) })));
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
      "INSERT INTO aktivitaet (TeilnehmerID, Art, Thema, Bearbeiter, BearbeiterID, Bemerkung, Wiedervorlage) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [teilnehmerId, Art, thema || null, bearbeiter, req.session.userId, Bemerkung || null, Wiedervorlage || null]
    );

    const [rows] = await pool.query(
      "SELECT ID, TeilnehmerID, Art, Thema, Bearbeiter, Bemerkung, Wiedervorlage, WiedervorlageErledigt, ErstelltAm FROM aktivitaet WHERE ID = ?",
      [result.insertId]
    );

    res.status(201).json({ ...rows[0], WiedervorlageErledigt: Boolean(rows[0].WiedervorlageErledigt) });
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

app.get("/api/aktivitaeten/wiedervorlagen", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.ID, a.TeilnehmerID, a.Art, a.Thema, a.Wiedervorlage,
              t.Vorname, t.Nachname, m.VT
         FROM aktivitaet a
         JOIN teilnehmer t ON t.ID = a.TeilnehmerID
         JOIN massnahme m ON m.ID = t.MassnahmeID
        WHERE a.BearbeiterID = ? AND a.WiedervorlageErledigt = 0 AND a.Wiedervorlage IS NOT NULL
        ORDER BY a.Wiedervorlage ASC`,
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Wiedervorlagen konnten nicht geladen werden." });
  }
});

async function resolveAktivitaetFuerScope(id) {
  const [rows] = await pool.query(
    `SELECT a.ID, t.MassnahmeID FROM aktivitaet a JOIN teilnehmer t ON t.ID = a.TeilnehmerID WHERE a.ID = ?`,
    [id]
  );
  return rows[0] || null;
}

app.put("/api/aktivitaeten/:id/erledigt", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  try {
    const aktivitaet = await resolveAktivitaetFuerScope(id);
    if (!aktivitaet) {
      return res.status(404).json({ error: "Aktivität wurde nicht gefunden." });
    }

    if (isRestrictedUser(req)) {
      const fachbereichId = await resolveFachbereichForMassnahme(aktivitaet.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diese Aktivität." });
      }
    }

    await pool.query("UPDATE aktivitaet SET WiedervorlageErledigt = 1 WHERE ID = ?", [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Wiedervorlage konnte nicht als erledigt markiert werden." });
  }
});

app.put("/api/aktivitaeten/:id/wiedervorlage", async (req, res) => {
  const id = Number(req.params.id);
  const { Wiedervorlage } = req.body;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  if (!Wiedervorlage || Number.isNaN(Date.parse(Wiedervorlage))) {
    return res.status(400).json({ error: "Ein gültiges Datum ist erforderlich." });
  }

  try {
    const aktivitaet = await resolveAktivitaetFuerScope(id);
    if (!aktivitaet) {
      return res.status(404).json({ error: "Aktivität wurde nicht gefunden." });
    }

    if (isRestrictedUser(req)) {
      const fachbereichId = await resolveFachbereichForMassnahme(aktivitaet.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für diese Aktivität." });
      }
    }

    await pool.query("UPDATE aktivitaet SET Wiedervorlage = ?, WiedervorlageErledigt = 0 WHERE ID = ?", [
      Wiedervorlage,
      id,
    ]);
    res.json({ Wiedervorlage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Wiedervorlagetermin konnte nicht gespeichert werden." });
  }
});

// --- Leistungskontrollen ---

const LEISTUNGSKONTROLLE_ARTEN = [
  "Klausur",
  "Schriftlicher Test",
  "Präsentation",
  "Projekt",
  "Dokumentation",
  "Lehrstück",
];

async function attachMassnahmenZuLeistungskontrollen(lkRows) {
  if (lkRows.length === 0) {
    return [];
  }
  const ids = lkRows.map((lk) => lk.ID);
  const [massnahmenRows] = await pool.query(
    `SELECT lm.LeistungskontrolleID, m.ID, m.Bezeichnung, m.VT, m.GruppeID, g.FachbereichID, g.Bezeichnung AS GruppeBezeichnung
       FROM leistungskontrolle_massnahme lm
       JOIN massnahme m ON m.ID = lm.MassnahmeID
       LEFT JOIN gruppe g ON g.ID = m.GruppeID
      WHERE lm.LeistungskontrolleID IN (?)`,
    [ids]
  );
  return lkRows.map((lk) => ({
    ...lk,
    Massnahmen: massnahmenRows
      .filter((m) => m.LeistungskontrolleID === lk.ID)
      .map(({ LeistungskontrolleID, ...rest }) => rest),
  }));
}

async function resolveMassnahmenFuerLeistungskontrolle(id) {
  const [lkMitMassnahmen] = await attachMassnahmenZuLeistungskontrollen([{ ID: id }]);
  return lkMitMassnahmen.Massnahmen;
}

function leistungskontrolleInScope(req, massnahmenZuordnungen) {
  if (!isRestrictedUser(req)) {
    return true;
  }
  return massnahmenZuordnungen.some((m) => fachbereichInScope(req, m.FachbereichID));
}

function readLeistungskontrolleBody(body) {
  const { Art, Bezeichnung, Beschreibung, Durchfuehrungsdatum, Gesamtpunkte, Loeschdatum, Lagerort, MassnahmeIDs } = body;

  const bezeichnung = typeof Bezeichnung === "string" ? Bezeichnung.trim() : "";
  const beschreibung = typeof Beschreibung === "string" ? Beschreibung.trim() : "";
  const lagerort = typeof Lagerort === "string" ? Lagerort.trim() : "";
  const massnahmeIds = Array.isArray(MassnahmeIDs) ? [...new Set(MassnahmeIDs.map(Number))] : [];

  if (
    !LEISTUNGSKONTROLLE_ARTEN.includes(Art) ||
    !bezeichnung ||
    !beschreibung ||
    !Durchfuehrungsdatum ||
    Number.isNaN(Date.parse(Durchfuehrungsdatum)) ||
    !lagerort ||
    massnahmeIds.length === 0 ||
    massnahmeIds.some((massnahmeId) => !Number.isInteger(massnahmeId))
  ) {
    return {
      error:
        "Art, Bezeichnung, Beschreibung, Durchführungsdatum, Lagerort und mindestens eine zugewiesene Maßnahme sind erforderlich.",
    };
  }

  const gesamtpunkteWert =
    Gesamtpunkte === "" || Gesamtpunkte === null || Gesamtpunkte === undefined ? null : Number(Gesamtpunkte);
  if (gesamtpunkteWert !== null && (!Number.isFinite(gesamtpunkteWert) || gesamtpunkteWert < 0)) {
    return { error: "Gesamtpunkte müssen eine positive Zahl sein." };
  }

  const loeschdatumWert = Loeschdatum || null;
  if (loeschdatumWert && Number.isNaN(Date.parse(loeschdatumWert))) {
    return { error: "Löschdatum ist ungültig." };
  }

  return {
    values: {
      Art,
      Bezeichnung: bezeichnung,
      Beschreibung: beschreibung,
      Durchfuehrungsdatum,
      Gesamtpunkte: gesamtpunkteWert,
      Loeschdatum: loeschdatumWert,
      Lagerort: lagerort,
      MassnahmeIDs: massnahmeIds,
    },
  };
}

app.get("/api/leistungskontrollen", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ID, Art, Bezeichnung, Beschreibung, Durchfuehrungsdatum, Gesamtpunkte, Loeschdatum, Lagerort, ErstelltAm
         FROM leistungskontrolle ORDER BY Durchfuehrungsdatum DESC, ID DESC`
    );
    const mitMassnahmen = await attachMassnahmenZuLeistungskontrollen(rows);
    const ergebnis = isRestrictedUser(req)
      ? mitMassnahmen.filter((lk) => leistungskontrolleInScope(req, lk.Massnahmen))
      : mitMassnahmen;
    res.json(ergebnis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Leistungskontrollen konnten nicht geladen werden." });
  }
});

app.get("/api/leistungskontrollen/summary", async (req, res) => {
  try {
    let query = `SELECT t.ID AS TeilnehmerID, COUNT(DISTINCT lk.ID) AS Anzahl,
        MAX(CASE WHEN lk.ErstelltAm >= (NOW() - INTERVAL 14 DAY) THEN 1 ELSE 0 END) AS HatAktuelle
       FROM teilnehmer t
       JOIN leistungskontrolle_massnahme lm ON lm.MassnahmeID = t.MassnahmeID
       JOIN leistungskontrolle lk ON lk.ID = lm.LeistungskontrolleID`;
    const params = [];

    if (isRestrictedUser(req)) {
      const ids = req.session.fachbereichIds || [];
      if (ids.length === 0) {
        return res.json([]);
      }
      query += ` JOIN massnahme m ON m.ID = t.MassnahmeID
         JOIN gruppe g ON g.ID = m.GruppeID
         WHERE g.FachbereichID IN (?)`;
      params.push(ids);
    }

    query += " GROUP BY t.ID";

    const [rows] = await pool.query(query, params);
    res.json(rows.map((row) => ({ TeilnehmerID: row.TeilnehmerID, Anzahl: row.Anzahl, HatAktuelle: Boolean(row.HatAktuelle) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Leistungskontrollen-Übersicht konnte nicht geladen werden." });
  }
});

app.get("/api/leistungskontrollen/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  try {
    const [rows] = await pool.query(
      `SELECT ID, Art, Bezeichnung, Beschreibung, Durchfuehrungsdatum, Gesamtpunkte, Loeschdatum, Lagerort, ErstelltAm
         FROM leistungskontrolle WHERE ID = ?`,
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Leistungskontrolle wurde nicht gefunden." });
    }
    const massnahmen = await resolveMassnahmenFuerLeistungskontrolle(id);
    if (isRestrictedUser(req) && !leistungskontrolleInScope(req, massnahmen)) {
      return res.status(403).json({ error: "Keine Berechtigung für diese Leistungskontrolle." });
    }
    res.json({ ...rows[0], Massnahmen: massnahmen });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Leistungskontrolle konnte nicht geladen werden." });
  }
});

app.post("/api/leistungskontrollen", async (req, res) => {
  const { error, values } = readLeistungskontrolleBody(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  if (values.Gesamtpunkte === null) {
    values.Gesamtpunkte = 100;
  }

  try {
    if (isRestrictedUser(req)) {
      for (const massnahmeId of values.MassnahmeIDs) {
        const fachbereichId = await resolveFachbereichForMassnahme(massnahmeId);
        if (!fachbereichInScope(req, fachbereichId)) {
          return res.status(403).json({ error: "Keine Berechtigung für eine der zugewiesenen Maßnahmen." });
        }
      }
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Berechtigung konnte nicht geprüft werden." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO leistungskontrolle (Art, Bezeichnung, Beschreibung, Durchfuehrungsdatum, Gesamtpunkte, Loeschdatum, Lagerort)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        values.Art,
        values.Bezeichnung,
        values.Beschreibung,
        values.Durchfuehrungsdatum,
        values.Gesamtpunkte,
        values.Loeschdatum,
        values.Lagerort,
      ]
    );
    const id = result.insertId;
    for (const massnahmeId of values.MassnahmeIDs) {
      await conn.query("INSERT INTO leistungskontrolle_massnahme (LeistungskontrolleID, MassnahmeID) VALUES (?, ?)", [
        id,
        massnahmeId,
      ]);
    }
    await conn.commit();

    const massnahmen = await resolveMassnahmenFuerLeistungskontrolle(id);
    res.status(201).json({ ID: id, ...values, Massnahmen: massnahmen });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Leistungskontrolle konnte nicht gespeichert werden." });
  } finally {
    conn.release();
  }
});

app.put("/api/leistungskontrollen/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  const { error, values } = readLeistungskontrolleBody(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const [existingRows] = await pool.query("SELECT ID FROM leistungskontrolle WHERE ID = ?", [id]);
    if (!existingRows[0]) {
      return res.status(404).json({ error: "Leistungskontrolle wurde nicht gefunden." });
    }
    if (isRestrictedUser(req)) {
      const bestehendeMassnahmen = await resolveMassnahmenFuerLeistungskontrolle(id);
      if (!leistungskontrolleInScope(req, bestehendeMassnahmen)) {
        return res.status(403).json({ error: "Keine Berechtigung für diese Leistungskontrolle." });
      }
      for (const massnahmeId of values.MassnahmeIDs) {
        const fachbereichId = await resolveFachbereichForMassnahme(massnahmeId);
        if (!fachbereichInScope(req, fachbereichId)) {
          return res.status(403).json({ error: "Keine Berechtigung für eine der zugewiesenen Maßnahmen." });
        }
      }
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Berechtigung konnte nicht geprüft werden." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE leistungskontrolle SET Art = ?, Bezeichnung = ?, Beschreibung = ?, Durchfuehrungsdatum = ?,
              Gesamtpunkte = ?, Loeschdatum = ?, Lagerort = ? WHERE ID = ?`,
      [
        values.Art,
        values.Bezeichnung,
        values.Beschreibung,
        values.Durchfuehrungsdatum,
        values.Gesamtpunkte,
        values.Loeschdatum,
        values.Lagerort,
        id,
      ]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Leistungskontrolle wurde nicht gefunden." });
    }
    await conn.query("DELETE FROM leistungskontrolle_massnahme WHERE LeistungskontrolleID = ?", [id]);
    for (const massnahmeId of values.MassnahmeIDs) {
      await conn.query("INSERT INTO leistungskontrolle_massnahme (LeistungskontrolleID, MassnahmeID) VALUES (?, ?)", [
        id,
        massnahmeId,
      ]);
    }
    await conn.commit();

    const massnahmen = await resolveMassnahmenFuerLeistungskontrolle(id);
    res.json({ ID: id, ...values, Massnahmen: massnahmen });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Leistungskontrolle konnte nicht aktualisiert werden." });
  } finally {
    conn.release();
  }
});

app.delete("/api/leistungskontrollen/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  try {
    const [rows] = await pool.query("SELECT Durchfuehrungsdatum FROM leistungskontrolle WHERE ID = ?", [id]);
    if (!rows[0]) {
      return res.status(404).json({ error: "Leistungskontrolle wurde nicht gefunden." });
    }
    const massnahmen = await resolveMassnahmenFuerLeistungskontrolle(id);
    if (isRestrictedUser(req) && !leistungskontrolleInScope(req, massnahmen)) {
      return res.status(403).json({ error: "Keine Berechtigung für diese Leistungskontrolle." });
    }
    const istAdmin = hasRole(req, "Administrator");
    const heuteOderSpaeter = new Date(rows[0].Durchfuehrungsdatum) >= new Date(new Date().toDateString());
    if (!istAdmin && !heuteOderSpaeter) {
      return res.status(403).json({
        error: "Leistungskontrollen mit vergangenem Durchführungsdatum können nur von Administratoren gelöscht werden.",
      });
    }
    await pool.query("DELETE FROM leistungskontrolle WHERE ID = ?", [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Leistungskontrolle konnte nicht gelöscht werden." });
  }
});

app.get("/api/leistungskontrollen/:id/ergebnisse", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  try {
    const [existingRows] = await pool.query("SELECT ID FROM leistungskontrolle WHERE ID = ?", [id]);
    if (!existingRows[0]) {
      return res.status(404).json({ error: "Leistungskontrolle wurde nicht gefunden." });
    }
    const massnahmen = await resolveMassnahmenFuerLeistungskontrolle(id);
    if (isRestrictedUser(req) && !leistungskontrolleInScope(req, massnahmen)) {
      return res.status(403).json({ error: "Keine Berechtigung für diese Leistungskontrolle." });
    }
    const massnahmeIds = massnahmen.map((m) => m.ID);
    if (massnahmeIds.length === 0) {
      return res.json([]);
    }
    const [rows] = await pool.query(
      `SELECT t.ID AS TeilnehmerID, t.Vorname, t.Nachname, t.MassnahmeID, m.Bezeichnung AS MassnahmeBezeichnung, m.VT,
              lt.Ergebnispunkte, lt.Note, lt.Korrekturdatum, lt.BesprochenAmDatum
         FROM teilnehmer t
         JOIN massnahme m ON m.ID = t.MassnahmeID
         LEFT JOIN leistungskontrolle_teilnehmer lt ON lt.LeistungskontrolleID = ? AND lt.TeilnehmerID = t.ID
        WHERE t.MassnahmeID IN (?)
        ORDER BY t.Nachname, t.Vorname`,
      [id, massnahmeIds]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ergebnisse konnten nicht geladen werden." });
  }
});

app.put("/api/leistungskontrollen/:id/ergebnisse", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  const { Ergebnisse } = req.body;
  if (!Array.isArray(Ergebnisse)) {
    return res.status(400).json({ error: "Ergebnisse sind erforderlich." });
  }

  try {
    const [existingRows] = await pool.query("SELECT ID FROM leistungskontrolle WHERE ID = ?", [id]);
    if (!existingRows[0]) {
      return res.status(404).json({ error: "Leistungskontrolle wurde nicht gefunden." });
    }
    const massnahmen = await resolveMassnahmenFuerLeistungskontrolle(id);
    if (isRestrictedUser(req) && !leistungskontrolleInScope(req, massnahmen)) {
      return res.status(403).json({ error: "Keine Berechtigung für diese Leistungskontrolle." });
    }

    const gueltigeTeilnehmerIds = new Set();
    const massnahmeIds = massnahmen.map((m) => m.ID);
    if (massnahmeIds.length > 0) {
      const [teilnehmerRows] = await pool.query("SELECT ID FROM teilnehmer WHERE MassnahmeID IN (?)", [massnahmeIds]);
      teilnehmerRows.forEach((t) => gueltigeTeilnehmerIds.add(t.ID));
    }

    for (const eintrag of Ergebnisse) {
      const teilnehmerId = Number(eintrag.TeilnehmerID);
      if (!gueltigeTeilnehmerIds.has(teilnehmerId)) {
        continue;
      }
      const ergebnispunkte =
        eintrag.Ergebnispunkte === "" || eintrag.Ergebnispunkte === null || eintrag.Ergebnispunkte === undefined
          ? null
          : Number(eintrag.Ergebnispunkte);
      const noteWert =
        eintrag.Note === "" || eintrag.Note === null || eintrag.Note === undefined ? null : Number(eintrag.Note);
      if (noteWert !== null && (!Number.isFinite(noteWert) || noteWert < 1 || noteWert > 6)) {
        return res.status(400).json({ error: "Note muss zwischen 1,0 und 6,0 liegen." });
      }
      const note = noteWert === null ? null : String(noteWert);
      const korrekturdatum = eintrag.Korrekturdatum || null;
      const besprochenAmDatum = eintrag.BesprochenAmDatum || null;

      await pool.query(
        `INSERT INTO leistungskontrolle_teilnehmer (LeistungskontrolleID, TeilnehmerID, Ergebnispunkte, Note, Korrekturdatum, BesprochenAmDatum)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE Ergebnispunkte = VALUES(Ergebnispunkte), Note = VALUES(Note),
           Korrekturdatum = VALUES(Korrekturdatum), BesprochenAmDatum = VALUES(BesprochenAmDatum)`,
        [id, teilnehmerId, ergebnispunkte, note, korrekturdatum, besprochenAmDatum]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ergebnisse konnten nicht gespeichert werden." });
  }
});

app.get("/api/teilnehmer/:id/leistungskontrollen", async (req, res) => {
  const teilnehmerId = Number(req.params.id);
  if (!Number.isInteger(teilnehmerId)) {
    return res.status(400).json({ error: "Ungültige ID." });
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
      `SELECT lk.ID, lk.Art, lk.Bezeichnung, lk.Durchfuehrungsdatum, lk.Gesamtpunkte,
              lt.Ergebnispunkte, lt.Note, lt.Korrekturdatum, lt.BesprochenAmDatum
         FROM leistungskontrolle_massnahme lm
         JOIN leistungskontrolle lk ON lk.ID = lm.LeistungskontrolleID
         LEFT JOIN leistungskontrolle_teilnehmer lt ON lt.LeistungskontrolleID = lk.ID AND lt.TeilnehmerID = ?
        WHERE lm.MassnahmeID = ?
        ORDER BY lk.Durchfuehrungsdatum ASC, lk.ID ASC`,
      [teilnehmerId, teilnehmer.MassnahmeID]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Notenverlauf konnte nicht geladen werden." });
  }
});

app.get("/api/teilnehmer/:id/anwesenheiten", async (req, res) => {
  const teilnehmerId = Number(req.params.id);
  if (!Number.isInteger(teilnehmerId)) {
    return res.status(400).json({ error: "Ungültige ID." });
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
      `SELECT a.Datum, s.Kurzzeichen
         FROM anwesenheit a
         JOIN anwesenheitsstatus s ON s.ID = a.StatusID
        WHERE a.TeilnehmerID = ?
        ORDER BY a.Datum ASC`,
      [teilnehmerId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Anwesenheiten konnten nicht geladen werden." });
  }
});

// --- Dokumente ---

const DOKUMENT_ARTEN = [
  "Eigennachweis Fehlzeit",
  "Arbeitsunfähigkeit",
  "Praktikumsvertrag",
  "Anwesenheitsnachweis Praktikum",
];

async function resolveDokumentFuerScope(id) {
  const [rows] = await pool.query(
    `SELECT d.*, t.MassnahmeID FROM dokument d JOIN teilnehmer t ON t.ID = d.TeilnehmerID WHERE d.ID = ?`,
    [id]
  );
  return rows[0] || null;
}

app.get("/api/dokumente", async (req, res) => {
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
      `SELECT ID, TeilnehmerID, Titel, Schlagworte, Dokumentart, Vertraulich, Loeschdatum,
              Dateiname, Dateigroesse, MimeType, HochgeladenAm
         FROM dokument WHERE TeilnehmerID = ? ORDER BY HochgeladenAm DESC`,
      [teilnehmerId]
    );
    res.json(rows.map((r) => ({ ...r, Vertraulich: Boolean(r.Vertraulich) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dokumente konnten nicht geladen werden." });
  }
});

app.get("/api/dokumente/summary", async (req, res) => {
  try {
    let query = `SELECT d.TeilnehmerID, COUNT(*) AS Anzahl,
        MAX(CASE WHEN d.HochgeladenAm >= (NOW() - INTERVAL 14 DAY) THEN 1 ELSE 0 END) AS HatAktuelle
       FROM dokument d`;
    const params = [];

    if (isRestrictedUser(req)) {
      const ids = req.session.fachbereichIds || [];
      if (ids.length === 0) {
        return res.json([]);
      }
      query += ` JOIN teilnehmer t ON t.ID = d.TeilnehmerID
         JOIN massnahme m ON m.ID = t.MassnahmeID
         JOIN gruppe g ON g.ID = m.GruppeID
         WHERE g.FachbereichID IN (?)`;
      params.push(ids);
    }

    query += " GROUP BY d.TeilnehmerID";

    const [rows] = await pool.query(query, params);
    res.json(rows.map((row) => ({ TeilnehmerID: row.TeilnehmerID, Anzahl: row.Anzahl, HatAktuelle: Boolean(row.HatAktuelle) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dokumente-Übersicht konnte nicht geladen werden." });
  }
});

app.post("/api/dokumente", upload.single("Datei"), async (req, res) => {
  const { TeilnehmerID, Titel, Schlagworte, Dokumentart, Vertraulich, Loeschdatum } = req.body;
  const teilnehmerId = Number(TeilnehmerID);
  const titel = typeof Titel === "string" ? Titel.trim() : "";

  const cleanupUploadedFile = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  if (!req.file) {
    return res.status(400).json({ error: "Eine Datei ist erforderlich." });
  }
  if (
    !Number.isInteger(teilnehmerId) ||
    !titel ||
    !DOKUMENT_ARTEN.includes(Dokumentart) ||
    !Loeschdatum ||
    Number.isNaN(Date.parse(Loeschdatum))
  ) {
    cleanupUploadedFile();
    return res.status(400).json({ error: "Teilnehmer, Titel, Dokumentart und Löschdatum sind erforderlich." });
  }

  try {
    const [teilnehmerRows] = await pool.query("SELECT MassnahmeID FROM teilnehmer WHERE ID = ?", [teilnehmerId]);
    const teilnehmer = teilnehmerRows[0];
    if (!teilnehmer) {
      cleanupUploadedFile();
      return res.status(404).json({ error: "Teilnehmer wurde nicht gefunden." });
    }
    if (isRestrictedUser(req)) {
      const fachbereichId = await resolveFachbereichForMassnahme(teilnehmer.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        cleanupUploadedFile();
        return res.status(403).json({ error: "Keine Berechtigung für diesen Teilnehmer." });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO dokument (TeilnehmerID, Titel, Schlagworte, Dokumentart, Vertraulich, Loeschdatum,
                              Dateiname, GespeicherterDateiname, Dateigroesse, MimeType)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teilnehmerId,
        titel,
        (Schlagworte || "").trim() || null,
        Dokumentart,
        Boolean(Vertraulich) ? 1 : 0,
        Loeschdatum,
        req.file.originalname,
        req.file.filename,
        req.file.size,
        req.file.mimetype,
      ]
    );

    const [rows] = await pool.query(
      `SELECT ID, TeilnehmerID, Titel, Schlagworte, Dokumentart, Vertraulich, Loeschdatum,
              Dateiname, Dateigroesse, MimeType, HochgeladenAm FROM dokument WHERE ID = ?`,
      [result.insertId]
    );
    await logDateioperation("Upload", {
      dateiname: req.file.originalname,
      teilnehmer: await resolveTeilnehmerName(teilnehmerId),
      username: req.session.username,
    });
    res.status(201).json({ ...rows[0], Vertraulich: Boolean(rows[0].Vertraulich) });
  } catch (err) {
    cleanupUploadedFile();
    console.error(err);
    res.status(500).json({ error: "Dokument konnte nicht gespeichert werden." });
  }
});

app.put("/api/dokumente/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  const { Titel, Schlagworte, Dokumentart, Vertraulich, Loeschdatum } = req.body;
  const titel = typeof Titel === "string" ? Titel.trim() : "";
  if (!titel || !DOKUMENT_ARTEN.includes(Dokumentart) || !Loeschdatum || Number.isNaN(Date.parse(Loeschdatum))) {
    return res.status(400).json({ error: "Titel, Dokumentart und Löschdatum sind erforderlich." });
  }
  try {
    const dokument = await resolveDokumentFuerScope(id);
    if (!dokument) {
      return res.status(404).json({ error: "Dokument wurde nicht gefunden." });
    }
    if (isRestrictedUser(req)) {
      const fachbereichId = await resolveFachbereichForMassnahme(dokument.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für dieses Dokument." });
      }
    }
    const schlagworte = (Schlagworte || "").trim() || null;
    await pool.query(
      "UPDATE dokument SET Titel = ?, Schlagworte = ?, Dokumentart = ?, Vertraulich = ?, Loeschdatum = ? WHERE ID = ?",
      [titel, schlagworte, Dokumentart, Boolean(Vertraulich) ? 1 : 0, Loeschdatum, id]
    );
    await logDateioperation("Änderung", {
      dateiname: dokument.Dateiname,
      teilnehmer: await resolveTeilnehmerName(dokument.TeilnehmerID),
      username: req.session.username,
    });
    res.json({ ID: id, Titel: titel, Schlagworte: schlagworte, Dokumentart, Vertraulich: Boolean(Vertraulich), Loeschdatum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dokument konnte nicht aktualisiert werden." });
  }
});

app.delete("/api/dokumente/:id", requireRole("Administrator"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  try {
    const [rows] = await pool.query(
      "SELECT GespeicherterDateiname, Dateiname, TeilnehmerID FROM dokument WHERE ID = ?",
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Dokument wurde nicht gefunden." });
    }
    const verzeichnis = await resolveUploadVerzeichnis();
    await pool.query("DELETE FROM dokument WHERE ID = ?", [id]);
    fs.unlink(path.join(verzeichnis, rows[0].GespeicherterDateiname), (err) => {
      if (err && err.code !== "ENOENT") {
        console.error("Datei konnte nicht gelöscht werden:", err);
      }
    });
    await logDateioperation("Löschung", {
      dateiname: rows[0].Dateiname,
      teilnehmer: await resolveTeilnehmerName(rows[0].TeilnehmerID),
      username: req.session.username,
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dokument konnte nicht gelöscht werden." });
  }
});

app.get("/api/dokumente/:id/datei", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  try {
    const dokument = await resolveDokumentFuerScope(id);
    if (!dokument) {
      return res.status(404).json({ error: "Dokument wurde nicht gefunden." });
    }
    if (isRestrictedUser(req)) {
      const fachbereichId = await resolveFachbereichForMassnahme(dokument.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für dieses Dokument." });
      }
    }
    const verzeichnis = await resolveUploadVerzeichnis();
    res.download(path.join(verzeichnis, dokument.GespeicherterDateiname), dokument.Dateiname, async (err) => {
      if (err) {
        console.error(err);
        if (!res.headersSent) {
          res.status(404).json({ error: "Datei nicht gefunden." });
        }
        return;
      }
      await logDateioperation("Download", {
        dateiname: dokument.Dateiname,
        teilnehmer: await resolveTeilnehmerName(dokument.TeilnehmerID),
        username: req.session.username,
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Datei konnte nicht heruntergeladen werden." });
  }
});

app.get("/api/dokumente/:id/vorschau", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  try {
    const dokument = await resolveDokumentFuerScope(id);
    if (!dokument) {
      return res.status(404).json({ error: "Dokument wurde nicht gefunden." });
    }
    if (isRestrictedUser(req)) {
      const fachbereichId = await resolveFachbereichForMassnahme(dokument.MassnahmeID);
      if (!fachbereichInScope(req, fachbereichId)) {
        return res.status(403).json({ error: "Keine Berechtigung für dieses Dokument." });
      }
    }
    const verzeichnis = await resolveUploadVerzeichnis();
    res.sendFile(path.join(verzeichnis, dokument.GespeicherterDateiname), (err) => {
      if (err) {
        console.error(err);
        if (!res.headersSent) {
          res.status(404).json({ error: "Datei nicht gefunden." });
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Datei konnte nicht angezeigt werden." });
  }
});

// --- Einstellungen ---

app.get("/api/einstellungen/loeschfrist-offset", async (req, res) => {
  try {
    const wert = await getEinstellung("loeschfrist_offset_jahre", "3");
    res.json({ loeschfristOffsetJahre: Number(wert) || 3 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Einstellung konnte nicht geladen werden." });
  }
});

app.get("/api/einstellungen", requireRole("Administrator"), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT Schluessel, Wert FROM einstellung");
    const map = {};
    rows.forEach((r) => {
      map[r.Schluessel] = r.Wert;
    });
    res.json(map);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Einstellungen konnten nicht geladen werden." });
  }
});

app.put("/api/einstellungen", requireRole("Administrator"), async (req, res) => {
  const { dokumentenpfad, loeschfrist_offset_jahre: loeschfristOffsetJahre } = req.body;
  const offset = Number(loeschfristOffsetJahre);
  if (!Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ error: "Löschfrist-Offset muss eine positive ganze Zahl sein." });
  }
  const pfad = (dokumentenpfad || "").trim();
  if (pfad) {
    try {
      fs.mkdirSync(pfad, { recursive: true });
      fs.accessSync(pfad, fs.constants.W_OK);
    } catch (err) {
      return res.status(400).json({ error: `Dokumentenpfad ist nicht beschreibbar: ${err.message}` });
    }
  }
  try {
    await pool.query(
      "INSERT INTO einstellung (Schluessel, Wert) VALUES ('dokumentenpfad', ?) ON DUPLICATE KEY UPDATE Wert = VALUES(Wert)",
      [pfad]
    );
    await pool.query(
      "INSERT INTO einstellung (Schluessel, Wert) VALUES ('loeschfrist_offset_jahre', ?) ON DUPLICATE KEY UPDATE Wert = VALUES(Wert)",
      [String(offset)]
    );
    res.json({ dokumentenpfad: pfad, loeschfrist_offset_jahre: offset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Einstellungen konnten nicht gespeichert werden." });
  }
});

app.get("/api/einstellungen/logging", requireRole("Administrator"), async (req, res) => {
  try {
    const wert = await getEinstellung("log_max_dateigroesse_mb", "");
    res.json({ log_max_dateigroesse_mb: wert ? Number(wert) : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Einstellung konnte nicht geladen werden." });
  }
});

app.put("/api/einstellungen/logging", requireRole("Administrator"), async (req, res) => {
  const { log_max_dateigroesse_mb: maxMb } = req.body;
  const trimmed = maxMb === "" || maxMb === null || maxMb === undefined ? "" : String(maxMb).trim();
  if (trimmed) {
    const zahl = Number(trimmed);
    if (!Number.isFinite(zahl) || zahl < 1) {
      return res.status(400).json({ error: "Die maximale Logdateigröße muss eine positive Zahl (MB) sein." });
    }
  }
  try {
    await pool.query(
      "INSERT INTO einstellung (Schluessel, Wert) VALUES ('log_max_dateigroesse_mb', ?) ON DUPLICATE KEY UPDATE Wert = VALUES(Wert)",
      [trimmed]
    );
    res.json({ log_max_dateigroesse_mb: trimmed ? Number(trimmed) : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Einstellung konnte nicht gespeichert werden." });
  }
});

app.get("/api/einstellungen/bildungsstaette", async (req, res) => {
  try {
    const werte = {};
    for (const schluessel of BILDUNGSSTAETTE_SCHLUESSEL) {
      werte[schluessel] = await getEinstellung(schluessel, "");
    }
    res.json(werte);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Einstellungen konnten nicht geladen werden." });
  }
});

app.put("/api/einstellungen/bildungsstaette", requireRole("Administrator"), async (req, res) => {
  const bundesland = (req.body.bildungsstaette_bundesland || "").trim();
  const geschaeftsbereich = (req.body.bildungsstaette_geschaeftsbereich || "").trim();

  if (bundesland && !BUNDESLAENDER.includes(bundesland)) {
    return res.status(400).json({ error: "Ungültiges Bundesland." });
  }
  if (geschaeftsbereich && !GESCHAEFTSBEREICHE.includes(geschaeftsbereich)) {
    return res.status(400).json({ error: "Ungültiger Geschäftsbereich." });
  }

  const werte = {
    bildungsstaette_name: (req.body.bildungsstaette_name || "").trim(),
    bildungsstaette_strasse: (req.body.bildungsstaette_strasse || "").trim(),
    bildungsstaette_hausnummer: (req.body.bildungsstaette_hausnummer || "").trim(),
    bildungsstaette_plz: (req.body.bildungsstaette_plz || "").trim(),
    bildungsstaette_ort: (req.body.bildungsstaette_ort || "").trim(),
    bildungsstaette_bundesland: bundesland,
    bildungsstaette_email: (req.body.bildungsstaette_email || "").trim(),
    bildungsstaette_telefon: (req.body.bildungsstaette_telefon || "").trim(),
    bildungsstaette_geschaeftsbereich: geschaeftsbereich,
  };

  try {
    for (const [schluessel, wert] of Object.entries(werte)) {
      await pool.query(
        "INSERT INTO einstellung (Schluessel, Wert) VALUES (?, ?) ON DUPLICATE KEY UPDATE Wert = VALUES(Wert)",
        [schluessel, wert]
      );
    }
    res.json(werte);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Einstellungen konnten nicht gespeichert werden." });
  }
});

app.get("/api/einstellungen/unternehmen", async (req, res) => {
  try {
    const werte = {};
    for (const schluessel of UNTERNEHMEN_TEXT_SCHLUESSEL) {
      werte[schluessel] = await getEinstellung(schluessel, "");
    }
    werte.unternehmen_logo_dateiname = await getEinstellung("unternehmen_logo_dateiname", "");
    res.json(werte);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Einstellungen konnten nicht geladen werden." });
  }
});

app.put("/api/einstellungen/unternehmen", requireRole("Administrator"), async (req, res) => {
  const werte = {
    unternehmen_name: (req.body.unternehmen_name || "").trim(),
    unternehmen_bezeichnung: (req.body.unternehmen_bezeichnung || "").trim(),
  };

  try {
    for (const [schluessel, wert] of Object.entries(werte)) {
      await pool.query(
        "INSERT INTO einstellung (Schluessel, Wert) VALUES (?, ?) ON DUPLICATE KEY UPDATE Wert = VALUES(Wert)",
        [schluessel, wert]
      );
    }
    res.json(werte);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Einstellungen konnten nicht gespeichert werden." });
  }
});

app.get("/api/einstellungen/unternehmen/logo", async (req, res) => {
  try {
    const dateiname = await getEinstellung("unternehmen_logo_dateiname", "");
    if (!dateiname) {
      return res.status(404).json({ error: "Kein Logo hinterlegt." });
    }
    res.sendFile(path.join(LOGO_VERZEICHNIS, dateiname), (err) => {
      if (err) {
        console.error(err);
        if (!res.headersSent) {
          res.status(404).json({ error: "Logo nicht gefunden." });
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Logo konnte nicht geladen werden." });
  }
});

app.post("/api/einstellungen/unternehmen/logo", requireRole("Administrator"), (req, res) => {
  logoUpload.single("Logo")(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr instanceof multer.MulterError && uploadErr.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Logo ist zu groß (max. 5 MB)." });
      }
      return res.status(400).json({ error: "Nur PNG-, JPEG-, GIF- oder WEBP-Bilder sind als Logo erlaubt." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Eine Bilddatei ist erforderlich." });
    }
    try {
      ensureLogoVerzeichnis();
      const bisherigerDateiname = await getEinstellung("unternehmen_logo_dateiname", "");
      if (bisherigerDateiname) {
        fs.unlink(path.join(LOGO_VERZEICHNIS, bisherigerDateiname), () => {});
      }
      const dateiname = `logo${path.extname(req.file.originalname).toLowerCase() || ".png"}`;
      fs.writeFileSync(path.join(LOGO_VERZEICHNIS, dateiname), req.file.buffer);
      await pool.query(
        "INSERT INTO einstellung (Schluessel, Wert) VALUES ('unternehmen_logo_dateiname', ?) ON DUPLICATE KEY UPDATE Wert = VALUES(Wert)",
        [dateiname]
      );
      res.json({ unternehmen_logo_dateiname: dateiname });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Logo konnte nicht gespeichert werden." });
    }
  });
});

app.delete("/api/einstellungen/unternehmen/logo", requireRole("Administrator"), async (req, res) => {
  try {
    const dateiname = await getEinstellung("unternehmen_logo_dateiname", "");
    if (dateiname) {
      fs.unlink(path.join(LOGO_VERZEICHNIS, dateiname), (err) => {
        if (err && err.code !== "ENOENT") {
          console.error("Logo konnte nicht gelöscht werden:", err);
        }
      });
    }
    await pool.query(
      "INSERT INTO einstellung (Schluessel, Wert) VALUES ('unternehmen_logo_dateiname', '') ON DUPLICATE KEY UPDATE Wert = VALUES(Wert)"
    );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Logo konnte nicht entfernt werden." });
  }
});

app.get("/api/systemlogs/dateioperationen", requireRole("Administrator"), (req, res) => {
  try {
    res.json(leseDateioperationenLog());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Logs konnten nicht geladen werden." });
  }
});

app.get("/api/einstellungen/datenbank", requireRole("Administrator"), (req, res) => {
  res.json({
    host: process.env.DB_HOST || "",
    port: process.env.DB_PORT || "",
    name: process.env.DB_NAME || "",
    user: process.env.DB_USER || "",
  });
});

app.put("/api/einstellungen/datenbank", requireRole("Administrator"), async (req, res) => {
  const { host, port, name, user } = req.body;
  const trimmedHost = (host || "").trim();
  const trimmedName = (name || "").trim();
  const trimmedUser = (user || "").trim();
  const portNumber = Number(port);

  if (!trimmedHost || !trimmedName || !trimmedUser || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    return res.status(400).json({ error: "Host, Port, Datenbankname und Datenbankuser sind erforderlich." });
  }

  try {
    await testDatenbankVerbindung({
      host: trimmedHost,
      port: portNumber,
      user: trimmedUser,
      password: process.env.DB_PASSWORD || "",
      database: trimmedName,
    });
  } catch (err) {
    return res.status(400).json({ error: `Verbindung mit diesen Zugangsdaten fehlgeschlagen: ${err.message}` });
  }

  try {
    writeEnvUpdates({
      DB_HOST: trimmedHost,
      DB_PORT: String(portNumber),
      DB_NAME: trimmedName,
      DB_USER: trimmedUser,
    });
    res.json({
      success: true,
      message: "Gespeichert. Bitte den Server neu starten, damit die neuen Zugangsdaten wirksam werden.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Zugangsdaten konnten nicht gespeichert werden." });
  }
});

app.put("/api/einstellungen/datenbank/passwort", requireRole("Administrator"), async (req, res) => {
  const { passwort } = req.body;
  if (!passwort) {
    return res.status(400).json({ error: "Ein neues Passwort ist erforderlich." });
  }

  try {
    await testDatenbankVerbindung({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: passwort,
      database: process.env.DB_NAME,
    });
  } catch (err) {
    return res.status(400).json({ error: `Verbindung mit diesem Passwort fehlgeschlagen: ${err.message}` });
  }

  try {
    writeEnvUpdates({ DB_PASSWORD: passwort });
    res.json({
      success: true,
      message: "Gespeichert. Bitte den Server neu starten, damit das neue Passwort wirksam wird.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Passwort konnte nicht gespeichert werden." });
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

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE" ? "Datei ist zu groß (max. 20 MB)." : "Datei-Upload fehlgeschlagen.",
    });
  }
  next(err);
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
