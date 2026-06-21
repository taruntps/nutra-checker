// Curated botanical intelligence — top high-demand entries.
// Purpose: give the botanicals most likely to drive search demand, industry usage
// and AI citations a clean English/common name, and a curated "related" cluster.
//
// This is a DISPLAY/SEO enrichment layer only. It NEVER mutates source data:
//  - The original FSSAI/regulatory name is always preserved in `entity.name` and
//    shown in page content + provenance.
//  - Scientific name + plant part are auto-extracted from source for ALL botanicals;
//    a curated `sci`/`part` here only OVERRIDES when the auto value needs cleanup.
//  - `english` is used for H1, SEO title and meta when present (per approved spec).
//  - `related` is an ordered list of slugs (curated relationships win over genus/
//    schedule/alphabetical fallback computed in normalize.mjs).
//
// Keyed by entity slug (stable — slugs are not changing). Adding an entry is a
// config change; new botanicals without an entry still render via auto-extraction.

export const BOTANICAL_CANON = {
  // ── Adaptogens / flagship Ayurvedic ───────────────────────────────────────
  "ashwagandha-asgandh-nagauri": {
    english: "Ashwagandha",
    sci: "Withania somnifera", part: "Root",
    alsoCalled: ["Indian Ginseng", "Indian Winter Cherry", "Asgandh"],
    related: ["brahmi", "shatawar", "guduchi-giloy-giloya", "gokhru-gokshura", "musali-safed-musali", "mandukaparni-brahmi"],
  },
  "brahmi": {
    english: "Brahmi",
    sci: "Bacopa monnieri", part: "Whole plant",
    alsoCalled: ["Water Hyssop", "Indian Pennywort"],
    related: ["mandukaparni-brahmi", "bacopa-monnieri-leaf-extract", "ashwagandha-asgandh-nagauri", "guduchi-giloy-giloya", "shatawar"],
  },
  "bacopa-monnieri-leaf-extract": {
    english: "Bacopa (Brahmi extract)",
    alsoCalled: ["Brahmi", "Water Hyssop", "CDRI-08"],
    related: ["brahmi", "mandukaparni-brahmi", "ashwagandha-asgandh-nagauri", "centella-asiatica-leafaerial-parts-standardized-extract"],
  },
  "mandukaparni-brahmi": {
    english: "Gotu Kola (Mandukaparni)",
    sci: "Centella asiatica", part: "Leaf",
    alsoCalled: ["Gotu Kola", "Centella", "Mandukaparni"],
    related: ["centella-asiatica-leafaerial-parts-standardized-extract", "brahmi", "bacopa-monnieri-leaf-extract", "ashwagandha-asgandh-nagauri"],
  },
  "centella-asiatica-leafaerial-parts-standardized-extract": {
    english: "Gotu Kola",
    alsoCalled: ["Mandukaparni", "Centella", "TECA", "CICA"],
    related: ["mandukaparni-brahmi", "brahmi", "bacopa-monnieri-leaf-extract"],
  },
  "guduchi-giloy-giloya": {
    english: "Giloy (Guduchi)",
    sci: "Tinospora cordifolia", part: "Stem",
    alsoCalled: ["Guduchi", "Tinospora", "Heart-leaved Moonseed"],
    related: ["ashwagandha-asgandh-nagauri", "amalaki-anwala-amla", "brahmi", "gokhru-gokshura", "shatawar"],
  },
  "shatawar": {
    english: "Shatavari",
    sci: "Asparagus racemosus", part: "Root",
    alsoCalled: ["Wild Asparagus", "Shatawari"],
    related: ["badi-shatawar", "shatavari-bhed", "ashwagandha-asgandh-nagauri", "musali-safed-musali", "asparagus-densiflorus-extract"],
  },
  "badi-shatawar": {
    english: "Shatavari (Bada)",
    sci: "Asparagus sarmentosus", part: "Root",
    alsoCalled: ["Wild Asparagus"],
    related: ["shatawar", "shatavari-bhed", "musali-safed-musali"],
  },
  "shatavari-bhed": {
    english: "Shatavari (variant)",
    sci: "Asparagus officinalis", part: "Root",
    alsoCalled: ["Garden Asparagus"],
    related: ["shatawar", "badi-shatawar", "musali-safed-musali", "asparagus-densiflorus-extract"],
  },
  "gokhru-gokshura": {
    english: "Gokshura (Tribulus)",
    sci: "Tribulus terrestris", part: "Fruit",
    alsoCalled: ["Tribulus", "Puncture Vine", "Gokharu"],
    related: ["brihat-gokshura-bada-gokharu", "ashwagandha-asgandh-nagauri", "musali-safed-musali", "shatawar"],
  },
  "brihat-gokshura-bada-gokharu": {
    english: "Gokshura (Bada)",
    sci: "Pedalium murex", part: "Fruit",
    alsoCalled: ["Large Caltrops"],
    related: ["gokhru-gokshura", "ashwagandha-asgandh-nagauri"],
  },
  "musali-safed-musali": {
    english: "Safed Musli",
    sci: "Asparagus adscendens", part: "Root",
    alsoCalled: ["White Musli"],
    related: ["musali-safed", "shatawar", "ashwagandha-asgandh-nagauri"],
  },
  "musali-safed": {
    english: "Safed Musli (Chlorophytum)",
    sci: "Chlorophytum borivilianum", part: "Root",
    alsoCalled: ["White Musli"],
    related: ["musali-safed-musali", "shatawar"],
  },

  // ── Turmeric / Triphala / Rasayana ────────────────────────────────────────
  "haldi": {
    english: "Turmeric (Haldi)",
    sci: "Curcuma longa", part: "Rhizome",
    alsoCalled: ["Haridra", "Curcuma longa"],
    related: ["curcuma-longa-rhizome-powderextract-standardized", "aamra-haridra-ambaahaldi", "adrakh-shunti", "maricha-black-pepper", "amalaki-anwala-amla"],
  },
  "curcuma-longa-rhizome-powderextract-standardized": {
    english: "Turmeric",
    alsoCalled: ["Haldi", "Haridra", "Curcumin source"],
    related: ["haldi", "aamra-haridra-ambaahaldi", "piper-nigrum-powderstandardized-extract", "boswellia-serrata-gum-resin-extract"],
  },
  "aamra-haridra-ambaahaldi": {
    english: "Mango Ginger (Amba Haldi)",
    alsoCalled: ["Curcuma amada", "Amba Haldi"],
    related: ["haldi", "curcuma-longa-rhizome-powderextract-standardized", "adrakh-shunti"],
  },
  "amalaki-anwala-amla": {
    english: "Amla (Indian Gooseberry)",
    sci: "Emblica officinalis", part: "Fruit",
    alsoCalled: ["Amalaki", "Indian Gooseberry", "Anwala"],
    related: ["emblica-officinalis-dried-fruit-extractspray-dried-pulp-powder", "haritaki-harad-shiva", "bibitaki-bahera", "guduchi-giloy-giloya", "ashwagandha-asgandh-nagauri"],
  },
  "emblica-officinalis-dried-fruit-extractspray-dried-pulp-powder": {
    english: "Amla (Indian Gooseberry)",
    alsoCalled: ["Amalaki", "Indian Gooseberry", "Anwala"],
    related: ["amalaki-anwala-amla", "haritaki-harad-shiva", "bibitaki-bahera"],
  },
  "haritaki-harad-shiva": {
    english: "Haritaki",
    sci: "Terminalia chebula", part: "Fruit",
    alsoCalled: ["Chebulic Myrobalan", "Harad"],
    related: ["terminalia-chebulia-fruit-extract", "amalaki-anwala-amla", "bibitaki-bahera", "terminalia-bellerica-fruit-extract"],
  },
  "terminalia-chebulia-fruit-extract": {
    english: "Haritaki",
    alsoCalled: ["Terminalia chebula", "Chebulic Myrobalan", "Harad"],
    related: ["haritaki-harad-shiva", "terminalia-bellerica-fruit-extract", "emblica-officinalis-dried-fruit-extractspray-dried-pulp-powder"],
  },
  "bibitaki-bahera": {
    english: "Bibhitaki",
    sci: "Terminalia bellirica", part: "Fruit",
    alsoCalled: ["Belleric Myrobalan", "Baheda"],
    related: ["terminalia-bellerica-fruit-extract", "haritaki-harad-shiva", "amalaki-anwala-amla"],
  },
  "terminalia-bellerica-fruit-extract": {
    english: "Bibhitaki",
    alsoCalled: ["Terminalia bellirica", "Belleric Myrobalan", "Baheda"],
    related: ["bibitaki-bahera", "terminalia-chebulia-fruit-extract", "emblica-officinalis-dried-fruit-extractspray-dried-pulp-powder"],
  },
  "arjun-parth": {
    english: "Arjuna",
    sci: "Terminalia arjuna", part: "Bark",
    alsoCalled: ["Arjun"],
    related: ["terminalia-arjuna-barkleaf-standardized-extract", "guduchi-giloy-giloya", "ashwagandha-asgandh-nagauri"],
  },
  "terminalia-arjuna-barkleaf-standardized-extract": {
    english: "Arjuna",
    alsoCalled: ["Terminalia arjuna", "Arjun"],
    related: ["arjun-parth", "guduchi-giloy-giloya"],
  },

  // ── Tulsi / culinary-medicinal ────────────────────────────────────────────
  "ocimum-tenuiflorumsanctum-aerial-partsseed-extract": {
    english: "Tulsi (Holy Basil)",
    alsoCalled: ["Holy Basil", "Tulasi", "Surasa", "Ocimum sanctum"],
    related: ["vriddha-tulasi-ram-tulasi", "barbari-bhavari-tulsi", "guduchi-giloy-giloya", "ashwagandha-asgandh-nagauri", "amalaki-anwala-amla", "adrakh-shunti"],
  },
  "tulasi-surasa": {
    english: "Tulsi (Holy Basil)",
    sci: "Ocimum tenuiflorum", part: "Leaf",
    alsoCalled: ["Holy Basil", "Surasa", "Ocimum sanctum"],
    related: ["vriddha-tulasi-ram-tulasi", "barbari-bhavari-tulsi", "guduchi-giloy-giloya", "ashwagandha-asgandh-nagauri", "amalaki-anwala-amla", "adrakh-shunti"],
  },
  "vriddha-tulasi-ram-tulasi": {
    english: "Ram Tulsi",
    alsoCalled: ["Ocimum gratissimum", "Clove Basil", "Ram Tulsi"],
    related: ["tulasi-surasa", "ocimum-tenuiflorumsanctum-aerial-partsseed-extract", "barbari-bhavari-tulsi"],
  },
  "barbari-bhavari-tulsi": {
    english: "Sweet Basil (Barbari Tulsi)",
    sci: "Ocimum basilicum", part: "Leaf",
    alsoCalled: ["Sweet Basil", "Barbari"],
    related: ["tulasi-surasa", "ocimum-tenuiflorumsanctum-aerial-partsseed-extract", "vriddha-tulasi-ram-tulasi"],
  },
  "adrakh-shunti": {
    english: "Ginger",
    sci: "Zingiber officinale", part: "Rhizome",
    alsoCalled: ["Adrak", "Shunti"],
    related: ["zingiber-officinale-rhizome-standardized-extracts", "haldi", "maricha-black-pepper", "kaidarya-meetha-neem-kadhipatta"],
  },
  "zingiber-officinale-rhizome-standardized-extracts": {
    english: "Ginger",
    alsoCalled: ["Zingiber officinale", "Adrak", "Shunti"],
    related: ["adrakh-shunti", "curcuma-longa-rhizome-powderextract-standardized", "piper-nigrum-powderstandardized-extract"],
  },
  "rason-lahsun": {
    english: "Garlic",
    sci: "Allium sativum", part: "Bulb",
    alsoCalled: ["Lahsun", "Rason"],
    related: ["allium-sativum-bulbs-dried-standardized-powderextract", "plandu-pyaj", "adrakh-shunti"],
  },
  "allium-sativum-bulbs-dried-standardized-powderextract": {
    english: "Garlic (dried standardized powder/extract)",
    alsoCalled: ["Allium sativum", "Lahsun", "Allicin source"],
    related: ["rason-lahsun", "plandu-pyaj"],
  },
  "plandu-pyaj": {
    english: "Onion",
    sci: "Allium cepa", part: "Bulb",
    alsoCalled: ["Pyaj"],
    related: ["rason-lahsun", "allium-sativum-bulbs-dried-standardized-powderextract"],
  },
  "maricha-black-pepper": {
    english: "Black Pepper",
    sci: "Piper nigrum", part: "Fruit",
    alsoCalled: ["Maricha", "Kali Mirch"],
    related: ["piper-nigrum-powderstandardized-extract", "pippaali-long-pepper-magha", "piper-longum-extract", "adrakh-shunti"],
  },
  "piper-nigrum-powderstandardized-extract": {
    english: "Black Pepper (Piperine)",
    alsoCalled: ["Piper nigrum", "Piperine", "BioPerine", "Kali Mirch"],
    related: ["maricha-black-pepper", "piper-nigrum-piper-longum-extract", "pippaali-long-pepper-magha", "curcuma-longa-rhizome-powderextract-standardized"],
  },
  "piper-nigrum-piper-longum-extract": {
    english: "Pepper (Piperine blend)",
    alsoCalled: ["Piper nigrum", "Piperine", "BioPerine", "Black & Long Pepper"],
    related: ["piper-nigrum-powderstandardized-extract", "maricha-black-pepper", "piper-longum-extract"],
  },
  "pippaali-long-pepper-magha": {
    english: "Long Pepper (Pippali)",
    sci: "Piper longum", part: "Fruit",
    alsoCalled: ["Pippali", "Magha"],
    related: ["piper-longum-extract", "maricha-black-pepper", "piper-nigrum-powderstandardized-extract"],
  },
  "piper-longum-extract": {
    english: "Long Pepper (Pippali)",
    alsoCalled: ["Piper longum", "Pippali", "Magha"],
    related: ["pippaali-long-pepper-magha", "maricha-black-pepper", "piper-nigrum-piper-longum-extract"],
  },
  "methika-methi": {
    english: "Fenugreek",
    sci: "Trigonella foenum-graecum", part: "Seed",
    alsoCalled: ["Methi"],
    related: ["trigonella-foenum-graecum-seeds-extract", "mishraya-sounf-fennel", "haldi"],
  },
  "trigonella-foenum-graecum-seeds-extract": {
    english: "Fenugreek (extract)",
    sci: "Trigonella foenum-graecum", part: "Seed",
    alsoCalled: ["Methi", "Methika"],
    related: ["methika-methi", "galactomannan", "mishraya-sounf-fennel"],
  },
  "mishraya-sounf-fennel": {
    english: "Fennel",
    sci: "Foeniculum vulgare", part: "Fruit",
    alsoCalled: ["Saunf"],
    related: ["foeniculum-vulgare-fruit-oilextract", "anisoon-aniseed", "methika-methi"],
  },
  "foeniculum-vulgare-fruit-oilextract": {
    english: "Fennel",
    alsoCalled: ["Foeniculum vulgare", "Saunf", "Shatahva"],
    related: ["mishraya-sounf-fennel", "anethum-graveolens-seeds-and-oil", "anisoon-aniseed"],
  },
  "twak-dalchini": {
    english: "Cinnamon",
    sci: "Cinnamomum zeylanicum", part: "Bark",
    alsoCalled: ["Dalchini", "Ceylon Cinnamon"],
    related: ["cinnamomum-verum-bark-powderextract", "tamalpatra-tejapatra", "adrakh-shunti"],
  },
  "cinnamomum-verum-bark-powderextract": {
    english: "Cinnamon (Ceylon)",
    alsoCalled: ["Cinnamomum verum", "Dalchini", "Tvak"],
    related: ["twak-dalchini", "tamalpatra-tejapatra"],
  },
  "tamalpatra-tejapatra": {
    english: "Indian Bay Leaf (Tejpatta)",
    sci: "Cinnamomum tamala", part: "Leaf",
    alsoCalled: ["Tejpatta", "Tamalpatra"],
    related: ["twak-dalchini", "cinnamomum-verum-bark-powderextract"],
  },
  "kumkum-kesar": {
    english: "Saffron",
    sci: "Crocus sativus", part: "Stigma",
    alsoCalled: ["Kesar", "Kumkum"],
    related: ["ashwagandha-asgandh-nagauri", "brahmi"],
  },
  "kaidarya-meetha-neem-kadhipatta": {
    english: "Curry Leaf",
    sci: "Murraya koenigii", part: "Leaf",
    alsoCalled: ["Kadi Patta", "Meetha Neem"],
    related: ["nimba-neem", "adrakh-shunti"],
  },

  // ── Liver / metabolic / standardized extracts ─────────────────────────────
  "madhuyasti-mulethi-liquorice": {
    english: "Licorice (Mulethi)",
    sci: "Glycyrrhiza glabra", part: "Root",
    alsoCalled: ["Mulethi", "Yashtimadhu", "Liquorice"],
    related: ["glycyrrhiza-glabra-extract", "amalaki-anwala-amla", "haritaki-harad-shiva"],
  },
  "glycyrrhiza-glabra-extract": {
    english: "Licorice (Mulethi)",
    alsoCalled: ["Glycyrrhiza glabra", "Mulethi", "Yashtimadhu", "DGL"],
    related: ["madhuyasti-mulethi-liquorice", "amalaki-anwala-amla"],
  },
  "meshashrungi-gudmar": {
    english: "Gymnema (Gudmar)",
    sci: "Gymnema sylvestre", part: "Leaf",
    alsoCalled: ["Gudmar", "Meshashrungi"],
    related: ["gymnema-sylvestre-extract-powder", "methika-methi", "vidaari-patal-kohda"],
  },
  "gymnema-sylvestre-extract-powder": {
    english: "Gymnema (Gudmar)",
    alsoCalled: ["Gymnema sylvestre", "Gudmar", "Madhunashini"],
    related: ["meshashrungi-gudmar", "methika-methi"],
  },
  "shallaki-salai-guggal": {
    english: "Boswellia (Shallaki)",
    sci: "Boswellia serrata", part: "Gum resin",
    alsoCalled: ["Salai Guggul", "Indian Frankincense"],
    related: ["curcuma-longa-rhizome-powderextract-standardized", "adrakh-shunti", "ashwagandha-asgandh-nagauri", "arjun-parth", "gandiva-pathachoor", "guduchi-giloy-giloya"],
  },
  "boswellia-serrata-gum-resin-extract": {
    english: "Boswellia (Shallaki)",
    alsoCalled: ["Boswellia serrata", "Salai Guggul", "Shallaki", "AKBA"],
    related: ["curcuma-longa-rhizome-powderextract-standardized", "adrakh-shunti", "ashwagandha-asgandh-nagauri", "arjun-parth", "gandiva-pathachoor", "guduchi-giloy-giloya"],
  },
  "manjishta-manjeeth": {
    english: "Manjistha",
    sci: "Rubia cordifolia", part: "Root",
    alsoCalled: ["Indian Madder", "Manjeeth"],
    related: ["amalaki-anwala-amla", "haritaki-harad-shiva", "nimba-neem"],
  },
  "punarnava-itsit": {
    english: "Punarnava",
    sci: "Boerhavia diffusa", part: "Root",
    alsoCalled: ["Hogweed", "Itsit"],
    related: ["gokhru-gokshura", "guduchi-giloy-giloya", "shatawar"],
  },
  "gandiva-pathachoor": {
    english: "Coleus (Forskohlii)",
    sci: "Coleus forskohlii", part: "Root",
    alsoCalled: ["Forskolin source", "Pathachoor"],
    related: ["hrivera-baalatka", "gymnema-sylvestre-extract-powder"],
  },
  "garcinia-gummi-guttacambogiaindica-fruit-rind-extract-standardized-to-hydroxyl-c": {
    english: "Garcinia (Malabar Tamarind)",
    alsoCalled: ["Garcinia cambogia", "Kokum", "HCA source", "Malabar Tamarind"],
    related: ["vrukshamala-kokam", "vatasamla-amalbeda", "garcinia-mangostana-seed-extract-standardized"],
  },
  "vrukshamala-kokam": {
    english: "Kokum",
    sci: "Garcinia indica", part: "Fruit rind",
    alsoCalled: ["Kokum"],
    related: ["garcinia-gummi-guttacambogiaindica-fruit-rind-extract-standardized-to-hydroxyl-c", "vatasamla-amalbeda"],
  },
  "garcinia-mangostana-seed-extract-standardized": {
    english: "Mangosteen",
    alsoCalled: ["Garcinia mangostana", "Mangosteen"],
    related: ["garcinia-gummi-guttacambogiaindica-fruit-rind-extract-standardized-to-hydroxyl-c", "vrukshamala-kokam"],
  },
  "picrorhiza-kurroa-extract": {
    english: "Kutki",
    alsoCalled: ["Picrorhiza kurroa", "Katuka", "Kutaki"],
    related: ["guduchi-giloy-giloya", "amalaki-anwala-amla", "haritaki-harad-shiva"],
  },
  "phyllanthus-amarus-extract": {
    english: "Bhumi Amla",
    alsoCalled: ["Phyllanthus amarus", "Stonebreaker", "Bhumi Amla"],
    related: ["tamlaki-bhui-amla", "amalaki-anwala-amla", "picrorhiza-kurroa-extract"],
  },
  "tamlaki-bhui-amla": {
    english: "Bhumi Amla",
    sci: "Phyllanthus amarus", part: "Herb",
    alsoCalled: ["Stonebreaker", "Bhui Amla"],
    related: ["phyllanthus-amarus-extract", "amalaki-anwala-amla"],
  },
  "vidaari-patal-kohda": {
    english: "Vidari Kand",
    sci: "Pueraria tuberosa", part: "Root",
    alsoCalled: ["Indian Kudzu", "Vidari"],
    related: ["kasheer-vidhara-vidarikand", "ashwagandha-asgandh-nagauri", "shatawar"],
  },
  "kasheer-vidhara-vidarikand": {
    english: "Vidari Kand (Ipomoea)",
    sci: "Ipomoea mauritiana", part: "Root",
    alsoCalled: ["Vidari"],
    related: ["vidaari-patal-kohda", "shatawar"],
  },

  // ── Global / Western botanicals ───────────────────────────────────────────
  "aloe-vera-juiceconcentratepowder-of-sapgel": {
    english: "Aloe Vera",
    alsoCalled: ["Aloe barbadensis", "Ghrit Kumari", "Indian Aloe"],
    related: ["kumari-ghikvar-ghrit-kumari", "amalaki-anwala-amla"],
  },
  "kumari-ghikvar-ghrit-kumari": {
    english: "Aloe Vera (Kumari)",
    sci: "Aloe barbadensis", part: "Leaf gel",
    alsoCalled: ["Ghrit Kumari", "Kumari"],
    related: ["aloe-vera-juiceconcentratepowder-of-sapgel"],
  },
  "nimba-neem": {
    english: "Neem",
    sci: "Azadirachta indica", part: "Leaf",
    alsoCalled: ["Nimba", "Indian Lilac"],
    related: ["kaidarya-meetha-neem-kadhipatta", "manjishta-manjeeth", "haldi"],
  },
  "shiguru-sahijan-moringa": {
    english: "Moringa (Drumstick)",
    sci: "Moringa oleifera", part: "Leaf",
    alsoCalled: ["Shigru", "Sahjan", "Drumstick"],
    related: ["moringa-oleifera-leafpodsseed-extract-powder", "amalaki-anwala-amla"],
  },
  "moringa-oleifera-leafpodsseed-extract-powder": {
    english: "Moringa (Drumstick)",
    alsoCalled: ["Moringa oleifera", "Shigru", "Sahjan", "Drumstick"],
    related: ["shiguru-sahijan-moringa", "amalaki-anwala-amla"],
  },
  "camellia-sinensis-blackgreen-tea-extract-standardized-powder": {
    english: "Green Tea Extract",
    alsoCalled: ["Camellia sinensis", "Green Tea", "GTE"],
    related: ["camellia-sinensis-tea-catechins-egcgepicatechincatechin-gallates", "chai-patti", "grape-seed-extract"],
  },
  "camellia-sinensis-tea-catechins-egcgepicatechincatechin-gallates": {
    english: "Green Tea Catechins (EGCG)",
    alsoCalled: ["Camellia sinensis", "EGCG", "Tea Catechins"],
    related: ["camellia-sinensis-blackgreen-tea-extract-standardized-powder", "chai-patti", "grape-seed-extract"],
  },
  "chai-patti": {
    english: "Tea (Camellia sinensis)",
    sci: "Camellia sinensis", part: "Leaf",
    alsoCalled: ["Tea Leaf", "Chai"],
    related: ["camellia-sinensis-blackgreen-tea-extract-standardized-powder", "camellia-sinensis-tea-catechins-egcgepicatechincatechin-gallates"],
  },
  "ginkgo-biloba-extract-from-dried-leaves": {
    english: "Ginkgo Biloba",
    alsoCalled: ["Ginkgo biloba", "Maidenhair Tree", "EGb 761"],
    related: ["brahmi", "bacopa-monnieri-leaf-extract", "centella-asiatica-leafaerial-parts-standardized-extract"],
  },
  "panax-ginseng-extract-korean-ginseng-06-20-g-root": {
    english: "Korean Ginseng",
    alsoCalled: ["Panax ginseng", "Korean Red Ginseng", "KRG"],
    related: ["american-ginseng-panax-quinquefolius-l", "siberian-ginseng-acanthopanax-senticosus-06-20-g-root", "ashwagandha-asgandh-nagauri"],
  },
  "american-ginseng-panax-quinquefolius-l": {
    english: "American Ginseng",
    alsoCalled: ["Panax quinquefolius", "American Ginseng"],
    related: ["panax-ginseng-extract-korean-ginseng-06-20-g-root", "siberian-ginseng-acanthopanax-senticosus-06-20-g-root"],
  },
  "siberian-ginseng-acanthopanax-senticosus-06-20-g-root": {
    english: "Siberian Ginseng (Eleuthero)",
    alsoCalled: ["Eleutherococcus senticosus", "Eleuthero"],
    related: ["panax-ginseng-extract-korean-ginseng-06-20-g-root", "american-ginseng-panax-quinquefolius-l", "ashwagandha-asgandh-nagauri"],
  },
  "silybum-marianum-extract-silymarin": {
    english: "Milk Thistle (Silymarin)",
    alsoCalled: ["Silybum marianum", "Silymarin", "Milk Thistle"],
    related: ["picrorhiza-kurroa-extract", "phyllanthus-amarus-extract", "glycyrrhiza-glabra-extract"],
  },
  "spirulina-spirulina-platensisarthrospira-platensis": {
    english: "Spirulina",
    sci: "Arthrospira platensis", part: "Whole thallus",
    alsoCalled: ["Blue-Green Algae", "Spirulina platensis"],
    related: ["phycocyanin-from-spirulina-platensis-dried-powder", "chlorella-vulgaris-dried-powder"],
  },
  "phycocyanin-from-spirulina-platensis-dried-powder": {
    english: "Phycocyanin (Spirulina)",
    alsoCalled: ["C-Phycocyanin", "Spirulina Phycocyanin", "C-PC"],
    related: ["spirulina-spirulina-platensisarthrospira-platensis", "chlorella-vulgaris-dried-powder"],
  },
  "chlorella-vulgaris-dried-powder": {
    english: "Chlorella",
    alsoCalled: ["Chlorella vulgaris", "Green Algae"],
    related: ["spirulina-spirulina-platensisarthrospira-platensis", "phycocyanin-from-spirulina-platensis-dried-powder"],
  },
  "grape-seed-extract": {
    english: "Grape Seed Extract",
    alsoCalled: ["Vitis vinifera", "OPC", "Proanthocyanidins"],
    related: ["draksha-munakka", "vitis-alba-and-vinifera-fruit-dried-powderconcentrate-standardized", "vaccinium-myrtillus-extract"],
  },
  "vaccinium-myrtillus-extract": {
    english: "Bilberry",
    alsoCalled: ["Vaccinium myrtillus", "European Blueberry"],
    related: ["vaccinium-oxycoccosmacrocarpon-fruit-dried-powderconcentrate-standardized", "grape-seed-extract"],
  },
  "vaccinium-oxycoccosmacrocarpon-fruit-dried-powderconcentrate-standardized": {
    english: "Cranberry",
    alsoCalled: ["Vaccinium macrocarpon", "Cranberry", "PAC source"],
    related: ["vaccinium-myrtillus-extract", "grape-seed-extract"],
  },
  "sambucus-nigra-extract": {
    english: "Elderberry",
    alsoCalled: ["Sambucus nigra", "Black Elderberry"],
    related: ["vaccinium-myrtillus-extract", "vaccinium-oxycoccosmacrocarpon-fruit-dried-powderconcentrate-standardized"],
  },
  "dadima-anar": {
    english: "Pomegranate",
    sci: "Punica granatum", part: "Fruit",
    alsoCalled: ["Anar", "Dadima"],
    related: ["punica-granatum-fruitseedskin-extractleafpowder", "ellagic-acid", "draksha-munakka"],
  },
  "punica-granatum-fruitseedskin-extractleafpowder": {
    english: "Pomegranate",
    alsoCalled: ["Punica granatum", "Anar", "Dadima"],
    related: ["dadima-anar", "ellagic-acid"],
  },
  "draksha-munakka": {
    english: "Grapes / Raisins (Draksha)",
    sci: "Vitis vinifera", part: "Fruit",
    alsoCalled: ["Munakka", "Draksha"],
    related: ["vitis-alba-and-vinifera-fruit-dried-powderconcentrate-standardized", "grape-seed-extract"],
  },
  "vitis-alba-and-vinifera-fruit-dried-powderconcentrate-standardized": {
    english: "Grapes (Draksha)",
    alsoCalled: ["Vitis vinifera", "Munakka", "Draksha"],
    related: ["draksha-munakka", "grape-seed-extract"],
  },
  "amlavetasa-sea-buckthorn": {
    english: "Sea Buckthorn",
    sci: "Hippophae rhamnoides", part: "Fruit",
    alsoCalled: ["Amlavetasa"],
    related: ["amalaki-anwala-amla", "dadima-anar"],
  },
  "anjeer-fig": {
    english: "Fig (Anjeer)",
    sci: "Ficus carica", part: "Fruit",
    alsoCalled: ["Anjeer"],
    related: ["draksha-munakka", "amlika-tamarind"],
  },
  "akshod-akhrot-walnut": {
    english: "Walnut",
    sci: "Juglans regia", part: "Seed",
    alsoCalled: ["Akhrot"],
    related: ["alasi-linseed-flaxseed", "draksha-munakka"],
  },
  "alasi-linseed-flaxseed": {
    english: "Flaxseed (Linseed)",
    sci: "Linum usitatissimum", part: "Seed",
    alsoCalled: ["Alasi", "Linseed"],
    related: ["akshod-akhrot-walnut", "methika-methi"],
  },
  "amlika-tamarind": {
    english: "Tamarind",
    sci: "Tamarindus indica", part: "Fruit",
    alsoCalled: ["Imli", "Amlika"],
    related: ["vrukshamala-kokam", "anjeer-fig"],
  },
  "ananas-pineapple": {
    english: "Pineapple",
    sci: "Ananas comosus", part: "Fruit",
    alsoCalled: ["Bromelain source"],
    related: ["dadima-anar", "amalaki-anwala-amla"],
  },
  "anantmula": {
    english: "Sariva (Indian Sarsaparilla)",
    sci: "Hemidesmus indicus", part: "Root",
    alsoCalled: ["Anantmool", "Indian Sarsaparilla"],
    related: ["manjishta-manjeeth", "guduchi-giloy-giloya"],
  },
  "ashok": {
    english: "Ashoka",
    sci: "Saraca asoca", part: "Bark",
    alsoCalled: ["Ashok Tree"],
    related: ["shatawar", "manjishta-manjeeth"],
  },
  "anethum-graveolens-seeds-and-oil": {
    english: "Dill",
    alsoCalled: ["Anethum graveolens", "Sowa", "Shatahva"],
    related: ["mishraya-sounf-fennel", "anisoon-aniseed"],
  },
  "anisoon-aniseed": {
    english: "Aniseed",
    sci: "Pimpinella anisum", part: "Fruit",
    alsoCalled: ["Anisoon"],
    related: ["mishraya-sounf-fennel", "foeniculum-vulgare-fruit-oilextract"],
  },
  "peppermint-sat-pudina": {
    english: "Peppermint",
    sci: "Mentha piperita", part: "Herb",
    alsoCalled: ["Sat Pudina", "Pudina"],
    related: ["putina-pudina", "tulasi-surasa"],
  },
};

// Keys reserved/empty must be ignored
for (const k of Object.keys(BOTANICAL_CANON)) {
  if (!BOTANICAL_CANON[k] || !BOTANICAL_CANON[k].english) delete BOTANICAL_CANON[k];
}
