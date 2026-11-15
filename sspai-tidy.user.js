// ==UserScript==
// @name         少数派 · 阅读增强
// @namespace    local.sspai.tidy
// @version      2.2.2
// @description  保留少数派原有目录、图片查看器、分享与评论入口；清理广告位、推广卡、侧栏和正文后的干扰模块，并提供紧凑列表、阅读进度、代码复制、已读标记、返回位置恢复、列表过滤与导出、图片原图下载
// @author       hulatu
// @homepageURL  https://github.com/hulatu/sspai-tidy
// @supportURL   https://github.com/hulatu/sspai-tidy/issues
// @updateURL    https://raw.githubusercontent.com/hulatu/sspai-tidy/main/sspai-tidy.user.js
// @downloadURL  https://raw.githubusercontent.com/hulatu/sspai-tidy/main/sspai-tidy.user.js
// @match        https://sspai.com/*
// @icon         https://sspai.com/favicon.ico
// @license      MIT
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_download
// @grant        GM_setClipboard
// @connect      *
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // SPA 软导航时可能被重复注入，直接跳过
  if (window.__sspaiTidyLoaded) return;
  window.__sspaiTidyLoaded = true;

  /* ================================================================
     可调项：改 true / false 就能开关某一块
     ================================================================ */
  const CFG = {
    hideHero:      true,   // 顶部大 banner 区（派早报 / 投稿须知 / 广告位）
    hideLeftNav:   true,   // 首页左侧「推荐 / 全部内容 / 话题讨论 / 热门内容」
    hideRightSide: true,   // 首页「派友在看」、Matrix「值得关注 / 专栏推荐」
    hidePrime:     true,   // 列表里的 PRIME 会员社区精选
    hidePromo:     true,   // 列表里的「一派投票 / 讨论」推广卡
    hideCustomerService: true, // 右下角「联系客服」问号按钮（保留旁边的返回顶部）
    autoLoad:      true,   // 滚到底自动点「加载更多」（Matrix）
    thumb:         128,    // 列表缩略图宽度 px，0 = 不显示缩略图
    thumbSide:     'left', // 'left' = 图在标题左边（宽列表更紧凑）；'right' = 保持原样
    compact:       true,   // true = 紧凑行高，false = 保持原来的宽松
    userDefaultPosts: true, // 进作者主页默认显示「文章」列表（而不是「动态」）
    userWide:      true,   // 作者主页也拉宽、按首页列表的样式重排

    // ---- 文章详情页：读完就结束 ----
    // 这四块都在文章标签之后，加起来约 1950px。想留哪块就把对应项改成 false
    hideArticleCharge:   true, // 「N 位派友已充电」打赏卡（约 222px）
    hideArticleAd:       true, // 文末广告位（约 398px）
    hideArticleComments: true, // 讨论区（约 237px）
    hideArticleRelated:  true, // 「关联阅读」（约 864px）
    hideInlineComment:   true, // 正文每个章节末尾的「发表首评 + 表情」互动条（7 处，约 392px）
    hideAppPromos:       true, // 正文末尾的「下载客户端 / 关注公众号 / 正版软件」推广句

    // ---- 文章页：非侵入式增强 ----
    // 图片点击、目录展开、分享和底部评论栏全部交还给原站，脚本不再拦截或代点。
    progressBar:   true,   // 文章页顶部 2px 阅读进度条
    codeCopy:      true,   // 代码块右上角「复制」
    markRead:      true,   // 列表里标记读过的文章（记在 localStorage，只存最近 400 篇）
    hideRead:      false,  // true = 已读文章直接从列表里消失（配合自动加载就是「只看没读过的」）
    restoreScroll: true,   // 从文章返回列表时回到上次读到的位置（只记本次标签页）

    // ---- 列表工具 ----
    filterBar:     true,   // 列表顶部过滤框 + 屏蔽名单（名单存在 GM 存储里，下次打开还在）
    exportList:    true,   // 脚本菜单：把当前列表导出成 Markdown

    // ---- 文章页 ----
    imageDownload: true,   // 图片右上角「下载原图」（走 GM_download，不经过跨域限制）
    externalMark:  true    // 站外链接补一个 ↗ 标记，并补上 rel="noopener"
  };

  /* 列表宽度：首页 / Matrix / 作者页三处共用，改一处即可 */
  const FEED_MAX = 1120;
  const FEED_PAD = 28;

  const thumbWidth = Math.max(0, Number(CFG.thumb) || 0);
  const thumbSide = CFG.thumbSide === 'right' ? 'right' : 'left';

  /* ================================================================
     存储：GM 优先，退回 localStorage
     —— 2.2 起脚本会申请 GM 权限。Tampermonkey 的 GM_getValue 直接存取对象，
        别的实现可能存字符串；这里统一兜一层，任何一步抛错都退回 localStorage，
        不让一个存储问题把整个脚本卡死（隐私模式下 localStorage 也会抛）。
     ================================================================ */
  const safeParse = (raw, fallback) => {
    try {
      const v = JSON.parse(raw)
      return v == null ? fallback : v
    } catch (e) { return fallback }
  }

  const storeGet = (key, fallback) => {
    try {
      if (typeof GM_getValue === 'function') {
        const v = GM_getValue(key, null)
        if (v !== null && v !== undefined) {
          return typeof v === 'string' ? safeParse(v, fallback) : v
        }
      }
    } catch (e) { /* 没有 GM 或权限被拒，走下面的回退 */ }
    try {
      const raw = localStorage.getItem(key)
      return raw ? safeParse(raw, fallback) : fallback
    } catch (e) { return fallback }
  }

  const storeSet = (key, value) => {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(key, value)
        return
      }
    } catch (e) { /* 同上 */ }
    try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) {}
  };

  /* ================================================================
     几个到处要用的小组件
     ================================================================ */

  /** 复制纯文本；GM 通道和 execCommand 都在，先试哪个都不吃亏 */
  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    (document.body || document.documentElement).appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  };

  const copyOut = (text) => {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return true;
      }
    } catch (e) { /* 权限被拒就退回 execCommand */ }
    return fallbackCopy(text);
  };

  /** 底部轻提示：同一时刻只留一条 */
  const toast = (message) => {
    let el = document.getElementById('sspai-tidy-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sspai-tidy-toast';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el.__sspaiTidyTimer);
    el.__sspaiTidyTimer = setTimeout(() => el.classList.remove('show'), 2200);
  };

  const downloadText = (fileName, text) => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  /** 图片地址 → 文件名 */
  const fileNameOf = (url) => {
    try {
      const last = new URL(url, location.href).pathname.split('/').filter(Boolean).pop() || 'image';
      return /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i.test(last) ? last : last + '.jpg';
    } catch (e) {
      return 'image.jpg';
    }
  };

  /* ================================================================
     样式
     —— 隐藏类规则全局生效；改宽度 / 行高的规则只在 ≥1000px 生效，
        避免和站点自己的窄屏响应式布局打架
     ================================================================ */
  const CSS = `
${CFG.hideLeftNav ? '.feed__side--left { display: none !important; }' : ''}
${CFG.hideRightSide ? '.feed__side--right, .aside-container { display: none !important; }' : ''}
${CFG.hideHero ? '.board { display: none !important; }\n.section__wrapper:has(.board) { display: none !important; }' : ''}
${CFG.hidePrime ? '.shortContentGroup { display: none !important; }' : ''}
${CFG.hidePromo ? '.comboRecommendCard { display: none !important; }' : ''}
${CFG.hideCustomerService ? `/* 右下角悬浮工具条（fixed, right:32px bottom:32px）里有两个按钮：
   联系客服（问号）和返回顶部。这里只砍客服，返回顶部保留 ——
   工具条是 flex + gap，砍掉一个后整体从 96px 收到 40px，
   因为靠右对齐，返回顶部的位置不会动，也不会留下空隙 */
