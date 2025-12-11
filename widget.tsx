import {
  Widget,
  VStack,
  HStack,
  ZStack,
  Text,
  Spacer,
  Image,
  RoundedRectangle,
  Capsule,
  Color,
} from "scripting"
import {
  getAccountData,
  getSettings,
  processBarChartData,
  extractDisplayData,
  SGCCSettings,
  BarData
} from "./api"

// --- 全局声明 ---
declare const FileManager: any
declare const fetch: (url: string, init?: any) => Promise<{ data: () => Promise<any> }>

// --- 配置与常量 ---
const LOGO_URL = "https://raw.githubusercontent.com/Honye/scriptable-scripts/master/static/sgcc.png"
const LOGO_FILENAME = "sgcc_logo_cache.png"

const C = {
  teal: "#00706B" as any,
  yellow: "#E8C70B" as any,
  orange: "#D0580D" as any,
  textPrimary: { light: "#18231C", dark: "#FFFFFF" } as any,
  textSecondary: { light: "rgba(24, 35, 28, 0.7)", dark: "rgba(255, 255, 255, 0.7)" } as any,
  bgCard: { light: "#ffffff", dark: "#1C1C1E" } as any,
  trackBg: { light: "rgba(0,0,0,0.06)", dark: "rgba(255,255,255,0.15)" } as any
}

const BAR_GRADIENTS = {
  level1: { start: "#81CDC7" as any, end: "#00706B" as any },
  level2: { start: "#FFEE8C" as any, end: "#E8C70B" as any },
  level3: { start: "#FCBF94" as any, end: "#D0580D" as any }
}

// --- 尺寸适配逻辑 (From SGCC.js) ---
function getWidgetSize() {
  const phones: { [key: number]: any } = {
    /** 16 Pro Max */
    956: { small: 170, medium: 364, large: 382 },
    /** 16 Pro */
    874: { small: 162, medium: 344, large: 366 },
    /** 16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max */
    932: { small: 170, medium: 364, large: 382 },
    /** 13 Pro Max, 12 Pro Max */
    926: { small: 170, medium: 364, large: 382 },
    /** 11 Pro Max, 11, XS Max, XR */
    896: { small: 169, medium: 360, large: 379 },
    /** Plus phones */
    736: { small: 157, medium: 348, large: 357 },
    /** 16, 15 Pro, 15, 14 Pro */
    852: { small: 158, medium: 338, large: 354 },
    /** 13, 13 Pro, 12, 12 Pro */
    844: { small: 158, medium: 338, large: 354 },
    /** 13 mini, 12 mini / 11 Pro, XS, X */
    812: { small: 155, medium: 329, large: 345 },
    /** SE2 and 6/6S/7/8 */
    667: { small: 148, medium: 321, large: 324 },
    /** iPad Pro 2 */
    1194: { small: 155, medium: 342, large: 342, extraLarge: 715.5 },
    /** iPad 6 */
    1024: { small: 141, medium: 305.5, large: 305.5, extraLarge: 634.5 }
  }

  try {
    // @ts-ignore
    if (typeof Device !== 'undefined' && Device.screenSize) {
      // @ts-ignore
      let { width, height } = Device.screenSize()
      if (typeof width === 'number' && typeof height === 'number') {
        if (width > height) height = width
        if (phones[height]) return phones[height]
      }
    }
  } catch (e) {
    console.log("Device.screenSize not supported, using fallback.")
  }

  return { small: 155, medium: 329, large: 329 }
}

function vmin(num: number): number {
  const size = getWidgetSize()
  let family: any = Widget.family
  if (family === 'systemSmall') family = 'small'
  else if (family === 'systemMedium') family = 'medium'
  else if (family === 'systemLarge') family = 'large'
  else if (family === 'systemExtraLarge') family = 'extraLarge'
  else family = 'medium' // fallback

  const width = size[family === 'large' ? 'medium' : family] || 329
  // Logical mismatch in SGCC source? 
  // SGCC: width = size[family === 'large' ? 'medium' : family];
  // Height logic: family === 'medium' ? size.small : ...
  let height = 155
  if (family === 'medium') height = size.small
  else if (family === 'extraLarge') height = size.large
  else height = size[family]

  return num * Math.min(width, height) / 100
}

