-- Create satellites table
CREATE TABLE IF NOT EXISTS satellites (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    norad_id INTEGER UNIQUE,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create TLE history table
CREATE TABLE IF NOT EXISTS tle_history (
    id SERIAL PRIMARY KEY,
    satellite_id INTEGER NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
    line1 TEXT NOT NULL,
    line2 TEXT NOT NULL,
    epoch TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    source TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(satellite_id, epoch)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tle_satellite_epoch 
    ON tle_history(satellite_id, epoch DESC);

CREATE INDEX IF NOT EXISTS idx_tle_created_at 
    ON tle_history(created_at DESC);

-- Insert Turkish satellites with NORAD IDs
INSERT INTO satellites (name, norad_id, description) VALUES 
    ('GKT1', 42982, 'Göktürk-1 - Turkish reconnaissance satellite'),
    ('GKT2', 43758, 'Göktürk-2 - Turkish reconnaissance satellite'),
    ('TURKSAT5A', 47926, 'Türksat 5A - Turkish communication satellite'),
    ('TURKSAT5B', 49361, 'Türksat 5B - Turkish communication satellite'),
    ('IMECE', 60526, 'IMECE - Turkish Earth observation satellite')
ON CONFLICT (name) DO NOTHING;

-- Add some comments
COMMENT ON TABLE satellites IS 'Active satellites being tracked';
COMMENT ON TABLE tle_history IS 'Historical TLE (Two-Line Element) data for satellites';
COMMENT ON COLUMN tle_history.epoch IS 'TLE epoch time (when the TLE was valid)';
COMMENT ON COLUMN tle_history.source IS 'Source of TLE data (celestrak, spacetrack, manual)';