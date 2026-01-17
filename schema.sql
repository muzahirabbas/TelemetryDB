DROP TABLE IF EXISTS visits;
CREATE TABLE visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,           -- The Session ID
  ip TEXT,
  user_agent TEXT,
  city TEXT,
  country TEXT,
  precise_lat REAL,    -- From GPS Vector
  precise_lon REAL,    -- From GPS Vector
  timing_data TEXT,    -- From Timing Vector (JSON)
  image_data TEXT,
  timestamp TEXT
);