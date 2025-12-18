import {
  Navigation,
  NavigationStack,
  List,
  Section,
  Text,
  TextField,
  Picker,
  Button,
  useState,
  Script,
  Dialog,
  Toggle
} from "scripting"
import { getSettings, saveSettings, DEFAULT_SETTINGS, SGCCSettings } from "./api"
import { ModuleSection, createModuleActions } from "./moduleSection"

function SettingsView() {
  const dismiss = Navigation.useDismiss()

  // 初始化状态
  const initial = getSettings()

  const [accountIndex, setAccountIndex] = useState(String(initial.accountIndex))
  const [dimension, setDimension] = useState<string>(initial.dimension)
  const [barCount, setBarCount] = useState<number>(initial.barCount)
  const [oneLevelPq, setOneLevelPq] = useState(String(initial.oneLevelPq))
  const [twoLevelPq, setTwoLevelPq] = useState(String(initial.twoLevelPq))
  const [refreshInterval, setRefreshInterval] = useState(initial.refreshInterval)

  const handleSave = () => {
    const newSettings: SGCCSettings = {
      accountIndex: parseInt(accountIndex) || 0,
      dimension: dimension as 'daily' | 'monthly',
      barCount: Number(barCount),
      oneLevelPq: Number(oneLevelPq) || DEFAULT_SETTINGS.oneLevelPq,
      twoLevelPq: Number(twoLevelPq) || DEFAULT_SETTINGS.twoLevelPq,
      refreshInterval: Number(refreshInterval)
    }

    saveSettings(newSettings)
    dismiss()
  }

  const handleReset = async () => {
    const confirmed = await Dialog.confirm({
      title: "重置设置",
      message: "确定要恢复默认设置吗？",
    })

    if (confirmed) {
      setAccountIndex(String(DEFAULT_SETTINGS.accountIndex))
      setDimension(DEFAULT_SETTINGS.dimension)
      setBarCount(DEFAULT_SETTINGS.barCount)
      setOneLevelPq(String(DEFAULT_SETTINGS.oneLevelPq))
      setTwoLevelPq(String(DEFAULT_SETTINGS.twoLevelPq))
      setRefreshInterval(DEFAULT_SETTINGS.refreshInterval)
    }
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="网上电网配置"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: [
            <Button title="取消" action={dismiss} />
          ],
          topBarTrailing: [
            <Button title="保存" fontWeight="bold" action={handleSave} />
          ]
        }}
      >
        {/* 组件模块安装 */}
        <ModuleSection
          footerLines={[
            "使用前请完成以下步骤：",
            "1）在 BoxJS 中订阅配置",
            "2）安装对应平台的重写模块",
            "3）打开网上国网 App 查看电费触发数据抓取",
          ]}
          collapsible
          collapseStorageKey="sgccModuleSectionCollapsed"
          defaultCollapsed={true}
          actions={createModuleActions()}
        />

        <Section header={<Text>基础设置</Text>}>
          <TextField
            title="户号索引"
            value={accountIndex}
            placeholder="0"
            keyboardType="numberPad"
            onChanged={setAccountIndex}
          />
          <Text font="caption2" foregroundStyle="secondaryLabel">
            如果你绑定了多个户号，默认为 0 (第一个)。第二个请输入 1，以此类推。
          </Text>
        </Section>

        <Section header={<Text>图表配置</Text>}>
          <Picker
            title="统计维度"
            value={dimension}
            onChanged={setDimension}
            pickerStyle="menu"
          >
            <Text tag="daily">每日用电</Text>
            <Text tag="monthly">每月用电</Text>
          </Picker>

          <Picker
            title="显示数量"
            value={barCount}
            onChanged={(v: number) => setBarCount(v)}
            pickerStyle="menu"
          >
            <Text tag={7}>近 7 条</Text>
            <Text tag={15}>近 15 条</Text>
            <Text tag={30}>近 30 条</Text>
          </Picker>
        </Section>

        <Section header={<Text>阶梯阈值 (年度)</Text>} footer={<Text font="caption2" foregroundStyle="secondaryLabel">用于计算阶梯电价进度条颜色</Text>}>
          <TextField
            title="一阶电量上限"
            value={oneLevelPq}
            keyboardType="numberPad"
            onChanged={setOneLevelPq}
          />
          <TextField
            title="二阶电量上限"
            value={twoLevelPq}
            keyboardType="numberPad"
            onChanged={setTwoLevelPq}
          />
        </Section>

        <Section header={<Text>系统</Text>}>
          <Picker
            title="自动刷新间隔"
            value={refreshInterval}
            onChanged={(v: number) => setRefreshInterval(v)}
            pickerStyle="menu"
          >
            <Text tag={60}>1 小时</Text>
            <Text tag={180}>3 小时 (推荐)</Text>
            <Text tag={360}>6 小时</Text>
            <Text tag={720}>12 小时</Text>
          </Picker>

          <Button
            title="恢复默认设置"
            role="destructive"
            action={handleReset}
            frame={{ maxWidth: "infinity", alignment: "center" }}
          />
        </Section>

      </List>
    </NavigationStack>
  )
}

// 只有在 APP 内运行脚本时才会渲染此页面
if (Script.env === "index") {
  Navigation.present({
    element: <SettingsView />
  })
}
