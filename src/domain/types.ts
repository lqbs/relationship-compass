/** 联系节奏档位:受控枚举,不做自由输入(v1 决定)。 */
export const CADENCE_PRESETS = {
  '1w': { days: 7, label: '1 周' },
  '2w': { days: 14, label: '2 周' },
  '1m': { days: 30, label: '1 个月' },
  '3m': { days: 90, label: '3 个月' },
  '6m': { days: 180, label: '6 个月' },
} as const;

export type CadenceKey = keyof typeof CADENCE_PRESETS;

export const CADENCE_KEYS = Object.keys(CADENCE_PRESETS) as CadenceKey[];

export const DEFAULT_CADENCE: CadenceKey = '1m';

export interface Contact {
  id: string;
  name: string;
  note: string;
  cadenceKey: CadenceKey;
  /** 延后至(YYYY-MM-DD);期间不参与清单判定,当天回归。null 表示未延后。 */
  deferredUntil: string | null;
  /** 是否为预置示例数据(清空示例数据时只删这些)。 */
  isSample: boolean;
  createdAt: string;
}

export interface Interaction {
  id: string;
  contactId: string;
  /** 发生日期(YYYY-MM-DD)。不分方向:对方主动联系我也算。 */
  date: string;
  note: string;
  createdAt: string;
}
