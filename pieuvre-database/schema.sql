-- ====================================================================
-- PIEUVRE AUTO - Schéma de base de données PostgreSQL
-- Système de gestion de pieuvres électriques
-- ====================================================================

-- Suppression des tables existantes (pour réinstallation propre)
DROP TABLE IF EXISTS ocr_type_mappings CASCADE;
DROP TABLE IF EXISTS normes_chunks CASCADE;
DROP TABLE IF EXISTS normes_documents CASCADE;
DROP TABLE IF EXISTS historique_stock CASCADE;
DROP TABLE IF EXISTS calculs CASCADE;
DROP TABLE IF EXISTS stock_gaines CASCADE;
DROP TABLE IF EXISTS stock_cleurs CASCADE;
DROP TABLE IF EXISTS chantierS CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS rappels CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS historique_modifications CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS entreprises CASCADE;
DROP TABLE IF EXISTS utilisateurs CASCADE;

-- ====================================================================
-- EXTENSIONS
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ====================================================================
-- TABLE: ENTREPRISES
-- Multi-entreprises (si tu travailles pour plusieurs sociétés)
-- ====================================================================
CREATE TABLE entreprises (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    siret VARCHAR(50),
    adresse TEXT,
    telephone VARCHAR(50),
    email VARCHAR(255),
    logo BYTEA,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ====================================================================
-- TABLE: UTILISATEURS
-- Gestion des utilisateurs avec rôles
-- ====================================================================
CREATE TABLE utilisateurs (
    id SERIAL PRIMARY KEY,
    id_entreprise INTEGER REFERENCES entreprises(id) ON DELETE SET NULL,
    
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Rôle dans le système
    role VARCHAR(50) NOT NULL DEFAULT 'dessinateur' 
        CHECK (role IN ('admin', 'commercial', 'dessinateur', 'magasinier', 'lecture')),
    
    -- Permissions granulaires (JSON)
    permissions JSONB DEFAULT '{}'::jsonb,
    
    -- Statut
    actif BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    
    -- Métadonnées
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);
CREATE INDEX idx_utilisateurs_role ON utilisateurs(role);
CREATE INDEX idx_utilisateurs_entreprise ON utilisateurs(id_entreprise);

-- ====================================================================
-- TABLE: CLIENTS
-- Profils des entreprises clientes avec leurs normes par défaut
-- ====================================================================
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) UNIQUE NOT NULL,
    
    -- Sections par défaut (en mm²)
    prises_section DECIMAL(3,1) DEFAULT 2.5,
    eclairage_section DECIMAL(3,1) DEFAULT 1.5,
    volets_section DECIMAL(3,1) DEFAULT 1.5,
    cuisson_section DECIMAL(3,1) DEFAULT 6.0,
    vmc_section DECIMAL(3,1) DEFAULT 1.5,
    chauffage_section DECIMAL(3,1) DEFAULT 2.5,
    
    -- Couleurs préférées (JSON array)
    -- Ex: ["Rouge", "Bleu", "Vert/Jaune", "Orange", "Violet"]
    couleurs_preferees JSONB DEFAULT '["Rouge", "Bleu", "Vert/Jaune", "Orange", "Noir", "Violet", "Marron"]'::jsonb,
    
    -- Gainiers disponibles (JSON array) - si vide, toutes tailles autorisées
    -- Ex: [20, 25, 32] pour exclure Ø16
    gaines_disponibles JSONB DEFAULT '[16, 20, 25, 32, 40, 50, 63]'::jsonb,
    
    -- Marges (%)
    -- Marge sur les fils (pour chutes, raccords, etc.)
    marge_fils DECIMAL(5,2) DEFAULT 10.00,
    -- Marge sur les gaines
    marge_gaines DECIMAL(5,2) DEFAULT 10.00,
    -- Marge sur les câbles (pour extérieure)
    marge_cables DECIMAL(5,2) DEFAULT 15.00,
    
    -- Longueurs minimales par défaut (mètres)
    longueur_min_fils DECIMAL(6,2) DEFAULT 1.00,
    longueur_min_gaines DECIMAL(6,2) DEFAULT 1.00,
    
    -- Particularités spécifiques au client
    particularites TEXT,
    
    -- Notes (JSONB structuré: [{date, auteur, texte, type}])
    notes JSONB DEFAULT '[]'::jsonb,
    
    -- Contact client
    contact_nom VARCHAR(255),
    contact_email VARCHAR(255),
    contact_telephone VARCHAR(50),
    responsable_compte VARCHAR(255), -- Nom du commercial/gestionnaire
    
    -- Préférences d'étiquetage par défaut pour ce client
    -- Ex: {"format": "Avery L7160", "regroupement": {"ordre": ["logement", "boite"]}, "afficher_longueur": true}
    preferences_etiquettes JSONB DEFAULT '{}'::jsonb,
    
    -- Mémoire OCR / symboles personnalisés activée pour ce client
    memoire_ocr_active BOOLEAN DEFAULT FALSE,
    
    -- Métadonnées
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_clients_nom ON clients(nom);
CREATE INDEX idx_clients_actif ON clients(actif);

