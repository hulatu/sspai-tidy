<div align="center">

# 📰 少数派 · 阅读增强

**一个 Tampermonkey 用户脚本，把 [sspai.com](https://sspai.com) 改成一个只用来读东西的地方。**

[![version](https://img.shields.io/badge/version-1.4.1-1b1917?style=flat-square)](sspai-tidy.user.js)
[![platform](https://img.shields.io/static/v1?label=%E5%B9%B3%E5%8F%B0&message=sspai.com&color=d71a1b&style=flat-square)](https://sspai.com)
[![userscript](https://img.shields.io/static/v1?label=%E7%B1%BB%E5%9E%8B&message=UserScript&color=2f7d5d&style=flat-square)](https://www.tampermonkey.net/)
[![license](https://img.shields.io/static/v1?label=%E8%AE%B8%E5%8F%AF&message=MIT&color=1b1917&style=flat-square)](LICENSE)

**[⬇️ 安装](https://raw.githubusercontent.com/hulatu/sspai-tidy/main/sspai-tidy.user.js)** ・
**[🎛 想改点什么](#-想微调)** ・
**[⚠️ 失效了怎么办](#-注意)**

</div>

![首页](screenshots/home.png)

## 📑 目录

| 想了解 | 看这里 |
| --- | --- |
| 它到底动了什么 | [🎯 一句话](#-一句话) ・ [📊 数字对比](#-数字对比) |
| 文章页有什么变化 | [📖 文章页：读完就结束](#-文章页读完就结束) |
| 1.4 新增了什么 | [✨ 1.4 新增](#-14-新增) |
| 1.4.1 新增了什么 | [✨ 1.4.1 新增](#-141-新增) |
| 怎么装 | [🚀 装法](#-装法) |
| 想自己调 | [🎛 想微调](#-想微调) |
| 坏了 / 不生效 | [⚠️ 注意](#-注意) |

## 🎯 一句话

少数派的列表页把三分之二的屏幕给了轮播、侧栏和推广卡，文章页在正文之后又堆了近 2000px 的广告、打赏、评论和「关联阅读」。

这个脚本把它们都拿掉，**一屏从 4 篇变成 9 篇，文章页读完正文就结束**；然后补上几个原站没有、但读长文很需要的小东西：进度条、目录常驻、顶栏自动隐藏、字数统计、代码块复制、已读标记。点图放大不再自己做——原站现在自带全功能查看器（切换、缩略图、旋转、下载），脚本不再拦截点击。

## 📊 数字对比

在 1440×900 的窗口下实测（单条 = 一篇的高度）：

| | 首页 | Matrix | 作者主页 |
| --- | --- | --- | --- |
| 列表宽度 | 520 → **1064px** | 741 → **1064px** | 588 → **1064px** |
| 单条高度 | 189 → **99px** | 136 → **92px** | 178 → **121px** |
| 一屏（900px 高）能看到 | 4 → **9 篇** | 6 → **9 篇** | 5 → **7 篇** |

![Matrix](screenshots/matrix.png)

## 📖 文章页：读完就结束

一篇 11000px 的长文，原文总高 **13466px**，其中约 2400px（18%）不是正文。清完是 **11097px**。

| 清掉的块 | 高度 | 是什么 |
| --- | --- | --- |
| `.article__charge__card` | 222px | 「N 位派友已充电」打赏卡 |
| `.advertisement__box` | **398px** | 文末广告位 |
| `.post__comments` | 237px | 讨论区（底部固定栏的评论按钮还能打开弹窗，不算丢了入口） |
| `.related__read__wrapper` | 864px | 「关联阅读」 |
| `.comment__footer__wrapper` ×7 | 392px | 正文每个章节末尾的「发表首评 + 表情」互动条 |

**保留**：正文、文章标签与责编信息、目录、底部固定的「说点什么… / 分享」栏。

![文章页](screenshots/article.png)

## ✨ 1.4 新增

> 1.2 只有「减法」。1.3 补了四个「加法」。1.4 在 1.3 的基础上再加三个，并把点图放大还给原站。

### 📊 阅读进度条

文章页顶部一条 2px 的红线，跟着滚动走。首页、Matrix、作者页不显示。
滚到底时宽度到 100%，`requestAnimationFrame` 节流，不占主线程。

### 📑 目录常驻

原站的目录默认只是一条竖直虚线，悬停才展开，很多人不知道那里有个目录。现在打开文章就自动点站方自己的固定按钮（`.article__directory__pin`），目录一直展开显示；再加一道 CSS 兜底（覆盖它内联的 `display:none`）。

### 🔝 顶栏自动隐藏

文章页向下滚超过 120px 后，顶部导航（`#app-head`）向上平移藏起来，向上滚立即放回。用 `transform` 实现，不占布局、不引起页面跳动；顶部那条 2px 进度条不受影响，一直可见。

### 🔢 字数统计

原站只有「14 分钟阅读」，没有字数。现在数正文 `.article__main__content` 的字数，插在它后面，显示成「14 分钟阅读 · 约 7,234 字」。中英文混排都按字符数，去掉空白后计数。

### 🖼 点图放大：1.4 起不再自己做

1.3 的自定义查看器在 1.4 里删掉了——原站现在自带全功能查看器（左右切换、底部缩略图、旋转、下载），比自定义的更全。脚本之前在捕获阶段拦截点击，反而把原站查看器挡住了；现在不拦截，点图直接走原站查看器。

### 📋 代码块复制

正文里的 `<pre>` 右上角会出现一个「复制」按钮，悬停才显示，点一下变「已复制」。
复制的是纯文本（不含按钮自己那两个字），优先走 `navigator.clipboard`，不行就退回 `execCommand`。

### ✅ 已读标记

读过的文章，在首页 / Matrix / 作者页的列表里会**压暗到 48%**，鼠标悬停恢复原亮度。
记录只写在你自己浏览器的 `localStorage`（`sspai-tidy:read`），最多存 400 条，不上传任何地方。

## ✨ 1.4.1 新增

> 1.4.1 再补三件事：搜索页、文章正文宽度、列表页的页面跳转。

### 🔍 搜索页拉宽

搜索页（`/search`）之前完全没动过：结果区窄，右侧还有一列「推荐标签」。现在把它拉宽到和首页一样（1120px），藏掉右侧推荐标签栏。文章结果是 `.module__list__slot` 包着 `PostCard`；如果它渲染的是 `.article__card`，首页那套紧凑规则（全局的）会直接沿用。

### 📏 文章正文放宽

实测正文栏和标题栏都是 680px（1919px 视口）。现在一起放宽到 800px，保持对齐。`wideArticle` 开关默认开，觉得行太长就关掉（`wideArticle: false`）。

### 📖 页面跳转

首页 / Matrix / 作者主页 / 搜索页都是无限滚动或「加载更多」，想看旧文章只能一直往下翻。现在右下角多了一个悬浮控件（在返回顶部按钮的上方）：

- 显示当前已加载到第几页（「页」按每批的数量算：首屏有几条，一页就是几条）
- 输页码点「跳转」，会一直加载到那一页再滚过去
- 点「+10 页」，一次加载 10 页

Matrix 有「加载更多」按钮就直接点它；首页 / 作者页是无限滚动，就滚到底触发加载。加载时按钮会暂时禁用，避免重复点。

> 说明：Matrix 列表行里并没有「复制链接 / 分享 / 在集合中查看」这三个按钮——站方服务端渲染的 HTML 里没有，悬停也不会出现；每行底部只有作者、点赞数、评论数和时间，都是有用的信息，所以 1.4.1 没有动它们。

## 🚀 装法

1. 装 [Tampermonkey](https://www.tampermonkey.net/)（Chrome / Edge / Firefox 商店都有；Safari 用 [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)）。
2. 点 **[sspai-tidy.user.js](https://raw.githubusercontent.com/hulatu/sspai-tidy/main/sspai-tidy.user.js)** —— 会弹出安装页，点「安装」。
3. 打开 <https://sspai.com/> ，生效。

> 脚本头里写了 `@updateURL` / `@downloadURL`，以后我推新版本，Tampermonkey 会自己提示更新，不用手动重装。

装不上就手动来：Tampermonkey 面板 → 添加新脚本 → 把 `.user.js` 全文粘进去替换模板 → `Cmd/Ctrl + S`。

## 🎛 想微调

脚本开头有一个 `CFG`，改完保存即生效：

```js
const CFG = {
  // ---- 列表页：减法 ----
  hideHero:      true,   // 顶部大 banner 区（派早报 / 投稿须知 / 广告位）
  hideLeftNav:   true,   // 首页左侧「推荐 / 全部内容 / 话题讨论 / 热门内容」
  hideRightSide: true,   // 首页「派友在看」、Matrix「值得关注 / 专栏推荐」
  hidePrime:     true,   // 列表里的 PRIME 会员社区精选
  hidePromo:     true,   // 列表里的「一派投票 / 讨论」推广卡
  hideCustomerService: true, // 右下角「联系客服」问号按钮（保留旁边的返回顶部）
  autoLoad:      true,   // 滚到底自动点「加载更多」（Matrix）
  thumb:         128,    // 列表缩略图宽度 px，0 = 不显示缩略图
  thumbSide:     'left', // 'left' 图在标题左边；'right' 保持站点原样
  compact:       true,   // false = 行高恢复宽松
  userDefaultPosts: true, // 进作者主页默认显示「文章」列表
  userWide:      true,   // 作者主页也拉宽、按首页样式重排

  // ---- 文章页：减法 ----
  hideArticleCharge:   true, // 「N 位派友已充电」打赏卡
  hideArticleAd:       true, // 文末广告位
  hideArticleComments: true, // 讨论区
  hideArticleRelated:  true, // 「关联阅读」
  hideInlineComment:   true, // 正文各章节末尾的「发表首评」互动条

  // ---- 文章页：加法（1.3 新增，1.4 续）----
  progressBar:   true,   // 顶部阅读进度条
  codeCopy:      true,   // 代码块右上角「复制」
  markRead:      true,   // 列表里把读过的文章压暗
  tocPin:        true,   // 文章页目录常驻展开（自动点站方自己的固定按钮）
  hideHeaderOnScroll: true, // 文章页向下滚动时收起顶栏，向上滚再出现
  wordCount:     true,   // 标题下「14 分钟阅读」旁显示「约 X 字」
  hideMatrixTitle: true, // Matrix 顶部只留「社区广场 / 专栏 / 一派」标签，藏掉大标题行
  // 1.4 已删 imageViewer：点图放大改用原站自带查看器，不再拦截点击

  // ---- 1.4.1 新增 ----
  searchWide:    true,   // 搜索页拉宽、藏掉右侧「推荐标签」
  wideArticle:   true,   // 文章正文放宽到 800px（默认开，觉得行太长就关掉）
  pageJump:      true    // 列表页右下角加「页面跳转」：输页码跳到指定页、或一次加载 10 页
};
```

几个常见的改法：

- **只想清广告，不想动排版**：`compact: false` + `userWide: false`
- **想更极端地只看标题**：`thumb: 0`，变成纯文字列表（单条 99 → 92px），没有图更安静
- **想留评论区**（少数派的评论质量通常不错）：`hideArticleComments: false`
- **不喜欢被压暗**：`markRead: false`（已经记下的条目不会被清掉）
- **只想要阅读进度条**：把上面所有 `hide*` 都改成 `false`，只留 `progressBar: true`
- **Matrix 顶部想留大标题**：`hideMatrixTitle: false`（只藏标题行，标签页一直都在）

## 🚧 注意

- **少数派改版后类名可能会变**，脚本会失效（页面恢复原样，不会坏）。到时候把新类名替换进选择器即可 —— 改版最容易先坏的是 `.article__card` / `.post-item` / `.article__main__content` 这三个。1.4 新增的选择器（`.article__directory__pin`、`.article__header__reading-time`、`#app-head`、`.matrix-page-header .page-title`）也是同理。
- 首页右侧那个半透明浮层卡「无需申请，自由写作」和话题页（`/topic/*`），站方在改版中已经移除了，不用再管。
- Matrix 顶部只藏了标题行（大 Logo +「开始创作」），「社区广场 / 专栏 / 一派」标签页一直留着，切换不受影响。
- 改宽度和行高的规则**只在窗口 ≥1000px 时生效**，窄窗口下用站点自己的布局，不会打架。
- 作者页的跳转只在**进入主页那一刻**发生：进去之后再手动点「动态 / 收藏」，不会被抢回来。
- 文章页那两个 `.article__subsection__wrapper` 只能清里面的内容块，**不能整个藏掉** —— 底部那条「说点什么…」固定栏的占位元素挂在里面，整块 `display:none` 会让那条栏塌成 0×0。脚本里已经按这个约束写了。
- 站点把整列包在 `.feed__wrapper` 里，并写死 `max-width: 960px`；只改 `.feed` 会被它卡住（实测只能到 960 / 卡片 904），所以两个都要放开。
- 脚本只改样式、点几下按钮、写一条本地的已读记录；**不碰登录态、不读你的数据、不发任何请求**。

## 🧪 兼容性

在 Chrome（Helium 157）+ Tampermonkey 下开发，1440×900 窗口实测；首页 / Matrix / 作者主页 / 文章页四条路径都验证过，含浅色与深色主题。

用到的都是现代 CSS（`:has()`、`aspect-ratio`、CSS 变量），Chrome 105+ / Safari 15.4+ / Firefox 121+ 都没问题。

深色主题下同样生效，颜色全部走站点自己的 CSS 变量：

![深色主题](screenshots/home-dark.png)

## 📄 许可

[MIT](LICENSE) —— 随便改、随便用，出问题别找我。
