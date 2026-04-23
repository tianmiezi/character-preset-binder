# 角色预设绑定器

一个 SillyTavern 前端扩展，用于把生成预设绑定到当前聊天或角色卡。绑定后，每次开始生成回复时，扩展会自动切换到对应预设。

## 功能

- 将当前聊天绑定到某个生成预设。
- 将当前角色卡绑定到某个生成预设。
- 生成开始前自动切换预设。
- 聊天绑定优先于角色卡绑定。
- 支持在扩展设置面板中查看当前绑定状态。
- 支持从角色管理下拉菜单快速绑定角色卡预设。

## 安装

### 通过 SillyTavern 扩展安装器安装

1. 打开 SillyTavern。
2. 进入“扩展”页面。
3. 找到“安装扩展”或“Install extension”。
4. 输入本仓库地址：

```text
[https://github.com/你的用户名/character-preset-binder](https://github.com/tianmiezi/character-preset-binder)
```

5. 安装后刷新 SillyTavern 页面。

### 手动安装

也可以下载或打包本插件文件夹，然后放到 SillyTavern 的扩展目录：

```text
SillyTavern/public/scripts/extensions/character-preset-binder
```

最终目录结构应类似：

```text
SillyTavern/public/scripts/extensions/character-preset-binder/manifest.json
SillyTavern/public/scripts/extensions/character-preset-binder/index.js
SillyTavern/public/scripts/extensions/character-preset-binder/style.css
```

放置完成后刷新 SillyTavern 页面。

## 使用方法

1. 打开 SillyTavern 并选择角色。
2. 打开“扩展”设置区域，找到“角色预设绑定器”。
3. 在“要绑定的预设”中选择当前 API 下的预设。
4. 点击“绑定聊天”或“绑定角色卡”。
5. 开始生成回复时，插件会自动切换到绑定的预设。

也可以在角色管理下拉菜单中选择“绑定预设到角色卡”，快速给当前角色卡绑定预设。

## 绑定优先级

如果聊天和角色卡都绑定了预设，插件会优先使用聊天绑定。

```text
聊天绑定 > 角色卡绑定
```

这意味着你可以给角色设置一个默认预设，同时为某个具体聊天覆盖它。

## 注意事项

- 插件只会在当前 API 下切换预设。例如绑定的是 OpenAI 预设，但当前使用 Text Completion API 时，不会跨 API 切换。
- 如果绑定的预设被删除或重命名，插件会提示找不到该预设。
- 聊天绑定会保存到当前聊天的 metadata 中。
- 角色卡绑定会保存到角色卡的 `data.extensions` 字段中。

