import { RecommendationCategory } from '@prisma/client';

export interface CatalogSeedEntry {
  title: string;
  description: string;
  category: RecommendationCategory;
  neighborhood: string;
  durationMinutes: number;
  minDurationMinutes: number;
  priceLevel: number;
  premiumScore: number;
  sourceType: 'SEED';
  tags: string[];
  suitableWindows: string[];
  isActive: true;
}

export const CATALOG_SEED_DATA: CatalogSeedEntry[] = [
  // ─── Restaurants ───────────────────────────────────────────────────────────
  {
    title: 'Executive Garden Bistro (Demo)',
    description:
      'Refined Franco-Brazilian cuisine in a serene garden setting. Private dining rooms available for business lunches. Known for attentive, discreet service.',
    category: RecommendationCategory.RESTAURANT,
    neighborhood: 'Jardins',
    durationMinutes: 75,
    minDurationMinutes: 45,
    priceLevel: 4,
    premiumScore: 5,
    sourceType: 'SEED',
    tags: ['french', 'brazilian', 'private-room', 'business-lunch', 'garden'],
    suitableWindows: ['LUNCH', 'DINNER'],
    isActive: true,
  },
  {
    title: 'Itaim Prime Steakhouse (Demo)',
    description:
      'Premium aged beef and executive cocktails in a discreet, modern environment. Popular with C-suite professionals for client entertainment.',
    category: RecommendationCategory.RESTAURANT,
    neighborhood: 'Itaim Bibi',
    durationMinutes: 90,
    minDurationMinutes: 60,
    priceLevel: 4,
    premiumScore: 5,
    sourceType: 'SEED',
    tags: ['steakhouse', 'business-dinner', 'cocktails', 'premium'],
    suitableWindows: ['LUNCH', 'DINNER'],
    isActive: true,
  },
  {
    title: 'Vila Nova Sushi Omakase (Demo)',
    description:
      'Intimate omakase counter experience with Japanese-Brazilian fusion. Reservations required. Maximum 12 seats.',
    category: RecommendationCategory.RESTAURANT,
    neighborhood: 'Vila Nova Conceição',
    durationMinutes: 90,
    minDurationMinutes: 75,
    priceLevel: 4,
    premiumScore: 5,
    sourceType: 'SEED',
    tags: ['japanese', 'omakase', 'fusion', 'intimate'],
    suitableWindows: ['LUNCH', 'DINNER'],
    isActive: true,
  },
  {
    title: 'Pinheiros Market Table (Demo)',
    description:
      'Contemporary Brazilian cuisine using local produce. Relaxed, creative atmosphere. Ideal for informal business conversations.',
    category: RecommendationCategory.RESTAURANT,
    neighborhood: 'Pinheiros',
    durationMinutes: 60,
    minDurationMinutes: 45,
    priceLevel: 3,
    premiumScore: 4,
    sourceType: 'SEED',
    tags: ['brazilian', 'local-produce', 'casual', 'creative'],
    suitableWindows: ['LUNCH', 'DINNER', 'ANY'],
    isActive: true,
  },

  // ─── Wellness ──────────────────────────────────────────────────────────────
  {
    title: 'Jardins Wellness Suite (Demo)',
    description:
      'Executive massage and relaxation suite. Book 45-minute or 75-minute slots. Specializes in sports massage and decompression therapy for frequent travellers.',
    category: RecommendationCategory.WELLNESS,
    neighborhood: 'Jardins',
    durationMinutes: 60,
    minDurationMinutes: 45,
    priceLevel: 3,
    premiumScore: 4,
    sourceType: 'SEED',
    tags: ['massage', 'relaxation', 'executive', 'travellers'],
    suitableWindows: ['MORNING', 'AFTERNOON', 'AFTER_MEETING', 'EVENING', 'ANY'],
    isActive: true,
  },
  {
    title: 'Itaim Executive Spa (Demo)',
    description:
      'Full-service day spa with business lounge access. Offers express treatments (30 min) and signature experiences (120 min). Walking distance from major corporate towers.',
    category: RecommendationCategory.WELLNESS,
    neighborhood: 'Itaim Bibi',
    durationMinutes: 75,
    minDurationMinutes: 30,
    priceLevel: 4,
    premiumScore: 5,
    sourceType: 'SEED',
    tags: ['spa', 'business-lounge', 'express-treatment', 'corporate'],
    suitableWindows: ['MORNING', 'AFTER_MEETING', 'EVENING', 'ANY'],
    isActive: true,
  },
  {
    title: 'Paulista Mindfulness Studio (Demo)',
    description:
      'Guided meditation and breathwork sessions tailored for executives. 25-minute and 50-minute group or private sessions available.',
    category: RecommendationCategory.WELLNESS,
    neighborhood: 'Bela Vista',
    durationMinutes: 50,
    minDurationMinutes: 25,
    priceLevel: 2,
    premiumScore: 3,
    sourceType: 'SEED',
    tags: ['meditation', 'breathwork', 'mindfulness', 'short-session'],
    suitableWindows: ['MORNING', 'AFTER_MEETING', 'ANY'],
    isActive: true,
  },

  // ─── Executive Cafés / Work Lounges ───────────────────────────────────────
  {
    title: 'Faria Lima Work Lounge (Demo)',
    description:
      'Premium co-working café with private meeting pods. Excellent specialty coffee, secure WiFi, and printing facilities. Day passes available.',
    category: RecommendationCategory.BUSINESS_SUPPORT,
    neighborhood: 'Faria Lima',
    durationMinutes: 120,
    minDurationMinutes: 30,
    priceLevel: 2,
    premiumScore: 4,
    sourceType: 'SEED',
    tags: ['coworking', 'wifi', 'coffee', 'meeting-pods', 'printing'],
    suitableWindows: ['MORNING', 'LUNCH', 'AFTERNOON', 'ANY'],
    isActive: true,
  },
  {
    title: 'Jardins Executive Café (Demo)',
    description:
      'Quiet, refined café popular with executives. Specialty Brazilian coffees, light menu, and discreet corners for calls. No time limit.',
    category: RecommendationCategory.BUSINESS_SUPPORT,
    neighborhood: 'Jardins',
    durationMinutes: 60,
    minDurationMinutes: 20,
    priceLevel: 2,
    premiumScore: 3,
    sourceType: 'SEED',
    tags: ['cafe', 'quiet', 'specialty-coffee', 'executive'],
    suitableWindows: ['BREAKFAST', 'MORNING', 'LUNCH', 'AFTERNOON', 'ANY'],
    isActive: true,
  },

  // ─── Short Bleisure Experiences ───────────────────────────────────────────
  {
    title: 'MASP 45-Minute Express Visit (Demo)',
    description:
      'Curated 45-minute self-guided tour of the Museu de Arte de São Paulo highlights. Conveniently located on Avenida Paulista. Cultural break between meetings.',
    category: RecommendationCategory.SHORT_EXPERIENCE,
    neighborhood: 'Bela Vista',
    durationMinutes: 45,
    minDurationMinutes: 30,
    priceLevel: 1,
    premiumScore: 3,
    sourceType: 'SEED',
    tags: ['culture', 'museum', 'art', 'paulista', 'express'],
    suitableWindows: ['LUNCH', 'AFTER_MEETING', 'AFTERNOON', 'ANY'],
    isActive: true,
  },
  {
    title: 'Ibirapuera Park Walk (Demo)',
    description:
      'Scenic 30-45 minute guided walk through Ibirapuera Park. Combines light exercise with cultural commentary. Perfect between morning and afternoon meetings.',
    category: RecommendationCategory.MICRO_EXPERIENCE,
    neighborhood: 'Ibirapuera',
    durationMinutes: 45,
    minDurationMinutes: 30,
    priceLevel: 1,
    premiumScore: 3,
    sourceType: 'SEED',
    tags: ['outdoors', 'park', 'walking', 'nature', 'exercise'],
    suitableWindows: ['MORNING', 'LUNCH', 'AFTER_MEETING', 'ANY'],
    isActive: true,
  },
  {
    title: 'Vila Madalena Street Art Tour (Demo)',
    description:
      'Private 60-minute walking tour of São Paulo\'s world-renowned street art district. Includes commentary on local artists and cultural context.',
    category: RecommendationCategory.SHORT_EXPERIENCE,
    neighborhood: 'Vila Madalena',
    durationMinutes: 60,
    minDurationMinutes: 45,
    priceLevel: 2,
    premiumScore: 4,
    sourceType: 'SEED',
    tags: ['art', 'street-art', 'walking-tour', 'culture', 'private'],
    suitableWindows: ['AFTER_MEETING', 'AFTERNOON', 'EVENING', 'ANY'],
    isActive: true,
  },

  // ─── Business Support ──────────────────────────────────────────────────────
  {
    title: 'GRU International Airport Lounge Access (Demo)',
    description:
      'Premium lounge access at Guarulhos International Airport. Includes shower facilities, business services, and premium dining. Bookable on demand.',
    category: RecommendationCategory.BUSINESS_SUPPORT,
    neighborhood: 'Guarulhos',
    durationMinutes: 90,
    minDurationMinutes: 30,
    priceLevel: 3,
    premiumScore: 4,
    sourceType: 'SEED',
    tags: ['airport', 'lounge', 'business', 'shower', 'dining', 'travel'],
    suitableWindows: ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'],
    isActive: true,
  },
  {
    title: 'Executive Pharmacy & Health Concierge (Demo)',
    description:
      'Premium pharmacy with English-speaking staff, on-demand prescription assistance, and health kit delivery to your hotel. Available 7am-10pm.',
    category: RecommendationCategory.BUSINESS_SUPPORT,
    neighborhood: 'Itaim Bibi',
    durationMinutes: 20,
    minDurationMinutes: 15,
    priceLevel: 2,
    premiumScore: 3,
    sourceType: 'SEED',
    tags: ['pharmacy', 'health', 'english-speaking', 'delivery', 'convenience'],
    suitableWindows: ['MORNING', 'LUNCH', 'AFTERNOON', 'EVENING', 'ANY'],
    isActive: true,
  },
  {
    title: 'Micro Wine Tasting — Jardins (Demo)',
    description:
      'Intimate 45-minute guided tasting of 4 Brazilian and South American wines. Private rooms available. Perfect for after-work wind-down or informal client entertainment.',
    category: RecommendationCategory.MICRO_EXPERIENCE,
    neighborhood: 'Jardins',
    durationMinutes: 45,
    minDurationMinutes: 40,
    priceLevel: 3,
    premiumScore: 4,
    sourceType: 'SEED',
    tags: ['wine', 'tasting', 'private', 'evening', 'client-entertainment'],
    suitableWindows: ['AFTER_MEETING', 'EVENING', 'DINNER'],
    isActive: true,
  },
];
