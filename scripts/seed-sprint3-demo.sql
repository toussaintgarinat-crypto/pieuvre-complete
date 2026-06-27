-- ====================================================================
-- SEED - Données de démo Sprint 3 : Mémoire client / dossier
-- À exécuter après avoir appliqué la migration 003
-- ====================================================================

-- Client démo avec mémoire OCR active
INSERT INTO clients (
    id,
    nom,
    prises_section,
    eclairage_section,
    gaines_disponibles,
    particularites,
    preferences_etiquettes,
    memoire_ocr_active
) VALUES (
    5,
    'DEMO - Mémoire OCR',
    2.5,
    1.5,
    '[16, 20, 25]',
    'Client de démonstration pour la mémoire OCR',
    '{"mode_etiquetage":"machine","regroupement":{"ordre":["type","section","gaine"]}}'::jsonb,
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    preferences_etiquettes = EXCLUDED.preferences_etiquettes,
    memoire_ocr_active = EXCLUDED.memoire_ocr_active;

-- Chantier démo associé
INSERT INTO chantiers (
    id,
    id_client,
    nom,
    adresse,
    statut,
    date_debut,
    preferences_etiquettes,
    memoire_ocr_active
) VALUES (
    5,
    5,
    'Démo Mémoire - Appartement T3',
    '1 Rue de la Démo, 75000 Paris',
    'actif',
    '2026-06-01',
    '{"mode_etiquetage":"atelier","regroupement":{"ordre":["logement","boite"]}}'::jsonb,
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    id_client = EXCLUDED.id_client,
    preferences_etiquettes = EXCLUDED.preferences_etiquettes,
    memoire_ocr_active = EXCLUDED.memoire_ocr_active;

-- Mapping client P16 -> P
INSERT INTO ocr_type_mappings (
    id_client,
    ocr_type_element,
    ocr_code_symbol,
    circuit_type_code,
    description,
    conditions,
    priority
) VALUES (
    5,
    'prise',
    'P16',
    'P',
    'Le client DEMO appelle ses prises P16',
    '{"requires_code": true}',
    110
)
ON CONFLICT (id_client, id_chantier, ocr_type_element, ocr_code_symbol) DO UPDATE SET
    circuit_type_code = EXCLUDED.circuit_type_code,
    description = EXCLUDED.description,
    conditions = EXCLUDED.conditions,
    priority = EXCLUDED.priority;
