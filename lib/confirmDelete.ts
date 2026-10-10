/** Shared delete-confirmation for workouts — used everywhere delete is offered, for consistency. */
import { Alert } from 'react-native';
import { deleteWorkouts } from '@/db/workouts';
import { haptics } from '@/lib/haptics';

export function confirmDeleteWorkouts(ids: string[], onDone: () => void) {
  const n = ids.length;
  if (n === 0) return;
  Alert.alert(
    'Delete workouts?',
    `Delete ${n} workout${n > 1 ? 's' : ''}? Deleted workouts can’t be retrieved.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          haptics.warning();
          await deleteWorkouts(ids);
          onDone();
        },
      },
    ]
  );
}
