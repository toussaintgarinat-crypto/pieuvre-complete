-- ====================================================================
-- MIGRATION 001 - Sprint 1 : Infrastructure RAG
-- À exécuter sur une base de données existante
-- ====================================================================

-- Extension pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ====================================================================
-- TABLE: NORMES_DOCUMENTS
-- ====================================================================
CREATE TABLE IF NOT EXISTS normes_documents (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    source VARCHAR(100),
    description TEXT,
    type_document VARCHAR(50) DEFAULT 'norme',
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_normes_documents_actif ON normes_documents(actif);

-- ====================================================================
-- TABLE: NORMES_CHUNKS
-- ====================================================================
CREATE TABLE IF NOT EXISTS normes_chunks (
    id SERIAL PRIMARY KEY,
    id_document INTEGER NOT NULL REFERENCES normes_documents(id) ON DELETE CASCADE,
    contenu TEXT NOT NULL,
    embedding vector(1536),
    chunk_index INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_normes_chunks_document ON normes_chunks(id_document);
CREATE INDEX IF NOT EXISTS idx_normes_chunks_embedding ON normes_chunks USING hnsw (embedding vector_cosine_ops);

-- ====================================================================
-- DONNÉES INITIALES
-- ====================================================================
INSERT INTO normes_documents (titre, source, description, type_document) VALUES
('NF C 15-100 - Sections et protection des circuits', 'NF C 15-100', 'Règles de section des conducteurs et protection des circuits électriques domestiques et tertiaires', 'norme'),
('NF C 15-100 - Nombre de prises par circuit', 'NF C 15-100', 'Limitation du nombre de points d''utilisation par circuit de prises de courant', 'norme'),
('Guide Pieuvre - Choix des gaines', 'Pieuvre Auto', 'Recommandations métier pour le choix des diamètres de gaines selon le nombre et la section des conducteurs', 'guide')
ON CONFLICT DO NOTHING;

INSERT INTO normes_chunks (id_document, contenu, chunk_index, metadata) VALUES
(1, 'Les circuits de prises de courant doivent être protégés par des disjoncteurs de 16 A ou 20 A selon la section des conducteurs. En section 1,5 mm², le disjoncteur est limité à 16 A. En section 2,5 mm², le disjoncteur peut être de 20 A.', 0, '{"theme": "section_prises", "mots_cles": ["prises", "section", "disjoncteur"]}'),
(1, 'Les circuits d''éclairage sont réalisés en conducteurs de 1,5 mm² minimum et protégés par un disjoncteur de 16 A maximum.', 1, '{"theme": "section_eclairage", "mots_cles": ["eclairage", "lumiere", "1.5"]}'),
(1, 'Les circuits de commande de volets roulants utilisent des conducteurs de 1,5 mm². Ils comportent une phase, un neutre, une terre et deux navettes pour la commande montée/descente.', 2, '{"theme": "section_volets", "mots_cles": ["volet", "vr", "navettes"]}'),
(1, 'Les circuits alimentant les plaques de cuisson et cuisinières électriques sont réalisés en conducteurs de 6 mm² minimum, protégés par un disjoncteur adapté à la puissance (32 A à 40 A).', 3, '{"theme": "section_cuisson", "mots_cles": ["cuisson", "cuisiniere", "6"]}'),
(2, 'Un circuit de prises de courant ne doit pas alimenter plus de 8 prises en logement. Au-delà, il faut prévoir un circuit supplémentaire.', 0, '{"theme": "max_prises", "mots_cles": ["prises", "maximum", "8"]}'),
(2, 'Les prises de courant doivent être réparties de manière à limiter la longueur des circuits et à faciliter l''identification des départs au tableau.', 1, '{"theme": "repartition_prises", "mots_cles": ["prises", "repartition", "tableau"]}'),
(3, 'Le taux de remplissage des gaines est limité à 40 % de leur section intérieure. Pour un circuit standard 3G2,5 (3 conducteurs 2,5 mm²), une gaine Ø16 est suffisante. Pour 5G1,5 ou plus, privilégier une gaine Ø20 ou Ø25.', 0, '{"theme": "gaine_standard", "mots_cles": ["gaine", "diametre", "remplissage"]}'),
(3, 'Les circuits de communication (RJ45) et les circuits de sécurité incendie doivent être posés dans des gaines dédiées et identifiées.', 1, '{"theme": "gaine_speciale", "mots_cles": ["gaine", "communication", "securite"]}')
ON CONFLICT DO NOTHING;

-- Ajout colonne stored_filename sur les scans existants (pour retrouver le fichier sur disque)
ALTER TABLE scans ADD COLUMN IF NOT EXISTS stored_filename VARCHAR(255);

-- ====================================================================
-- TABLE: OCR_TYPE_MAPPINGS
-- ====================================================================
CREATE TABLE IF NOT EXISTS ocr_type_mappings (
    id SERIAL PRIMARY KEY,
    ocr_type_element VARCHAR(50),
    ocr_code_symbol VARCHAR(50),
    circuit_type_code VARCHAR(10) NOT NULL REFERENCES types_circuits(code),
    description TEXT,
    conditions JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ocr_type_element, ocr_code_symbol)
);

CREATE INDEX IF NOT EXISTS idx_ocr_mappings_code ON ocr_type_mappings(ocr_code_symbol) WHERE ocr_code_symbol IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocr_mappings_type ON ocr_type_mappings(ocr_type_element) WHERE ocr_type_element IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocr_mappings_active ON ocr_type_mappings(actif, priority DESC);

-- Ajout de la colonne type_calcul sur types_circuits si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'types_circuits' AND column_name = 'type_calcul') THEN
        ALTER TABLE types_circuits ADD COLUMN type_calcul VARCHAR(50);
    END IF;
