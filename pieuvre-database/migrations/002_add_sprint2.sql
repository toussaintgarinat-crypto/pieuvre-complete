-- ====================================================================
-- MIGRATION 002 - Sprint 2 : Modes de production et étiquetage
-- À exécuter sur une base de données existante
-- ====================================================================

-- Ajout des colonnes mode_production, mode_etiquetage et regroupement sur calculs
ALTER TABLE calculs
    ADD COLUMN IF NOT EXISTS mode_production VARCHAR(20) DEFAULT 'direct'
        CHECK (mode_production IN ('direct', 'derivation')),
    ADD COLUMN IF NOT EXISTS mode_etiquetage VARCHAR(20) DEFAULT 'atelier'
        CHECK (mode_etiquetage IN ('atelier', 'machine')),
    ADD COLUMN IF NOT EXISTS regroupement JSONB DEFAULT '{"ordre":["logement","boite"],"grouper_par":[]}'::jsonb;

-- Ajout de la colonne mode_production sur chantiers si absente
ALTER TABLE chantiers
    ADD COLUMN IF NOT EXISTS mode_production VARCHAR(20) DEFAULT 'direct'
        CHECK (mode_production IN ('direct', 'derivation'));

-- Ajout de la colonne longueur_derivation_m sur chantiers si absente
ALTER TABLE chantiers
    ADD COLUMN IF NOT EXISTS longueur_derivation_m DECIMAL(5,2) DEFAULT 2.50;

-- ====================================================================
-- TABLE: IMPRESSION_SESSIONS
-- ====================================================================
CREATE TABLE IF NOT EXISTS impression_sessions (
    id SERIAL PRIMARY KEY,
    id_calcul INTEGER NOT NULL REFERENCES calculs(id) ON DELETE CASCADE,
    utilisateur VARCHAR(100) NOT NULL,
    filtre_type VARCHAR(20) DEFAULT 'chantier' CHECK (filtre_type IN ('chantier', 'logement', 'boite')),
    filtre_valeur VARCHAR(100),
    mode_etiquetage VARCHAR(20) DEFAULT 'atelier' CHECK (mode_etiquetage IN ('atelier', 'machine')),
    regroupement JSONB DEFAULT '{"ordre":["logement","boite"]}'::jsonb,
    etiquettes_totales INTEGER NOT NULL DEFAULT 0,
    etiquettes_imprimees INTEGER NOT NULL DEFAULT 0,
    derniere_etiquette VARCHAR(50),
    statut VARCHAR(20) DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'termine', 'annule', 'pause')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impression_sessions_calcul ON impression_sessions(id_calcul);
CREATE INDEX IF NOT EXISTS idx_impression_sessions_statut ON impression_sessions(statut);

-- ====================================================================
-- TABLE: IMPRESSION_HISTORIQUE
-- ====================================================================
CREATE TABLE IF NOT EXISTS impression_historique (
    id SERIAL PRIMARY KEY,
    id_session INTEGER NOT NULL REFERENCES impression_sessions(id) ON DELETE CASCADE,
    etiquette_code VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('imprimee', 'decoupee', 'ignoree', 'reimprimee')),
    utilisateur VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impression_historique_session ON impression_historique(id_session);
CREATE INDEX IF NOT EXISTS idx_impression_historique_timestamp ON impression_historique(timestamp);

-- Trigger updated_at sur impression_sessions (si la fonction existe et le trigger n'existe pas)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column')
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_impression_sessions_updated_at') THEN
        CREATE TRIGGER update_impression_sessions_updated_at
            BEFORE UPDATE ON impression_sessions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
