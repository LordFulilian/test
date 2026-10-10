import { CONFIG, Sku, TestChain } from './Config';
export interface Order { id: string; needs: { sku: Sku; count: number }[]; reward: number }
const GUI_CYCLE: { sku: Sku; count: number }[][] = [
    [{ sku: 'GUI_2', count: 1 }], [{ sku: 'GUI_3', count: 1 }],
    [{ sku: 'GUI_2', count: 2 }], [{ sku: 'GUI_3', count: 1 }],
];
const DUAL_CYCLE: { sku: Sku; count: number }[][] = [
    [{ sku: 'GUI_2', count: 1 }], [{ sku: 'JAS_2', count: 1 }],
    [{ sku: 'GUI_3', count: 1 }], [{ sku: 'JAS_3', count: 1 }],
    [{ sku: 'GUI_2', count: 1 }, { sku: 'JAS_2', count: 1 }],
];
export function makeOrder(chain: TestChain, index: number): Order {
    const cycle = chain === 'DUAL' ? DUAL_CYCLE : GUI_CYCLE;
    const needs = cycle[index % cycle.length].map(n => ({ ...n }));
    return { id: `S-${chain}-${index}`, needs,
        reward: needs.reduce((sum, n) => sum + CONFIG.price[Number(n.sku.slice(-1))] * n.count, 0) };
}
const MEDIUM_CYCLE: {sku:Sku;count:number}[][]=[
    [{sku:'GUI_4',count:1}],[{sku:'JAS_4',count:1}],[{sku:'GUI_3',count:1},{sku:'JAS_3',count:1}],
];
export function makeMediumOrder(index:number):Order {const needs=MEDIUM_CYCLE[index%MEDIUM_CYCLE.length].map(n=>({...n}));
    return {id:`M-${index}`,needs,reward:needs.reduce((sum,n)=>sum+CONFIG.price[Number(n.sku.slice(-1))]*n.count,0)};}
