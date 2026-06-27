# Supports d'installation et hauteurs - Règles de calcul

## Types de support au plafond

### Planchette / Faux-plafond

- On peut passer les gaines dans le vide sanitaire / faux-plafond.
- Les fils descendent du plafond jusqu'à l'appareil.
- Possibilité de mutualiser les gaines.
- Moins de saignées, moins de boîtes de dérivation.
- Matériel spécifique : manchons annulaires pour l'étanchéité au feu / phonique.

### Dalle plein

- Impossible de passer dans le plafond (béton plein).
- Les gaines descendent par les murs depuis le tableau ou les gaines verticales.
- Nécessite plus de fils et de gaines (pas de passage direct).
- Nécessite des boîtes de dérivation supplémentaires.
- Plus de saignées à prévoir.

### Mixte

- Certaines zones en dalle plein, d'autres en planchette.
- Le calcul s'adapte zone par zone si l'information est fournie.
- Par défaut, on applique la règle la plus restrictive (dalle plein).

## Hauteur des appareils (valeurs par défaut)

| Appareil | Hauteur par défaut | Remarque |
|---|---|---|
| Prise de courant | 0,30 m du sol | Peut varier selon usage ( cuisine, salle de bains) |
| Interrupteur | 1,10 m du sol | NF C 15-100 recommande entre 0,90 m et 1,30 m |
| Point lumineux | 0 m (au plafond) | Pas de descente depuis le plafond |
| Luminaire | 0 m (au plafond) | Pas de descente depuis le plafond |
| VMC | 0 m (au plafond) | Souvent au plafond ou en haut de mur |
| Bloc secours | 2,00 m du sol | Hauteur de sécurité |
| Cuisinière | 0,50 m du sol | Prise dédiée, hauteur selon installation |
| Lave-linge / lave-vaisselle | 0,30 m du sol | Prise dédiée |
| Prise extérieure | 0,30 m du sol | Étanche, IP minimum selon volume |

## Calcul de la descente de fils

La longueur de descente depuis le plafond jusqu'à l'appareil se calcule ainsi :

```
descente = hauteur_plafond_m - hauteur_appareil
```

Si l'appareil est au plafond (point lumineux, VMC, luminaire), la descente est nulle.

### Exemples

- Prise dans une pièce de 2,50 m de hauteur : `2,50 - 0,30 = 2,20 m` de descente par fil.
- Interrupteur dans une pièce de 2,70 m de hauteur : `2,70 - 1,10 = 1,60 m` de descente par fil.
- Point lumineux : `0 m` de descente.

## Impact sur la longueur totale des fils

La longueur totale d'un circuit est :

```
longueur_totale = longueur_horizontale + (descente * nombre_de_points)
```

Chaque conducteur du circuit (phase, neutre, terre, navettes) parcourt cette longueur totale.

## Pots et boîtiers nécessaires

### En planchette / faux-plafond

- 1 boîte d'encastrement par point d'appareil.
- Manchons annulaires si passage à travers la planchette (étanchéité, feu).

### En dalle plein

- 1 boîte d'encastrement par point d'appareil.
- 1 boîte de dérivation par circuit (impossible de mutualiser dans le plafond).
- Plus de gaines et de fils car tout passe par les murs.

### Types de pots courants

| Type | Usage |
|---|---|
| Boîte d'encastrement | Accueillir prise, interrupteur, appareil |
| Boîte de dérivation | Raccordement de fils sans appareil |
| Boîte de connexion | Dérivation étanche ou pour gros sections |
| Manchon annulaire | Protection de passage dans planchette |
| Pot de centre | Boîte pour luminaire encastré |

## Règles de déduction automatique

Lorsqu'un plan est analysé (OCR ou vision), le système doit :

1. Détecter chaque dispositif et son type.
2. Déterminer la hauteur d'installation selon le type.
3. Calculer la descente depuis le plafond.
4. Multiplier par le nombre de points sur le circuit.
5. Ajouter le matériel spécifique selon le type de support (pots, manchons, boîtes de dérivation).
6. Vérifier le stock de fils, gaines et pots.

## Références

- NF C 15-100 : hauteurs d'installation des appareils.
- Promotelec : guides d'application selon type de construction.
