export interface GardenClock { readonly kind: 'injected-test' | 'server'; now(): number | null }
// S3 only: an explicit UTC anchor plus monotonic elapsed time. Never device Date.now().
export class InjectedTestClock implements GardenClock {
    readonly kind = 'injected-test' as const;
    private offset = 0;
    available = true;
    private readonly monoStart: number;
    constructor(private anchor: number, private readonly monotonic: () => number) { this.monoStart = monotonic(); }
    now(): number | null { return this.available ? Math.floor(this.anchor + this.offset + Math.max(0,this.monotonic()-this.monoStart)) : null; }
    advance(ms: number): void { if(!Number.isSafeInteger(ms) || ms<0)throw new Error('Invalid test time increment');this.offset+=ms; }
}
export function shanghaiDay(utcMs: number): string { return new Date(utcMs+8*3600000).toISOString().slice(0,10); }
