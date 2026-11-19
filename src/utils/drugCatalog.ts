export type DrugCategory =
  | 'Antibiotics'
  | 'Pain & Fever'
  | 'Allergy & Respiratory'
  | 'Heart & Metabolism'
  | 'Digestive & Other';

export interface DrugCatalogEntry {
  genericName: string;
  brandNames: string[];
  category: DrugCategory;
  drugClass: string;
  commonUse: string;
  typicalLiquidMg?: number;
  typicalLiquidPerMl?: number;
}

export interface DrugIdentityMatch {
  inputQuery: string;
  matchedAs: 'brand' | 'generic';
  matchedTerm: string;
  genericName: string;
  brandNames: string[];
  category: DrugCategory;
  drugClass: string;
  commonUse: string;
  typicalLiquidMg?: number;
  typicalLiquidPerMl?: number;
}

export const DRUG_CATALOG: DrugCatalogEntry[] = [
  // Antibiotics
  {
    genericName: 'Amoxicillin',
    brandNames: ['Amoxil', 'Mox', 'Trimox', 'Novamox', 'Almox', 'Wymox', 'Moxatag'],
    category: 'Antibiotics',
    drugClass: 'Penicillin Antibiotic',
    commonUse: 'Ear, throat, sinus & respiratory infections',
    typicalLiquidMg: 250,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Amoxicillin-Clavulanate',
    brandNames: ['Augmentin', 'Moxikind-CV', 'Clavam', 'Co-Amoxiclav', 'Advent', 'Augmentin Duo', 'Amoxyclav'],
    category: 'Antibiotics',
    drugClass: 'Penicillin + Beta-Lactamase Inhibitor',
    commonUse: 'Sinus, dental, ear & skin infections',
    typicalLiquidMg: 228.5,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Azithromycin',
    brandNames: ['Zithromax', 'Z-Pak', 'Azithral', 'Azee', 'Zmax', 'Azax', 'Aziwok'],
    category: 'Antibiotics',
    drugClass: 'Macrolide Antibiotic',
    commonUse: 'Respiratory, throat & atypical bacterial infections',
    typicalLiquidMg: 200,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Cephalexin',
    brandNames: ['Keflex', 'Sporidex', 'Phexin', 'Cefalexin', 'Biocef'],
    category: 'Antibiotics',
    drugClass: '1st-Gen Cephalosporin',
    commonUse: 'Skin, soft tissue & urinary tract infections',
    typicalLiquidMg: 250,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Cefixime',
    brandNames: ['Suprax', 'Taxim-O', 'Zifi', 'Cefolac', 'Mahacef'],
    category: 'Antibiotics',
    drugClass: '3rd-Gen Cephalosporin',
    commonUse: 'Respiratory, typhoid & urinary tract infections',
    typicalLiquidMg: 100,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Cefdinir',
    brandNames: ['Omnicef', 'Adcef', 'Cefdiel'],
    category: 'Antibiotics',
    drugClass: '3rd-Gen Cephalosporin',
    commonUse: 'Pediatric ear, sinus & throat infections',
    typicalLiquidMg: 125,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Cefuroxime',
    brandNames: ['Ceftin', 'Zinnat', 'Cefakind', 'Altacef'],
    category: 'Antibiotics',
    drugClass: '2nd-Gen Cephalosporin',
    commonUse: 'Bronchitis, sinusitis & Lyme disease',
    typicalLiquidMg: 125,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Doxycycline',
    brandNames: ['Vibramycin', 'Doryx', 'Doxt-SL', 'Doxy-1', 'Monodox', 'Oracea'],
    category: 'Antibiotics',
    drugClass: 'Tetracycline Antibiotic',
    commonUse: 'Tick-borne, acne & respiratory infections',
  },
  {
    genericName: 'Ciprofloxacin',
    brandNames: ['Cipro', 'Ciplox', 'Cifran', 'Ciprobay', 'Ciproxin'],
    category: 'Antibiotics',
    drugClass: 'Fluoroquinolone Antibiotic',
    commonUse: 'Complicated urinary & gastrointestinal infections',
  },
  {
    genericName: 'Levofloxacin',
    brandNames: ['Levaquin', 'Levoflox', 'Glevo', 'Loxof'],
    category: 'Antibiotics',
    drugClass: 'Fluoroquinolone Antibiotic',
    commonUse: 'Pneumonia, sinusitis & complicated UTI',
  },
  {
    genericName: 'Trimethoprim-Sulfamethoxazole',
    brandNames: ['Bactrim', 'Septra', 'Septran', 'Co-trimoxazole', 'Sulfatrim'],
    category: 'Antibiotics',
    drugClass: 'Sulfonamide Antibiotic',
    commonUse: 'Urinary & MRSA skin infections',
    typicalLiquidMg: 240,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Metronidazole',
    brandNames: ['Flagyl', 'Metrogyl', 'Metro', 'Aristogyl'],
    category: 'Antibiotics',
    drugClass: 'Nitroimidazole Antibiotic',
    commonUse: 'Anaerobic, GI & dental infections',
    typicalLiquidMg: 200,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Clarithromycin',
    brandNames: ['Biaxin', 'Claribid', 'Klacid', 'Crixan'],
    category: 'Antibiotics',
    drugClass: 'Macrolide Antibiotic',
    commonUse: 'Respiratory & H. pylori infections',
    typicalLiquidMg: 125,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Clindamycin',
    brandNames: ['Cleocin', 'Dalacin C', 'Clindac'],
    category: 'Antibiotics',
    drugClass: 'Lincosamide Antibiotic',
    commonUse: 'Dental, bone & serious skin infections',
  },

  // Pain & Fever
  {
    genericName: 'Acetaminophen (Paracetamol)',
    brandNames: ['Tylenol', 'Calpol', 'Crocin', 'Dolo 650', 'Dolo', 'Panadol', 'P-500', 'Pacimol', 'Metacin', 'Febrex'],
    category: 'Pain & Fever',
    drugClass: 'Analgesic / Antipyretic',
    commonUse: 'Fever reduction & mild-to-moderate pain',
    typicalLiquidMg: 160,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Ibuprofen',
    brandNames: ['Advil', 'Motrin', 'Brufen', 'Nurofen', 'Ibugesic', 'Combiflam'],
    category: 'Pain & Fever',
    drugClass: 'NSAID',
    commonUse: 'Inflammation, fever & musculoskeletal pain',
    typicalLiquidMg: 100,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Naproxen',
    brandNames: ['Aleve', 'Naprosyn', 'Anaprox', 'Naxdom'],
    category: 'Pain & Fever',
    drugClass: 'NSAID',
    commonUse: 'Longer-acting pain, migraine & joint inflammation',
  },
  {
    genericName: 'Aspirin',
    brandNames: ['Disprin', 'Ecosprin', 'Bayer Aspirin', 'Ecotrin', 'Loprin'],
    category: 'Pain & Fever',
    drugClass: 'Salicylate / Antiplatelet',
    commonUse: 'Adult cardiovascular prevention & pain',
  },
  {
    genericName: 'Diclofenac',
    brandNames: ['Voltaren', 'Voveran', 'Cataflam', 'Dynapar'],
    category: 'Pain & Fever',
    drugClass: 'NSAID',
    commonUse: 'Joint, arthritis & acute musculoskeletal pain',
  },

  // Allergy & Respiratory
  {
    genericName: 'Cetirizine',
    brandNames: ['Zyrtec', 'Cetzine', 'Okacet', 'Alerid', 'Reactine'],
    category: 'Allergy & Respiratory',
    drugClass: '2nd-Gen Antihistamine',
    commonUse: 'Seasonal allergies, sneezing & hives',
    typicalLiquidMg: 5,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Levocetirizine',
    brandNames: ['Xyzal', 'Levocet', 'Vozet', '1-AL'],
    category: 'Allergy & Respiratory',
    drugClass: '2nd-Gen Antihistamine',
    commonUse: 'Allergic rhinitis & chronic hives',
    typicalLiquidMg: 2.5,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Loratadine',
    brandNames: ['Claritin', 'Alavert', 'Lorfast', 'Clarityn'],
    category: 'Allergy & Respiratory',
    drugClass: '2nd-Gen Antihistamine',
    commonUse: 'Non-drowsy allergy relief',
    typicalLiquidMg: 5,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Fexofenadine',
    brandNames: ['Allegra', 'Telfast', 'Fexova'],
    category: 'Allergy & Respiratory',
    drugClass: '2nd-Gen Antihistamine',
    commonUse: 'Non-drowsy hay fever & hives',
    typicalLiquidMg: 30,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Montelukast',
    brandNames: ['Singulair', 'Montair', 'Romilast', 'Montek'],
    category: 'Allergy & Respiratory',
    drugClass: 'Leukotriene Receptor Antagonist',
    commonUse: 'Asthma control & allergic rhinitis',
  },
  {
    genericName: 'Albuterol (Salbutamol)',
    brandNames: ['Ventolin', 'ProAir', 'Asthalin', 'Proventil'],
    category: 'Allergy & Respiratory',
    drugClass: 'Short-Acting Beta Agonist',
    commonUse: 'Quick-relief asthma & bronchospasm',
  },
  {
    genericName: 'Diphenhydramine',
    brandNames: ['Benadryl', 'Nytol', 'Unisom'],
    category: 'Allergy & Respiratory',
    drugClass: '1st-Gen Antihistamine',
    commonUse: 'Acute allergy relief & itching',
    typicalLiquidMg: 12.5,
    typicalLiquidPerMl: 5,
  },

  // Heart & Metabolism
  {
    genericName: 'Lisinopril',
    brandNames: ['Zestril', 'Prinivil', 'Listril', 'Qbrelis'],
    category: 'Heart & Metabolism',
    drugClass: 'ACE Inhibitor',
    commonUse: 'High blood pressure & heart protection',
  },
  {
    genericName: 'Amlodipine',
    brandNames: ['Norvasc', 'Amlong', 'Stamlo', 'Amlokind'],
    category: 'Heart & Metabolism',
    drugClass: 'Calcium Channel Blocker',
    commonUse: 'High blood pressure & angina',
  },
  {
    genericName: 'Losartan',
    brandNames: ['Cozaar', 'Losar', 'Repace', 'Losakar'],
    category: 'Heart & Metabolism',
    drugClass: 'ARB (Angiotensin Receptor Blocker)',
    commonUse: 'High blood pressure & kidney protection',
  },
  {
    genericName: 'Metformin',
    brandNames: ['Glucophage', 'Glycomet', 'Fortamet', 'Glumetza', 'Obimet'],
    category: 'Heart & Metabolism',
    drugClass: 'Biguanide',
    commonUse: 'Type 2 diabetes blood sugar control',
  },
  {
    genericName: 'Atorvastatin',
    brandNames: ['Lipitor', 'Atorva', 'Storvas', 'Tonact'],
    category: 'Heart & Metabolism',
    drugClass: 'Statin',
    commonUse: 'Cholesterol lowering & heart protection',
  },
  {
    genericName: 'Rosuvastatin',
    brandNames: ['Crestor', 'Rosuvas', 'Rozavel', 'Rosycap'],
    category: 'Heart & Metabolism',
    drugClass: 'Statin',
    commonUse: 'Cholesterol & triglyceride management',
  },
  {
    genericName: 'Warfarin',
    brandNames: ['Coumadin', 'Jantoven', 'Warf'],
    category: 'Heart & Metabolism',
    drugClass: 'Vitamin K Antagonist Anticoagulant',
    commonUse: 'Blood clot prevention',
  },
  {
    genericName: 'Apixaban',
    brandNames: ['Eliquis', 'Apigat'],
    category: 'Heart & Metabolism',
    drugClass: 'Direct Oral Anticoagulant (DOAC)',
    commonUse: 'Stroke & DVT/PE blood clot prevention',
  },

  // Digestive & Other
  {
    genericName: 'Omeprazole',
    brandNames: ['Prilosec', 'Omez', 'Losec', 'Ocid'],
    category: 'Digestive & Other',
    drugClass: 'Proton Pump Inhibitor',
    commonUse: 'Acid reflux, GERD & stomach ulcers',
  },
  {
    genericName: 'Pantoprazole',
    brandNames: ['Protonix', 'Pan-40', 'Pan 40', 'Pantocid', 'Pantodac', 'Pan-D'],
    category: 'Digestive & Other',
    drugClass: 'Proton Pump Inhibitor',
    commonUse: 'Acidity, GERD & erosive esophagitis',
  },
  {
    genericName: 'Esomeprazole',
    brandNames: ['Nexium', 'Nexpro', 'Sompraz'],
    category: 'Digestive & Other',
    drugClass: 'Proton Pump Inhibitor',
    commonUse: 'GERD & acid suppression',
  },
  {
    genericName: 'Ondansetron',
    brandNames: ['Zofran', 'Emeset', 'Ondem', 'Vomikind'],
    category: 'Digestive & Other',
    drugClass: '5-HT3 Antagonist',
    commonUse: 'Nausea & vomiting relief',
    typicalLiquidMg: 4,
    typicalLiquidPerMl: 5,
  },
  {
    genericName: 'Loperamide',
    brandNames: ['Imodium', 'Eldoper', 'Lopamide'],
    category: 'Digestive & Other',
    drugClass: 'Antidiarrheal',
    commonUse: 'Acute non-infectious diarrhea relief',
  },
];