END $$;

-- Mise à jour des types_calcul existants
UPDATE types_circuits SET type_calcul = 'prise' WHERE code IN ('P', 'P15', 'LL', 'LV');
UPDATE types_circuits SET type_calcul = 'lumiere' WHERE code IN ('L', 'L15');
UPDATE types_circuits SET type_calcul = 'va-et-vient' WHERE code IN ('VD');
UPDATE types_circuits SET type_calcul = 'double-allumage' WHERE code IN ('DA', 'DA_S');
UPDATE types_circuits SET type_calcul = 'telerupteur' WHERE code IN ('TEL', 'TE');
UPDATE types_circuits SET type_calcul = 'bs' WHERE code IN ('BS');
UPDATE types_circuits SET type_calcul = 'vmc' WHERE code IN ('VMC');
UPDATE types_circuits SET type_calcul = 'volet' WHERE code IN ('VR');
UPDATE types_circuits SET type_calcul = 'cuisiniere' WHERE code IN ('CUIS');
UPDATE types_circuits SET type_calcul = 'exterieur' WHERE code IN ('PG');

-- Ajout du type 'I' (Interrupteur simple) s'il n'existe pas
INSERT INTO types_circuits (code, libelle, description, symbole, categorie, type_calcul, section_par_defaut, ordre_affichage, style)
VALUES ('I', 'Interrupteur', 'Interrupteur simple', 'I', 'commande', 'telerupteur', 1.5, 29, '{"bg_color": "#F3E5F5", "border_style": "solid"}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO ocr_type_mappings (ocr_type_element, ocr_code_symbol, circuit_type_code, description, conditions, priority) VALUES
('prise', 'P', 'P', 'Prise de courant standard', '{"requires_code": true}', 100),
('prise', 'P15', 'P15', 'Prise 1.5mm²', '{"requires_code": true}', 100),
('lumiere', 'L', 'L', 'Point lumineux simple', '{"requires_code": true}', 100),
('lumiere', 'L15', 'L15', 'Lumière 1.5mm²', '{"requires_code": true}', 100),
('interrupteur', 'VD', 'VD', 'Va-et-vient', '{"requires_code": true}', 100),
('interrupteur', 'DA', 'DA', 'Double allumage', '{"requires_code": true}', 100),
('interrupteur', 'TEL', 'TEL', 'Télérupteur', '{"requires_code": true}', 100),
('communication', 'RJ45', 'TEL', 'Prise réseau', '{"requires_code": true}', 100),
('securite', 'BS', 'BS', 'Bloc secours', '{"requires_code": true}', 100),
('securite', 'DI', 'BS', 'Détecteur incendie', '{"requires_code": true}', 100),
('ventilation', 'VMC', 'VMC', 'VMC', '{"requires_code": true}', 100),
('volet', 'VR', 'VR', 'Volet roulant', '{"requires_code": true}', 100),
('appareil', 'CUIS', 'CUIS', 'Cuisinière', '{"requires_code": true}', 100),
('appareil', 'LL', 'LL', 'Lave-linge', '{"requires_code": true}', 100),
('appareil', 'LV', 'LV', 'Lave-vaisselle', '{"requires_code": true}', 100),
('exterieur', 'PG', 'PG', 'Prise extérieure', '{"requires_code": true}', 100),
('prise', NULL, 'P', 'Prise détectée sans code explicite', '{}', 50),
('lumiere', NULL, 'L', 'Lumière détectée sans code explicite', '{}', 50),
('interrupteur', NULL, 'I', 'Interrupteur simple détecté', '{}', 40),
('communication', NULL, 'TEL', 'Circuit communication détecté', '{}', 50),
('securite', NULL, 'BS', 'Circuit sécurité détecté', '{}', 50),
('ventilation', NULL, 'VMC', 'Ventilation détectée', '{}', 50),
('volet', NULL, 'VR', 'Volet détecté', '{}', 50),
('appareil', NULL, 'CUIS', 'Appareil cuisine détecté', '{}', 50),
('exterieur', NULL, 'PG', 'Extérieur détecté', '{}', 50)
ON CONFLICT DO NOTHING;
