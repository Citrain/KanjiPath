export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  id?: string;
  className?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  ariaLabelledBy,
  id,
  className = '',
}: SliderProps) {
  const ratio = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      id={id}
      value={value}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onChange={(event) => onChange(Number(event.target.value))}
      className={`w-full ${className}`}
      style={{
        backgroundImage: `linear-gradient(to right, var(--accent) ${ratio}%, var(--surface-3) ${ratio}%)`,
      }}
    />
  );
}