function rpt(n: number): number {
  return vmin(n * 100 / 155)
}

// --- Logo 获取 ---
async function getLogoPath() {
  try {
    if (typeof FileManager === 'undefined') return null
    const docs = FileManager.documentsDirectory
    const path = `${docs}/${LOGO_FILENAME}`

    try {
      const exists = FileManager.readAsData ? true : false
      if (exists) return path
    } catch (e) { }

    const req = await fetch(LOGO_URL)
    const data = await req.data()
    FileManager.writeAsData(path, data)
    return path
  } catch (e) {
    return null
  }
}

// --- UI 组件 ---

// --- UI 组件 ---

// --- UI 组件 ---

function BarChart({ data }: { data: BarData[] }) {
  if (!data || data.length === 0) {
    return (
      <VStack frame={{ height: Widget.family === 'systemMedium' ? rpt(40) : rpt(68) }} alignment="center">
        <Text font={rpt(8)} foregroundStyle={C.textSecondary}>暂无数据</Text>
      </VStack>
    )
  }

  const values = data.map(d => Number(d.value) || 0)
  const max = Math.max(...values, 1)

  const isSmall = Widget.family === 'systemSmall'
  // Adjust height to save space (SGCC Medium uses 40)
  const height = isSmall ? rpt(50) : rpt(40)
  const barWidth = Widget.family === 'systemMedium' ? rpt(6) : rpt(8)
  const gap = Widget.family === 'systemMedium' ? rpt(6) : 0
  const vp = Widget.family === 'systemMedium' ? rpt(4) : rpt(10)
  const px = Widget.family === 'systemMedium' ? 0 : rpt(8)


  // Distribute bars: For Small (gap undefined), use Spacers. For Medium (gap defined), use HStack spacing.
  const bars = data.map(({ value, level }, i) => {
    const val = Number(value) || 0
    let barHeight = (val / max) * (height - vp * 2)
    if (!Number.isFinite(barHeight) || barHeight < 0) barHeight = 0
    barHeight = Math.max(rpt(4), barHeight)

    const gradientColor = level === 3 ? BAR_GRADIENTS.level3 : level === 2 ? BAR_GRADIENTS.level2 : BAR_GRADIENTS.level1

    return (
      <RoundedRectangle
        key={i}
        frame={{ width: barWidth, height: barHeight }}
        cornerRadius={rpt(3)}
        style="continuous"
        fill={{
          colors: [gradientColor.start, gradientColor.end],
          startPoint: "top",
          endPoint: "bottom"
        } as any}
      />
    )
  })

  // Inject spacers for Small widget
  const children: any[] = []
  if (isSmall) {
    bars.forEach((bar, i) => {
      children.push(bar)
      if (i < bars.length - 1) children.push(<Spacer key={`s-${i}`} />)
    })
  } else {
    children.push(...bars)
  }

  return (
    <VStack frame={{ height: height }} padding={{ top: vp, horizontal: px, bottom: 2 }}>
      <Spacer />
      <HStack
        alignment="bottom"
        spacing={gap}
        frame={{ maxWidth: Infinity, height: height }}
      >
        {children}
      </HStack>
    </VStack>
  )
}

function GridItem({ label, value }: { label: string; value: string }) {
  return (
    <ZStack alignment="topLeading">
      <RoundedRectangle
        cornerRadius={rpt(6)}
        style="continuous"
        fill={{ light: "rgba(0, 112, 107, 0.03)", dark: "rgba(4, 96, 91, 0.1)" }}
        stroke={{
          shapeStyle: { light: "rgba(0, 112, 107, 0.2)", dark: "rgba(255, 255, 255, 0.1)" } as any,
          strokeStyle: { lineWidth: 0.5 }
        }}
        frame={{ maxWidth: Infinity, maxHeight: Infinity }}
      />
      <VStack padding={{ vertical: rpt(6), horizontal: rpt(12) }} alignment="leading" spacing={0} frame={{ maxWidth: Infinity, maxHeight: Infinity }}>
        <Text font={rpt(8)} foregroundStyle={C.textSecondary} lineLimit={1}>{label}</Text>
        <Text font={14} fontWeight="bold" fontDesign="rounded" foregroundStyle={C.textPrimary} lineLimit={1}>{value}</Text>
      </VStack>
    </ZStack>
  )
}

