/** Plan/premake a workout (no timer, no session). Renders the builder in plan mode. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  if (!id) return null;
  return <WorkoutBuilder mode="plan" workoutId={id} onExit={() => router.back()} />;
}
