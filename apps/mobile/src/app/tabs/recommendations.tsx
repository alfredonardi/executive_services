import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Colors, Typography, Spacing } from '../../theme/tokens';

interface RecommendationCard {
  id: string;
  category: string;
  title: string;
  description: string;
  neighborhood: string;
  duration: string;
  priceLevel: number;
  reason: string;
}

const MOCK_RECOMMENDATIONS: RecommendationCard[] = [
  {
    id: '1',
    category: 'RESTAURANT',
    title: 'Consulado Mineiro',
    description:
      'Refined São Paulo cuisine with a creative take on Brazilian classics. Perfect for a business lunch.',
    neighborhood: 'Jardins',
    duration: '90 min',
    priceLevel: 4,
    reason: 'Matches your 90-min window at 10:30 AM and your preference for local cuisine.',
  },
  {
    id: '2',
    category: 'WELLNESS',
    title: 'Alto de Pinheiros Spa',
    description:
      'Private wellness suite with massage, sauna and pool. Pre-booking required.',
    neighborhood: 'Alto de Pinheiros',
    duration: '2 hours',
    priceLevel: 3,
    reason: 'Based on your 4-hour evening window and wellness preference.',
  },
  {
    id: '3',
    category: 'EXPERIENCE',
    title: 'MASP After Hours',
    description:
      'Private evening access to São Paulo Museum of Art with a curator-led tour of the Latin American collection.',
    neighborhood: 'Paulista',
    duration: '1.5 hours',
    priceLevel: 3,
    reason: 'Cultural experience matching your interest in art and available this evening.',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  RESTAURANT: 'DINING',
  WELLNESS: 'WELLNESS',
  EXPERIENCE: 'EXPERIENCE',
  BUSINESS_SUPPORT: 'BUSINESS',
  MICRO_EXPERIENCE: 'MICRO',
};

export default function RecommendationsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>For You</Text>
        <Text style={styles.headerSubtitle}>Curated for today's schedule</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_RECOMMENDATIONS.map((rec) => (
          <RecommendationCardView key={rec.id} rec={rec} />
        ))}
      </ScrollView>
    </View>
  );
}

function RecommendationCardView({ rec }: { rec: RecommendationCard }) {
  return (
    <View style={styles.card}>
      {/* Category badge */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>
          {CATEGORY_LABELS[rec.category] ?? rec.category}
        </Text>
      </View>

      {/* Title & neighborhood */}
      <Text style={styles.cardTitle}>{rec.title}</Text>
      <Text style={styles.cardNeighborhood}>
        {rec.neighborhood} · {rec.duration} · {'$'.repeat(rec.priceLevel)}
      </Text>

      {/* Description */}
      <Text style={styles.cardDescription}>{rec.description}</Text>

      {/* Why this? */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>WHY THIS</Text>
        <Text style={styles.reasonText}>{rec.reason}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionPrimary}>
          <Text style={styles.actionPrimaryText}>Request this</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionSecondary}>
          <Text style={styles.actionSecondaryText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionSecondary}>
          <Text style={styles.actionSecondaryText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing[6],
    gap: Spacing[4],
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.midGray,
    borderRadius: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    marginBottom: Spacing[3],
  },
  categoryText: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.wider,
  },
  cardTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.white,
    marginBottom: 4,
  },
  cardNeighborhood: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
    marginBottom: Spacing[3],
  },
  cardDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    lineHeight: 20,
    marginBottom: Spacing[4],
  },
  reasonBox: {
    backgroundColor: Colors.charcoal,
    borderRadius: 8,
    padding: Spacing[3],
    marginBottom: Spacing[4],
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.wider,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.lightGray,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: Colors.gold,
    borderRadius: 6,
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  actionPrimaryText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.black,
  },
  actionSecondary: {
    flex: 0,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  actionSecondaryText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
  },
});
