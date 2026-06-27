-- ====================================================================
-- MIGRATION 003 - Mémoire client / dossier
-- Personnalisation des mappings OCR et des préférences d'étiquettes
-- par client et par chantier (héritage : dossier > client > global)
-- ====================================================================

-- ------------------------------------------------------------------
-- 1. Mapping OCR hiérarchique
-- ------------------------------------------------------------------
ALTER TABLE ocr_type_mappings
    ADD COLUMN IF NOT EXISTS id_client INT,
    ADD COLUMN IF NOT EXISTS id_chantier INT;

-- Supprimer l'ancienne contrainte d'unicité globale si elle existe
ALTER TABLE ocr_type_mappings
    DROP CONSTRAINT IF EXISTS ocr_type_mappings_ocr_type_element_ocr_code_symbol_key;

-- Nouvelle contrainte d'unicité tenant compte du contexte client/chantier
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ocr_type_mappings_scope_unique'
          AND conrelid = 'ocr_type_mappings'::regclass
    ) THEN
        ALTER TABLE ocr_type_mappings
            ADD CONSTRAINT ocr_type_mappings_scope_unique
            UNIQUE (id_client, id_chantier, ocr_type_element, ocr_code_symbol);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ocr_mappings_client ON ocr_type_mappings(id_client) WHERE id_client IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocr_mappings_chantier ON ocr_type_mappings(id_chantier) WHERE id_chantier IS NOT NULL;

-- Clés étrangères (peuvent échouer si les tables n'existent pas, d'où le IF EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_ocr_mappings_client'
          AND conrelid = 'ocr_type_mappings'::regclass
    ) THEN
        ALTER TABLE ocr_type_mappings
            ADD CONSTRAINT fk_ocr_mappings_client
            FOREIGN KEY (id_client) REFERENCES clients(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_ocr_mappings_chantier'
          AND conrelid = 'ocr_type_mappings'::regclass
    ) THEN
        ALTER TABLE ocr_type_mappings
            ADD CONSTRAINT fk_ocr_mappings_chantier
            FOREIGN KEY (id_chantier) REFERENCES chantiers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ------------------------------------------------------------------
-- 2. Préférences d'étiquettes et mémoire OCR sur clients/chantiers
-- ------------------------------------------------------------------
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS preferences_etiquettes JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS memoire_ocr_active BOOLEAN DEFAULT FALSE;

ALTER TABLE chantiers
    ADD COLUMN IF NOT EXISTS preferences_etiquettes JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS memoire_ocr_active BOOLEAN DEFAULT FALSE;

-- ====================================================================
-- FIN MIGRATION 003
-- ====================================================================
