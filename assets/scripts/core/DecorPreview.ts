import { DECOR, DecorSlot } from './Chapter';
import { State } from './State';
// Presentation-only. This class never writes to GameSession or SnapshotStore.
export class DecorPreview {
    private selected: string | null = null;
    get id(): string | null { return this.selected; }
    select(id: string): boolean { if (!DECOR.some(d => d.id === id)) return false; this.selected = id; return true; }
    cancel(): void { this.selected = null; }
    displayed(slot: DecorSlot, state: State): string {
        const decor = DECOR.find(d => d.id === this.selected);
        return decor?.slot === slot ? decor.id : state.activeDecorBySlot[slot];
    }
}