function cleanToken(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Resolves any user-typed drug name (brand or generic, with optional dosage strength like "Dolo 650" or "Augmentin 625")
 * into its structured generic & brand identity.
 */
export function resolveDrugIdentity(rawInput: string): DrugIdentityMatch | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const queryLower = trimmed.toLowerCase();
  const queryClean = cleanToken(trimmed);
  if (queryClean.length < 2) return null;

  // Pass 1: Exact match on generic or brand name
  for (const entry of DRUG_CATALOG) {
    const genericClean = cleanToken(entry.genericName);
    if (queryLower === entry.genericName.toLowerCase() || queryClean === genericClean) {
      return {
        inputQuery: trimmed,
        matchedAs: 'generic',
        matchedTerm: entry.genericName,
        genericName: entry.genericName,
        brandNames: entry.brandNames,
        category: entry.category,
        drugClass: entry.drugClass,
        commonUse: entry.commonUse,
        typicalLiquidMg: entry.typicalLiquidMg,
        typicalLiquidPerMl: entry.typicalLiquidPerMl,
      };
    }

    for (const brand of entry.brandNames) {
      const brandClean = cleanToken(brand);
      if (queryLower === brand.toLowerCase() || queryClean === brandClean) {
        return {
          inputQuery: trimmed,
          matchedAs: 'brand',
          matchedTerm: brand,
          genericName: entry.genericName,
          brandNames: entry.brandNames,
          category: entry.category,
          drugClass: entry.drugClass,
          commonUse: entry.commonUse,
          typicalLiquidMg: entry.typicalLiquidMg,
          typicalLiquidPerMl: entry.typicalLiquidPerMl,
        };
      }
    }
  }

  // Pass 2: Token-boundary match (e.g., "Augmentin 625 Duo", "Calpol 250mg syrup", "Paracetamol 500")
  const queryWords = queryClean.split(' ');

  for (const entry of DRUG_CATALOG) {
    const genericAliases = entry.genericName
      .split(/[()\/]/)
      .map((part) => cleanToken(part))
      .filter((p) => p.length >= 3);

    for (const alias of genericAliases) {
      if (
        queryClean === alias ||
        queryClean.startsWith(`${alias} `) ||
        queryWords.includes(alias)
      ) {
        return {
          inputQuery: trimmed,
          matchedAs: 'generic',
          matchedTerm: entry.genericName,
          genericName: entry.genericName,
          brandNames: entry.brandNames,
          category: entry.category,
          drugClass: entry.drugClass,
          commonUse: entry.commonUse,
          typicalLiquidMg: entry.typicalLiquidMg,
          typicalLiquidPerMl: entry.typicalLiquidPerMl,
        };
      }
    }

    for (const brand of entry.brandNames) {
      const brandClean = cleanToken(brand);
      if (brandClean.length < 3) continue;
      if (
        queryClean === brandClean ||
        queryClean.startsWith(`${brandClean} `) ||
        queryWords.includes(brandClean)
      ) {
        return {
          inputQuery: trimmed,
          matchedAs: 'brand',
          matchedTerm: brand,
          genericName: entry.genericName,
          brandNames: entry.brandNames,
          category: entry.category,
          drugClass: entry.drugClass,
          commonUse: entry.commonUse,
          typicalLiquidMg: entry.typicalLiquidMg,
          typicalLiquidPerMl: entry.typicalLiquidPerMl,
        };
      }
    }
  }

  return null;
}