.ss__customer__service { display: none !important; }` : ''}

/* ================================================================
   文章详情页：读完就结束
   —— 文章标签之后原本还堆着四块东西，合计约 1950px：
        充电卡 222 + 广告位 398 + 讨论区 237 + 关联阅读 864
   ⚠️ 「讨论区」和「关联阅读」外层都套着 .article__subsection__wrapper，
      而底部那条「说点什么…」固定栏（comp__ArticleStickyBar）就嵌在这个容器里，
      所以不能 display:none —— 整块藏掉会把那条栏一起带走（实测过）。
      做法：内容块各自藏掉，容器本身压成零高度、无背景、无描边 ——
      看起来这段就不存在了，但里面的固定栏还活着。
   （底部栏自己的配色不做任何覆盖，保持站点原样。）
   ================================================================ */
${CFG.hideArticleCharge ? '.article__charge__card { display: none !important; }' : ''}
${CFG.hideArticleAd ? '.advertisement__box { display: none !important; }' : ''}
${CFG.hideArticleComments ? '.post__comments { display: none !important; }' : ''}
${CFG.hideArticleRelated ? '.related__read__wrapper { display: none !important; }' : ''}
${(CFG.hideArticleComments || CFG.hideArticleRelated) ? `.article__subsection__wrapper {
  margin: 0 !important;
  padding: 0 !important;
  min-height: 0 !important;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
}` : ''}
${CFG.hideInlineComment ? `/* 正文每个章节末尾都插了一条「发表首评 + 表情 + 评论」互动条，
   7 处、每处 24px 高 + 32px 上边距，夹在正文里打断阅读节奏 */
.comment__footer__wrapper { display: none !important; }` : ''}
${CFG.hideAppPromos ? `/* 仅隐藏正文末尾明确指向客户端、公众号和商城的两句推广文案，
   不用「包含会员 / 下载」这类文字匹配，避免误伤文章内容 */
.article__main__content p:has(> a[href$="/page/client"]),
.article__main__content p:has(> a[href^="https://sspai.com/s/"]),
.article__main__content p:has(> a[href$="/mall"]) {
  display: none !important;
}` : ''}

@media (min-width: 1000px) {
/* ---------- 首页：列表占满宽度 ---------- */
/* 整列外面还套了一层 .feed__wrapper，站点给它写了 max-width: 960px。
   只改 .feed 的话会被这层卡住（实测 960 / 卡片 904），必须一起放开 */
.feed__wrapper {
  max-width: ${FEED_MAX}px !important;
}
.feed {
  width: 100% !important;
  max-width: ${FEED_MAX}px !important;
  margin: 0 auto !important;
  padding: 0 ${FEED_PAD}px !important;
  box-sizing: border-box !important;
}
.feed__main {
  flex: 1 1 auto !important;
  width: auto !important;
  max-width: none !important;
  margin-bottom: 56px !important;
}

/* ---------- 首页：列表行 ---------- */
.article__card {
  border-bottom: 1px solid rgba(128, 128, 128, .16) !important;
}
.article__card__body {
  padding: ${CFG.compact ? '13px' : '24px'} 0 !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 20px !important;
}
.article__card__content {
  flex: 1 1 auto !important;
  width: auto !important;
  min-width: 0 !important;
}
.article__card__title {
  font-size: ${CFG.compact ? '16px' : '18px'} !important;
  line-height: ${CFG.compact ? '1.55' : '1.6'} !important;
}
.article__card__meta {
  margin-top: ${CFG.compact ? '6px' : '10px'} !important;
}

/* ---------- 「重点文章」大卡压平成普通行 ----------
   站点有 .article__card--important 这种竖排大卡（大图 + 深色面板 + 摘要），
   和普通行混在列表里会突然断开节奏，这里把它拆成同样的「左图右文」一行 */
.article__card--important {
  padding: 0 !important;
}
.article__card__body--important {
  padding: ${CFG.compact ? '13px' : '24px'} 0 !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 20px !important;
}
.article__card__content--important {
  padding: 0 !important;
  background: transparent !important;
  border-radius: 0 !important;
}
.article__card__title--important {
  font-size: ${CFG.compact ? '16px' : '18px'} !important;
  line-height: ${CFG.compact ? '1.55' : '1.6'} !important;
  font-weight: 600 !important;
}

/* ---------- 「重点文章」的文字配色回到普通行 ----------
   这类卡原本是「深色面板」配色：标题和次要信息都走浅色，
   面板一旦压成透明，次要信息（作者 / 时间 / 摘要）就和普通行对不上了。
   站点自己有主题变量：--B8-t 主文字色、--B6-t 次要灰字，直接复用，
   深浅色主题都会自动跟着切，不用写死颜色 */
.article__card--important .article__card__title,
.article__card--important .article__card__title--important {
  color: var(--B8-t, #1a1a1a) !important;
}
.article__card--important .article__card__meta,
.article__card--important .article__card__author,
.article__card--important .article__card__author__name,
.article__card--important .article__card__publish,
.article__card--important .article__card__summary {
  color: var(--B6-t, #6a6a6a) !important;
  opacity: 1 !important;
}
/* 摘要保留，但压成一行、小一号，不额外撑高行 */
.article__card__summary {
  font-size: 13px !important;
  line-height: 1.5 !important;
  margin-top: 3px !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.article__card__cover--important {
  ${thumbWidth > 0 ? `width: ${thumbWidth}px !important;
  height: ${Math.round(thumbWidth * 0.56)}px !important;` : 'display: none !important;'}
  border-radius: 4px !important;
  overflow: hidden !important;
}
${thumbWidth > 0 ? `
.article__card__cover {
  flex: 0 0 auto !important;
  width: ${thumbWidth}px !important;
  height: ${Math.round(thumbWidth * 0.56)}px !important;
  ${thumbSide === 'left' ? 'order: -1 !important; margin: 0 !important;' : 'margin-left: 20px !important;'}
  border-radius: 4px !important;
  overflow: hidden !important;
  background: transparent !important;
  border: none !important;
}
.article__card__cover img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block !important;
  background: transparent !important;
}
/* 懒加载还没拿到 src 时先别露破图 */
.article__card__cover img:not([src]),
.article__card__cover img[src=""],
.post-cover:not([src]),
.post-cover[src=""] {
  visibility: hidden !important;
}
` : '.article__card__cover { display: none !important; }'}

/* ---------- Matrix（只在 Matrix 路由生效，避免误伤文章和设置页的 .container） ---------- */
html[data-sspai-tidy-page="matrix"] .container {
  width: 100% !important;
  max-width: ${FEED_MAX}px !important;
  padding: 0 ${FEED_PAD}px !important;
  box-sizing: border-box !important;
}
html[data-sspai-tidy-page="matrix"] main.main-container {
  flex: 1 1 auto !important;
  width: auto !important;
  max-width: none !important;
  padding: 0 !important;
}
/* 下面这几条和上面的 .container 一样只在 Matrix 生效：
   同样的 .post-title / .post-cover 在搜索结果和标签页里也有，
   不加限定会把那些页面的字号和缩略图一起改掉 */
html[data-sspai-tidy-page="matrix"] .posts-list,
html[data-sspai-tidy-page="matrix"] .posts-list-item {
  width: 100% !important;
}
html[data-sspai-tidy-page="matrix"] .post-item.defalut {
  padding: ${CFG.compact ? '12px 16px' : '18px 18px 18px 20px'} !important;
  margin: 0 !important;
}
html[data-sspai-tidy-page="matrix"] .posts-list-item {
  margin: 0 !important;
}
html[data-sspai-tidy-page="matrix"] .post-title {
  font-size: ${CFG.compact ? '16px' : '18px'} !important;
  line-height: ${CFG.compact ? '1.5' : '1.6'} !important;
}
html[data-sspai-tidy-page="matrix"] .post-cover {
  flex: 0 0 auto !important;
  ${thumbWidth > 0 ? `width: ${Math.round(thumbWidth * 0.94)}px !important;
  height: ${Math.round(thumbWidth * 0.53)}px !important;` : 'display: none !important;'}
  object-fit: cover !important;
  border-radius: 4px !important;
  ${thumbWidth > 0 && thumbSide === 'left' ? 'order: -1 !important; margin: 0 20px 0 0 !important;' : ''}
}
html[data-sspai-tidy-page="matrix"] .post-item-bottom {
  margin-top: ${CFG.compact ? '6px' : '12px'} !important;
}
${CFG.userWide ? `
/* ================================================================
   作者主页
   —— 原版是三块 588px 窄栏竖着堆：头像卡 / 数据卡 / 列表，
      每篇文章还套了「头像 + 创作了一篇文章 + 卡片」三层，一行占 174px。
      这里把整列拉宽到和首页一致，列表行压成「左图右文 + 灰色日期」
   ================================================================ */
