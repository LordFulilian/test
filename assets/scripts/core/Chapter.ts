import type { State } from './State';
import { makeOrder, makeMediumOrder } from './Orders';
import { initializePlots, newPlot } from './Garden';
export const STORY_VERSION = 's2.1';
export const S3_VERSION = 's3.1';
export type DecorSlot = 'LANTERN' | 'CURTAIN' | 'COUNTER';
export interface Decor { id: string; slot: DecorSlot; name: string; cost: number; condition: string }
export const DECOR: readonly Decor[] = [
    { id: 'lantern-default', slot: 'LANTERN', name: '素纸', cost: 0, condition: '' },
    { id: 'lantern-osmanthus', slot: 'LANTERN', name: '桂影', cost: 40, condition: '完成开张首单' },
    { id: 'lantern-celadon', slot: 'LANTERN', name: '青瓷', cost: 40, condition: '完成开张首单' },
    { id: 'curtain-default', slot: 'CURTAIN', name: '素麻', cost: 0, condition: '' },
    { id: 'curtain-apricot', slot: 'CURTAIN', name: '暖杏', cost: 120, condition: '完成阿绫赠友单，并累计交付3单' },
    { id: 'curtain-celadon', slot: 'CURTAIN', name: '青瓷', cost: 120, condition: '完成阿绫赠友单，并累计交付3单' },
    { id: 'counter-default', slot: 'COUNTER', name: '木柜', cost: 0, condition: '' },
    { id: 'counter-apricot', slot: 'COUNTER', name: '暖木', cost: 180, condition: '完成小满的茉莉赠友单' },
    { id: 'counter-celadon', slot: 'COUNTER', name: '青瓷', cost: 180, condition: '完成小满的茉莉赠友单' },
];
export const T0 = { id: 'T0', needs: [{ sku: 'GUI_2' as const, count: 1 }], reward: 40 };
export const C1A = { id: 'C1a', needs: [{ sku: 'GUI_3' as const, count: 2 }], reward: 120 };
export const C2A = { id: 'C2a', needs: [{ sku: 'JAS_3' as const, count: 2 }], reward: 120 };
export const C2B = { id: 'C2b', needs: [{ sku: 'GUI_4' as const, count: 1 },{sku:'JAS_4' as const,count:1}], reward:260 };
export const hasNode = (s: State, node: string): boolean => s.permanentNodes.includes(node);
export function unlocked(s: State, decor: Decor): boolean {
    return decor.cost === 0 || (decor.slot === 'LANTERN' ? hasNode(s, '1A') : decor.slot === 'CURTAIN' ? hasNode(s,'1C') : s.contentMaxChapter===2 && hasNode(s,'2B'));
}
export function storyOrders(s: State): State['orders'] {
    if(s.chapter===2){const chapterOrder=!hasNode(s,'C2a')?[C2A]:hasNode(s,'2C')&&!hasNode(s,'C2b')?[C2B]:[];
        return [s.carryoverShortOrder??makeOrder('DUAL',s.orderCycles.short),makeMediumOrder(s.orderCycles.medium),...chapterOrder.map(o=>JSON.parse(JSON.stringify(o)))];}
    if (!s.tutorialNodes.includes('T0')) return [JSON.parse(JSON.stringify(T0))];
    if (!hasNode(s, '1B')) return [];
    return [makeOrder('GUI', s.orderCycles.short), ...hasNode(s, 'C1a') ? [] : [JSON.parse(JSON.stringify(C1A))]];
}
export function reconcileChapter(s: State, now?: number | null): void {
    if (s.mode !== 'story') return;
    const add = (id: string): void => { if (!hasNode(s, id)) s.permanentNodes.push(id); };
    if (s.tutorialNodes.includes('T0')) add('1A');
    if (hasNode(s, '1A') && s.activeDecorBySlot.LANTERN !== 'lantern-default') add('1B');
    if (hasNode(s, 'C1a') && s.completedOrders >= 3) add('1C');
    if (hasNode(s, '1C') && s.activeDecorBySlot.CURTAIN !== 'curtain-default') add('curtain-used');
    if (hasNode(s, 'C1a') && s.completedOrders >= 6 && hasNode(s, 'curtain-used')) {
        add('1D'); if (!s.completedChapters.includes(1)) s.completedChapters.push(1);
    }
    if(s.contentMaxChapter===2 && hasNode(s,'1D')) {
        if(!hasNode(s,'2A')) {
            add('2A');s.chapterOneShortCompleted=s.orderCycles.short;s.carryoverShortOrder=makeOrder('GUI',s.orderCycles.short);
            s.carryoverShortCompleted=false;s.orderCycles.short=0;s.orderCycles.medium=0;
            s.garden.push(newPlot('GUI'));
        }
        s.chapter=2;
        if(hasNode(s,'C2a'))add('2B');
        if(hasNode(s,'2B')&&s.activeDecorBySlot.COUNTER!=='counter-default')add('2C');
        if(hasNode(s,'C2b')&&s.completedOrders>=18&&hasNode(s,'2C')){
            add('2D');if(!s.completedChapters.includes(2))s.completedChapters.push(2);
            if(!s.garden.some(p=>p.id==='JAS'))s.garden.push(newPlot('JAS'));
        }
        initializePlots(s,now);
    } else s.chapter=1;
    s.orders = storyOrders(s);
}
export function chapterGoal(s: State): string {
    if(s.chapter===2){
        if(!hasNode(s,'C2a'))return '小满想试茉莉香：做好两只茉莉缎囊';
        if(!hasNode(s,'2C'))return '柜台新款已解锁，挑一款摆上';
        if(!hasNode(s,'C2b'))return '周婶要成套礼匣：桂花、茉莉各一只';
        if(!hasNode(s,'2D'))return `累计交付18单，完成花窗来客（${s.completedOrders}/18）`;
        return '两章已完成，继续接单、布置与照料花园';
    }
    if (!hasNode(s, '1A')) return '开张首单：把两只素袋合成绣囊，交单得40铜钱';
    if (!hasNode(s, '1B')) return '挑一盏新灯笼摆上，点亮香铺';
    if (!hasNode(s, 'C1a')) return '阿绫想给好友带桂花香：做好两只缎囊';
    if (!hasNode(s, '1C')) return `再接短单，累计交付3单（${s.completedOrders}/3）`;
    if (!hasNode(s, 'curtain-used')) return '门帘已解锁，挑一幅新门帘挂上';
    if (!hasNode(s, '1D')) return `累计交付6单，完成重新开张（${s.completedOrders}/6）`;
    return '第一章 · 重新开张 已完成，继续接单布置香铺';
}
