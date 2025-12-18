// moduleSection.tsx - 模块安装组件
import { Section, Text, Button, useState } from "scripting"

declare const Storage: any
declare const Safari: any

export type ModuleAction = {
    title: string
    action: () => void | Promise<void>
    systemImage?: string
    foregroundStyle?: any
    hidden?: boolean
}

export type ModuleSectionProps = {
    headerTitle?: string
    footerLines?: string[]
    collapsible?: boolean
    collapseStorageKey?: string
    defaultCollapsed?: boolean
    actions: ModuleAction[]
}

function readBool(key: string, fallback: boolean): boolean {
    try {
        const v = Storage?.get?.(key)
        if (typeof v === "boolean") return v
    } catch { }
    return fallback
}

function writeBool(key: string, value: boolean) {
    try {
        Storage?.set?.(key, value)
    } catch { }
}

export function ModuleSection(props: ModuleSectionProps) {
    const {
        headerTitle = "组件模块",
        footerLines = [],
        collapsible = true,
        collapseStorageKey = "sgccModuleSectionCollapsed",
        defaultCollapsed = true,
        actions,
    } = props

    const footerText = footerLines.filter(Boolean).join("\n")

    const [expanded, setExpanded] = useState(() => {
        if (!collapsible) return true
        const collapsed = readBool(collapseStorageKey, defaultCollapsed)
        return !collapsed
    })

    const toggleExpanded = async () => {
        if (!collapsible) return
        const nextExpanded = !expanded
        setExpanded(nextExpanded)
        writeBool(collapseStorageKey, !nextExpanded)
    }

    const visibleActions = (actions ?? []).filter((a) => !a?.hidden)

    return (
        <Section
            header={
                <Text font="body" fontWeight="semibold">
                    {headerTitle}
                </Text>
            }
            footer={
                footerText ? (
                    <Text font="caption2" foregroundStyle="secondaryLabel">
                        {footerText}
                    </Text>
                ) : undefined
            }
        >
            {collapsible ? (
                <Button
                    title={expanded ? "收起组件模块" : "展开组件模块"}
                    systemImage={expanded ? "chevron.down" : "chevron.right"}
                    foregroundStyle="secondaryLabel"
                    action={toggleExpanded}
                />
            ) : undefined}

            {expanded
                ? visibleActions.map((item, idx) => (
                    <Button
                        key={`${idx}-${item.title}`}
                        title={item.title}
                        systemImage={item.systemImage}
                        foregroundStyle={item.foregroundStyle}
                        action={item.action}
                    />
                ))
                : undefined}
        </Section>
    )
}

// 模块链接配置
const MODULE_LINKS = {
    boxjsSubUrl: "http://boxjs.com/#/sub/add/https%3A%2F%2Fraw.githubusercontent.com%2FYuheng0101%2FX%2Fmain%2FTasks%2Fboxjs.json",
    surgeModuleUrl: "https://raw.githubusercontent.com/dompling/Script/master/wsgw/wsgw.sgmodule",
    loonPluginUrl: "https://raw.githubusercontent.com/monkey-sking/sgcc/main/wsgw.plugin",
    qxRewriteUrl: "https://raw.githubusercontent.com/monkey-sking/sgcc/main/wsgw.conf",
}

function enc(u: string) {
    return encodeURIComponent(u)
}

function open(url: string) {
    return Safari.openURL(url)
}

export function createModuleActions(): ModuleAction[] {
    const handleOpenBoxJsSub = async () => open(MODULE_LINKS.boxjsSubUrl)

    const handleInstallToSurge = async () => {
        await open(`surge:///install-module?url=${enc(MODULE_LINKS.surgeModuleUrl)}`)
    }

    const handleInstallToEgern = async () => {
        const name = enc("网上国网组件服务")
        await open(`egern:/modules/new?name=${name}&url=${enc(MODULE_LINKS.surgeModuleUrl)}`)
    }

    const handleInstallToLoon = async () => {
        await open(`loon://import?plugin=${enc(MODULE_LINKS.loonPluginUrl)}`)
    }

    const handleInstallToQx = async () => {
        await open(
            `quantumult-x:///update-configuration?remote-resource=${enc(MODULE_LINKS.qxRewriteUrl)}`,
        )
    }

    return [
        { title: "添加 BoxJS 订阅", systemImage: "shippingbox", action: handleOpenBoxJsSub },
        { title: "安装 Surge 模块", systemImage: "bolt.fill", action: handleInstallToSurge },
        { title: "安装 Egern 模块", systemImage: "tornado", action: handleInstallToEgern },
        { title: "安装 Loon 插件", systemImage: "puzzlepiece.extension", action: handleInstallToLoon },
        { title: "安装 Quantumult X 重写", systemImage: "doc.text", action: handleInstallToQx },
    ]
}
