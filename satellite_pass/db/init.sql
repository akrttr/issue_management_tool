CREATE TABLE IF NOT EXISTS satellites (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tle_history (
    id SERIAL PRIMARY KEY,
    satellite_id INTEGER NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
    line1 TEXT NOT NULL,
    line2 TEXT NOT NULL,
    epoch TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Insert Göktürk-1 placeholder (update TLEs manually via SQL/API)
INSERT INTO satellites (name) VALUES ('GKT1')
ON CONFLICT (name) DO NOTHING;
