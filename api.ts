import { fetch } from "scripting"

// --- 全局声明 ---
declare const Storage: any

// --- 常量与配置 ---
const CACHE_KEY = 'sgcc_data_cache'
const SETTINGS_KEY = 'sgccSettings'

// --- 类型定义 ---
export interface SGCCSettings {
  accountIndex: number      // 户号索引
  barCount: number          // 图表显示条数 (7/30)
  dimension: 'daily' | 'monthly' // 图表维度
  oneLevelPq: number        // 一阶电量阈值
  twoLevelPq: number        // 二阶电量阈值
  refreshInterval: number   // 刷新间隔(分钟)
  largeWidgetRange: '7days' | '30days' | '12months' // 大尺寸组件显示范围
}

export const DEFAULT_SETTINGS: SGCCSettings = {
  accountIndex: 0,
  barCount: 7,
  dimension: 'daily',
  oneLevelPq: 2160,
  twoLevelPq: 4800,
  refreshInterval: 180,
  largeWidgetRange: '7days'
}

export interface BarData {
  value: number
  level: number
  label?: string // 可选：用于显示日期或其他标签
}

// --- 设置管理 ---

/** 获取设置，自动合并默认值 */
export function getSettings(): SGCCSettings {
  try {
    const s = Storage.get(SETTINGS_KEY)
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** 保存设置 */
export function saveSettings(settings: SGCCSettings) {
  try {
    Storage.set(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('[API] Save settings failed:', e)
  }
}

// --- 数据获取 ---

function getCachedData() {
  try {
    const cacheString = Storage.get(CACHE_KEY)
    if (cacheString) return JSON.parse(cacheString)
  } catch (e) { }
  return null
}

function saveCachedData(data: any) {
  try {
    Storage.set(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }))
  } catch (e) { }
}

/** 获取所有户号的电力数据 */
export async function getElectricityData(forceRefresh = false) {
  const cachedData = getCachedData()

  // 缓存 4 小时有效
  if (cachedData && !forceRefresh && (Date.now() - cachedData.timestamp < 4 * 60 * 60 * 1000)) {
    console.log('[API] Using cached data')
    return { data: cachedData.data, timestamp: cachedData.timestamp }
  }

  try {
    const url = 'http://api.wsgw-rewrite.com/electricity/bill/all?monthElecQuantity=1&dayElecQuantity31=1&stepElecQuantity=1&eleBill=1'
    const response = await fetch(url)
    const data = await response.json()

    if (data) {
      saveCachedData(data)
      return { data, timestamp: Date.now() }
    }
  } catch (error) {
    console.error('[API] Network request failed:', error)
    if (cachedData) return { data: cachedData.data, timestamp: cachedData.timestamp }
  }
  return { data: [], timestamp: Date.now() }
}

/** 获取指定或者当前设置户号的数据 */
export async function getAccountData(forceRefresh = false): Promise<any> {
  const settings = getSettings()
  const result = await getElectricityData(forceRefresh)
  const allData = result.data
  const timestamp = result.timestamp

  if (allData && allData.length > 0) {
    const index = Math.min(Math.max(0, settings.accountIndex), allData.length - 1)
    return { ...allData[index], lastUpdateTime: timestamp }
  }

  // 返回默认空结构，防止 UI 报错
  return {
    eleBill: { sumMoney: "0.00" },
    arrearsOfFees: false,
    stepElecQuantity: [],
    monthElecQuantity: { dataInfo: {}, mothEleList: [] },
    dayElecQuantity31: { sevenEleList: [] },
    lastUpdateTime: Date.now()
  }
}

// --- 业务逻辑处理 ---

/** 处理图表数据：计算阶梯和数值 */
export function processBarChartData(data: any, settings: SGCCSettings): BarData[] {
  const { oneLevelPq, twoLevelPq, barCount, dimension } = settings

  // 1. 预处理月度数据，用于计算阶梯
  const monthlyData: { yearTotal: number; monthElec: number; level: number }[] = []
  let yearTotal = 0

  const mothEleList = data.monthElecQuantity?.mothEleList || []

  for (const { monthEleNum } of mothEleList) {
    const n = Number(monthEleNum || 0)
    yearTotal += n
    const level = yearTotal > twoLevelPq ? 3 : yearTotal > oneLevelPq ? 2 : 1
    monthlyData.push({ yearTotal, monthElec: n, level })
  }

  let barData: BarData[] = []

  if (dimension === 'monthly') {
    // A. 月度模式
    barData = monthlyData.map(({ monthElec, level }) => ({ value: monthElec, level }))
  } else {
    // B. 日度模式 (默认)
    const sevenEleList = data.dayElecQuantity31?.sevenEleList || []
    const currentYear = new Date().getFullYear()

    for (const { day, dayElePq } of sevenEleList) {
      if (dayElePq && !isNaN(Number(dayElePq))) {
        const match = day.match(/^(\d{4})\D?(\d{2})/)
        if (match) {
          const year = Number(match[1])
          const month = Number(match[2])
          let level = 1

          // 仅当是今年数据时，尝试匹配对应月份的阶梯
          if (currentYear === year) {
            // mothEleList通常按时间顺序排列，但月份索引需要小心处理
            // 简单映射：假设 monthlyData 索引 0 是 1月 (需要确认数据源顺序，原代码逻辑如下)
            // 原代码：Math.min(monthlyData.length - 1, month - 1)
            const safeIndex = Math.max(0, Math.min(monthlyData.length - 1, month - 1))
            level = monthlyData[safeIndex]?.level || 1
          }

          barData.unshift({ value: Number(dayElePq), level, label: day })
        }
      }
    }
  }

  // 截取指定数量
  return barData.slice(-barCount)
}

/** 获取大组件数据（根据 largeWidgetRange 设置） */
export function processLargeWidgetData(data: any, settings: SGCCSettings): BarData[] {
  if (!data) return []

  const { largeWidgetRange } = settings

  // 获取月度数据
  const monthlyData = data.monthElecQuantity?.mothEleList || []

  if (largeWidgetRange === '12months') {
    // 12个月数据
    return monthlyData.map((item: any) => ({
      value: Number(item.monthEleNum || item.eleNum || item.usage || item.monthElec || 0),
      level: item.level || 1,
      label: item.month || ''
    })).slice(-12)
  }

  // 日度数据
  const sevenEleList = data.dayElecQuantity31?.sevenEleList || []
  const currentYear = new Date().getFullYear()

  const dailyData: BarData[] = []
  for (const { day, dayElePq } of sevenEleList) {
    if (dayElePq && !isNaN(Number(dayElePq))) {
      const match = day.match(/^(\d{4})\D?(\d{2})/)
      if (match) {
        const year = Number(match[1])
        const month = Number(match[2])
        let level = 1

        if (currentYear === year) {
          const safeIndex = Math.max(0, Math.min(monthlyData.length - 1, month - 1))
          level = monthlyData[safeIndex]?.level || 1
        }

        dailyData.unshift({ value: Number(dayElePq), level, label: day })
      }
    }
  }

  // 根据设置返回7天或30天
  const count = largeWidgetRange === '30days' ? 30 : 7
  return dailyData.slice(-count)
}

/** 提取关键展示数据 (余额, 上期, 年度等) */
export function extractDisplayData(data: any) {
  const balance = data.eleBill?.sumMoney || "0.00"
  const hasArrear = !!data.arrearsOfFees

  // 上期数据 (优先尝试取最后一月，否则取阶梯数据中的第一项)
  let lastBill = "0.00"
  let lastUsage = "0"

  if (data.monthElecQuantity?.mothEleList?.length > 0) {
    const list = data.monthElecQuantity.mothEleList
    const last = list[list.length - 1]
    if (last) {
      lastBill = last.monthEleCost || last.cost || last.eleCost || "0.00"
      lastUsage = last.monthEleNum || last.eleNum || last.usage || "0"
    }
  } else if (data.stepElecQuantity?.[0]?.electricParticulars) {
    const p = data.stepElecQuantity[0].electricParticulars
    lastBill = p.totalAmount || "0.00"
    lastUsage = p.totalPq || "0"
  }

  // 年度数据
  const yearBill = data.monthElecQuantity?.dataInfo?.totalEleCost || "0"

  // 优先从阶梯数据获取实时年度电量 (totalYearPq)，因为月度数据通常滞后
  let yearUsage = data.monthElecQuantity?.dataInfo?.totalEleNum || "0"

  let totalYearPq = 0
  if (data.stepElecQuantity?.[0]?.electricParticulars) {
    const p = data.stepElecQuantity[0].electricParticulars
    if (p.totalYearPq) {
      totalYearPq = Number(p.totalYearPq)
      // 如果阶梯数据有效，优先使用它作为展示的年度电量
      yearUsage = p.totalYearPq
    }
  }

  return {
    balance,
    hasArrear,
    lastBill,
    lastUsage,
    yearBill,
    yearUsage,
    totalYearPq,
    lastUpdateTime: data.lastUpdateTime
  }
}