.page__profile .user__info__card,
.page__profile .overview__wrapper,
.page__profile .view__wrapper,
.page__profile .custom__tabs {
  width: 100% !important;
  max-width: ${FEED_MAX}px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  padding-left: ${FEED_PAD}px !important;
  padding-right: ${FEED_PAD}px !important;
  box-sizing: border-box !important;
}
.page__profile .user__updates__view {
  width: 100% !important;
}

/* 一行 = 左图 + 标题 + 灰色日期
   —— 这里刻意用 display:block 而不是 flex：站点给这个容器开了
      flex-wrap:wrap，改成 nowrap 之后主轴尺寸会被算错（塞进去一个
      100px 的元素，量出来只剩 64px，右列也跟着撑不满），
      块级布局反而稳，右列作为块级子元素自然撑满整行 */
.page__profile .user__updates__view .user__update__item__wrapper {
  display: block !important;
  padding: ${CFG.compact ? '13px' : '24px'} 0 !important;
  height: auto !important;
  min-height: 0 !important;
  border-bottom: 1px solid rgba(128, 128, 128, .16) !important;
}
/* 站点用 ::after 画行间分隔线，还带了 24px 上下外边距
   （24 + 1px 线 + 24 = 49px 空白，每行白多出半个行高）。
   上面已经用 border-bottom 画线了，这里直接关掉 */
.page__profile .user__update__item__wrapper::after {
  display: none !important;
}
/* 这是作者自己的主页，头像列是重复信息，去掉 */
.page__profile .user__update__item__left {
  display: none !important;
}
.page__profile .user__update__item__right {
  flex: 1 1 auto !important;
  width: auto !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}
/* 卡片外层原本写死 max-width: 430px，撑满整行 */
.page__profile .user__update__item__card,
.page__profile .user__content__card__wrapper,
.page__profile .user__content__card {
  width: 100% !important;
  max-width: none !important;
}
/* 站点给这一层套了浅色圆角底（原本是「一张小卡片」的观感），
   压平成列表行后要脱掉，否则每行中间会浮出一个灰块 */
