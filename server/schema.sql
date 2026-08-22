-- Grundschema für die Datenbank db_fct.
-- Einspielen auf einem neuen/leeren Server, z. B.:
--   mysql -h 127.0.0.1 -u root -p db_fct < schema.sql
-- Die Tabellen benutzer, rolle, benutzer_rolle und benutzer_fachbereich
-- werden NICHT hier angelegt - die legt server.js beim ersten Start
-- automatisch selbst an (inkl. Rollen-Seed und Admin-Konto).

CREATE TABLE IF NOT EXISTS fachbereich (
  ID INT NOT NULL AUTO_INCREMENT,
  BezeichnungLang VARCHAR(255) NOT NULL,
  BezeichnungKurz VARCHAR(15) NOT NULL,
  Kennung VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS gruppe (
  ID INT NOT NULL AUTO_INCREMENT,
  Bezeichnung VARCHAR(45) NOT NULL,
  Kennung VARCHAR(45) DEFAULT NULL,
  FachbereichID INT DEFAULT NULL,
  PRIMARY KEY (ID),
  KEY fk_Gruppe_Fachbereich1_idx (FachbereichID),
  CONSTRAINT fk_Gruppe_Fachbereich1 FOREIGN KEY (FachbereichID) REFERENCES fachbereich (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS massnahme (
  ID INT NOT NULL AUTO_INCREMENT,
  Bezeichnung VARCHAR(255) NOT NULL,
  VT VARCHAR(45) NOT NULL,
  GruppeID INT DEFAULT NULL,
  ZertDatum DATE NOT NULL,
  PlanStart DATE NOT NULL,
  PlanEnde DATE NOT NULL,
  PRIMARY KEY (ID),
  KEY fk_Massnahme_Gruppe1_idx (GruppeID),
  CONSTRAINT fk_Massnahme_Gruppe1 FOREIGN KEY (GruppeID) REFERENCES gruppe (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS teilnehmer (
  ID INT NOT NULL AUTO_INCREMENT,
  Vorname VARCHAR(100) NOT NULL,
  Nachname VARCHAR(100) NOT NULL,
  Geburtsdatum DATE NOT NULL,
  MassnahmeID INT NOT NULL,
  Startdatum DATE NOT NULL,
  Endedatum DATE NOT NULL,
  Email VARCHAR(100) DEFAULT NULL,
  Telefon VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (ID),
  KEY fk_Teilnehmer_Massnahme_idx (MassnahmeID),
  CONSTRAINT fk_Teilnehmer_Massnahme FOREIGN KEY (MassnahmeID) REFERENCES massnahme (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS anwesenheitsstatus (
  ID INT NOT NULL AUTO_INCREMENT,
  Bezeichnung VARCHAR(100) NOT NULL,
  Kurzzeichen VARCHAR(2) NOT NULL,
  PRIMARY KEY (ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS anwesenheit (
  ID INT NOT NULL AUTO_INCREMENT,
  TeilnehmerID INT NOT NULL,
  Datum DATE NOT NULL,
  StatusID INT NOT NULL,
  PRIMARY KEY (ID),
  UNIQUE KEY uq_anwesenheit_teilnehmer_datum (TeilnehmerID, Datum),
  KEY idx_anwesenheit_status (StatusID),
  CONSTRAINT fk_anwesenheit_status FOREIGN KEY (StatusID) REFERENCES anwesenheitsstatus (ID),
  CONSTRAINT fk_anwesenheit_teilnehmer FOREIGN KEY (TeilnehmerID) REFERENCES teilnehmer (ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

INSERT IGNORE INTO anwesenheitsstatus (ID, Bezeichnung, Kurzzeichen) VALUES
  (1, 'Anwesend', 'A'),
  (2, 'Fehlt unentschuldigt', 'UA'),
  (3, 'Fehlt entschuldigt', 'E'),
  (4, 'Krank mit AU', 'K'),
  (5, 'Urlaub', 'U'),
  (6, 'Praktikum', 'PR');

CREATE TABLE IF NOT EXISTS aktivitaet (
  ID INT NOT NULL AUTO_INCREMENT,
  TeilnehmerID INT NOT NULL,
  Art VARCHAR(50) NOT NULL,
  Thema VARCHAR(60) DEFAULT NULL,
  Bearbeiter VARCHAR(200) DEFAULT NULL,
  Bemerkung TEXT,
  Wiedervorlage DATE DEFAULT NULL,
  ErstelltAm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ID),
  KEY fk_Aktivitaet_Teilnehmer_idx (TeilnehmerID),
  CONSTRAINT fk_Aktivitaet_Teilnehmer FOREIGN KEY (TeilnehmerID) REFERENCES teilnehmer (ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
