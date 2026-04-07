import { Tabs } from 'expo-router';
import { Colors } from '../../theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.charcoal,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.gray,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            // Using text icon as placeholder — use Expo vector icons in production
            // <Ionicons name="calendar-outline" size={24} color={color} />
            null
          ),
        }}
      />
      <Tabs.Screen
        name="concierge"
        options={{
          title: 'Concierge',
        }}
      />
      <Tabs.Screen
        name="recommendations"
        options={{
          title: 'For You',
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
        }}
      />
    </Tabs>
  );
}