function SmallStepProgress({ totalYearPq, settings }: { totalYearPq: number; settings: SGCCSettings }) {
  const { oneLevelPq, twoLevelPq } = settings

  // Calculate fill percentage for each tier (0.0 to 1.0)
  const tier3MaxCap = twoLevelPq + twoLevelPq - oneLevelPq // SGCC Logic: 4800 + 4800 - 2160 = 7440

  const p1 = Math.min(totalYearPq, oneLevelPq) / oneLevelPq
  const p2 = totalYearPq > oneLevelPq ? Math.min(totalYearPq / twoLevelPq, 1) : 0
  const p3 = totalYearPq > twoLevelPq ? Math.min(totalYearPq / tier3MaxCap, 1) : 0

  // Full width for Small Widget content area: 155 - 12*2(padding) - 10*2(inner padding) = 111
  const barWidth = 115
  const gap = 2
  const segWidth = (barWidth - gap * 2) / 3

  // Track colors (faint version of tier color)
  const tier1Bg = { light: "rgba(0, 112, 107, 0.1)", dark: "rgba(4, 96, 91, 0.1)" } as any
  const tier2Bg = { light: "rgba(232, 199, 11, 0.1)", dark: "rgba(203, 173, 2, 0.1)" } as any
  const tier3Bg = { light: "rgba(208, 88, 13, 0.1)", dark: "rgba(208, 88, 13, 0.1)" } as any

  return (
    <HStack spacing={gap} frame={{ height: 4, width: barWidth }}>
      {/* Tier 1 */}
      <ZStack alignment="leading" frame={{ width: segWidth, maxHeight: Infinity }}>
        <RoundedRectangle cornerRadius={2} style="continuous" fill={tier1Bg} frame={{ maxWidth: Infinity, maxHeight: Infinity }} />
        <RoundedRectangle cornerRadius={2} style="continuous" fill={C.teal} frame={{ width: Math.max(0, p1 * segWidth), maxHeight: Infinity }} />
      </ZStack>

      {/* Tier 2 */}
      <ZStack alignment="leading" frame={{ width: segWidth, maxHeight: Infinity }}>
        <RoundedRectangle cornerRadius={2} style="continuous" fill={tier2Bg} frame={{ maxWidth: Infinity, maxHeight: Infinity }} />
        <RoundedRectangle cornerRadius={2} style="continuous" fill={C.yellow} frame={{ width: Math.max(0, p2 * segWidth), maxHeight: Infinity }} />
      </ZStack>

      {/* Tier 3 */}
      <ZStack alignment="leading" frame={{ width: segWidth, maxHeight: Infinity }}>
        <RoundedRectangle cornerRadius={2} style="continuous" fill={tier3Bg} frame={{ maxWidth: Infinity, maxHeight: Infinity }} />
        <RoundedRectangle cornerRadius={2} style="continuous" fill={C.orange} frame={{ width: Math.max(0, p3 * segWidth), maxHeight: Infinity }} />
      </ZStack>
    </HStack>
  )
}