.page__profile .user__content__card__wrapper {
  background: transparent !important;
  border-radius: 0 !important;
  border: none !important;
  box-shadow: none !important;
}
.page__profile .user__update__item__card {
  order: 1 !important;
}
.page__profile .user__content__card {
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 20px !important;
}
.page__profile .user__content__card__left {
  flex: 1 1 auto !important;
  width: auto !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 0 !important;
}
/* 选择器多带一层，压过站点给标题的 display: flow-root */
.page__profile .user__update__item__card .user__content__card__title {
  order: 1 !important;
  font-size: ${CFG.compact ? '16px' : '18px'} !important;
  line-height: ${CFG.compact ? '1.55' : '1.6'} !important;
  font-weight: 500 !important;
  color: var(--B8-t, #1a1a1a) !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}
/* 卡片上的「文章」标签和下面的日期重复，藏掉 */
.page__profile .user__content__card__type {
  display: none !important;
}
.page__profile .user__content__card__right {
  order: -1 !important;
  flex: 0 0 auto !important;
  ${thumbWidth > 0 ? `width: ${thumbWidth}px !important;
  height: ${Math.round(thumbWidth * 0.56)}px !important;` : 'display: none !important;'}
  margin: 0 !important;
  border-radius: 4px !important;
  overflow: hidden !important;
  background: transparent !important;
}
.page__profile .user__content__card__image {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block !important;
  border-radius: 4px !important;
}
/* 没有配图的条目别留一个空框 */
.page__profile .user__content__card__right:not(:has(img)) {
  display: none !important;
}
/* 「创作了一篇文章 + 时间」这一行：只留时间，压成小灰字 */
.page__profile .user__update__item__type {
  order: 2 !important;
  margin: ${CFG.compact ? '6px' : '10px'} 0 0 !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  color: var(--B6-t, #6a6a6a) !important;
  justify-content: flex-start !important;
}
.page__profile .user__update__item__type > span:not(.user__update__item__date) {
  display: none !important;
}
.page__profile .user__update__item__date {
  font-size: 13px !important;
  color: var(--B6-t, #6a6a6a) !important;
}
/* 日期行缩进到标题正下方，不要贴在缩略图底下 */
.page__profile .user__update__item__type:has(~ .user__update__item__card .user__content__card__image) {
  ${thumbWidth > 0 ? `margin-left: ${thumbWidth + 20}px !important;` : ''}
}
` : ''}
}

/* ================================================================
   增强：进度条 / 原生图片查看器提示 / 代码复制 / 已读标记
   —— 这几块和宽度无关，窄窗口下同样生效
   ================================================================ */

/* ---------- 阅读进度条 ---------- */
#sspai-tidy-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  width: 100%;
  background: #e0342b;
  opacity: 0;
  z-index: 2147483000;
  pointer-events: none;
  /* 用 transform 而不是 width：宽度动画每帧都要重新布局，
     滚动时正好是最忙的时候；scaleX 只走合成层，代价可以忽略 */
  transform: scaleX(0);
  transform-origin: 0 50%;
  transition: transform .1s linear, opacity .2s;
  will-change: transform;
}

/* ---------- 原生图片查看器 ---------- */
/* 只给可点击的 figure 加光标提示，不绑定 click，也不创建第二套查看器。
   点击后仍由少数派自己的查看器处理切换、缩略图、旋转、下载和 Esc 关闭。 */
.article__main__content figure.image {
  cursor: zoom-in;
}

/* ---------- 代码块复制 ---------- */
.article__main__content pre {
  position: relative;
}
.sspai-tidy-copy {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  color: var(--B8-t, #1a1a1a);
  background: rgba(128, 128, 128, .14);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity .15s;
}
.article__main__content pre:hover .sspai-tidy-copy,
.sspai-tidy-copy:focus-visible {
  opacity: 1;
}
/* 触摸设备没有 hover：按钮否则永远不出现（点一下只会闪一下） */
@media (hover: none) {
  .sspai-tidy-copy { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  #sspai-tidy-progress,
  .sspai-tidy-copy,
  .sspai-tidy-read .article__card__meta,
  .sspai-tidy-read .article__card__summary,
  .sspai-tidy-read .article__card__cover,
  .sspai-tidy-read .post-cover,
  .sspai-tidy-read .user__content__card__right,
  .sspai-tidy-read .user__update__item__type {
    transition: none;
  }
}

/* ---------- 已读标记 ----------
   以前是整卡 opacity: .48。按浅色主题的正文色算，标题会落到 2.7–3.2:1，
   低于 AA 的 4.5:1 —— 想「扫一眼看清但不再吸引我」的需求没达成，反而先看不清了。
   现在改成：标题降到次要灰（约 5.4:1，仍过 AA），元信息、摘要和缩略图压到 55%。
   视觉上照样一眼分出读没读过，扫读和读屏都不吃亏。 */
.sspai-tidy-read .article__card__title,
.sspai-tidy-read .post-title,
.sspai-tidy-read .user__content__card__title {
  color: var(--B6-t, #6a6a6a) !important;
}
.sspai-tidy-read .article__card__meta,
.sspai-tidy-read .article__card__summary,
.sspai-tidy-read .article__card__cover,
.sspai-tidy-read .post-cover,
.sspai-tidy-read .user__content__card__right,
.sspai-tidy-read .user__update__item__type {
  opacity: .55;
  transition: opacity .15s;
}
.sspai-tidy-read:hover .article__card__title,
.sspai-tidy-read:hover .post-title,
.sspai-tidy-read:hover .user__content__card__title {
  color: var(--B8-t, #1a1a1a) !important;
}
.sspai-tidy-read:hover .article__card__meta,
.sspai-tidy-read:hover .article__card__summary,
.sspai-tidy-read:hover .article__card__cover,
.sspai-tidy-read:hover .post-cover,
.sspai-tidy-read:hover .user__content__card__right,
.sspai-tidy-read:hover .user__update__item__type {
  opacity: 1;
}
${CFG.hideRead ? `/* 已读直接从列表消失：配合「滚到底自动加载」就是一个只看新文章的信息流 */
.sspai-tidy-read { display: none !important; }` : ''}

/* ---------- 列表过滤：右下角悬浮面板 ----------
   最初做成列表顶部的横条，两个问题：它要插进文档流，等列表渲染完才出现，
   页面会往下跳一格；而且横条和站点自己的「排序 / 标签」栏挤在同一块。
   现在改成右下角的悬浮按钮 + 点开的浮层：完全不进文档流，永远不会让页面跳动。
   位置放在站点「返回顶部」按钮上方（站点那条在 right:32 / bottom:32）。 */
.sspai-tidy-fab-wrap {
  position: fixed;
  right: 24px;
  bottom: 92px;
  z-index: 2147482000;
  display: none;
  font-size: 12px;
}
.sspai-tidy-fab-wrap.on {
  display: block;
}
.sspai-tidy-fab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  font: inherit;
  font-size: 12px;
  color: var(--B6-t, #6a6a6a);
  background: rgba(128, 128, 128, .14);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  backdrop-filter: blur(14px) saturate(1.4);
  border: 1px solid rgba(128, 128, 128, .18);
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, .12);
}
.sspai-tidy-fab:hover,
.sspai-tidy-fab[aria-expanded="true"],
.sspai-tidy-fab.has-filter {
  color: var(--B8-t, #1a1a1a);
  border-color: rgba(128, 128, 128, .4);
}
.sspai-tidy-panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  width: 280px;
  max-width: 86vw;
  padding: 10px;
  background: rgba(128, 128, 128, .16);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid rgba(128, 128, 128, .22);
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, .18);
}
.sspai-tidy-panel[hidden] {
  display: none;
}
.sspai-tidy-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(128, 128, 128, .14);
  border-radius: 8px;
}
.sspai-tidy-search-icon {
  flex: 0 0 auto;
  display: block;
  color: var(--B6-t, #6a6a6a);
}
.sspai-tidy-filter-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--B8-t, #1a1a1a);
  background: none;
  border: none;
  outline: none;
}
/* 去掉 type=search 自带的那个小叉，和圆角对不上 */
.sspai-tidy-filter-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}
.sspai-tidy-panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.sspai-tidy-filter-count {
  color: var(--B6-t, #6a6a6a);
  font-variant-numeric: tabular-nums;
}
.sspai-tidy-filter-count:empty {
  display: none;
}
.sspai-tidy-filter-btn {
  flex: 0 0 auto;
  padding: 4px 10px;
  font: inherit;
  font-size: 12px;
  color: var(--B6-t, #6a6a6a);
  background: rgba(128, 128, 128, .14);
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: color .15s, background .15s;
}
.sspai-tidy-filter-btn:hover,
.sspai-tidy-filter-btn[aria-expanded="true"] {
  color: var(--B8-t, #1a1a1a);
  background: rgba(128, 128, 128, .22);
}
/* 屏蔽名单是浮层里的第二块，跟着面板走，不再自己绝对定位 */
.sspai-tidy-blocked {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(128, 128, 128, .18);
}
.sspai-tidy-blocked[hidden] {
  display: none;
}
.sspai-tidy-blocked-row {
  display: flex;
  gap: 8px;
}
.sspai-tidy-blocked-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 5px 8px;
  font: inherit;
  font-size: 12px;
  color: var(--B8-t, #1a1a1a);
  background: rgba(128, 128, 128, .12);
  border: 1px solid rgba(128, 128, 128, .2);
  border-radius: 6px;
  outline: none;
}
.sspai-tidy-blocked-add {
  flex: 0 0 auto;
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  color: var(--B8-t, #1a1a1a);
  background: rgba(128, 128, 128, .2);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.sspai-tidy-blocked-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}
.sspai-tidy-blocked-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  color: var(--B6-t, #6a6a6a);
  font-size: 12px;
}
.sspai-tidy-blocked-list li > span {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sspai-tidy-blocked-list li > button {
  flex: 0 0 auto;
  padding: 0 4px;
  font-size: 15px;
  line-height: 1;
  color: var(--B6-t, #6a6a6a);
  background: none;
  border: none;
  cursor: pointer;
}
.sspai-tidy-blocked-empty {
  padding: 6px 0;
  color: var(--B6-t, #6a6a6a);
  font-size: 12px;
}

/* 被过滤掉的条目：用 class 而不是内联 style，方便一键撤销 */
.sspai-tidy-hidden {
  display: none !important;
}

/* ---------- 图片下载原图 ---------- */
.article__main__content figure.image {
  position: relative;
}
.sspai-tidy-dl {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  padding: 3px 9px;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  color: var(--B8-t, #1a1a1a);
  background: rgba(128, 128, 128, .2);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity .15s;
}
.article__main__content figure.image:hover .sspai-tidy-dl,
.sspai-tidy-dl:focus-visible {
  opacity: 1;
}
@media (hover: none) {
  .sspai-tidy-dl { opacity: 1; }
}

/* ---------- 站外链接标记 ---------- */
.article__main__content a.sspai-tidy-ext::after {
  content: '↗';
  margin-left: 2px;
  font-size: .85em;
  opacity: .6;
}

/* ---------- 轻提示 ---------- */
#sspai-tidy-toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  z-index: 2147483001;
  max-width: 80vw;
  padding: 8px 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--B8-t, #1a1a1a);
  background: rgba(128, 128, 128, .18);
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
  backdrop-filter: blur(16px) saturate(1.5);
  border-radius: 8px;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 8px);
  transition: opacity .2s, transform .2s;
}
#sspai-tidy-toast.show {
  opacity: 1;
  transform: translate(-50%, 0);
}
@media (prefers-reduced-motion: reduce) {
  #sspai-tidy-toast,
  .sspai-tidy-dl { transition: none; }
}
`;

  /* ================================================================
     注入
     ================================================================ */
  const STYLE_ID = 'sspai-tidy-style';

  function whenRoot(fn) {
    if (document.documentElement) {
      fn();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!document.documentElement) return;
      observer.disconnect();
      fn();
    });
    observer.observe(document, { childList: true });
  }

  function whenReady(fn) {
    if (document.readyState !== 'loading' && document.body) {
      fn();
      return;
    }
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const parent = document.head || document.documentElement;
    if (!parent) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    parent.appendChild(el);
  }

  whenRoot(() => {
    injectStyle();

    // 只观察 <html> 的直接子节点和 <head>：head 被 SPA 重建时补回样式，
    // 不再因为正文每次 DOM 变化就重复检查样式。
    let headObserver = null;
    const watchHead = () => {
      if (headObserver) headObserver.disconnect();
      if (!document.head) return;
      headObserver = new MutationObserver(injectStyle);
      headObserver.observe(document.head, { childList: true });
    };
    new MutationObserver(() => {
      injectStyle();
      watchHead();
    }).observe(document.documentElement, { childList: true });
    watchHead();
  });

  /* ================================================================
     SPA 路由与统一 DOM 通知
     —— 进度条、已读标记、代码复制和自动加载共用一套通知，
        替代原来三个各自轮询的 setInterval
     ================================================================ */
  const routeListeners = new Set();
  const domListeners = new Set();
  let lastRouteKey = '';
  let routeStarted = false;

  const runListener = (fn, arg) => {
    try { fn(arg); } catch (e) { console.debug('[sspai-tidy]', e); }
  };

  const pageKindOf = (pathname) => {
    if (/^\/post\/\d+/.test(pathname)) return 'post';
    if (pathname.startsWith('/matrix')) return 'matrix';
    if (pathname.startsWith('/search')) return 'search';
    if (pathname.startsWith('/u/')) return 'profile';
    if (pathname === '/' || pathname.startsWith('/feed')) return 'feed';
    return 'other';
  };

  function publishRoute() {
    const key = location.pathname + location.search + location.hash;
    const changed = key !== lastRouteKey;
    lastRouteKey = key;
    if (document.documentElement) {
      document.documentElement.dataset.sspaiTidyPage = pageKindOf(location.pathname);
    }
    if (!changed && routeStarted) return;
    routeStarted = true;
    for (const fn of routeListeners) runListener(fn, location);
  }

  function onRoute(fn) {
    routeListeners.add(fn);
    if (routeStarted) runListener(fn, location);
  }

  function onDomChange(fn) {
    domListeners.add(fn);
  }

  window.addEventListener('popstate', publishRoute);
  window.addEventListener('hashchange', publishRoute);
  window.addEventListener('pageshow', publishRoute);
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function () {
      const result = original.apply(this, arguments);
      queueMicrotask(publishRoute);
      return result;
    };
  }
  whenReady(() => {
    publishRoute();
    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        for (const fn of domListeners) runListener(fn);
      });
    }).observe(document.body, { childList: true, subtree: true });
  });

  /* ================================================================
     滚到底自动加载（Matrix 的「加载更多」）
     ================================================================ */
  if (CFG.autoLoad) {
    let lastClick = 0;
    let lastCount = -1;
    let bound = null;

    const itemCount = () =>
      document.querySelectorAll('.posts-list-item, .article__card').length;

    function clickMore() {
      const btn = document.querySelector('.button-show-more');
      if (!btn) return;
      // 光靠时间节流不够：站点在「加载中」常常把按钮整块重建，新节点一进视口
      // 就会触发一次 IntersectionObserver 的初始回调，慢网下会连着点两三次。
      // 用「列表条数有没有长」来判上一次请求回没回来 —— 没长说明还在加载。
      const count = itemCount();
      if (Date.now() - lastClick < 900 && count <= lastCount) return;
      lastClick = Date.now();
      lastCount = count;
      btn.click();
    }

    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) clickMore();
    }, { rootMargin: '900px 0px' });

    function bindMore() {
      const btn = document.querySelector('.button-show-more');
      if (!btn || btn === bound) return;
      if (bound) io.unobserve(bound);
      bound = btn;
      io.observe(btn);
    }

    whenReady(() => {
      // 页面结构变化和 SPA 路由切换时重新绑定；不保留常驻定时器。
      onDomChange(bindMore);
      onRoute(() => {
        if (bound) {
          io.unobserve(bound);
          bound = null;
        }
        lastCount = -1;
        bindMore();
      });
      bindMore();
    });
  }

  /* ================================================================
     作者主页：默认落到「文章」列表
     —— 站点把 /u/:id 在前端重定向到 /u/:id/updates（动态），
        而文章列表 /u/:id/posts 只是「动态」标签下拉里的一个隐藏子项，
        页面上没有任何直接入口，所以得自己把它挑出来
     ================================================================ */
  if (CFG.userDefaultPosts) {
    const RE_ROOT = /^\/u\/([^/]+)\/?$/;
    const RE_UPD  = /^\/u\/([^/]+)\/updates\/?$/;
    const RE_POST = /^\/u\/([^/]+)\/posts\/?$/;
    const seen = new Set();          // 已经默认去过文章页的作者 id

    // ① 应用启动前：裸 /u/:id 直接改成 /u/:id/posts
    //    这时前端路由还没初始化，改完它就直接按文章页渲染 —— 不闪、不多一次请求
    const boot = location.pathname.match(RE_ROOT);
    if (boot) {
      try { history.replaceState(history.state, '', '/u/' + boot[1] + '/posts' + location.search + location.hash); } catch (e) {}
    }

    // ② 点作者头像进来（SPA 软导航）时补一刀：
    //    找到「动态」下拉里那个隐藏的「文章」项点一下，让路由自己切过去。
    //    它虽然 display:none，但 click 依然会触发路由跳转。
    // 站点切到「文章」之后，触发按钮上的文案还写着「动态」（下拉里的勾已经移过去了），
    // 补一刀让标签和内容对上。要在路由渲染之后改，改早了会被重渲染盖回去
    function syncTabLabel() {
      if (!/\/posts\/?$/.test(location.pathname)) return;
      const span = document.querySelector('.custom__tabs .custom__tab__item span');
      if (span && span.textContent.trim() === '动态') span.textContent = '文章';
    }

    function clickPostsFilter() {
      const items = document.querySelectorAll('.custom__tabs .select__dropdown__item');
      for (const li of items) {
        if ((li.textContent || '').trim() === '文章') {
          li.click();
          setTimeout(syncTabLabel, 600);
          setTimeout(syncTabLabel, 1600);
          return true;
        }
      }
      return false;
    }

    /**
     * 落到作者主页时把「文章」挑出来。
     *
     * 早先是 8 次 × 400ms 的 setTimeout 轮询，只为等下拉渲染出来。页面本来就有
     * 一条「每帧合并一次」的 DOM 通知，直接用它：路由变了先试一次，之后只要 DOM
     * 有变化就再试，直到点中或用户自己点了别的标签。1.5 秒的间隔只防连点 ——
     * 下拉一旦出现，下一帧就会点上，比固定 400ms 更快也更省。
     */
    let clickedAt = 0;

    function fix() {
      const m = location.pathname.match(RE_ROOT) || location.pathname.match(RE_UPD);
      if (!m) return;
      if (seen.has(m[1])) return;                 // 用户自己点过「动态」，别抢
      if (Date.now() - clickedAt < 1500) return;
      if (clickPostsFilter()) clickedAt = Date.now();
    }

    function mark() {
      const m = location.pathname.match(RE_POST);
      if (m) seen.add(m[1]);
    }

    // 标签文案只在「路由刚变」时补一次：这条路径放在 DOM 通知里会被每帧排一个定时器
    onRoute(() => {
      if (RE_POST.test(location.pathname)) setTimeout(syncTabLabel, 600);
      fix();
      mark();
    });
    // 下拉是异步渲染的，DOM 一有变化就再试一次；fix() 自己会早退，不会空转
    onDomChange(() => { if (location.pathname.startsWith('/u/')) fix(); });
  }

  /* ================================================================
     读起来更顺手：进度条 / 代码复制 / 已读标记
     —— 站点是 SPA；这里使用路由通知和共享 DOM 通知，不保留轮询
     ================================================================ */
  const isPostPage = () => /^\/post\/\d+/.test(location.pathname);
  const postIdOf = (href) => {
    try {
      const path = new URL(String(href || ''), location.origin).pathname;
      const m = path.match(/^\/post\/(\d+)/);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  };

  /* ---------- 阅读进度条 ---------- */
  if (CFG.progressBar) {
    const bar = document.createElement('div');
    bar.id = 'sspai-tidy-progress';
    bar.setAttribute('aria-hidden', 'true');
    whenRoot(() => document.documentElement.appendChild(bar));

    let raf = 0;
    const update = () => {
      raf = 0;
      if (!isPostPage()) {
        bar.style.opacity = '0';
        bar.style.transform = 'scaleX(0)';
        return;
      }
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      bar.style.opacity = '1';
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(update); };

    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick, { passive: true });
    addEventListener('load', kick, true);
    onRoute(kick);
    whenReady(() => {
      update();
      if ('ResizeObserver' in window) {
        new ResizeObserver(kick).observe(document.body);
      }
    });
  }

  /* ---------- 图片查看 ----------
     不注册点击或键盘监听。少数派自己的 figure.image 会打开原生查看器；
     脚本只负责给 figure 加光标提示，避免抢走切换、旋转、下载和 Esc 行为。 */

  /* ---------- 已读标记 ---------- */
  const READ_KEY = 'sspai-tidy:read';

  const readSet = () => {
    try {
      const v = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
      return new Set(Array.isArray(v) ? v : []);
    } catch (e) { return new Set(); }
  };

  const rememberRead = (id) => {
    if (!id) return;
    try {
      const s = readSet();
      s.delete(id);
      s.add(id);
      localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-400)));
    } catch (e) { /* 隐私模式下 localStorage 会抛，忽略 */ }
  };

  // hideRead 靠同一套记录工作：只开 hideRead 也得继续记和画
  if (CFG.markRead || CFG.hideRead) {
    const paint = () => {
      const ids = readSet();
      if (!ids.size) return;
      for (const a of document.querySelectorAll('a[href*="/post/"]')) {
        const id = postIdOf(a.getAttribute('href'));
        if (!id || !ids.has(id)) continue;
        const card = a.closest('.article__card, .post-item, .user__update__item__wrapper');
        if (card) card.classList.add('sspai-tidy-read');
      }
    };

    let pt = 0;
    const kickPaint = () => { clearTimeout(pt); pt = setTimeout(paint, 400); };

    onRoute(() => {
      rememberRead(postIdOf(location.pathname));
      kickPaint();
    });

    whenReady(() => {
      paint();
      onDomChange(kickPaint);
    });
  }

  /* ---------- 返回列表时回到原位置 ----------
     —— 只写 sessionStorage：关掉标签页就该忘，也不该在别的标签页里串味。
        只对列表页生效（首页 / feed / Matrix / 搜索 / 作者页），文章页不记录。 */
  if (CFG.restoreScroll) {
    const SCROLL_KEY = 'sspai-tidy:scroll';
    const MAX_AGE = 10 * 60 * 1000;
    const isListPage = () => /^\/($|feed|matrix|search|u\/)/.test(location.pathname);
    const keyOf = () => location.pathname + location.search;

    const readAll = () => {
      try {
        const v = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}');
        return v && typeof v === 'object' ? v : {};
      } catch (e) { return {}; }
    };

    let saveTimer = 0;
    const save = () => {
      if (!isListPage()) return;
      try {
        const all = readAll();
        all[keyOf()] = { y: Math.round(window.scrollY), t: Date.now() };
        sessionStorage.setItem(SCROLL_KEY, JSON.stringify(all));
      } catch (e) { /* 隐私模式：记不住也不影响阅读 */ }
    };

    addEventListener('scroll', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 300);
    }, { passive: true });
    // 点链接的那一下先把位置落盘：滚动防抖还没到点就跳走的话，记下的是旧位置
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('a')) save();
    }, true);
    addEventListener('pagehide', save);

    /**
     * 列表是异步渲染的：刚进页面时高度还不够，直接 scrollTo 会被截断。
     * 每 80ms 看一眼高度够没够，够了一次性落位；最多等 2 秒。
     */
    const restore = () => {
      if (!isListPage()) return;
      const rec = readAll()[keyOf()];
      if (!rec || typeof rec.y !== 'number') return;
      // 十分钟前的旧位置就别跳了 —— 那时候你可能早就换了一篇文章在读
      if (Date.now() - (rec.t || 0) > MAX_AGE) return;
      const target = rec.y;
      if (target < 200) return;
      let tries = 0;
      const tick = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max >= target - 4 || tries++ > 25) {
          window.scrollTo(0, Math.min(target, Math.max(0, max)));
          return;
        }
        setTimeout(tick, 80);
      };
      tick();
    };

    onRoute(() => setTimeout(restore, 80));
  }

  /* ---------- 代码块复制 ---------- */
  if (CFG.codeCopy) {
    const showResult = (btn, ok) => {
      btn.textContent = ok ? '已复制' : '复制失败';
      setTimeout(() => {
        btn.textContent = '复制';
        btn.disabled = false;
      }, 1400);
    };

    /**
     * 复制一段文本。
     *
     * 先走同步通道：execCommand 在点击手势里一次就落地，不受焦点和权限影响。
     * 只有它不可用才退到异步 clipboard —— 反过来写（先 await clipboard、失败再回退）
     * 的话，await 之后已经不在用户手势里了，Safari 会直接拒绝 execCommand，
     * 用户看到「复制失败」，而剪贴板里留的还是上一次的内容。
     */
    const copyText = (text, btn) => {
      if (fallbackCopy(text)) {
        showResult(btn, true);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => showResult(btn, true),
          () => showResult(btn, false),
        );
        return;
      }
      showResult(btn, false);
    };

    const attachCopy = () => {
      for (const pre of document.querySelectorAll('.article__main__content pre')) {
        if (pre.querySelector('.sspai-tidy-copy')) continue;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sspai-tidy-copy';
        btn.textContent = '复制';
        btn.title = '复制代码';
        btn.setAttribute('aria-label', '复制代码');
        btn.addEventListener('click', () => {
          // 复制前先把按钮自己摘掉，否则会把「复制」两个字一起复制进去
          const clone = pre.cloneNode(true);
          const self = clone.querySelector('.sspai-tidy-copy');
          if (self) self.remove();
          const code = clone.querySelector('code') || clone;
          btn.disabled = true;
          copyText((code.textContent || '').replace(/\s+$/, ''), btn);
        });

        pre.appendChild(btn);

        // 代码块自己横向滚动时（长行很常见），绝对定位的按钮会跟着内容一起滚走。
        // 反向补一个 translateX 把它钉在右上角；不滚动时 scrollLeft 恒为 0，没有副作用。
        const sync = () => { btn.style.transform = 'translateX(' + pre.scrollLeft + 'px)'; };
        pre.addEventListener('scroll', sync, { passive: true });
        sync();
      }
    };

    whenReady(() => {
      attachCopy();
      onDomChange(attachCopy);
      onRoute(attachCopy);
    });
  }

  /* ================================================================
     列表过滤：右下角悬浮面板
     —— 名单里每一条就是一段普通子串，同时比对标题、作者和摘要。
        作者名本来就出现在卡片文字里，所以「屏蔽某个作者」和「屏蔽某个关键词」
        是同一套机制，不用为作者单独开数据结构。
        名单存在 GM 存储里（没有 GM 就退回 localStorage），下次打开还在。
     —— 界面不进列表流：做成 fixed 定位的悬浮按钮 + 浮层，文档流里一行都不占。
        之前那版插在列表顶部的横条要等列表渲染完才出现，会把整列往下推一截，
        页面看起来就是「加载时跳了一下」。
     ================================================================ */
  if (CFG.filterBar) {
    const BLOCK_KEY = 'sspai-tidy:blocked';
    const CARD_SEL = '.article__card, .posts-list-item, .user__update__item__wrapper';

    let blocked = storeGet(BLOCK_KEY, []);
    if (!Array.isArray(blocked)) blocked = [];
    let query = '';
    let ui = null;

    const allCards = () => [...document.querySelectorAll(CARD_SEL)];

    const apply = () => {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const banned = blocked.map((t) => String(t).toLowerCase()).filter(Boolean);
      const cards = allCards();
      let shown = 0;
      for (const card of cards) {
        const text = (card.textContent || '').toLowerCase();
        // 多个词是「与」关系：都命中才留下
        const missQuery = terms.length > 0 && !terms.every((t) => text.includes(t));
        const hitBlocked = banned.some((t) => text.includes(t));
        const hide = missQuery || hitBlocked;
        card.classList.toggle('sspai-tidy-hidden', hide);
        if (!hide) shown++;
      }
      if (!ui) return;
      // 没有过滤条件时不显示「40 / 40」这种废话
      ui.count.textContent = shown === cards.length ? '' : shown + ' / ' + cards.length;
    };

    const refreshLabel = () => {
      if (!ui) return;
      const active = !!query || blocked.length > 0;
      ui.toggle.textContent = blocked.length ? '屏蔽 ' + blocked.length : '屏蔽';
      ui.fab.textContent = active ? '过滤中' : '过滤';
      ui.fab.classList.toggle('has-filter', active);
    };

    const renderBlocked = () => {
      if (!ui) return;
      refreshLabel();
      ui.list.textContent = '';
      if (!blocked.length) {
        const li = document.createElement('li');
        li.className = 'sspai-tidy-blocked-empty';
        li.textContent = '还没有屏蔽任何词';
        ui.list.appendChild(li);
        return;
      }
      for (const term of blocked) {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = term;
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '×';
        del.setAttribute('aria-label', '移除屏蔽词 ' + term);
        del.addEventListener('click', () => {
          blocked = blocked.filter((t) => t !== term);
          storeSet(BLOCK_KEY, blocked);
          renderBlocked();
          apply();
        });
        li.append(span, del);
        ui.list.appendChild(li);
      }
    };

    const addBlocked = (value) => {
      const term = String(value || '').trim();
      if (!term) return;
      if (!blocked.some((t) => t.toLowerCase() === term.toLowerCase())) {
        blocked = blocked.concat(term);
        storeSet(BLOCK_KEY, blocked);
        renderBlocked();
        apply();
      }
      ui.bInput.value = '';
      ui.bInput.focus();
    };

    const closePanel = () => {
      if (!ui) return;
      ui.panel.hidden = true;
      ui.fab.setAttribute('aria-expanded', 'false');
    };

    const build = () => {
      if (ui) return ui;
      const wrap = document.createElement('div');
      wrap.className = 'sspai-tidy-fab-wrap';
      wrap.innerHTML =
        '<button class="sspai-tidy-fab" type="button" aria-expanded="false" aria-label="过滤文章列表">过滤</button>' +
        '<div class="sspai-tidy-panel" hidden aria-label="过滤与屏蔽">' +
        '<label class="sspai-tidy-search">' +
        '<svg class="sspai-tidy-search-icon" width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">' +
        '<circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" stroke-width="1.5"></circle>' +
        '<path d="M10.4 10.4 L14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
        '</svg>' +
        '<input class="sspai-tidy-filter-input" type="search" placeholder="标题 / 作者 / 关键词" aria-label="过滤文章列表">' +
        '</label>' +
        '<div class="sspai-tidy-panel-foot">' +
        '<span class="sspai-tidy-filter-count"></span>' +
        '<button class="sspai-tidy-filter-btn" type="button" aria-expanded="false">屏蔽</button>' +
        '</div>' +
        '<div class="sspai-tidy-blocked" hidden>' +
        '<div class="sspai-tidy-blocked-row">' +
        '<input class="sspai-tidy-blocked-input" type="text" placeholder="作者名或关键词" aria-label="要屏蔽的词">' +
        '<button class="sspai-tidy-blocked-add" type="button">添加</button>' +
        '</div><ul class="sspai-tidy-blocked-list"></ul></div>' +
        '</div>';
      (document.body || document.documentElement).appendChild(wrap);

      const q = (sel) => wrap.querySelector(sel);
      ui = {
        wrap,
        fab: q('.sspai-tidy-fab'),
        panel: q('.sspai-tidy-panel'),
        input: q('.sspai-tidy-filter-input'),
        count: q('.sspai-tidy-filter-count'),
        toggle: q('.sspai-tidy-filter-btn'),
        list: q('.sspai-tidy-blocked-list'),
        blockedBox: q('.sspai-tidy-blocked'),
        bInput: q('.sspai-tidy-blocked-input'),
        bAdd: q('.sspai-tidy-blocked-add'),
      };

      ui.fab.addEventListener('click', () => {
        const open = ui.panel.hidden;
        ui.panel.hidden = !open;
        ui.fab.setAttribute('aria-expanded', String(open));
        if (open) ui.input.focus();
      });

      // 站点有自己的键盘快捷键，输入框里敲字不该触发它们
      for (const el of [ui.input, ui.bInput]) {
        el.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && el === ui.bInput) addBlocked(ui.bInput.value);
          if (e.key === 'Escape') { el.blur(); closePanel(); }
        });
      }

      ui.input.addEventListener('input', () => {
        query = ui.input.value;
        apply();
        refreshLabel();
      });

      ui.toggle.addEventListener('click', () => {
        ui.blockedBox.hidden = !ui.blockedBox.hidden;
        ui.toggle.setAttribute('aria-expanded', String(!ui.blockedBox.hidden));
        if (!ui.blockedBox.hidden) ui.bInput.focus();
      });

      ui.bAdd.addEventListener('click', () => addBlocked(ui.bInput.value));

      renderBlocked();
      refreshLabel();
      return ui;
    };

    // 点浮层和按钮以外的地方收起（capture 阶段，先于站点自己的点击处理）
    document.addEventListener('click', (e) => {
      if (!ui || ui.panel.hidden) return;
      if (ui.wrap.contains(e.target)) return;
      closePanel();
    }, true);

    const sync = () => {
      const bar = build();
      const hasCards = allCards().length > 0;
      bar.wrap.classList.toggle('on', hasCards);
      if (!hasCards) closePanel();
      apply();
    };

    let filterTimer = 0;
    const kick = () => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(sync, 150);
    };

    whenReady(() => {
      sync();
      onDomChange(kick);
      onRoute(sync);
    });
  }

  /* ---------- 导出当前列表 ----------
     —— 只导出「当前可见」的条目：过滤和屏蔽之后剩什么就导什么。
        复制到剪贴板（GM_setClipboard，退到 execCommand），失败再下载文件。 */
  if (CFG.exportList && typeof GM_registerMenuCommand === 'function') {
    const stamp = () => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    };

    GM_registerMenuCommand('导出当前列表为 Markdown', () => {
      const cards = [...document.querySelectorAll('.article__card, .posts-list-item, .user__update__item__wrapper')]
        .filter((c) => !c.classList.contains('sspai-tidy-hidden'));
      if (!cards.length) {
        toast('当前列表里没有可导出的条目');
        return;
      }
      const lines = cards.map((card) => {
        const a = card.querySelector('a[href*="/post/"]');
        let url = '';
        try { url = a ? new URL(a.getAttribute('href'), location.origin).href : ''; } catch (e) {}
        const titleEl = card.querySelector('.article__card__title, .post-title, .user__content__card__title');
        const title = ((titleEl ? titleEl.textContent : (a ? a.textContent : '')) || '').replace(/\s+/g, ' ').trim();
        const metaEl = card.querySelector('.article__card__meta, .post-item-bottom, .user__update__item__type');
        const meta = ((metaEl ? metaEl.textContent : '') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        return '- [' + (title || url) + '](' + url + ')' + (meta ? ' — ' + meta : '');
      });
      const text = '# 少数派列表导出 · ' + stamp() + '\n\n' + lines.join('\n') + '\n';
      if (copyOut(text)) {
        toast('已复制 ' + lines.length + ' 条到剪贴板');
        return;
      }
      downloadText('sspai-list-' + stamp().replace(/[: ]/g, '-') + '.md', text);
      toast('复制失败，已改为下载文件');
    });
  }

  /* ---------- 图片：下载原图 ----------
     —— 原图往往在另一个域上，直接 <a download> 会被跨域限制拦住；
        GM_download 不受这个限制，所以优先用它，没有 GM 才退回打开新标签。 */
  if (CFG.imageDownload) {
    const downloadImage = (url, name) => {
      if (typeof GM_download === 'function') {
        try {
          GM_download({ url, name, saveAs: false });
          toast('已开始下载');
          return;
        } catch (e) { /* 老版本 GM_download 走下面的两参数形式 */ }
        try {
          GM_download(url, name);
          toast('已开始下载');
          return;
        } catch (e) { /* 都失败就打开新标签 */ }
      }
      window.open(url, '_blank', 'noopener');
    };

    const attachDownloads = () => {
      for (const fig of document.querySelectorAll('.article__main__content figure.image')) {
        if (fig.querySelector('.sspai-tidy-dl')) continue;
        const img = fig.querySelector('img');
        if (!img) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sspai-tidy-dl';
        btn.textContent = '下载原图';
        btn.setAttribute('aria-label', '下载原图');
        btn.addEventListener('click', (e) => {
          // 不能让点击冒泡到 figure：那会顺带打开站点的图片查看器
          e.preventDefault();
          e.stopPropagation();
          const url = img.currentSrc || img.src;
          if (!url) return;
          downloadImage(url, fileNameOf(url));
        });
        fig.appendChild(btn);
      }
    };

    whenReady(() => {
      attachDownloads();
      onDomChange(attachDownloads);
      onRoute(attachDownloads);
    });
  }

  /* ---------- 站外链接标记 ----------
     —— 站点本来就新标签打开，这里只补两件它没做的事：
        给外链加 ≫ 标记（一眼看出会离开少数派），以及补 rel=noopener 防反向控制。 */
  if (CFG.externalMark) {
    const markExternal = () => {
      for (const a of document.querySelectorAll('.article__main__content a[href]')) {
        if (a.dataset.sspaiTidyExt) continue;
        let host = '';
        try { host = new URL(a.href, location.href).hostname; } catch (e) { continue; }
        if (!host || host === location.hostname || host === 'sspai.com' || host.endsWith('.sspai.com')) continue;
        a.dataset.sspaiTidyExt = '1';
        a.classList.add('sspai-tidy-ext');
        if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    };

    whenReady(() => {
      markExternal();
      onDomChange(markExternal);
      onRoute(markExternal);
    });
  }
})();
