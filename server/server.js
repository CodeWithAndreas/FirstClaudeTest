require("dotenv").config();
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
app.use(express.json());
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

app.get("/api/fachbereiche", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT ID, BezeichnungLang, BezeichnungKurz, Kennung FROM fachbereich ORDER BY BezeichnungLang"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fachbereiche konnten nicht geladen werden." });
  }
});

app.post("/api/fachbereiche", async (req, res) => {
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

app.put("/api/fachbereiche/:id", async (req, res) => {
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

app.delete("/api/fachbereiche/:id", async (req, res) => {
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

app.get("/api/gruppen", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.ID, g.Bezeichnung, g.Kennung, g.FachbereichID, f.BezeichnungLang AS FachbereichBezeichnung
       FROM gruppe g
       LEFT JOIN fachbereich f ON f.ID = g.FachbereichID
       ORDER BY g.Bezeichnung`
    );
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

app.get("/api/massnahmen", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.ID, m.Bezeichnung, m.VT, m.GruppeID, g.Bezeichnung AS GruppeBezeichnung,
              m.ZertDatum, m.PlanStart, m.PlanEnde
       FROM massnahme m
       LEFT JOIN gruppe g ON g.ID = m.GruppeID
       ORDER BY m.Bezeichnung`
    );
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

app.get("/api/teilnehmer", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.ID, t.Vorname, t.Nachname, t.Geburtsdatum, t.MassnahmeID, m.Bezeichnung AS MassnahmeBezeichnung,
              t.Startdatum, t.Endedatum, t.Email, t.Telefon
       FROM teilnehmer t
       LEFT JOIN massnahme m ON m.ID = t.MassnahmeID
       ORDER BY t.Nachname, t.Vorname`
    );
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Standortmanager Server läuft auf http://localhost:${port}`);
});