function MediumStepProgress({ totalYearPq, settings, lastUpdateTime }: { totalYearPq: number; settings: SGCCSettings; lastUpdateTime: number }) {
  const { oneLevelPq, twoLevelPq } = settings

  const level = totalYearPq > twoLevelPq ? 3 : totalYearPq > oneLevelPq ? 2 : 1
  const max = [oneLevelPq, twoLevelPq, twoLevelPq + twoLevelPq - oneLevelPq][level - 1]
  let percent = totalYearPq / max
  if (percent > 1) percent = 1

  const labelText = `第${['一', '二', '三'][level - 1]}梯度：${(percent * 100).toFixed(2)}%`

  // SGCC Bar Logic: n = width / (2 + gap) / 3 approx. Assuming ~45 total bars for visual match.
  const n = 15
  const totalBars = n * 3

  const bars: JSX.Element[] = []

  const colors = [
    { light: "#00706B", dark: "#04605B" },
    { light: "#E8C70B", dark: "#CBAD02" },
    { light: "#D0580D", dark: "#D0580D" }
  ]
  const bgColors = [
    { light: "rgba(0, 112, 107, 0.1)", dark: "rgba(4, 96, 91, 0.1)" },
    { light: "rgba(232, 199, 11, 0.1)", dark: "rgba(203, 173, 2, 0.1)" },
    { light: "rgba(208, 88, 13, 0.1)", dark: "rgba(208, 88, 13, 0.1)" }
  ]

  // SGCC Logic: end = Math.floor(n * level * percent)
  const end = Math.floor(n * level * percent)

  for (let i = 0; i < totalBars; i++) {
    const tier = Math.floor(i / n)
    const isActive = i <= end
    const color = isActive ? colors[tier] : bgColors[tier]

    bars.push(
      <RoundedRectangle
        key={i}
        cornerRadius={1}
        style="continuous"
        frame={{ width: 2, height: 14 }}
        fill={color as any}
      />
    )
    if (i < totalBars - 1) {
      bars.push(<Spacer key={`s-${i}`} minLength={rpt(2)} />)
    }
  }

  const d = new Date(lastUpdateTime)
  const timeString = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

  return (
    <ZStack alignment="topLeading">
      <RoundedRectangle cornerRadius={rpt(6)} style="continuous" fill={{ light: "rgba(0, 112, 107, 0.03)", dark: "rgba(4, 96, 91, 0.1)" }} frame={{ maxWidth: Infinity, maxHeight: Infinity }} />
      <VStack padding={{ vertical: rpt(6), horizontal: rpt(12) }} spacing={rpt(4)} alignment="leading" frame={{ maxWidth: Infinity }}>
        <HStack alignment="center">
          <Text font={rpt(8)} foregroundStyle={C.textSecondary}>{labelText}</Text>
          <Spacer />
          <HStack spacing={2} alignment="center">
            <Image systemName="clock.arrow.circlepath" resizable frame={{ width: rpt(8), height: rpt(8) }} foregroundStyle={C.textSecondary} />
            <Text font={rpt(8)} foregroundStyle={C.textSecondary}>{timeString}</Text>
          </HStack>
        </HStack>
        <HStack spacing={0} alignment="center">
          {bars}
        </HStack>
      </VStack>
    </ZStack>
  )
}

