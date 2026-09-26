/* Carnet Lean Bulk — données statiques (aliments, menus, prix, programme).
   Les données personnelles (pesées, photos, cases cochées, prix corrigés) ne sont
   jamais dans ce fichier : elles restent sur l'iPhone. */

window.CLB_DATA = (function () {
  "use strict";

  /* Aliment : nom FR, nom ES, rayon, kcal/P/G/L pour 100 g (ou 100 ml),
     poids d'une pièce (g) ou 0, liquide (true/false) */
  var FOOD = {
    avoine:   { fr: "Flocons d'avoine", es: "copos de avena", rayon: "Féculents", n: [372, 13.5, 58.7, 7] },
    riz:      { fr: "Riz", es: "arroz", rayon: "Féculents", n: [355, 7, 78, 0.7] },
    pates:    { fr: "Pâtes", es: "pasta (macarrones)", rayon: "Féculents", n: [355, 12.5, 71, 1.5] },
    pdt:      { fr: "Pommes de terre", es: "patatas", rayon: "Féculents", n: [80, 2, 17, 0.1] },
    pain:     { fr: "Pain complet de mie", es: "pan de molde integral", rayon: "Féculents", n: [245, 9, 41, 3.5] },
    poulet:   { fr: "Blanc de poulet", es: "pechuga de pollo fileteada", rayon: "Protéines", n: [110, 23, 0, 1.8] },
    dinde:    { fr: "Escalopes de dinde", es: "filetes de pechuga de pavo", rayon: "Protéines", n: [107, 24, 0, 1.2] },
    hache:    { fr: "Bœuf haché 5 %", es: "ternera magra picada (carnicería)", rayon: "Protéines", n: [125, 21, 0, 5] },
    thon:     { fr: "Thon au naturel (égoutté)", es: "atún al natural", rayon: "Protéines", n: [115, 26, 0, 1] },
    oeuf:     { fr: "Œufs", es: "huevos", rayon: "Protéines", n: [140, 12.5, 0.7, 9.6], piece: 55 },
    skyr:     { fr: "Skyr nature", es: "skyr natural", rayon: "Laitiers", n: [60, 10.5, 4, 0.2] },
    fblanc:   { fr: "Fromage blanc 0 %", es: "queso fresco batido 0 %", rayon: "Laitiers", n: [47, 7.5, 4, 0.2] },
    yaourt:   { fr: "Yaourt nature", es: "yogur natural", rayon: "Laitiers", n: [60, 4, 5, 3], piece: 125 },
    lait:     { fr: "Lait demi-écrémé", es: "leche semidesnatada", rayon: "Laitiers", n: [46, 3.3, 4.8, 1.6], liquid: true },
    emmental: { fr: "Emmental râpé", es: "queso rallado emmental", rayon: "Laitiers", n: [380, 28, 0, 30] },
    hverts:   { fr: "Haricots verts surgelés", es: "judías verdes congeladas", rayon: "Légumes", n: [30, 2, 4, 0.2] },
    brocoli:  { fr: "Brocolis surgelés", es: "brócoli congelado", rayon: "Légumes", n: [34, 3, 3, 0.4] },
    poivrons: { fr: "Poivrons en lanières surgelés", es: "pimientos en tiras congelados", rayon: "Légumes", n: [30, 1.2, 5, 0.3] },
    poelee:   { fr: "Poêlée de légumes surgelée", es: "salteado / juliana de verduras congelado", rayon: "Légumes", n: [40, 2, 6, 0.8] },
    epinards: { fr: "Épinards surgelés", es: "espinacas congeladas", rayon: "Légumes", n: [25, 3, 1, 0.4] },
    carottes: { fr: "Carottes", es: "zanahorias", rayon: "Légumes", n: [36, 0.8, 7, 0.2] },
    passata:  { fr: "Tomate concassée / passata", es: "tomate triturado", rayon: "Légumes", n: [35, 1.5, 6, 0.2] },
    hrouges:  { fr: "Haricots rouges (égouttés)", es: "alubias rojas cocidas", rayon: "Légumes", n: [110, 8, 15, 0.5] },
    banane:   { fr: "Bananes", es: "plátanos / bananas", rayon: "Fruits & oléagineux", n: [90, 1.1, 20, 0.3], piece: 120 },
    pomme:    { fr: "Pommes", es: "manzanas", rayon: "Fruits & oléagineux", n: [52, 0.3, 12, 0.2], piece: 150 },
    clem:     { fr: "Clémentines", es: "mandarinas", rayon: "Fruits & oléagineux", n: [47, 0.9, 11, 0.3], piece: 75 },
    amandes:  { fr: "Amandes nature", es: "almendras crudas", rayon: "Fruits & oléagineux", n: [600, 22, 7, 52] },
    noix:     { fr: "Cerneaux de noix", es: "nueces mondadas", rayon: "Fruits & oléagineux", n: [690, 15, 7, 65] },
    pb:       { fr: "Beurre de cacahuète 100 %", es: "crema de cacahuete 100 %", rayon: "Fruits & oléagineux", n: [610, 25, 12, 50] },
    huile:    { fr: "Huile d'olive", es: "aceite de oliva virgen extra", rayon: "Placard", n: [900, 0, 0, 100], liquid: true },
    soja:     { fr: "Sauce soja", es: "salsa de soja", rayon: "Placard", n: [60, 8, 6, 0], liquid: true },
    miel:     { fr: "Miel", es: "miel", rayon: "Placard", n: [320, 0, 80, 0] }
  };

  /* Prix au kg (ou au litre ; à l'unité pour les œufs).
     a = Alcampo Irun (relevé en ligne le 26/09/2026, marque distributeur la moins chère)
     l = Lidl France (estimation : Lidl France ne publie pas ses prix en ligne)
     ae = true si le prix Alcampo est lui aussi estimé */
  var PRICES_DATE = "26/09/2026";
  var PRICES = {
    avoine:   { a: 1.52, l: 1.70, unit: "kg" },
    riz:      { a: 1.05, l: 1.49, unit: "kg" },
    pates:    { a: 1.09, l: 1.19, unit: "kg" },
    pdt:      { a: 0.99, l: 1.00, unit: "kg" },
    pain:     { a: 1.96, l: 2.58, unit: "kg" },
    poulet:   { a: 7.07, l: 9.49, unit: "kg" },
    dinde:    { a: 8.99, l: 9.99, unit: "kg" },
    hache:    { a: 11.50, l: 10.98, unit: "kg", ae: true },
    thon:     { a: 11.08, l: 14.00, unit: "kg" },
    oeuf:     { a: 0.22, l: 0.24, unit: "pièce" },
    skyr:     { a: 5.00, l: 3.30, unit: "kg" },
    fblanc:   { a: 2.74, l: 1.79, unit: "kg" },
    yaourt:   { a: 1.50, l: 1.09, unit: "kg" },
    lait:     { a: 0.83, l: 0.99, unit: "L" },
    emmental: { a: 10.95, l: 8.95, unit: "kg" },
    hverts:   { a: 1.44, l: 1.89, unit: "kg" },
    brocoli:  { a: 1.69, l: 2.19, unit: "kg" },
    poivrons: { a: 8.15, l: 3.05, unit: "kg" },
    poelee:   { a: 3.39, l: 3.32, unit: "kg" },
    epinards: { a: 1.69, l: 1.69, unit: "kg" },
    carottes: { a: 1.00, l: 1.19, unit: "kg" },
    passata:  { a: 1.15, l: 1.27, unit: "kg" },
    hrouges:  { a: 5.48, l: 2.90, unit: "kg" },
    banane:   { a: 1.47, l: 1.69, unit: "kg" },
    pomme:    { a: 1.79, l: 2.00, unit: "kg", ae: true },
    clem:     { a: 1.99, l: 2.49, unit: "kg", ae: true },
    amandes:  { a: 11.53, l: 13.45, unit: "kg" },
    noix:     { a: 11.93, l: 16.45, unit: "kg" },
    pb:       { a: 5.30, l: 6.54, unit: "kg" },
    huile:    { a: 4.69, l: 7.99, unit: "L" },
    soja:     { a: 8.60, l: 7.93, unit: "L", ae: true },
    miel:     { a: 6.98, l: 7.98, unit: "kg", ae: true }
  };

  var SPICES = [
    ["Paprika / pimentón", "pimentón"], ["Ail en poudre", "ajo en polvo"],
    ["Herbes de Provence, origan", "hierbas provenzales, orégano"], ["Cumin", "comino"],
    ["Curry ou garam masala", "curry"], ["Cannelle", "canela"], ["Sel, poivre", "sal, pimienta"]
  ];

  var RNAME = { banane: "Banane", pomme: "Pomme", clem: "Clémentines", pain: "Pain complet", yaourt: "Yaourt nature",
    hrouges: "Haricots rouges", thon: "Thon au naturel", poivrons: "Poivrons surgelés", hache: "Bœuf haché 5 %" };

  var MOMENTS = ["Petit-déjeuner", "Midi · gamelle", "Collation", "Soir · gamelle"];
  var MOMENT_SHORT = ["Petit-déj", "Midi", "Collation", "Soir"];

  /* Ingrédient : [clé, grammes, libellé affiché] */
  var MENUS = [
    { n: 1, t: "Classique", note: "La base : poulet-riz le midi, bolo le soir. Simple à répéter, facile à peser.", meals: [
      { name: "Porridge banane & œufs brouillés", ing: [["avoine", 100, "100 g"], ["lait", 300, "300 ml"], ["banane", 120, "1"], ["oeuf", 110, "2"]],
        steps: ["Verse l'avoine et le lait dans une casserole, cuis 3-4 min à feu moyen en remuant (ou 2 min au micro-ondes, en 2 fois).", "Coupe la banane en rondelles par-dessus.", "Brouille les 2 œufs à la poêle antiadhésive, sel et poivre."] },
      { name: "Poulet paprika, riz & haricots verts", ing: [["riz", 120, "120 g cru"], ["poulet", 200, "200 g"], ["hverts", 150, "150 g"], ["huile", 10, "1 c. à s."]],
        steps: ["Cuis le riz 11-12 min dans l'eau salée, égoutte.", "Coupe le poulet en dés et saisis-le 6-8 min à feu vif dans l'huile avec 1 c. à c. de paprika, ail en poudre, sel.", "Ajoute les haricots verts surgelés dans la poêle 6-8 min, ou passe-les au micro-ondes.", "Répartis en gamelles : riz, poulet, légumes."],
        batch: "Pour 3 gamelles : 360 g de riz, 600 g de poulet, 450 g de haricots." },
      { name: "Skyr, amandes & pomme", ing: [["skyr", 250, "250 g"], ["amandes", 30, "30 g"], ["pomme", 150, "1"]],
        steps: ["Tout se mange tel quel. Coupe la pomme dans le skyr si tu préfères en bol."] },
      { name: "Pâtes bolognaise express & brocolis", ing: [["pates", 125, "125 g crues"], ["hache", 150, "150 g"], ["passata", 150, "150 g"], ["brocoli", 150, "150 g"], ["emmental", 20, "20 g"]],
        steps: ["Fais dorer le haché 5 min à la poêle sans matière grasse, en l'émiettant.", "Ajoute la passata, 1 c. à c. d'herbes de Provence, sel, poivre, et laisse mijoter 10 min.", "Cuis les pâtes al dente, et les brocolis 6 min au micro-ondes avec un fond d'eau.", "Mélange pâtes et sauce, brocolis à côté, emmental dessus."],
        batch: "Pour 3 gamelles : 375 g de pâtes, 450 g de haché, 450 g de passata." }] },
    { n: 2, t: "Tex-Mex", note: "Overnight oats à préparer la veille, pâtes au thon et chili con carne.", meals: [
      { name: "Overnight oats skyr & miel", ing: [["avoine", 90, "90 g"], ["lait", 250, "250 ml"], ["skyr", 150, "150 g"], ["miel", 10, "1 c. à c."], ["banane", 120, "1"]],
        steps: ["La veille, mélange l'avoine, le lait, le skyr et le miel dans une boîte fermée.", "Laisse une nuit au frigo.", "Le matin, ajoute la banane en rondelles. Ça se mange froid."],
        batch: "Tu peux en préparer 3 boîtes d'un coup, elles tiennent 3 jours." },
      { name: "Pâtes thon, tomate & poivrons", ing: [["pates", 120, "120 g crues"], ["thon", 140, "140 g égoutté"], ["passata", 150, "150 g"], ["poivrons", 150, "150 g"], ["huile", 10, "1 c. à s."]],
        steps: ["Cuis les pâtes al dente.", "Dans une poêle, fais revenir les poivrons surgelés 5 min dans l'huile avec ail en poudre et origan.", "Ajoute la passata, 5 min de mijotage, puis le thon émietté hors du feu.", "Mélange avec les pâtes, sel et poivre."],
        batch: "140 g égoutté ≈ 1 grande boîte ou 2-3 petites." },
      { name: "Fromage blanc, noix & clémentines", ing: [["fblanc", 250, "250 g"], ["noix", 30, "30 g"], ["clem", 150, "2"]],
        steps: ["Noix concassées sur le fromage blanc, clémentines à côté."] },
      { name: "Chili con carne & riz", ing: [["riz", 110, "110 g cru"], ["hache", 160, "160 g"], ["hrouges", 100, "100 g égouttés"], ["passata", 150, "150 g"], ["poivrons", 100, "100 g"], ["huile", 10, "1 c. à s."]],
        steps: ["Fais revenir les poivrons dans l'huile 3 min, ajoute le haché et fais dorer 5 min.", "Ajoute 1 c. à c. de cumin, 1 c. à c. de paprika, une pincée de piment, sel.", "Verse la passata et les haricots rouges rincés, mijote 15 min à couvert.", "Cuis le riz à part et sers le chili dessus."],
        batch: "Le chili est meilleur réchauffé : fais-en 3-4 portions d'un coup." }] },
    { n: 3, t: "Four & wok", note: "Pommes de terre rôties au four et riz sauté façon wok, avec des tartines le matin pour changer de l'avoine.", meals: [
      { name: "Tartines & œufs au plat", ing: [["pain", 130, "4 tranches"], ["oeuf", 165, "3"], ["lait", 250, "250 ml"], ["banane", 120, "1"]],
        steps: ["Toaste le pain.", "Cuis les 3 œufs au plat ou brouillés à la poêle antiadhésive.", "Un verre de lait et la banane à côté."] },
      { name: "Poulet pimentón & pommes de terre rôties", ing: [["pdt", 400, "400 g"], ["poulet", 200, "200 g"], ["hverts", 150, "150 g"], ["huile", 15, "1,5 c. à s."]],
        steps: ["Coupe les pommes de terre en cubes (avec la peau), mélange avec 1 c. à s. d'huile, du pimentón, du sel.", "Enfourne 35 min à 200 °C en remuant à mi-cuisson.", "Pendant ce temps, saisis le poulet en dés 6-8 min avec le reste d'huile et du pimentón.", "Haricots verts au micro-ondes 6 min, puis mise en gamelle."],
        batch: "Une plaque de four pleine = 3 gamelles (1,2 kg de pommes de terre)." },
      { name: "Skyr, beurre de cacahuète & pomme", ing: [["skyr", 250, "250 g"], ["pb", 20, "20 g"], ["pomme", 150, "1"]],
        steps: ["Mélange le beurre de cacahuète dans le skyr, pomme en lamelles à tremper dedans."] },
      { name: "Riz sauté dinde & œuf (wok)", ing: [["riz", 130, "130 g cru"], ["dinde", 180, "180 g"], ["oeuf", 55, "1"], ["poelee", 200, "200 g"], ["soja", 15, "1 c. à s."], ["huile", 5, "½ c. à s."]],
        steps: ["Idéalement, cuis le riz la veille : froid, il ne colle pas au wok.", "Saisis la dinde en lanières dans l'huile à feu vif 5 min, réserve.", "Fais sauter la poêlée surgelée 5 min, pousse-la sur le côté et brouille l'œuf dans la poêle.", "Ajoute le riz, la dinde et la sauce soja, fais sauter 3 min."],
        batch: "Pour 3 gamelles : 390 g de riz cru, 540 g de dinde, 3 œufs." }] },
    { n: 4, t: "Épices & gratin", note: "Pancakes le matin, poulet façon tikka et un hachis parmentier à faire en plat.", meals: [
      { name: "Pancakes avoine-banane", ing: [["avoine", 100, "100 g"], ["oeuf", 110, "2"], ["banane", 120, "1"], ["lait", 300, "100 + 200 ml"]],
        steps: ["Mixe l'avoine, les 2 œufs, la banane et 100 ml de lait avec une pincée de cannelle.", "Cuis 4-5 pancakes à la poêle antiadhésive, 2 min par face à feu moyen.", "Bois les 200 ml de lait restants à côté."],
        batch: "La pâte se garde 2 jours au frigo." },
      { name: "Poulet façon tikka, riz & épinards", ing: [["riz", 120, "120 g cru"], ["poulet", 200, "200 g"], ["yaourt", 60, "½ pot"], ["epinards", 150, "150 g"], ["huile", 10, "1 c. à s."]],
        steps: ["Mélange le poulet en dés avec le yaourt, 2 c. à c. de curry ou garam masala, ail, sel. 30 min de marinade minimum (ou la veille).", "Cuis le riz.", "Saisis le poulet mariné dans l'huile 8 min à feu moyen-vif.", "Réchauffe les épinards surgelés dans la même poêle 5 min, sel."],
        batch: "Fais mariner les 3 portions ensemble dans une boîte la veille au soir." },
      { name: "Fromage blanc, amandes & clémentines", ing: [["fblanc", 250, "250 g"], ["amandes", 35, "35 g"], ["clem", 150, "2"]],
        steps: ["Fromage blanc en bol, amandes et clémentines à côté."] },
      { name: "Hachis parmentier léger", ing: [["pdt", 400, "400 g"], ["hache", 160, "160 g"], ["lait", 80, "80 ml"], ["carottes", 150, "150 g"], ["emmental", 20, "20 g"], ["huile", 5, "½ c. à s."]],
        steps: ["Épluche les pommes de terre, cuis-les 20 min à l'eau salée, écrase-les avec le lait chaud, sel et poivre.", "Râpe ou coupe finement les carottes, fais-les revenir 5 min dans l'huile, ajoute le haché et fais dorer 5 min.", "Dans un plat : viande-carottes au fond, purée dessus, emmental.", "20 min au four à 200 °C, puis découpe en parts."],
        batch: "Un plat pour 4 parts : 1,6 kg de pommes de terre, 640 g de haché, 600 g de carottes." }] }
  ];

  /* ---------- Programme 24 semaines (Upper/Lower, Basic Fit) ---------- */
  var P12 = {
    "Upper A": [["Tirage vertical (poulie haute, barre large)", "3 × 8-10", "3-1-1", "2m30"], ["Développé couché machine convergente (ou haltères)", "3 × 8-10", "3-1-1", "2m30"], ["Rowing assis poulie basse", "3 × 10-12", "3-0-1", "2 min"], ["Élévations latérales (poulie basse ou haltères)", "3 × 12-15", "2-1-1", "1m30"], ["Extension triceps poulie", "2 × 12-15", "2-1-1", "1m30"], ["Curl biceps", "2 × 12", "2-1-1", "1m30"]],
    "Lower A": [["Soulevé de terre roumain haltères", "4 × 8-10", "4-1-1", "3 min"], ["Presse à cuisses 45°", "3 × 10", "3-1-1", "3 min"], ["Leg curl assis", "3 × 12", "3-1-1", "2 min"], ["Fentes bulgares", "2 × 10-12/jambe", "2-1-1", "2 min"], ["Mollets à la presse", "3 × 15", "2-1-1", "1m30"], ["Gainage planche", "3 × 30-45 s", "—", "1 min"]],
    "Upper B": [["Rowing machine convergente ou barre en T", "3 × 8-10", "3-1-1", "2m30"], ["Développé incliné haltères", "3 × 8-10", "3-1-1", "2m30"], ["Tirage vertical prise serrée (V-bar)", "3 × 10-12", "3-0-1", "2 min"], ["Face pull", "2 × 15", "2-1-1", "1m30"], ["Développé militaire haltères", "2 × 10-12", "2-1-1", "2 min"], ["Curl marteau", "2 × 12-15", "2-1-1", "1m30"]],
    "Lower B": [["Leg curl allongé (pré-fatigue)", "3 × 10-12", "3-1-1", "2 min"], ["Soulevé de terre classique", "3 × 6-8", "2-1-1", "3 min"], ["Presse pieds hauts", "3 × 10", "3-1-1", "2m30"], ["Hip thrust", "3 × 10-12", "2-1-1", "2m30"], ["Mollets assis", "3 × 15", "2-1-1", "1m30"], ["Gainage latéral", "2 × 30 s/côté", "—", "1 min"]]
  };
  var P3 = {
    "Upper A": [["Tirage vertical lourd", "4 × 6", "2-0-1", "3-4 min"], ["Développé couché haltères lourd", "4 × 5", "2-1-1", "3 min"], ["Rowing machine", "3 × 8", "3-0-1", "2m30"], ["Élévations latérales", "2 × 12", "2-1-1", "1m30"], ["Curl biceps lourd", "2 × 8-10", "2-1-1", "1m30"]],
    "Lower A": [["Soulevé de terre roumain lourd", "4 × 6", "3-1-1", "3-4 min"], ["Presse à cuisses lourde", "4 × 5", "2-1-1", "3-4 min"], ["Leg curl assis", "3 × 8", "3-0-1", "2m30"], ["Hip thrust lourd", "3 × 8", "2-1-1", "2m30"]],
    "Upper B": [["Rowing lourd (barre ou machine)", "4 × 5", "2-1-1", "3-4 min"], ["Développé incliné lourd", "4 × 6", "2-1-1", "3 min"], ["Tirage serré", "3 × 8", "3-0-1", "2m30"], ["Extension triceps lourde", "2 × 10", "2-1-1", "1m30"]],
    "Lower B": [["Soulevé de terre classique lourd", "3 × 4", "2-1-X", "4 min"], ["Leg curl allongé", "4 × 8", "3-0-1", "2m30"], ["Presse pieds hauts", "3 × 8", "2-1-1", "3 min"]]
  };
  function halve(sessions) { // -40 % : 2 séries au lieu de 3-4 sur les polyarticulaires
    var out = {};
    Object.keys(sessions).forEach(function (k) {
      out[k] = sessions[k].map(function (e) { return [e[0], e[1].replace(/^[34] ×/, "2 ×"), e[2], e[3]]; });
    });
    return out;
  }

  var BLOCKS = [
    { from: 1, to: 4, phase: "Phase 1", name: "Réadaptation", intensity: "RIR 3-4",
      summary: "On reconstruit les bases sans se cramer : charges modérées, technique propre, tempo lent en descente.",
      keys: ["Garde 3-4 reps en réserve sur chaque série, ego au vestiaire.", "Tempo 3-1-1 : 3 s de descente, 1 s de pause étirée.", "Repos 2m30-3 min sur les polyarticulaires, 1m30 sur l'isolation."],
      nutri: "Surplus léger (+200-300 kcal).", sessions: P12 },
    { from: 5, to: 11, phase: "Phase 2", name: "Hypertrophie de reconquête", intensity: "RIR 1-2",
      summary: "Mêmes séances, mais on pousse plus près de l'échec pour relancer la prise de muscle.",
      keys: ["1-2 reps en réserve : les dernières reps doivent être dures.", "Surcharge progressive : ajoute une rep ou un peu de charge chaque semaine.", "Si une charge stagne 2 séances, vérifie sommeil et calories avant de forcer."],
      nutri: "Surplus léger (+200-300 kcal).", sessions: P12 },
    { from: 12, to: 12, phase: "Deload", name: "Semaine de décharge", intensity: "-30 % volume et intensité",
      summary: "Semaine légère pour digérer 11 semaines de travail avant le bloc force.",
      keys: ["Enlève environ 1/3 des séries et de la charge.", "Aucune série à l'échec.", "Profites-en pour soigner mobilité et sommeil."],
      nutri: "Garde tes calories : la récup se fait maintenant.", sessions: P12 },
    { from: 13, to: 19, phase: "Phase 3", name: "Force & intensification", intensity: "RPE 8,5-9,5",
      summary: "Moins de reps, plus lourd. 0-1 rep en réserve sur le premier exercice.",
      keys: ["Repos 3-4 min sur les 2 premiers exercices de chaque séance.", "Priorité à la technique sur les charges lourdes.", "Échauffement progressif avant chaque premier exercice."],
      nutri: "Ajuste les calories selon l'évolution de ta composition corporelle.", sessions: P3 },
    { from: 20, to: 20, phase: "Deload", name: "Décharge avant peaking", intensity: "-40 % volume",
      summary: "Même structure que la phase 3, 2 séries effectives au lieu de 4. Charges maintenues.",
      keys: ["Garde les charges, coupe le volume.", "Objectif : dissiper la fatigue nerveuse."],
      nutri: "Calories stables.", sessions: halve(P3) },
    { from: 21, to: 23, phase: "Phase 4", name: "Peaking", intensity: "Charge max, -40 % volume",
      summary: "2 séries lourdes sur les gros mouvements, charge maximale conservée.",
      keys: ["Séries courtes et lourdes, repos longs.", "Arrive frais à chaque séance.", "Prépare tes tests de la semaine 24."],
      nutri: "Calories stables, sommeil prioritaire.", sessions: halve(P3) },
    { from: 24, to: 24, phase: "Tests", name: "Tests 1RM / 3RM", intensity: "Maximal",
      summary: "Tests sur 3 mouvements phares : soulevé de terre, développé couché, presse à cuisses.",
      keys: ["Échauffement progressif long avant chaque test.", "Un pareur ou des sécurités sur le développé couché.", "Note tes résultats : ce sera ta base pour le prochain cycle (top set / back-off)."],
      nutri: "Calories stables.", sessions: null }
  ];

  var GENERAL = [
    "Upper : toujours le dos (point faible) avant la poussée.",
    "Lower : chaîne postérieure (ischios) avant les quadriceps.",
    "Mobilité psoas 10 min avant chaque Lower : chevalier servant, glute bridge, 90/90, world's greatest stretch, charnière de hanche.",
    "Sommeil 7-9 h, créatine 3-5 g/jour, protéines 1,8-2,2 g/kg."
  ];

  return { FOOD: FOOD, PRICES: PRICES, PRICES_DATE: PRICES_DATE, SPICES: SPICES, RNAME: RNAME,
    MOMENTS: MOMENTS, MOMENT_SHORT: MOMENT_SHORT, MENUS: MENUS, BLOCKS: BLOCKS, GENERAL: GENERAL };
})();
