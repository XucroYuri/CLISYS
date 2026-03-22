<div align="center">

# CLISYS

**多 CLI 智能协作系统**

*元 CLI·智能执行织物·AI 编排器*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-orange.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-latest-black.svg)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/tests-147%2F147_passing-brightgreen.svg)](#测试)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[English](README.md) · [中文](README.zh-CN.md) · [路线图](docs/roadmap.md) · [贡献指南](CONTRIBUTING.md) · [安全政策](SECURITY.md)

</div>

---

## 什么是 CLISYS？

CLISYS **不是**又一个 AI CLI 工具。它是一个**元 CLI 编排器** —— 一个让多个 AI CLI 工具协同工作的协调层。

将其想象为一个 AI 助手乐团的指挥：每个工具发挥其优势，而 CLISYS 负责路由任务、聚合结果并迭代优化方案。

```
用户请求 → CLISYS 编排器
                │
    ┌───────────┼───────────┐
    ↓           ↓           ↓
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Claude  │ │  Codex   │ │  Gemini  │  …更多
│   Code   │ │   CLI    │ │   CLI    │
└──────────┘ └──────────┘ └──────────┘
    │           │           │
    └───────────┴───────────┘
                │
                ↓
          协作结果
```

> **灵感来源：** [Oh My OpenAgent](https://github.com/openagentlabs/oh-my-openagent)（前身为 Oh My OpenCode）—— AI CLI 生态系统应当拥有像 oh-my-zsh 那样的可组合性。

---

## 目录

- [功能特性](#功能特性)
- [快速上手](#快速上手)
- [架构设计](#架构设计)
- [支持的适配器](#支持的适配器)
- [循环机制](#循环机制)
- [配置说明](#配置说明)
- [开发路线图](#开发路线图)
- [技术栈](#技术栈)
- [灵感来源与致谢](#灵感来源与致谢)
- [贡献指南](#贡献指南)
- [开源协议](#开源协议)
- [社区](#社区)

---

## 功能特性

| 功能 | 描述 |
|------|------|
| 🎯 **多 CLI 编排** | 协调 Claude Code、Codex CLI、Gemini CLI 等 |
| 🧠 **智能任务分发** | 基于能力、成本和性能的智能路由 |
| 🔄 **循环机制** | Ralph 循环（自我优化）和 Ultrawork 循环（并行执行） |
| 📊 **结果聚合** | 合并、投票或从多个适配器输出中选择最佳结果 |
| ⚙️ **灵活配置** | 基于 TOML 的配置，支持 Zod 验证和多层级覆盖 |
| 💾 **会话持久化** | SQLite + Drizzle ORM 用于执行历史和会话状态 |
| 🔌 **插件优先适配器系统** | 内建适配器 + 插件发现 + manifest 校验 + provider backend + toolchain gating |
| 🏗️ **事件驱动核心** | EventBus 用于监控、调试和钩子集成 |

---

## 快速上手

### 前置条件

- [Bun](https://bun.sh/) ≥ 1.0 或 Node.js ≥ 20
- 至少安装一个支持的 AI CLI 工具（例如 `claude`、`codex`、`gemini`）

### 安装

```bash
# 克隆仓库
git clone https://github.com/XucroYuri/CLISYS.git
cd CLISYS

# 安装依赖
bun install

# （可选）运行测试以验证安装
bun test
```

### 基本用法

```bash
# 显示所有可用命令
bun run src/cli/index.ts --help

# 列出可用适配器及其状态
bun run src/cli/index.ts adapters

# 执行任务（自动路由到最佳适配器）
bun run src/cli/index.ts run "创建一个带 JWT 认证的 REST API"

# 指定特定适配器
bun run src/cli/index.ts run "检查这段代码的安全问题" --adapter claude-code

# 并行运行所有适配器
bun run src/cli/index.ts run "重构这个模块" --parallel

# 使用迭代优化（Ralph 循环）
bun run src/cli/index.ts run "编写全面的测试" --loop ralph --max-iterations 3
```

---

## 架构设计

```
clisys/
├── src/
│   ├── core/
│   │   ├── orchestrator/     # TaskParser、Dispatcher、Aggregator、LoopManager
│   │   ├── adapter/          # BaseAdapter、AdapterRegistry
│   │   ├── plugins/          # Manifest schema、loader、discovery、SDK
│   │   ├── providers/        # brew/npm/pipx/cargo/binary provider backend
│   │   ├── toolchain/        # Policy gate、state、locks、manager、audit、maintenance
│   │   ├── bus/              # EventBus
│   │   ├── config/           # 配置加载器和验证器
│   │   ├── logger/           # 基于 Pino 的结构化日志
│   │   └── storage/          # SQLite 会话和执行历史
│   ├── adapters/
│   │   ├── claude-code/      # Claude Code 适配器
│   │   ├── codex/            # OpenAI Codex CLI 适配器
│   │   └── gemini/           # Google Gemini CLI 适配器
│   ├── loops/
│   │   ├── ralph.ts          # 自我迭代优化循环
│   │   └── ultrawork.ts      # 并行多适配器循环
│   └── cli/
│       ├── commands/         # run、adapters、config 命令
│       └── index.ts          # CLI 入口点（Clipanion）
├── tests/                    # Vitest 测试套件（147 个测试）
├── docs/
│   ├── design/               # 架构和设计文档
│   └── roadmap.md            # 开发路线图
└── config/
    └── default.toml          # 默认配置
```

---

## 支持的适配器

| 适配器 | 状态 | CLI 工具 | 备注 |
|--------|------|----------|------|
| `claude-code` | ✅ 稳定 | [Claude Code](https://docs.anthropic.com/claude-code) | Anthropic 的编码助手 |
| `codex` | ✅ 稳定 | [Codex CLI](https://github.com/openai/codex) | OpenAI 的 CLI 编码代理 |
| `gemini` | ✅ 已支持 | [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Google 的 CLI AI 工具 |
| `openagent` | 🔲 计划中 | [Oh My OpenAgent](https://github.com/openagentlabs/oh-my-openagent) | 可组合的代理框架 |
| `aider` | 🔲 计划中 | [Aider](https://github.com/paul-gauthier/aider) | Git 感知的编码助手 |

**添加新适配器**现在支持插件优先路径：发布 `@clisys/adapter-*` 包并提供 manifest、动态入口和 provider-backed toolchain 元数据，或者继续使用内建适配器方式。详见 [docs/design/architecture.md](docs/design/architecture.md) 和 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 循环机制

### Ralph 循环 —— 迭代自我优化

迭代执行任务，直到满足完成标准或达到最大迭代次数。适用于需要优化周期的任务（例如：测试 → 修复 → 测试）。

```
┌──────────────────────────────────────┐
│  ┌──────┐   ┌─────────┐   ┌───────┐ │
│  │ 任务 │──▶│  执行   │──▶│  检查 │ │
│  └──────┘   └─────────┘   └───────┘ │
│      ▲                        │      │
│      └────────────────────────┘      │
│          （未完成则继续迭代）         │
└──────────────────────────────────────┘
```

### Ultrawork 循环 —— 并行多适配器执行

同时向多个适配器分发同一任务，然后聚合或选择最佳结果。适用于验证、多元视角和冗余场景。

---

## 配置说明

CLISYS 使用分层 TOML 配置系统：

1. 内置默认值（`config/default.toml`）
2. 用户级配置（`~/.clisys/config.toml`）
3. 项目级配置（项目中的 `.clisys/config.toml`）

```toml
version = "1.0"

[adapters.claude-code]
enabled = true
command  = "claude"

[adapters.codex]
enabled = true
command  = "codex"

[adapters.gemini]
enabled = true
command  = "gemini"

[orchestrator]
default_strategy   = "capability_based"   # capability_based | cost_based | performance | round_robin
max_parallel_tasks = 3
task_timeout       = 300000               # 毫秒

[logging]
level  = "info"    # debug | info | warn | error
output = "console" # console | file
```

---

## 开发路线图

完整技术路线图详见 [docs/roadmap.md](docs/roadmap.md)。概要：

| 阶段 | 版本 | 重点 |
|------|------|------|
| 第一阶段 ✅ | v0.1.0 | MVP — 核心编排、三个内建适配器、循环机制、存储 |
| 第二阶段 🔄 | v0.2.x | 扩展适配器（OpenAgent、Aider） |
| 第三阶段 📋 | v0.3.x | 插件架构、流式输出、评分缓存 |
| 第四阶段 📋 | v0.5.x | 企业功能：权限控制、沙箱、审计日志 |
| 第五阶段 📋 | v1.0.0 | 公开发布、SDK、社区生态系统 |

---

## 技术栈

| 组件 | 技术 | 原因 |
|------|------|------|
| 运行时 | [Bun](https://bun.sh/) / Node.js 20+ | 接近原生性能，出色的 TypeScript 支持 |
| 语言 | TypeScript 5（严格模式） | 全组件类型安全，最佳 AI 工具集成 |
| CLI 框架 | [Clipanion](https://mael.dev/clipanion/) | 基于装饰器的类型安全命令处理 |
| 验证 | [Zod](https://github.com/colinhacks/zod) | 配置和适配器契约的模式验证 |
| 日志 | [Pino](https://github.com/pinojs/pino) | 快速、结构化 JSON 日志 |
| 测试 | [Vitest](https://vitest.dev/) | 极速单元测试，原生 ESM 支持 |
| 存储 | [Drizzle ORM](https://orm.drizzle.team/) + SQLite | 类型安全 ORM，零依赖 SQLite |
| 配置 | [TOML](https://toml.io/) via `@iarna/toml` | 人性化格式，CLI 工具中广泛使用 |

---

## 灵感来源与致谢

CLISYS 站在巨人的肩膀上。以下项目直接启发了其设计或作为基础依赖被使用：

### 概念灵感

| 项目 | 贡献 |
|------|------|
| [Oh My OpenAgent](https://github.com/openagentlabs/oh-my-openagent)（前身为 Oh My OpenCode） | 核心理念：可组合的 AI CLI 编排，"AI 代理的 oh-my-zsh"概念 |
| [oh-my-zsh](https://github.com/ohmyzsh/ohmyzsh) | 插件/适配器生态系统模型 |
| [LangChain](https://github.com/langchain-ai/langchain) | 代理链和工具使用模式 |
| [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) | 自我迭代循环和自主任务执行 |
| [CrewAI](https://github.com/joaomdmoura/crewAI) | 多代理角色协作 |

---

## 贡献指南

CLISYS 无法由一个人长期维护。欢迎各种形式的贡献 —— 代码、文档、适配器、想法。

**本项目明确邀请有经验的开发者加入成为长期维护者。** 如果您有兴趣承担维护角色，请提交 issue 或直接联系。

详见 [CONTRIBUTING.md](CONTRIBUTING.md)：
- 开发环境设置
- 代码风格指南
- 如何添加新适配器
- Pull Request 流程
- 维护者职责

详见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) 了解社区标准。

---

## 开源协议

CLISYS 采用 **MIT 协议** 发布。完整文本见 [LICENSE](LICENSE)。

### 协议说明

MIT 允许不受限制的使用，包括商业用途。这是 v0.x 阶段的有意选择，旨在鼓励采用和生态系统发展。

随着项目向 v1.0 成熟，维护者可能会评估双重许可模型（个人/开源使用采用 MIT，企业部署采用商业许可）。任何此类变更仅适用于未来版本，并将在采用前与社区公开讨论。

---

## 社区

- **问题与功能请求**: [GitHub Issues](https://github.com/XucroYuri/CLISYS/issues)
- **讨论**: [GitHub Discussions](https://github.com/XucroYuri/CLISYS/discussions)
- **安全**: 负责任的披露见 [SECURITY.md](SECURITY.md)

---

<div align="center">

*以 ❤️ 为 AI 辅助开发的未来而构建。*

*如果 CLISYS 对您有用，请考虑给仓库点个星 ⭐ —— 这有助于更多人发现这个项目。*

</div>
