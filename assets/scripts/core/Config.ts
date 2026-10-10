export type Scent = 'GUI' | 'JAS';
export type Sku = `${Scent}_${1 | 2 | 3 | 4}`;
export type PresetId = 'A_5x4' | 'B_6x5';
export type TestChain = 'GUI' | 'DUAL';
export const CONFIG = {
    version: 's1.1', schemaVersion: 1, spawnIntervalMs: 350, dragThreshold: 6,
    mergeDuration: 0.25, fullNoticeIntervalMs: 2000,
    prototypeBoardPreset: 'B_6x5' as PresetId,
    productionBoardPreset: null,
    presets: { A_5x4: { cols: 5, rows: 4, gap: 8 }, B_6x5: { cols: 6, rows: 5, gap: 8 } },
    sell: [0, 0, 5, 12, 30], price: [0, 0, 20, 50, 120],
};
export const isSku = (v: unknown): v is Sku => typeof v === 'string' && /^(GUI|JAS)_[1-4]$/.test(v);
export const scentOf = (v: Sku): Scent => v.slice(0, 3) as Scent;
export const levelOf = (v: Sku): number => Number(v.slice(-1));
export function itemName(sku: Sku): string {
    return `${scentOf(sku) === 'GUI' ? '桂花' : '茉莉'}${['', '素袋', '绣囊', '缎囊', '礼匣'][levelOf(sku)]}`;
}
export function profileId(preset: PresetId, chain: TestChain): string { return `s1-core-${preset}-${chain}`; }