// --- 渐进式恢复视图 ---
function WidgetView({ displayData, barData, settings, logoPath }: any) {
  const family = Widget.family
  const { balance, hasArrear, lastBill, lastUsage, yearBill, yearUsage, totalYearPq } = displayData

  const Logo = () => logoPath ? (
    <Image filePath={logoPath} resizable frame={{ width: 24, height: 24 }} />
  ) : (
    <Image systemName="bolt.circle.fill" resizable frame={{ width: 24, height: 24 }} foregroundStyle={C.teal} />
  )

  // define styles for container background
  const contentBgStyle = {
    style: { light: "rgba(0, 112, 107, 0.05)", dark: "rgba(4, 96, 91, 0.15)" } as any,
    shape: { type: "rect", cornerRadius: 6, style: "continuous" } as any
  }

  // Small Widget Restoration
  if (family === "systemSmall") {
    return (
      <VStack
        padding={12}
        alignment="leading"
        widgetBackground={C.bgCard}
      >
        <VStack spacing={0} frame={{ maxWidth: Infinity, maxHeight: Infinity, alignment: "leading" }}>

          {/* Chart Area */}
          <VStack
            spacing={4}
            alignment="center"
            widgetBackground={contentBgStyle}
          >
            <BarChart data={barData} />
            <VStack padding={{ horizontal: rpt(8), bottom: rpt(8) }}>
              <SmallStepProgress totalYearPq={totalYearPq} settings={settings} />
            </VStack>
          </VStack>

          <Spacer />

          {/* Bottom Info */}
          <VStack alignment="leading" spacing={2}>
            <Text font={rpt(12)} foregroundStyle={C.textSecondary}>{lastBill !== "0.00" ? `余额(上期:${lastBill})` : '剩余电费'}</Text>
            <HStack alignment="center">
              <Text font={rpt(24)} fontWeight="bold" fontDesign="rounded" foregroundStyle={C.textPrimary} minScaleFactor={0.5} lineLimit={1}>{balance}</Text>
              <Spacer />
              <Logo />
            </HStack>
          </VStack>

        </VStack>
      </VStack>
    )
  }

  // Medium & Large
  return (
    <VStack
      padding={rpt(12)}
      alignment="leading"
      widgetBackground={C.bgCard}
    >
      <HStack spacing={rpt(12)} alignment="top">
        {/* 左侧面板 */}
        <ZStack frame={{ width: rpt(86), maxHeight: Infinity }}>
          <RoundedRectangle
            cornerRadius={rpt(6)}
            style="continuous"
            fill={{
              light: {
                colors: ["#00706B00", "#00706B08"],
                startPoint: { x: 0, y: 0.4 },
                endPoint: { x: 0, y: 1 }
              },
              dark: {
                colors: ["#00706B00", "#04605B1A"],
                startPoint: { x: 0, y: 0.4 },
                endPoint: { x: 0, y: 1 }
              }
            } as any}
            stroke={{
              shapeStyle: { light: "rgba(0, 112, 107, 0.2)", dark: "rgba(255, 255, 255, 0.1)" } as any,
              strokeStyle: { lineWidth: 0.5 }
            }}
            frame={{ width: rpt(86), maxHeight: Infinity }}
          />
          <VStack
            frame={{ width: rpt(86), maxHeight: Infinity }}
            padding={{ horizontal: rpt(4), vertical: 0 }}
            alignment="leading"
            spacing={0}
          >
            {/* @ts-ignore */}
            <Image filePath={logoPath} frame={{ width: rpt(24), height: rpt(24) }} cornerRadius={rpt(12) as any} resizable />
            <Spacer minLength={rpt(12)} />
            <Text font={rpt(10)} foregroundStyle={C.textSecondary}>{!hasArrear ? '剩余电费' : '待缴电费'}</Text>
            <Text font={rpt(22)} fontWeight="heavy" fontDesign="rounded" foregroundStyle={C.textPrimary} lineLimit={1} minScaleFactor={0.5}>{balance}</Text>
            <Spacer />
            <BarChart data={barData} />
          </VStack>
        </ZStack>

        {/* 右侧面板 */}
        <VStack spacing={rpt(6)} frame={{ maxWidth: Infinity, maxHeight: Infinity }} alignment="leading">
          <HStack spacing={rpt(8)}>
            <VStack spacing={rpt(6)} frame={{ maxWidth: Infinity }}>
              <GridItem label="上期电费" value={lastBill} />
              <GridItem label="年度电费" value={yearBill} />
            </VStack>
            <VStack spacing={rpt(6)} frame={{ maxWidth: Infinity }}>
              <GridItem label="上期电量" value={lastUsage} />
              <GridItem label="年度电量" value={yearUsage} />
            </VStack>
          </HStack>
          {/* 阶梯进度 */}
          <MediumStepProgress totalYearPq={totalYearPq} settings={settings} lastUpdateTime={displayData.lastUpdateTime || Date.now()} />
        </VStack>
      </HStack>
    </VStack>
  )
}

// --- 入口 ---
async function render() {
  try {
    console.log('[Widget] Starting render, family:', Widget.family)

    const settings = getSettings()
    console.log('[Widget] Settings:', JSON.stringify(settings))

    const rawData = await getAccountData()
    console.log('[Widget] Raw data received, keys:', Object.keys(rawData || {}))

    const displayData = extractDisplayData(rawData)
    console.log('[Widget] Display data:', JSON.stringify(displayData))

    console.log('[Widget Debug] dayEleList:', JSON.stringify(rawData?.dayElecQuantity31?.sevenEleList || []))
    const barData = processBarChartData(rawData, settings)
    console.log('[Widget] Bar data count:', barData?.length || 0)

    const logoPath = await getLogoPath()
    console.log('[Widget] Logo path:', logoPath)

    Widget.present(
      <WidgetView
        displayData={displayData}
        barData={barData}
        settings={settings}
        logoPath={logoPath}
      />
    )
  } catch (e) {
    console.error('[Widget] Render error:', e)
    Widget.present(
      <VStack padding={10} alignment="center">
        <Text font={12} foregroundStyle={"#000000" as any}>加载失败</Text>
        <Text font={10} foregroundStyle={"#888888" as any}>{String(e)}</Text>
      </VStack>
    )
  }
}

render()