/**
 * Searches the catalog across generic names, brand names, drug classes, and common uses.
 */
export function searchDrugCatalog(
  query: string,
  category: 'All' | DrugCategory = 'All',
  limit = 8
): DrugCatalogEntry[] {
  const queryLower = query.trim().toLowerCase();
  const exactMatch = resolveDrugIdentity(query);

  const filtered = DRUG_CATALOG.filter((entry) => {
    const catOk = category === 'All' || entry.category === category;
    if (!catOk) return false;
    if (!queryLower) return true;
    // If the user clicked a card and selected an exact generic or brand name, still show category list unless filtering
    if (
      exactMatch &&
      (queryLower === entry.genericName.toLowerCase() ||
        entry.brandNames.some((b) => b.toLowerCase() === queryLower))
    ) {
      return true;
    }
    return (
      entry.genericName.toLowerCase().includes(queryLower) ||
      entry.brandNames.some((b) => b.toLowerCase().includes(queryLower)) ||
      entry.drugClass.toLowerCase().includes(queryLower) ||
      entry.commonUse.toLowerCase().includes(queryLower)
    );
  });

  // Sort exact brand/generic matches to the top
  if (queryLower) {
    filtered.sort((a, b) => {
      const aBrandExact = a.brandNames.some((bn) => bn.toLowerCase().startsWith(queryLower)) ? 0 : 1;
      const bBrandExact = b.brandNames.some((bn) => bn.toLowerCase().startsWith(queryLower)) ? 0 : 1;
      if (aBrandExact !== bBrandExact) return aBrandExact - bBrandExact;
      const aGenStarts = a.genericName.toLowerCase().startsWith(queryLower) ? 0 : 1;
      const bGenStarts = b.genericName.toLowerCase().startsWith(queryLower) ? 0 : 1;
      return aGenStarts - bGenStarts;
    });
  }

  return filtered.slice(0, limit);
}

/**
 * Expands a medication name to include its generic equivalent so deterministic safety rules
 * (allergy screening, pediatric age rules, and interaction screening) automatically work on brand names.
 */
export function expandMedicationWithGeneric(rawInput: string): string {
  const identity = resolveDrugIdentity(rawInput);
  if (!identity) return rawInput.trim();
  if (rawInput.toLowerCase().includes(identity.genericName.toLowerCase())) {
    return rawInput.trim();
  }
  return `${rawInput.trim()} (${identity.genericName})`;
}