-- ====================================================================
-- TABLE: CHANTIERS
-- Projets spécifiques avec possibilité d'override des normes client
-- ====================================================================
CREATE TABLE IF NOT EXISTS chantiers (
    id SERIAL PRIMARY KEY,
    id_client INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    
    -- Localisation (pour étiquettes)
    batiment VARCHAR(50),
    etage VARCHAR(20),
    appartement VARCHAR(20),
    zone VARCHAR(100),
    
    -- Numéro de boîte par défaut
    numero_caisse_default INTEGER DEFAULT 1,
    
    -- Override des sections (NULL = utilise valeur client)
    prises_section DECIMAL(3,1),
    eclairage_section DECIMAL(3,1),
    volets_section DECIMAL(3,1),
    cuisson_section DECIMAL(3,1),
    vmc_section DECIMAL(3,1),
    chauffage_section DECIMAL(3,1),
    
    -- Override gaines disponibles (NULL = utilise valeur client)
    gaines_disponibles JSONB,
    
    -- Override marges (NULL = utilise valeur client)
    marge_fils DECIMAL(5,2),
    marge_gaines DECIMAL(5,2),
    marge_cables DECIMAL(5,2),
    
    -- Override longueurs minimales (NULL = utilise valeur client)
    longueur_min_fils DECIMAL(6,2),
    longueur_min_gaines DECIMAL(6,2),
    
    -- Statut du chantier
    statut VARCHAR(50) DEFAULT 'actif' CHECK (statut IN ('actif', 'pause', 'termine', 'annule')),
    
    -- Dates
    date_debut DATE,
    date_fin_prevue DATE,
    date_fin_reelle DATE,
    
    -- Notes (JSONB structuré: [{date, auteur, texte, type}])
    notes JSONB DEFAULT '[]'::jsonb,
    
    -- Contact chantier
    contact_nom VARCHAR(255),
    contact_email VARCHAR(255),
    contact_telephone VARCHAR(50),
    responsable_chantier VARCHAR(255), -- Nom du chef de chantier
    
    -- Préférences d'étiquetage spécifiques au chantier (override client)
    preferences_etiquettes JSONB DEFAULT '{}'::jsonb,
    
    -- Mémoire OCR / symboles personnalisés activée pour ce chantier
    memoire_ocr_active BOOLEAN DEFAULT FALSE,
    
    -- Mode de production des circuits
    mode_production VARCHAR(20) DEFAULT 'direct'
        CHECK (mode_production IN ('direct', 'derivation')),

    -- Longueur de dérivation par défaut (mode alimentation + dérivation)
    longueur_derivation_m DECIMAL(5,2) DEFAULT 2.50,

    -- Type de support au plafond (impacte le calcul des longueurs et du matériel)
    type_support VARCHAR(30) DEFAULT 'planchette'
        CHECK (type_support IN ('dalle_plein', 'planchette', 'mixte')),

    -- Hauteur sous plafond (mètres) pour calculer les descentes de fils
    hauteur_plafond_m DECIMAL(4,2) DEFAULT 2.50,
    
    -- Hauteur par défaut des appareils (mètres)
    hauteur_prise_m DECIMAL(4,2) DEFAULT 0.30,
    hauteur_interrupteur_m DECIMAL(4,2) DEFAULT 1.10,
    
    -- Besoin en pots / boîtiers
    besoin_pots BOOLEAN DEFAULT TRUE,
    types_pots JSONB DEFAULT '["boite_encastrement"]'::jsonb,
    
    -- Métadonnées
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_chantiers_client ON chantiers(id_client);
CREATE INDEX idx_chantiers_statut ON chantiers(statut);
CREATE INDEX idx_chantiers_nom ON chantiers(nom);

-- ====================================================================
-- CLÉS ÉTRANGÈRES DIFFÉRÉES : mappings OCR liés aux clients/chantiers
-- ====================================================================
ALTER TABLE ocr_type_mappings
    ADD CONSTRAINT fk_ocr_mappings_client FOREIGN KEY (id_client) REFERENCES clients(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_ocr_mappings_chantier FOREIGN KEY (id_chantier) REFERENCES chantiers(id) ON DELETE CASCADE;

-- ====================================================================
-- TABLE: STOCK_COULEURS
-- Stock temps réel des fils par couleur et section
-- ====================================================================
CREATE TABLE stock_couleurs (
    id SERIAL PRIMARY KEY,
    
    couleur VARCHAR(50) NOT NULL,
    section DECIMAL(3,1) NOT NULL,
    
    -- Quantité en mètres
    quantite_metres INTEGER NOT NULL DEFAULT 0,
    
    -- Seuil d'alerte (pour notification stock bas)
    seuil_alerte INTEGER DEFAULT 100,
    
    -- Métadonnées
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(100),
    
    UNIQUE(couleur, section)
);

-- Index pour recherche rapide
CREATE INDEX idx_stock_couleurs_lookup ON stock_couleurs(couleur, section);
CREATE INDEX idx_stock_couleurs_alerte ON stock_couleurs(quantite_metres) WHERE quantite_metres < seuil_alerte;

-- ====================================================================
-- TABLE: STOCK_GAINES
-- Stock temps réel des gaines par diamètre
-- ====================================================================
CREATE TABLE stock_gaines (
    id SERIAL PRIMARY KEY,
    
    diametre INTEGER NOT NULL UNIQUE,
    
    -- Quantité en mètres
    quantite_metres INTEGER NOT NULL DEFAULT 0,
    
    -- Seuil d'alerte
    seuil_alerte INTEGER DEFAULT 50,
    
    -- Métadonnées
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(100)
);

-- Index pour alertes
CREATE INDEX idx_stock_gaines_alerte ON stock_gaines(quantite_metres) WHERE quantite_metres < seuil_alerte;

-- ====================================================================
-- TABLE: CALCULS
-- Historique de tous les calculs de pieuvres effectués
-- ====================================================================
CREATE TABLE calculs (
    id SERIAL PRIMARY KEY,
    id_chantier INTEGER NOT NULL REFERENCES chantiers(id) ON DELETE RESTRICT,
    
    -- Utilisateur ayant effectué le calcul
    utilisateur VARCHAR(100) NOT NULL,
    
    -- Date et heure du calcul
    date_calcul TIMESTAMP DEFAULT NOW(),
    
    -- Bon de coupe complet en JSON
    -- Structure: {
    --   "fils": [
    --     {"couleur": "Rouge", "section": 2.5, "longueur": 47.2, "fonction": "Phase"},
    --     ...
    --   ],
    --   "gaines": [
    --     {"diametre": 20, "longueur": 47.2},
    --     ...
    --   ],
    --   "circuits": [...],
    --   "substitutions": {...},
    --   "alertes": [...]
    -- }
    bon_de_coupe JSONB NOT NULL,
    
    -- Mode de production utilisé pour ce calcul
    mode_production VARCHAR(20) DEFAULT 'direct'
        CHECK (mode_production IN ('direct', 'derivation')),

    -- Mode d'étiquetage / fabrication
    mode_etiquetage VARCHAR(20) DEFAULT 'atelier'
        CHECK (mode_etiquetage IN ('atelier', 'machine')),

    -- Options de regroupement des étiquettes (JSON)
    -- Ex: {"ordre": ["logement", "boite"], "grouper_par": ["type", "section"]}
    regroupement JSONB DEFAULT '{"ordre":["logement","boite"],"grouper_par":[]}'::jsonb,

    -- Chemin vers le fichier DWG source
    fichier_dwg_path TEXT,
    
    -- Commentaire optionnel
    commentaire TEXT,
    
    -- Métadonnées
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour historique et recherche
CREATE INDEX idx_calculs_chantier ON calculs(id_chantier);
CREATE INDEX idx_calculs_date ON calculs(date_calcul DESC);
CREATE INDEX idx_calculs_utilisateur ON calculs(utilisateur);

-- ====================================================================
-- TABLE: CIRCUITS_CALCULS
-- Circuits détaillés pour un calcul (avec type, numéro boîte, etc.)
-- ====================================================================
CREATE TABLE circuits_calculs (
    id SERIAL PRIMARY KEY,
    id_calcul INTEGER NOT NULL REFERENCES calculs(id) ON DELETE CASCADE,
    
    -- Numéro de circuit (P1, L1, VD1, etc.)
    numero VARCHAR(20) NOT NULL,
    
    -- Type de circuit (P, L, VD, DA, TEL, BS, VMC, VR, CUIS...)
    type_circuit_code VARCHAR(10),
    
    -- Description libre
    description TEXT,
    
    -- Localisation
    etage VARCHAR(20),
    appartement VARCHAR(20),
    numero_boite INTEGER,
    
    -- Longueurs
    longueur_theorique DECIMAL(7,2),  -- Longueur mesurée/saisie
    longueur_finale DECIMAL(7,2),      -- Longueur avec marge
    
    -- Fils contenus (JSON array)
    fils JSONB DEFAULT '[]'::jsonb,
    -- Ex: [{"couleur": "Rouge", "section": 2.5, "fonction": "Phase"}, ...]
    
    -- Gaine
    gaine_diametre INTEGER,
    gaine_longueur DECIMAL(7,2),
    
    -- Métadonnées
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_circuits_calculs_calcul ON circuits_calculs(id_calcul);
CREATE INDEX idx_circuits_calculs_type ON circuits_calculs(type_circuit_code);

-- ====================================================================
-- TABLE: HISTORIQUE_STOCK
-- Traçabilité de toutes les modifications de stock
-- ====================================================================
CREATE TABLE historique_stock (
    id SERIAL PRIMARY KEY,
    
    -- Référence à la table modifiée
    table_source VARCHAR(50) NOT NULL CHECK (table_source IN ('stock_couleurs', 'stock_gaines')),
    id_source INTEGER NOT NULL,
    
    -- Type d'opération
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('ajout', 'retrait', 'modification', 'initialisation')),
    
    -- Valeurs
    ancien_stock INTEGER,
    nouveau_stock INTEGER,
    difference INTEGER GENERATED ALWAYS AS (nouveau_stock - ancien_stock) STORED,
    
    -- Raison de la modification
    raison TEXT,
    
    -- Utilisateur
    utilisateur VARCHAR(100),
    
    -- Timestamp
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Index pour audit
CREATE INDEX idx_historique_date ON historique_stock(timestamp DESC);
CREATE INDEX idx_historique_source ON historique_stock(table_source, id_source);

-- ====================================================================
-- TABLE: HISTORIQUE_MODIFICATIONS
-- Audit trail complet de toutes les modifications
-- ====================================================================
CREATE TABLE historique_modifications (
    id SERIAL PRIMARY KEY,
    
    -- Table et enregistrement modifié
    table_nom VARCHAR(100) NOT NULL,
    ligne_id INTEGER NOT NULL,
    
    -- Type d'opération
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    
    -- Données
    donnees_avant JSONB,
    donnees_apres JSONB,
    
    -- Utilisateur
    utilisateur_id INTEGER REFERENCES utilisateurs(id),
    utilisateur_nom VARCHAR(255),
    
    -- IP et timestamp
    ip_client INET,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_histo_mod_date ON historique_modifications(timestamp DESC);
CREATE INDEX idx_histo_mod_table ON historique_modifications(table_nom, ligne_id);

-- ====================================================================
-- TABLE: RAPPELS
-- Rappels automatiques (fin de chantier, stock bas)
-- ====================================================================
CREATE TABLE rappels (
    id SERIAL PRIMARY KEY,
    
    -- Type de rappel
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'fin_chantier', 
        'stock_couleur', 
        'stock_gaine', 
        'personnalise'
    )),
    
    -- Objet et message
    titre VARCHAR(255) NOT NULL,
    message TEXT,
    
    -- Conditions de déclenchement
    -- Pour fin_chantier: jours_avant_fin
    jours_avant INTEGER,
    
    -- Pour stock: id du produit concerné
    produit_type VARCHAR(20),
    produit_id INTEGER,
    seuil_stock INTEGER,
    
    -- Cible du rappel
    utilisateur_id INTEGER REFERENCES utilisateurs(id),
    groupe VARCHAR(50), -- 'all', 'admin', 'commercial', 'dessinateur'
    
    -- Statut
    actif BOOLEAN DEFAULT TRUE,
    frequence VARCHAR(20) DEFAULT 'une_fois' CHECK (frequence IN ('une_fois', 'quotidien', 'hebdomadaire')),
    
    -- Dernier envoi et prochain envoi prévu
    dernier_envoi TIMESTAMP,
    prochain_envoi TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rappels_actif ON rappels(actif, prochain_envoi);
CREATE INDEX idx_rappels_type ON rappels(type);

-- ====================================================================
-- TABLE: WEBHOOKS
-- Webhooks pour notifications externes
-- ====================================================================
CREATE TABLE webhooks (
    id SERIAL PRIMARY KEY,
    
    -- Nom et description
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- URL de callback
    url TEXT NOT NULL,
    methode VARCHAR(10) DEFAULT 'POST' CHECK (methode IN ('POST', 'PUT')),
    
    -- Événements déclenchants
    evenements JSONB DEFAULT '[]'::jsonb,
    -- Ex: ['calcul.created', 'stock.low', 'chantier.termine']
    
    -- Configuration
    headers JSONB DEFAULT '{}'::jsonb,
    secret_signature VARCHAR(255),
    
    -- Statut
    actif BOOLEAN DEFAULT TRUE,
    
    -- Stats
    nb_appels_reussis INTEGER DEFAULT 0,
    nb_appels_echoues INTEGER DEFAULT 0,
    dernier_appel TIMESTAMP,
    dernier_erreur TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ====================================================================
-- TABLE: TYPES_CIRCUITS
-- Types de circuits configurables (P, L, VD, DA, TEL, BS, etc.)
-- ====================================================================
CREATE TABLE types_circuits (
    id SERIAL PRIMARY KEY,

    -- Code unique (P, L, VD, DA, TEL, BS, VMC, etc.)
    code VARCHAR(10) UNIQUE NOT NULL,

    -- Libellé long
    libelle VARCHAR(100) NOT NULL,

    -- Description
    description TEXT,

    -- Icône ou symbole (pour affichage)
    symbole VARCHAR(20),

    -- Style d'affichage (pour étiquettes)
    -- bg_color, text_color, border_style
    style JSONB DEFAULT '{}'::jsonb,

    -- Catégorie principale
    categorie VARCHAR(50) CHECK (categorie IN ('prise', 'eclairage', 'commande', 'securite', 'autre')),

    -- Type canonique utilisé par le calculateur (prise, lumiere, va-et-vient, etc.)
    type_calcul VARCHAR(50),

    -- Section par défaut recommandée
    section_par_defaut DECIMAL(3,1),

    -- Ordre d'affichage dans les listes
    ordre_affichage INTEGER DEFAULT 0,

    -- Actif
    actif BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Insertion des types par défaut
INSERT INTO types_circuits (code, libelle, description, symbole, categorie, type_calcul, section_par_defaut, ordre_affichage, style) VALUES
-- Prises
('P', 'Prise', 'Circuit prises de courant 16A', 'P', 'prise', 'prise', 2.5, 10, '{"bg_color": "#E3F2FD", "border_style": "solid"}'),
('P15', 'Prise 1.5mm²', 'Circuit prises en 1.5mm² (rénovation)', 'P', 'prise', 'prise', 1.5, 11, '{"bg_color": "#FFF3E0", "border_style": "dashed"}'),

-- Éclairage
('L', 'Lumière', 'Circuit éclairage simple', 'L', 'eclairage', 'lumiere', 1.5, 20, '{"bg_color": "#FFFDE7", "border_style": "solid"}'),
('L15', 'Lumière 1.5mm²', 'Circuit éclairage 1.5mm²', 'L', 'eclairage', 'lumiere', 1.5, 21, '{"bg_color": "#FFFDE7", "border_style": "dashed"}'),

-- Commandes (va-et-vient, double allumage)
('I', 'Interrupteur', 'Interrupteur simple', 'I', 'commande', 'telerupteur', 1.5, 29, '{"bg_color": "#F3E5F5", "border_style": "solid"}'),
('VD', 'Va-et-vient', 'Va-et-vient (2 inter)', 'VD', 'commande', 'va-et-vient', 1.5, 30, '{"bg_color": "#F3E5F5", "border_style": "dotted"}'),
('DA', 'Double allumage', 'Double allumage (2 points)', 'DA', 'commande', 'double-allumage', 1.5, 31, '{"bg_color": "#F3E5F5", "border_style": "dotted"}'),
('TEL', 'Télérupteur', 'Circuit Télérupteur', 'TEL', 'commande', 'telerupteur', 1.5, 32, '{"bg_color": "#F3E5F5", "border_style": "dashed"}'),
('TE', 'Télérupteur', 'Télerupteur (autre)', 'TE', 'commande', 'telerupteur', 1.5, 33, '{"bg_color": "#F3E5F5", "border_style": "double"}'),

-- Sécurité
('BS', 'Bloc secours', 'Bloc de sécurité', 'BS', 'securite', 'bs', 1.5, 40, '{"bg_color": "#FFEBEE", "border_style": "solid"}'),
('DA_S', 'Double allumage secours', 'Double allumage sécurité', 'DA_S', 'securite', 'double-allumage', 1.5, 41, '{"bg_color": "#FFEBEE", "border_style": "dotted"}'),

-- Autres
('VMC', 'VMC', 'Ventilation Mécanique Contrôlée', 'VMC', 'autre', 'vmc', 1.5, 50, '{"bg_color": "#E0F7FA", "border_style": "solid"}'),
('VR', 'Volet roulant', 'Volet roulant', 'VR', 'autre', 'volet', 1.5, 51, '{"bg_color": "#ECEFF1", "border_style": "solid"}'),
('CUIS', 'Cuisinière', 'Circuit cuisinière/plaque', 'CUIS', 'autre', 'cuisiniere', 6.0, 60, '{"bg_color": "#FBE9E7", "border_style": "solid"}'),
('LL', 'Lave-linge', 'Circuit lave-linge', 'LL', 'autre', 'prise', 2.5, 61, '{"bg_color": "#FBE9E7", "border_style": "dashed"}'),
('LV', 'Lave-vaisselle', 'Circuit lave-vaisselle', 'LV', 'autre', 'prise', 2.5, 62, '{"bg_color": "#FBE9E7", "border_style": "dashed"}'),
('PG', 'Prise greenery', 'Prise extérieur/jardin', 'PG', 'autre', 'exterieur', 2.5, 70, '{"bg_color": "#E8F5E9", "border_style": "solid"}');

-- ====================================================================
-- TABLE: OCR_TYPE_MAPPINGS
-- Mapping entre les types détectés par OCR et les types de circuits
-- Permet de personnaliser la détermination sans modifier le code
-- ====================================================================
CREATE TABLE ocr_type_mappings (
    id SERIAL PRIMARY KEY,
    
    -- Portée du mapping : global (NULL/NULL), client ou chantier
    -- Les clés étrangères sont ajoutées après création des tables clients/chantiers
    id_client INT,
    id_chantier INT,
    
    ocr_type_element VARCHAR(50),
    ocr_code_symbol VARCHAR(50),
    circuit_type_code VARCHAR(10) NOT NULL REFERENCES types_circuits(code),
    description TEXT,
    conditions JSONB DEFAULT '{}'::jsonb,
    -- Conditions possibles :
    -- { "min_count": 2, "max_count": 8, "nearby_types": ["interrupteur"], "requires_code": false }
    priority INTEGER DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(id_client, id_chantier, ocr_type_element, ocr_code_symbol)
);

CREATE INDEX idx_ocr_mappings_code ON ocr_type_mappings(ocr_code_symbol) WHERE ocr_code_symbol IS NOT NULL;
CREATE INDEX idx_ocr_mappings_type ON ocr_type_mappings(ocr_type_element) WHERE ocr_type_element IS NOT NULL;
CREATE INDEX idx_ocr_mappings_active ON ocr_type_mappings(actif, priority DESC);
CREATE INDEX idx_ocr_mappings_client ON ocr_type_mappings(id_client) WHERE id_client IS NOT NULL;
CREATE INDEX idx_ocr_mappings_chantier ON ocr_type_mappings(id_chantier) WHERE id_chantier IS NOT NULL;

-- Mappings par défaut
INSERT INTO ocr_type_mappings (ocr_type_element, ocr_code_symbol, circuit_type_code, description, conditions, priority) VALUES
-- Mapping par code_symbol (priorité haute)
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
-- Mapping par type_element (fallback, priorité plus basse)
('prise', NULL, 'P', 'Prise détectée sans code explicite', '{}', 50),
('lumiere', NULL, 'L', 'Lumière détectée sans code explicite', '{}', 50),
('interrupteur', NULL, 'I', 'Interrupteur simple détecté', '{}', 40),
('communication', NULL, 'TEL', 'Circuit communication détecté', '{}', 50),
('securite', NULL, 'BS', 'Circuit sécurité détecté', '{}', 50),
('ventilation', NULL, 'VMC', 'Ventilation détectée', '{}', 50),
('volet', NULL, 'VR', 'Volet détecté', '{}', 50),
('appareil', NULL, 'CUIS', 'Appareil cuisine détecté', '{}', 50),
('exterieur', NULL, 'PG', 'Extérieur détecté', '{}', 50);

-- Mapping personnalisé client DEMO (id_client = 5)
-- Ce client appelle ses prises 16A "P16" au lieu de "P".
INSERT INTO ocr_type_mappings (id_client, ocr_type_element, ocr_code_symbol, circuit_type_code, description, conditions, priority) VALUES
(5, 'prise', 'P16', 'P', 'Le client DEMO appelle ses prises P16', '{"requires_code": true}', 110);

-- ====================================================================
-- TABLE: NORMES
-- Paramètres des normes (NF C 15-100, etc.) - modifiables sans code
-- ====================================================================
CREATE TABLE normes (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    valeur TEXT NOT NULL,
    unite VARCHAR(20),
    actif BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO normes (nom, description, valeur, unite) VALUES
('taux_remplissage', 'Taux de remplissage des gaines', '0.4', NULL),
('max_prises_circuit', 'Nombre maximum de prises par circuit', '8', NULL),
('gaine_min_diametre', 'Diamètre minimum de gaine', '16', 'mm'),
('section_prises_standard', 'Section standard prises', '1.5', 'mm²'),
('section_prises_fortee', 'Section forcée prises', '2.5', 'mm²'),
('marge_fils', 'Marge par défaut fils', '10', '%'),
('marge_gaines', 'Marge par défaut gaines', '10', '%'),
('marge_cables', 'Marge par défaut câbles', '15', '%');

-- ====================================================================
-- TABLE: NORMES_DOCUMENTS
-- Documents de référence pour le RAG (NF C 15-100, guides métier, etc.)
-- ====================================================================
CREATE TABLE normes_documents (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    source VARCHAR(100),
    description TEXT,
    type_document VARCHAR(50) DEFAULT 'norme',
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_normes_documents_actif ON normes_documents(actif);

-- ====================================================================
-- TABLE: NORMES_CHUNKS
-- Fragments vectorisés des documents de référence
-- ====================================================================
CREATE TABLE normes_chunks (
    id SERIAL PRIMARY KEY,
    id_document INTEGER NOT NULL REFERENCES normes_documents(id) ON DELETE CASCADE,
    contenu TEXT NOT NULL,
    embedding vector(1536),
    chunk_index INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_normes_chunks_document ON normes_chunks(id_document);
CREATE INDEX idx_normes_chunks_embedding ON normes_chunks USING hnsw (embedding vector_cosine_ops);

-- ====================================================================
-- TABLE: PARAMETRES
-- Paramètres système-configurables (autres que normes)
-- ====================================================================
CREATE TABLE parametres (
    id SERIAL PRIMARY KEY,
    cle VARCHAR(50) NOT NULL UNIQUE,
    valeur TEXT NOT NULL,
    description TEXT,
    categorie VARCHAR(30) DEFAULT 'general',
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO parametres (cle, valeur, description, categorie) VALUES
('app_nom', 'Pieuvre Auto', 'Nom application', 'general'),
('app_version', '1.0.0', 'Version', 'general'),
('devise', '€', 'Devise', 'general'),
('pays', 'France', 'Pays défaut', 'general'),
('longueur_min_fils', '1', 'Longueur min fils (m)', 'cables'),
('longueur_min_gaines', '1', 'Longueur min gaines (m)', 'cables');

-- ====================================================================
-- TABLE: CONFIG_ETIQUETTES
-- Configuration des étiquettes (format, imprimantes, etc.)
-- ====================================================================
CREATE TABLE config_etiquette (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    largeur_mm DECIMAL(6,2) NOT NULL DEFAULT 70.00,
    hauteur_mm DECIMAL(6,2) NOT NULL DEFAULT 35.00,
    marge_haut_mm DECIMAL(5,2) DEFAULT 2.00,
    marge_bas_mm DECIMAL(5,2) DEFAULT 2.00,
    marge_gauche_mm DECIMAL(5,2) DEFAULT 2.00,
    marge_droite_mm DECIMAL(5,2) DEFAULT 2.00,
    impressions_par_ligne INTEGER DEFAULT 3,
    orientation VARCHAR(20) DEFAULT 'paysage' CHECK (orientation IN ('portrait', 'paysage')),
    police_titre INTEGER DEFAULT 10,
    police_corps INTEGER DEFAULT 8,
    police_pied INTEGER DEFAULT 7,
    afficher JSONB DEFAULT '{"ligne1_chantier": true, "ligne1_batiment": true, "ligne1_etage": true, "ligne1_logement": true, "ligne1_numero_boite": true, "ligne2_numero_boite": true, "lignes_fils": 2, "nom_gaine_4x": true, "ligne_client": true, "ligne_longueur": true, "ligne_icte": true}'::jsonb,
    est_defaut BOOLEAN DEFAULT FALSE,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Configurations par défaut
INSERT INTO config_etiquette (nom, description, largeur_mm, hauteur_mm, impressions_par_ligne, est_defaut) VALUES
('Standard 70x35', 'Étiquette standard 70x35mm, 3 par ligne', 70, 35, 3, TRUE),
('Compact 50x25', 'Étiquette compacte 50x25mm, 4 par ligne', 50, 25, 4, FALSE),
('Grand 100x50', 'Étiquette grande 100x50mm, 2 par ligne', 100, 50, 2, FALSE),
('Avery L7160', 'Étiquette Avery L7160 (99x34mm)', 99, 34, 3, FALSE);

-- ====================================================================
-- TABLE: IMPRESSION_SESSIONS
-- Sessions d'impression ruban continu avec reprise après changement rouleau
-- ====================================================================
CREATE TABLE impression_sessions (
    id SERIAL PRIMARY KEY,
    id_calcul INTEGER NOT NULL REFERENCES calculs(id) ON DELETE CASCADE,
    utilisateur VARCHAR(100) NOT NULL,

    -- Filtre appliqué à la session
    filtre_type VARCHAR(20) DEFAULT 'chantier' CHECK (filtre_type IN ('chantier', 'logement', 'boite')),
    filtre_valeur VARCHAR(100),

    -- Mode d'étiquetage utilisé pour cette session
    mode_etiquetage VARCHAR(20) DEFAULT 'atelier' CHECK (mode_etiquetage IN ('atelier', 'machine')),
    regroupement JSONB DEFAULT '{"ordre":["logement","boite"]}'::jsonb,

    -- Progression
    etiquettes_totales INTEGER NOT NULL DEFAULT 0,
    etiquettes_imprimees INTEGER NOT NULL DEFAULT 0,
    derniere_etiquette VARCHAR(50),

    -- Statut
    statut VARCHAR(20) DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'termine', 'annule', 'pause')),

    -- Métadonnées
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_impression_sessions_calcul ON impression_sessions(id_calcul);
CREATE INDEX idx_impression_sessions_statut ON impression_sessions(statut);

-- ====================================================================
-- TABLE: IMPRESSION_HISTORIQUE
-- Traçabilité des actions sur les étiquettes (imprimée, découpée, ignorée)
-- ====================================================================
CREATE TABLE impression_historique (
    id SERIAL PRIMARY KEY,
    id_session INTEGER NOT NULL REFERENCES impression_sessions(id) ON DELETE CASCADE,
    etiquette_code VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('imprimee', 'decoupee', 'ignoree', 'reimprimee')),
    utilisateur VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_impression_historique_session ON impression_historique(id_session);
CREATE INDEX idx_impression_historique_timestamp ON impression_historique(timestamp);

-- Trigger updated_at
CREATE TRIGGER update_impression_sessions_updated_at BEFORE UPDATE ON impression_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- TABLE: TEMPLATES
-- Modèles de calculs récurrents
-- ====================================================================
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    
    -- Nom et description
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Contenu du template (circuits types)
    circuits JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Ex: [{type: 'prise', nb_prises: 8, section: 2.5}, {type: 'eclairage', nb_points: 4}]
    
    -- Cible par défaut
    id_entreprise INTEGER REFERENCES entreprises(id),
    id_client INTEGER REFERENCES clients(id),
    
    -- Métadonnées
    utilisateur_id INTEGER REFERENCES utilisateurs(id),
    actif BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_entreprise ON templates(id_entreprise);
CREATE INDEX idx_templates_client ON templates(id_client);

-- ====================================================================
-- FONCTIONS TRIGGERS
-- Automatisation de la mise à jour des timestamps et historique
-- ====================================================================

-- Fonction pour mise à jour automatique updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Application du trigger sur les tables concernées
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chantiers_updated_at BEFORE UPDATE ON chantiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_couleurs_updated_at BEFORE UPDATE ON stock_couleurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_gaines_updated_at BEFORE UPDATE ON stock_gaines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_utilisateurs_updated_at BEFORE UPDATE ON utilisateurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entreprises_updated_at BEFORE UPDATE ON entreprises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rappels_updated_at BEFORE UPDATE ON rappels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour traçabilité stock couleurs
CREATE OR REPLACE FUNCTION log_stock_couleurs_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.quantite_metres != NEW.quantite_metres THEN
        INSERT INTO historique_stock (table_source, id_source, operation, ancien_stock, nouveau_stock, utilisateur)
        VALUES ('stock_couleurs', NEW.id, 'modification', OLD.quantite_metres, NEW.quantite_metres, NEW.updated_by);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO historique_stock (table_source, id_source, operation, ancien_stock, nouveau_stock, utilisateur)
        VALUES ('stock_couleurs', NEW.id, 'initialisation', 0, NEW.quantite_metres, NEW.updated_by);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_stock_couleurs_trigger AFTER INSERT OR UPDATE ON stock_couleurs
    FOR EACH ROW EXECUTE FUNCTION log_stock_couleurs_change();

-- Fonction pour traçabilité stock gaines
CREATE OR REPLACE FUNCTION log_stock_gaines_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.quantite_metres != NEW.quantite_metres THEN
        INSERT INTO historique_stock (table_source, id_source, operation, ancien_stock, nouveau_stock, utilisateur)
        VALUES ('stock_gaines', NEW.id, 'modification', OLD.quantite_metres, NEW.quantite_metres, NEW.updated_by);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO historique_stock (table_source, id_source, operation, ancien_stock, nouveau_stock, utilisateur)
        VALUES ('stock_gaines', NEW.id, 'initialisation', 0, NEW.quantite_metres, NEW.updated_by);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_stock_gaines_trigger AFTER INSERT OR UPDATE ON stock_gaines
    FOR EACH ROW EXECUTE FUNCTION log_stock_gaines_change();

-- Fonction générique pour audit trail
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    utilisateur_id INTEGER := NULL;
    utilisateur_nom VARCHAR(255) := current_setting('app.current_user_id', true);
    ip_client INET := current_setting('app.current_ip', true);
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO historique_modifications (table_nom, ligne_id, operation, donnees_avant, donnees_apres, utilisateur_id, utilisateur_nom, ip_client)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', NULL, to_jsonb(NEW), utilisateur_id, utilisateur_nom, ip_client);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO historique_modifications (table_nom, ligne_id, operation, donnees_avant, donnees_apres, utilisateur_id, utilisateur_nom, ip_client)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), utilisateur_id, utilisateur_nom, ip_client);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO historique_modifications (table_nom, ligne_id, operation, donnees_avant, donnees_apres, utilisateur_id, utilisateur_nom, ip_client)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), NULL, utilisateur_id, utilisateur_nom, ip_client);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Activation de l'audit sur les tables principales
CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON clients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_chantiers AFTER INSERT OR UPDATE OR DELETE ON chantiers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_calculs AFTER INSERT OR UPDATE OR DELETE ON calculs
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ====================================================================
-- VUES UTILES
-- ====================================================================

-- Vue: Chantiers avec infos client
CREATE OR REPLACE VIEW v_chantiers_complets AS
SELECT 
    c.id,
    c.nom AS chantier_nom,
    c.adresse,
    c.statut,
    cl.nom AS client_nom,
    cl.id AS client_id,
    COALESCE(c.prises_section, cl.prises_section) AS prises_section,
    COALESCE(c.eclairage_section, cl.eclairage_section) AS eclairage_section,
    COALESCE(c.volets_section, cl.volets_section) AS volets_section,
    c.date_debut,
    c.date_fin_prevue,
    c.created_at,
    COALESCE(c.gaines_disponibles, cl.gaines_disponibles) AS gaines_disponibles
FROM chantiers c
JOIN clients cl ON c.id_client = cl.id;

-- Vue: Alertes stock
CREATE OR REPLACE VIEW v_alertes_stock AS
SELECT 
    'couleur' AS type,
    couleur || ' ' || section || 'mm²' AS designation,
    quantite_metres AS stock_actuel,
    seuil_alerte,
    updated_at
FROM stock_couleurs
WHERE quantite_metres < seuil_alerte
UNION ALL
SELECT 
    'gaine' AS type,
    'Ø' || diametre AS designation,
    quantite_metres AS stock_actuel,
    seuil_alerte,
    updated_at
FROM stock_gaines
WHERE quantite_metres < seuil_alerte
ORDER BY stock_actuel ASC;

-- Vue: Statistiques par chantier
CREATE OR REPLACE VIEW v_stats_chantiers AS
SELECT 
    ch.id,
    ch.nom,
    cl.nom AS client,
    cl.id AS client_id,
    COUNT(ca.id) AS nb_calculs,
    MAX(ca.date_calcul) AS dernier_calcul,
    ch.statut,
    ch.date_debut,
    ch.date_fin_prevue
FROM chantiers ch
JOIN clients cl ON ch.id_client = cl.id
LEFT JOIN calculs ca ON ca.id_chantier = ch.id
GROUP BY ch.id, ch.nom, cl.nom, cl.id, ch.statut, ch.date_debut, ch.date_fin_prevue;

-- Vue: Suivi complet client-chantier (toutes les infos)
CREATE OR REPLACE VIEW v_suivi_client_chantier AS
SELECT 
    cl.id AS client_id,
    cl.nom AS client_nom,
    cl.actif AS client_actif,
    cl.contact_nom AS client_contact_nom,
    cl.contact_email AS client_contact_email,
    cl.contact_telephone AS client_contact_telephone,
    cl.responsable_compte,
    ch.id AS chantier_id,
    ch.nom AS chantier_nom,
    ch.adresse,
    ch.statut AS chantier_statut,
    ch.date_debut,
    ch.date_fin_prevue,
    ch.date_fin_reelle,
    ch.contact_nom AS chantier_contact_nom,
    ch.contact_email AS chantier_contact_email,
    ch.contact_telephone AS chantier_contact_telephone,
    ch.responsable_chantier,
    COALESCE(ch.prises_section, cl.prises_section) AS prises_section,
    COALESCE(ch.eclairage_section, cl.eclairage_section) AS eclairage_section,
    COALESCE(ch.gaines_disponibles, cl.gaines_disponibles) AS gaines_disponibles,
    COUNT(ca.id) AS nb_calculs,
    COALESCE(SUM(((ca.bon_de_coupe->'stats')->>'longueur_totale_fils')::numeric), 0) AS longueur_totale,
    MAX(ca.date_calcul) AS dernier_calcul
FROM clients cl
LEFT JOIN chantierS ch ON ch.id_client = cl.id
LEFT JOIN calculs ca ON ca.id_chantier = ch.id
GROUP BY cl.id, cl.nom, cl.actif, cl.contact_nom, cl.contact_email, cl.contact_telephone, cl.responsable_compte,
         ch.id, ch.nom, ch.adresse, ch.statut, ch.date_debut, ch.date_fin_prevue, ch.date_fin_reelle,
         ch.contact_nom, ch.contact_email, ch.contact_telephone, ch.responsable_chantier,
         ch.prises_section, ch.eclairage_section, ch.gaines_disponibles,
         cl.prises_section, cl.eclairage_section, cl.gaines_disponibles
ORDER BY cl.nom, ch.date_debut DESC;

-- ====================================================================
-- DONNÉES INITIALES
-- ====================================================================

-- Entreprise par défaut
INSERT INTO entreprises (nom, siret, adresse, telephone, email) VALUES
('Mon Entreprise', '12345678901234', '1 Rue de la Paix, 75001 Paris', '01 23 45 67 89', 'contact@monentreprise.fr');

-- Utilisateurs (password: admin123, dessinateur123, etc. - hash factice pour exemple)
INSERT INTO utilisateurs (id_entreprise, nom, prenom, email, password_hash, role) VALUES
(1, 'Admin', 'Système', 'admin@pieuvre.local', '$2b$10$abcdefghijklmnopqrstuv', 'admin'),
(1, 'Dupont', 'Jean', 'jean.dupont@pieuvre.local', '$2b$10$abcdefghijklmnopqrstuv', 'commercial'),
(1, 'Martin', 'Sophie', 'sophie.martin@pieuvre.local', '$2b$10$abcdefghijklmnopqrstuv', 'dessinateur'),
(1, 'Bernard', 'Pierre', 'pierre.bernard@pieuvre.local', '$2b$10$abcdefghijklmnopqrstuv', 'magasinier');

-- Clients exemple
INSERT INTO clients (nom, prises_section, eclairage_section, gaines_disponibles, particularites, preferences_etiquettes, memoire_ocr_active) VALUES
('BOUYGUES Immobilier', 2.5, 1.5, '[16, 20, 25, 32, 40, 50, 63]', 'Terre systématique en 2.5mm²', '{}', FALSE),
('VINCI Construction', 2.5, 1.5, '[20, 25, 32, 40, 50, 63]', 'Norme NF C 15-100 stricte', '{}', FALSE),
('EIFFAGE Aménagement', 2.5, 1.5, NULL, NULL, '{}', FALSE),
('Particuliers - Standard', 1.5, 1.5, '[16, 20, 25, 32]', 'Prises en 1.5mm² autorisées en rénovation', '{}', FALSE),
('DEMO - Mémoire OCR', 2.5, 1.5, '[16, 20, 25]', 'Client de démonstration pour la mémoire OCR', '{"mode_etiquetage":"machine","regroupement":{"ordre":["type","section","gaine"]}}', TRUE);

-- Stock couleurs standard (sections 1.5 et 2.5 mm²)
INSERT INTO stock_couleurs (couleur, section, quantite_metres, seuil_alerte, updated_by) VALUES
-- Section 1.5mm²
('Rouge', 1.5, 850, 100, 'INIT'),
('Bleu', 1.5, 1200, 100, 'INIT'),
('Vert/Jaune', 1.5, 600, 100, 'INIT'),
('Orange', 1.5, 180, 100, 'INIT'),
('Noir', 1.5, 450, 100, 'INIT'),
('Violet', 1.5, 250, 100, 'INIT'),
('Marron', 1.5, 320, 100, 'INIT'),

-- Section 2.5mm²
('Rouge', 2.5, 320, 100, 'INIT'),
('Bleu', 2.5, 720, 100, 'INIT'),
('Vert/Jaune', 2.5, 980, 100, 'INIT'),
('Orange', 2.5, 280, 100, 'INIT'),
('Noir', 2.5, 0, 100, 'INIT'),
('Violet', 2.5, 150, 100, 'INIT'),
('Marron', 2.5, 200, 100, 'INIT'),

-- Section 6mm² (plaques cuisson)
('Rouge', 6.0, 150, 50, 'INIT'),
('Bleu', 6.0, 150, 50, 'INIT'),
('Vert/Jaune', 6.0, 150, 50, 'INIT');

-- Stock gaines standard
INSERT INTO stock_gaines (diametre, quantite_metres, seuil_alerte, updated_by) VALUES
(16, 650, 50, 'INIT'),
(20, 820, 50, 'INIT'),
(25, 1100, 50, 'INIT'),
(32, 450, 50, 'INIT'),
(40, 200, 30, 'INIT'),
(50, 100, 30, 'INIT'),
(63, 50, 20, 'INIT');

-- Chantiers exemples
INSERT INTO chantiers (id_client, nom, adresse, statut, date_debut, preferences_etiquettes, memoire_ocr_active) VALUES
(1, 'Résidence Les Érables - Lot 23', '12 Avenue de la République, 95290 L''Isle-Adam', 'actif', '2026-03-01', '{}', FALSE),
(1, 'Résidence Les Érables - Lot 24', '14 Avenue de la République, 95290 L''Isle-Adam', 'actif', '2026-03-01', '{}', FALSE),
(2, 'Tour Horizon - R+12', '45 Boulevard Haussmann, 75008 Paris', 'actif', '2026-02-15', '{}', FALSE),
(3, 'Immeuble Pasteur', '78 Rue Pasteur, 92100 Boulogne-Billancourt', 'pause', '2026-01-10', '{}', FALSE),
(5, 'Démo Mémoire - Appartement T3', '1 Rue de la Démo, 75000 Paris', 'actif', '2026-06-01', '{"mode_etiquetage":"atelier","regroupement":{"ordre":["logement","boite"]}}', TRUE);

-- Fonction pour ajouter une note à un chantier
CREATE OR REPLACE FUNCTION ajouter_note_chantier(
    p_chantier_id INTEGER,
    p_texte TEXT,
    p_auteur VARCHAR(255),
    p_type VARCHAR(50) DEFAULT 'info'
)
RETURNS VOID AS $$
BEGIN
    UPDATE chantierS 
    SET notes = COALESCE(notes, '[]'::jsonb) || 
        jsonb_build_object(
            'date', NOW(),
            'auteur', p_auteur,
            'texte', p_texte,
            'type', p_type
        )::jsonb
    WHERE id = p_chantier_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour ajouter une note à un client
CREATE OR REPLACE FUNCTION ajouter_note_client(
    p_client_id INTEGER,
    p_texte TEXT,
    p_auteur VARCHAR(255),
    p_type VARCHAR(50) DEFAULT 'info'
)
RETURNS VOID AS $$
BEGIN
    UPDATE clients 
    SET notes = COALESCE(notes, '[]'::jsonb) || 
        jsonb_build_object(
            'date', NOW(),
            'auteur', p_auteur,
            'texte', p_texte,
            'type', p_type
        )::jsonb
    WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour récupérer le profil complet d'un chantier
CREATE OR REPLACE FUNCTION get_chantier_profil(p_chantier_id INTEGER)
RETURNS TABLE (
    chantier_nom VARCHAR,
    client_nom VARCHAR,
    prises_section DECIMAL,
    eclairage_section DECIMAL,
    volets_section DECIMAL,
    cuisson_section DECIMAL,
    couleurs_preferees JSONB,
    gaines_disponibles JSONB,
    type_support VARCHAR,
    hauteur_plafond_m DECIMAL,
    hauteur_prise_m DECIMAL,
    hauteur_interrupteur_m DECIMAL,
    besoin_pots BOOLEAN,
    types_pots JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.nom,
        cl.nom,
        COALESCE(c.prises_section, cl.prises_section),
        COALESCE(c.eclairage_section, cl.eclairage_section),
        COALESCE(c.volets_section, cl.volets_section),
        COALESCE(c.cuisson_section, cl.cuisson_section),
        cl.couleurs_preferees,
        COALESCE(c.gaines_disponibles, cl.gaines_disponibles),
        c.type_support,
        c.hauteur_plafond_m,
        c.hauteur_prise_m,
        c.hauteur_interrupteur_m,
        c.besoin_pots,
        c.types_pots
    FROM chantiers c
    JOIN clients cl ON c.id_client = cl.id
    WHERE c.id = p_chantier_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier disponibilité stock
CREATE OR REPLACE FUNCTION check_stock_disponible(
    p_couleur VARCHAR,
    p_section DECIMAL,
    p_longueur_requise INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_stock_actuel INTEGER;
BEGIN
    SELECT quantite_metres INTO v_stock_actuel
    FROM stock_couleurs
    WHERE couleur = p_couleur AND section = p_section;
    
    IF v_stock_actuel IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN v_stock_actuel >= p_longueur_requise;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- TABLE: MODELES_SYMBOLES
-- Bibliotheque de symboles graphiques pour plans
-- ====================================================================
CREATE TABLE modeles_symboles (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    type_element VARCHAR(30),
    categorie VARCHAR(30),
    svg_content TEXT,
    unicode_char VARCHAR(10),
    couleur VARCHAR(20),
    taille_mm DECIMAL(6,2),
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Symboles par defaut (NF P 96-105)
INSERT INTO modeles_symboles (nom, code, description, type_element, categorie, unicode_char, couleur, taille_mm) VALUES
-- Prises
('Prise 16A', 'P', 'Prise de courant 16A', 'prise', 'prise', '○', '#000000', 5),
('Prise 16A ronde', 'P_ROND', 'Prise de courant 16A cercle', 'prise', 'prise', '⬤', '#000000', 5),
('Prise 20A', 'P20', 'Prise de courant 20A', 'prise', 'prise', '●', '#000000', 5),
('Prise etanche', 'P_ETANCHE', 'Prise etanche', 'prise', 'prise', '⊗', '#000000', 5),
('Prise PMR', 'P_PMR', 'Prise PMR', 'prise', 'prise', '◎', '#0066FF', 5),
-- Lumieres
('Point lumineux', 'L', 'Point lumineux', 'lumiere', 'lumiere', '⬤', '#000000', 5),
('Luminaire', 'LUM', 'Luminaire', 'lumiere', 'lumiere', '⬢', '#000000', 8),
('Luminaire encastre', 'L_ENC', 'Luminaire encastre', 'lumiere', 'lumiere', '□', '#000000', 6),
-- Interrupteurs
('Interrupteur', 'I', 'Interrupteur', 'interrupteur', 'commande', '├', '#000000', 5),
('Interrupteur va-et-vient', 'VD', 'Va-et-vient', 'interrupteur', 'commande', '└', '#000000', 5),
('Double allumage', 'DA', 'Double allumage', 'interrupteur', 'commande', '├├', '#000000', 5),
('Telerrupteur', 'TEL', 'Telerrupteur', 'interrupteur', 'commande', '⊡', '#000000', 5),
-- Prises communication
('Prise RJ45', 'RJ45', 'Prise reseau', 'communication', 'reseau', '◇', '#0000FF', 5),
('Prise telephone', 'TEL_RJ', 'Prise telephone', 'communication', 'reseau', '◇', '#0000FF', 5),
('Prise TV', 'TV', 'Prise antenne TV', 'communication', 'reseau', '◎', '#0000FF', 5),
-- Securite
('Detecteur incendie', 'DI', 'Detecteur incendie', 'securite', 'securite', '⊕', '#FF0000', 6),
('Bloc secours BS', 'BS', 'Bloc secours', 'securite', 'securite', '⊞', '#FF0000', 8),
('Sirene', 'SIR', 'Sirene', 'securite', 'securite', '⊠', '#FF0000', 6),
-- Ventilation
('VMC', 'VMC', 'VMC', 'ventilation', 'ventilation', '⊓', '#00AA00', 8),
('Grille VMC', 'VMC_GRILLE', 'Grille VMC', 'ventilation', 'ventilation', '▤', '#00AA00', 6),
-- Appareils
('Cuisiniere', 'CUIS', 'Cuisiniere', 'appareil', 'cuisine', '⊞', '#FF6600', 10),
('Lave-linge', 'LL', 'Lave-linge', 'appareil', 'cuisine', '⊟', '#FF6600', 8),
('Lave-vaisselle', 'LV', 'Lave-vaisselle', 'appareil', 'cuisine', '⊟', '#FF6600', 8),
-- Exterieur
('Prise exterieur', 'PG', 'Prise exterieur', 'exterieur', 'exterieur', '◇', '#00AA00', 5),
('Projecteur', 'PROJ', 'Projecteur exterieur', 'exterieur', 'exterieur', '○', '#FFCC00', 8);

-- ====================================================================
-- TABLE: CLIENT_SYMBOLES
-- Mapping client -> modeles de symboles
-- ====================================================================
CREATE TABLE client_symboles (
    id SERIAL PRIMARY KEY,
    id_client INT REFERENCES clients(id),
    id_modele_symboles INT REFERENCES modeles_symboles(id),
    client_code VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(id_client, id_modele_symboles)
);

-- ====================================================================
-- TABLE: SCANS
-- Historique des scans de plans
-- ====================================================================
CREATE TABLE scans (
    id SERIAL PRIMARY KEY,
    id_chantier INT REFERENCES chantiers(id),
    id_client INT REFERENCES clients(id),
    nom_fichier VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255),
    type_fichier VARCHAR(20) NOT NULL,
    taille_fichier BIGINT,
    hash_fichier VARCHAR(64),
    methode_scan VARCHAR(20) DEFAULT 'local',
    statut VARCHAR(20) DEFAULT 'en_attente',
    nb_elements_detectes INT,
    nb_circuits_genérés INT,
    erreurs TEXT,
    scanned_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- ====================================================================
-- TABLE: SCAN_ELEMENTS
-- Elements detectes lors du scan
-- ====================================================================
CREATE TABLE scan_elements (
    id SERIAL PRIMARY KEY,
    id_scan INT REFERENCES scans(id),
    type_element VARCHAR(30) NOT NULL,
    code_symbol VARCHAR(20),
    position_x DECIMAL(10,2),
    position_y DECIMAL(10,2),
    label TEXT,
    confiance REAL,
    source_detection VARCHAR(20),
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================================================
-- TABLE: SCAN_CIRCUITS
-- Circuits generes depuis un scan
-- ====================================================================
CREATE TABLE scan_circuits (
    id SERIAL PRIMARY KEY,
    id_scan INT REFERENCES scans(id),
    code_circuit VARCHAR(50),
    type_element VARCHAR(30),
    nombre_elements INT,
    positions JSONB,
    circuit JSONB,
    imported BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================================================
-- FIN DU SCHÉMA
-- ====================================================================

-- ====================================================================
-- DONNÉES INITIALES - RAG
-- Documents de référence sans embeddings (à vectoriser via /api/rag/seed)
-- ====================================================================
INSERT INTO normes_documents (titre, source, description, type_document) VALUES
('NF C 15-100 - Sections et protection des circuits', 'NF C 15-100', 'Règles de section des conducteurs et protection des circuits électriques domestiques et tertiaires', 'norme'),
('NF C 15-100 - Nombre de prises par circuit', 'NF C 15-100', 'Limitation du nombre de points d''utilisation par circuit de prises de courant', 'norme'),
('Guide Pieuvre - Choix des gaines', 'Pieuvre Auto', 'Recommandations métier pour le choix des diamètres de gaines selon le nombre et la section des conducteurs', 'guide');

INSERT INTO normes_chunks (id_document, contenu, chunk_index, metadata) VALUES
(1, 'Les circuits de prises de courant doivent être protégés par des disjoncteurs de 16 A ou 20 A selon la section des conducteurs. En section 1,5 mm², le disjoncteur est limité à 16 A. En section 2,5 mm², le disjoncteur peut être de 20 A.', 0, '{"theme": "section_prises", "mots_cles": ["prises", "section", "disjoncteur"]}'),
(1, 'Les circuits d''éclairage sont réalisés en conducteurs de 1,5 mm² minimum et protégés par un disjoncteur de 16 A maximum.', 1, '{"theme": "section_eclairage", "mots_cles": ["eclairage", "lumiere", "1.5"]}'),
(1, 'Les circuits de commande de volets roulants utilisent des conducteurs de 1,5 mm². Ils comportent une phase, un neutre, une terre et deux navettes pour la commande montée/descente.', 2, '{"theme": "section_volets", "mots_cles": ["volet", "vr", "navettes"]}'),
(1, 'Les circuits alimentant les plaques de cuisson et cuisinières électriques sont réalisés en conducteurs de 6 mm² minimum, protégés par un disjoncteur adapté à la puissance (32 A à 40 A).', 3, '{"theme": "section_cuisson", "mots_cles": ["cuisson", "cuisiniere", "6"]}'),
(2, 'Un circuit de prises de courant ne doit pas alimenter plus de 8 prises en logement. Au-delà, il faut prévoir un circuit supplémentaire.', 0, '{"theme": "max_prises", "mots_cles": ["prises", "maximum", "8"]}'),
(2, 'Les prises de courant doivent être réparties de manière à limiter la longueur des circuits et à faciliter l''identification des départs au tableau.', 1, '{"theme": "repartition_prises", "mots_cles": ["prises", "repartition", "tableau"]}'),
(3, 'Le taux de remplissage des gaines est limité à 40 % de leur section intérieure. Pour un circuit standard 3G2,5 (3 conducteurs 2,5 mm²), une gaine Ø16 est suffisante. Pour 5G1,5 ou plus, privilégier une gaine Ø20 ou Ø25.', 0, '{"theme": "gaine_standard", "mots_cles": ["gaine", "diametre", "remplissage"]}'),
(3, 'Les circuits de communication (RJ45) et les circuits de sécurité incendie doivent être posés dans des gaines dédiées et identifiées.', 1, '{"theme": "gaine_speciale", "mots_cles": ["gaine", "communication", "securite"]}');

-- Afficher un résumé de la base créée
DO $$
BEGIN
    RAISE NOTICE '====================================================';
    RAISE NOTICE 'Base de données PIEUVRE AUTO créée avec succès !';
    RAISE NOTICE '====================================================';
    RAISE NOTICE 'Clients créés: %', (SELECT COUNT(*) FROM clients);
    RAISE NOTICE 'Chantiers créés: %', (SELECT COUNT(*) FROM chantiers);
    RAISE NOTICE 'Couleurs en stock: %', (SELECT COUNT(*) FROM stock_couleurs);
    RAISE NOTICE 'Gaines en stock: %', (SELECT COUNT(*) FROM stock_gaines);
    RAISE NOTICE 'Documents RAG créés: %', (SELECT COUNT(*) FROM normes_documents);
    RAISE NOTICE 'Chunks RAG créés: %', (SELECT COUNT(*) FROM normes_chunks);
    RAISE NOTICE '====================================================';
END $$;
