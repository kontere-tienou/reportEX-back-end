-- ========================================
-- INIT.SQL - Création des tables de départements
-- ========================================

-- Table commune exemple
-- Chaque table a id (UUID), date, user_id, created_at, updated_at

-- ================== IMPRESSION ==================
CREATE TABLE IF NOT EXISTS impression_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    effectif INTEGER NOT NULL,
    production_1er_choix INTEGER NOT NULL,
    production_2eme_choix INTEGER NOT NULL,
    production_3eme_choix INTEGER NOT NULL,
    chiffon_kg NUMERIC(10,2) NOT NULL,
    metres_imprimes NUMERIC(10,2) NOT NULL,
    remarques TEXT,
    tondeuse NUMERIC(10,2),
    caustic NUMERIC(10,2),
    blanch NUMERIC(10,2),
    laveuse_1 NUMERIC(10,2),
    rotative_1 NUMERIC(10,2),
    vapo NUMERIC(10,2),
    rame_1 NUMERIC(10,2),
    pliseuse_calandre NUMERIC(10,2),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== CONFECTION ==================
CREATE TABLE IF NOT EXISTS confection_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    effectif_couturieres INTEGER NOT NULL,
    effectif_coupeurs INTEGER NOT NULL,
    objectif_global INTEGER NOT NULL,
    qte_realisee INTEGER NOT NULL,
    taux_qualite NUMERIC(5,2) NOT NULL,
    taux_non_qualite NUMERIC(5,2) NOT NULL,
    dechet_kg NUMERIC(10,2) NOT NULL,
    taux_absenteisme NUMERIC(5,2) NOT NULL,
    articles_produits TEXT,
    commandes_clients TEXT,
    commentaires TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== TEINTURE ==================
CREATE TABLE IF NOT EXISTS teinture_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    effectif INTEGER NOT NULL,
    produit_fabrique TEXT NOT NULL,
    objectif_paquet INTEGER NOT NULL,
    qte_realisee INTEGER NOT NULL,
    statut_production TEXT NOT NULL,
    poids_theorique NUMERIC(10,3) NOT NULL,
    performance NUMERIC(5,2) NOT NULL,
    taux_qualite NUMERIC(5,2) NOT NULL,
    taux_non_conformite NUMERIC(5,2) NOT NULL,
    taux_absenteisme NUMERIC(5,2) NOT NULL,
    dechet_m3 NUMERIC(10,2) NOT NULL,
    temps_travaille NUMERIC(5,2) NOT NULL,
    qte_emballe NUMERIC(10,2),
    pannes_incidents TEXT,
    remarques TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== PRODUCTION ==================
CREATE TABLE IF NOT EXISTS production_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    effectif_total INTEGER NOT NULL,
    objectif_journalier INTEGER NOT NULL,
    production_realisee INTEGER NOT NULL,
    taux_rendement NUMERIC(5,2) NOT NULL,
    heures_travaillees NUMERIC(5,2) NOT NULL,
    heures_arret NUMERIC(5,2) NOT NULL,
    taux_disponibilite NUMERIC(5,2) NOT NULL,
    rebuts_kg NUMERIC(10,2) NOT NULL,
    incidents_production TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== IT ==================
CREATE TABLE IF NOT EXISTS it_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    nb_incidents_ouverts INTEGER NOT NULL,
    nb_incidents_resolus INTEGER NOT NULL,
    nb_incidents_en_cours INTEGER NOT NULL,
    temps_resolution_moyen NUMERIC(5,2) NOT NULL,
    taux_disponibilite_systeme NUMERIC(5,2) NOT NULL,
    nb_demandes_assistance INTEGER NOT NULL,
    taux_satisfaction_utilisateurs NUMERIC(5,2) NOT NULL,
    maintenance_preventive_effectuee INTEGER,
    incidents_critiques TEXT,
    observations TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== RH ==================
CREATE TABLE IF NOT EXISTS rh_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    effectif_total INTEGER NOT NULL,
    nb_presents INTEGER NOT NULL,
    nb_absents INTEGER NOT NULL,
    taux_absenteisme NUMERIC(5,2) NOT NULL,
    nb_conges INTEGER NOT NULL,
    nb_arrets_maladie INTEGER NOT NULL,
    nb_recrutements INTEGER,
    nb_departs INTEGER,
    nb_formations INTEGER,
    heures_supplementaires NUMERIC(5,2),
    incidents_rh TEXT,
    observations TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== ACHATS ==================
