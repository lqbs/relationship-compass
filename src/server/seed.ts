import { addDays } from '../domain/dates.ts';
import type { CadenceKey } from '../domain/types.ts';
import type { Store } from './db.ts';

interface SampleInteraction {
  daysAgo: number;
  note: string;
}

interface SampleContact {
  name: string;
  note: string;
  cadenceKey: CadenceKey;
  interactions: SampleInteraction[];
  /** 若设置,联系人创建时即处于"延后中"。 */
  deferredInDays?: number;
}

/** 预置假数据:让第一次打开就能看到完整效果(3 个逾期、1 个未联系过、2 个将到期、1 个延后中)。 */
const SAMPLE_CONTACTS: SampleContact[] = [
  {
    name: '林晓',
    note: '大学室友,现在在做前端',
    cadenceKey: '2w',
    interactions: [
      { daysAgo: 20, note: '聊了聊她换工作的进展' },
      { daysAgo: 55, note: '约了次咖啡' },
    ],
  },
  {
    name: '陈默',
    note: '前同事,喜欢摄影',
    cadenceKey: '1m',
    interactions: [
      { daysAgo: 45, note: '他分享了最近拍的片子' },
      { daysAgo: 120, note: '' },
    ],
  },
  {
    name: '周雨桐',
    note: '行业活动认识,做投资',
    cadenceKey: '1m',
    interactions: [{ daysAgo: 40, note: '请教了行业里的一些事' }],
  },
  {
    name: '徐凯',
    note: '新认识的朋友,想找机会多聊聊产品',
    cadenceKey: '1m',
    interactions: [],
  },
  {
    name: '何佳',
    note: '高中同学,刚搬来这个城市',
    cadenceKey: '2w',
    interactions: [{ daysAgo: 10, note: '电话里聊了聊近况' }],
  },
  {
    name: '高远',
    note: '创业时认识的伙伴',
    cadenceKey: '3m',
    interactions: [{ daysAgo: 85, note: '一起吃了顿饭' }],
  },
  {
    name: '苏晴',
    note: '读书会认识的编辑',
    cadenceKey: '1m',
    interactions: [{ daysAgo: 10, note: '微信上聊了几句' }],
  },
  {
    name: '罗一舟',
    note: '远房表哥,做外贸',
    cadenceKey: '6m',
    interactions: [{ daysAgo: 30, note: '介绍了位朋友给我' }],
  },
  {
    name: '郑好',
    note: '邻居,喜欢徒步',
    cadenceKey: '1m',
    deferredInDays: 10,
    interactions: [{ daysAgo: 50, note: '上次聊到她在准备考试' }],
  },
];

/** 首次启动时预置假数据;用户清空示例后不会再被塞回来(meta 标记)。 */
export function seedIfNeeded(store: Store, today: string): boolean {
  if (store.getMeta('seed_done') !== null) return false;

  if (store.countContacts() === 0) {
    for (const sample of SAMPLE_CONTACTS) {
      const contact = store.createContact({
        name: sample.name,
        note: sample.note,
        cadenceKey: sample.cadenceKey,
        isSample: true,
        deferredUntil: sample.deferredInDays === undefined ? null : addDays(today, sample.deferredInDays),
      });
      for (const interaction of sample.interactions) {
        store.addInteraction(contact.id, { date: addDays(today, -interaction.daysAgo), note: interaction.note });
      }
    }
    store.setMeta('seed_done', today);
    return true;
  }

  store.setMeta('seed_done', today);
  return false;
}
