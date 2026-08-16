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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Standortmanager Server läuft auf http://localhost:${port}`);
});
