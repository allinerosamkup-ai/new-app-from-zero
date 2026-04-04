import { labelMood, moodContent } from "../../features/aura/data";
import { useAuraStore } from "../../features/aura/store";
import type { MoodOption } from "../../features/aura/types";

export function MoodSelector() {
  const { state, setMood } = useAuraStore();

  return (
    <div className="aura-chip-group">
      {Object.keys(moodContent).map((item) => (
        <button
          key={item}
          type="button"
          className={item === state.mood ? "aura-chip active" : "aura-chip"}
          onClick={() => setMood(item as MoodOption)}
        >
          {labelMood(item as MoodOption)}
        </button>
      ))}
    </div>
  );
}
