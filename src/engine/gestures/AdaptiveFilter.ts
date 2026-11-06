/** Speed-adaptive low pass: steady hands stay quiet, deliberate movement stays responsive. */
export class AdaptiveFilter {
  private value: number | null = null;
  private raw = 0;
  private velocity = 0;

  reset() {
    this.value = null;
    this.velocity = 0;
  }

  update(value: number, dt: number, smoothing: number) {
    if (this.value === null) {
      this.raw = this.value = value;
      return value;
    }
    const seconds = Math.max(0.001, Math.min(0.18, dt / 1000));
    const alpha = (cutoff: number) => 1 - Math.exp(-2 * Math.PI * cutoff * seconds);
    this.velocity += ((value - this.raw) / seconds - this.velocity) * alpha(1.5);
    this.raw = value;
    const amount = Math.max(0, Math.min(1, smoothing));
    const cutoff = 1.2 + (1 - amount) * 5 + Math.abs(this.velocity) * 14;
    this.value += (value - this.value) * alpha(cutoff);
    return this.value;
  }
}
