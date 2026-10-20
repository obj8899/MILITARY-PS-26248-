export type EffectsMode = "Full" | "Reduced" | "Off";

export function Atmosphere({ mode }: { mode: EffectsMode }) {
  return <div aria-hidden="true" className={`atmosphere atmosphere-${mode.toLowerCase()}`} />;
}