CREATE TABLE IF NOT EXISTS achat_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    nb_commandes_passees INTEGER NOT NULL,
    nb_commandes_recues INTEGER NOT NULL,
    nb_commandes_en_attente INTEGER NOT NULL,
    montant_achats_jour NUMERIC(12,2) NOT NULL,
    nb_fournisseurs_contactes INTEGER NOT NULL,
    delai_moyen_livraison NUMERIC(5,2) NOT NULL,
    taux_conformite_livraisons NUMERIC(5,2) NOT NULL,
    nb_litiges INTEGER,
    economies_realisees NUMERIC(12,2),
    fournisseurs_evalues TEXT,
    observations TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== BUREAU ETUDE ==================
CREATE TABLE IF NOT EXISTS bureau_etude_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    nb_projets_en_cours INTEGER NOT NULL,
    nb_projets_termines INTEGER NOT NULL,
    nb_etudes_lancees INTEGER NOT NULL,
    nb_prototypes_realises INTEGER NOT NULL,
    nb_modifications_demandees INTEGER NOT NULL,
    taux_validation_prototypes NUMERIC(5,2) NOT NULL,
    heures_etude NUMERIC(5,2) NOT NULL,
    delai_moyen_etude NUMERIC(5,2) NOT NULL,
    projets_details TEXT,
    observations TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== COMMERCIAL ==================
CREATE TABLE IF NOT EXISTS commercial_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    nb_visites_clients INTEGER NOT NULL,
    nb_devis_emis INTEGER NOT NULL,
    nb_commandes_recues INTEGER NOT NULL,
    ca_journalier NUMERIC(12,2) NOT NULL,
    taux_transformation_devis NUMERIC(5,2) NOT NULL,
    nb_nouveaux_clients INTEGER NOT NULL,
    nb_clients_perdus INTEGER,
    nb_reclamations INTEGER,
    taux_satisfaction_clients NUMERIC(5,2) NOT NULL,
    actions_commerciales TEXT,
    observations TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== COMPTABILITE ==================
CREATE TABLE IF NOT EXISTS comptabilite_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    ca NUMERIC(12,2) NOT NULL,
    commandes INTEGER NOT NULL,
    caisse_entrees NUMERIC(12,2) NOT NULL,
    caisse_sorties NUMERIC(12,2) NOT NULL,
    solde_caisse NUMERIC(12,2) NOT NULL,
    observations TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ================== DG ==================
CREATE TABLE IF NOT EXISTS dg_data (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    user_id UUID NOT NULL,
    indicateur_1 NUMERIC(12,2),
    indicateur_2 NUMERIC(12,2),
    indicateur_3 NUMERIC(12,2),
    observations TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- ========================================
-- Fin du script d'initialisation
-- ========================================
DO $$
BEGIN
    RAISE NOTICE 'Table impression_data: % lignes', (SELECT COUNT(*) FROM impression_data);
    RAISE NOTICE 'Table confection_data: % lignes', (SELECT COUNT(*) FROM confection_data);
    RAISE NOTICE 'Table teinture_data: % lignes', (SELECT COUNT(*) FROM teinture_data);
    RAISE NOTICE 'Table production_data: % lignes', (SELECT COUNT(*) FROM production_data);
    RAISE NOTICE 'Table it_data: % lignes', (SELECT COUNT(*) FROM it_data);
    RAISE NOTICE 'Table rh_data: % lignes', (SELECT COUNT(*) FROM rh_data);
    RAISE NOTICE 'Table achat_data: % lignes', (SELECT COUNT(*) FROM achat_data);
    RAISE NOTICE 'Table bureau_etude_data: % lignes', (SELECT COUNT(*) FROM bureau_etude_data);
    RAISE NOTICE 'Table commercial_data: % lignes', (SELECT COUNT(*) FROM commercial_data);
    RAISE NOTICE 'Table comptabilite_data: % lignes', (SELECT COUNT(*) FROM comptabilite_data);
    RAISE NOTICE 'Table dg_data: % lignes', (SELECT COUNT(*) FROM dg_data);
END $$;