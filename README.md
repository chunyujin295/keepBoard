# keepBoard

像素风 Windows 桌面宠物 + 键鼠/屏幕时间统计工具。一只会咬人的食人花蹲在你的任务栏旁，你每敲一下键盘、点一下鼠标，它都会张嘴回应——同时默默记录你的每一次输入。

基于 **Electron + React + TypeScript + Canvas** 构建。

## ✨ 功能特性

| 模块 | 说明 |
|------|------|
| 🌱 像素宠物 | 9 款主题：食人花 / 仙人掌 / 史莱姆 / 像素猫 / 马里奥蘑菇 / 幽灵 / 小恐龙 / 机器人 / 南瓜灯，全部带咬合、狂暴、眨眼、摇摆动画 |
| ⌨ 全局统计 | 全局键盘（按字母/数字/功能键/修饰键/方向键分类）、鼠标左右中键、滚轮、峰值 APM、最长会话 |
| 📊 今日面板 | 实时展示当天键击、点击、屏幕使用时长、按键分类明细 |
| 📈 每周报告 | 本周/历史周统计翻阅、每日柱状图、一键导出 CSV 周报 |
| 🖥 屏幕时间 | 30s 空闲判定，自动累计有效使用时长 |
| 🎨 右键菜单 | 纯右键交互：统计入口、主题切换、置顶/吸附/自启/音效开关 |
| 🧲 任务栏吸附 | 自动检测任务栏位置（上/下/左/右），拖动松手后自动吸附 |
| 🔝 窗口特性 | 无边框透明窗口、始终置顶、不占任务栏 |
| 🚀 开机自启 | 一键开关，写入系统登录项 |

## 📦 环境要求

- [Node.js](https://nodejs.org) ≥ 18（含 npm）
- Windows 10/11

## 🚀 快速开始

### 方式一：一键脚本（推荐）

```cmd
scripts\dev.cmd
```

首次运行会自动安装依赖，然后启动 Vite 热更新 + Electron 窗口。

### 方式二：手动命令

```bash
npm install        # 安装依赖
npm run dev        # 启动开发模式
```

### 关于全局输入统计的说明

应用内置 [uiohook-napi](https://github.com/SnosMe/uiohook-napi) 原生钩子（N-API 预编译二进制，无需本地编译），开箱即用，全局记录键鼠事件且**不会劫持或拦截任何按键**。

若原生模块加载失败（如被安全软件拦截），会自动降级为"仅统计 keepBoard 窗口内的输入"，不影响正常打字。

## 🧰 打包发布

### 方式一：一键脚本（推荐）

```cmd
scripts\build-installer.cmd
```

自动完成：生成像素图标 → 构建渲染层与主进程 → electron-builder 打包。

### 方式二：手动命令

```bash
npm run package    # 含 prepackage 钩子：icons + build + electron-builder
```

产物输出在 `release\` 目录：

| 文件 | 说明 |
|------|------|
| `keepBoard-Setup-<版本>-x64.exe` | NSIS 安装版（可选安装目录、创建桌面/开始菜单快捷方式） |
| `keepBoard-Portable-<版本>-x64.exe` | 便携单文件版，免安装直接运行 |

## 🕹 使用说明

- **移动**：按住宠物拖拽，靠近任务栏松手自动吸附
- **菜单**：**右键点击**宠物打开菜单（统计 / 主题 / 各项开关 / 设置 / 退出）
- **托盘**：系统托盘常驻图标，左键唤起窗口，右键弹出同款菜单
- **数据目录**：设置面板 → 「📂 数据目录」，统计数据存于 `%APPDATA%\keepBoard\keepboard-store.json`（自动清理 180 天前的日数据）

## 📁 项目结构

```
keepBoard/
├── electron/            # 主进程
│   ├── main.ts          # 入口：窗口/托盘/IPC/统计调度
│   ├── hooks.ts         # 全局键鼠钩子（原生模块优先 + 回退）
│   ├── store.ts         # JSON 文件持久化（设置 + 日统计）
│   ├── statsUtils.ts    # 周/日聚合、CSV 导出、按键分类
│   ├── windowManager.ts # 任务栏吸附逻辑
│   └── menu.ts          # 托盘菜单、开机自启
├── src/                 # 渲染进程 (React)
│   ├── components/      # 宠物画布、今日/每周/设置面板、右键菜单
│   └── lib/             # 像素绘制引擎与 9 款主题
├── scripts/
│   ├── generate-icons.mjs  # 字符画 → PNG/ICO 图标生成器
│   ├── dev.cmd             # 一键开发脚本
│   └── build-installer.cmd # 一键打包脚本
└── build/               # 生成的图标（git 忽略，打包时自动重新生成）
```

## 📜 License

[MIT](https://opensource.org/licenses/MIT)
