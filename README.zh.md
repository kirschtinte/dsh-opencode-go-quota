# dsh-opencode-go-quota

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：在输入框旁实时显示你的
**OpenCode Go** 剩余额度，数据直接读自 OpenCode Go 的用量接口。

[English](README.md)

```
● OpenCode Go   98% · 97% · 99%
```

三个窗口，对应 OpenCode Go 自己的额度定义：

| 窗口 | 额度 | 显示 |
| --- | --- | --- |
| Rolling（5 小时） | 月额度的 20% | 该额度的剩余百分比 |
| Weekly（每周） | 月额度的 50% | 剩余百分比 |
| Monthly（每月） | 月额度的 100% | 剩余百分比 |

点开胶囊可以看到每个窗口的进度条和重置倒计时。

## 前置条件

- 带 Web UI 的 DeepSeek Harness
- 一个 OpenCode Go 订阅，且它的 API key 已存进 Harness，凭证引用名为 `OPENCODE_GO_API_KEY`
  （也就是你 `opencode-go` provider 那一行已经在用的同一个 key）

## 安装

这是一个本地 Harness bundle。先克隆到一个固定的位置：

```bash
git clone https://github.com/kirschtinte/dsh-opencode-go-quota.git
```

然后让 Harness 安装它——通过 agent 调用内置的插件管理器，**target 填克隆目录的绝对路径**：

```
plugin_manager  action: install_bundle
                target: /absolute/path/to/dsh-opencode-go-quota
```

`install_bundle` 会替你写 profile 的 `package.json` 和 `cordis.patch.yml`，并把该目录软链进去，
所以之后改克隆目录里的文件、刷新页面即可生效。**不要**手工去编辑 profile 文件，也不要在
profile 目录里跑包管理器。

## 配置

配置项写在 profile 的 `cordis.patch.yml` 里那一行上：

```yaml
- insert:
    - id: dsh-opencode-go-quota
      name: '@local/dsh-opencode-go-quota'
      config:
        baseUrl: https://opencode.ai/zen/go   # 接口根地址，会拼上 /v1/usage
        credentialRef: OPENCODE_GO_API_KEY    # 存放 key 的凭证引用名
        refreshMs: 60000                      # 缓存时长，下限 5000
```

改宿主半需要重启应用；浏览器半刷新页面即可。

## 实现方式

**宿主半**（[`index.js`](index.js)）通过 Harness 的凭证服务读取 key，请求
`GET <baseUrl>/v1/usage`，把三个窗口整理成纯 JSON 并缓存。它**不 import 任何东西**：
profile 安装的 bundle 解析裸模块名时会从自己的目录往上找，而那个目录里没有 Harness 的包。
服务通过 Typert Gateway 的 *source mode* 暴露给浏览器——该模式从运行时反射推导出通信描述符，
不需要代码生成产物。这也是那两个导出方法不收参数、并以字面量原型标记声明的原因。

**浏览器半**（[`client.js`](client.js)）把这些端点挂载成 `remote` 命名空间，并把一个胶囊
注册进 `conversation.composer.dock` 槽位。它同样不 import 任何 Harness 客户端包：React 来自
模块表，所有颜色都是 `--dsw-*` 主题 token，所以面板在明暗两套主题下都和宿主菜单一致。

**你的 API key 不会进浏览器**，客户端只收到解析好的百分比数字。

## 说明与限制

- **轮询频率**：浏览器每 60 秒取一次快照，标签页重新可见时会补一次；点开面板会强制绕过宿主缓存
  重新读取。
- **数据陈旧是可见的**：读取失败时旧数字仍留在屏幕上，但会标出它是何时取的，失败原因显示在下方——
  旧数据不会冒充当前值。
- **浅色主题**：面板在深色下是深色玻璃，在浅色下是一层淡磨砂。当应用底色是纯白时，背后没有东西
  可折射，玻璃感主要靠边缘高光体现——这是固有限制，不是样式缺陷。
- **这个用量接口不是官方的**：`https://opencode.ai/zen/go/v1/usage` 并不在 OpenCode 公开文档
  的 API 列表里。如果 OpenCode 改动或移除它，插件会报告失败，而不是显示错误数字。

## 开发

[`tools/contrast.mjs`](tools/contrast.mjs) 是本地校验脚本，不属于插件运行时。它读取已安装
Harness 的主题样式表、解析 token 链，打印两种配色下每一层文字的对比度，这样改配色不用靠眼睛猜：

```bash
node tools/contrast.mjs
```

它会自己找到主题包，包括直接从 `app.asar` 里读取——桌面版 Harness 的整棵树都打包在那个文件里。
如果你的 Harness 装在别处，可以把它的根目录、`app.asar`、或主题模块本身作为第一个参数传入，
也可以设置 `DSH_THEME_PATH`。

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。

Copyright 2026 kirschtinte
