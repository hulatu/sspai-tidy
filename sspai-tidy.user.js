// ==UserScript==
// @name         少数派 · 阅读增强
// @namespace    local.sspai.tidy
// @version      1.3.0
// @description  首页与 Matrix 去广告位/推广卡/侧栏，列表拉宽压紧；滚到底自动加载；作者主页默认文章列表并按首页样式重排；文章页读完就结束（清掉充电卡、广告、评论、关联阅读与正文互动条），另加阅读进度条、点图放大、代码块复制与「已读」标记
// @author       hulatu
// @homepageURL  https://github.com/hulatu/sspai-tidy
// @supportURL   https://github.com/hulatu/sspai-tidy/issues
// @updateURL    https://raw.githubusercontent.com/hulatu/sspai-tidy/main/sspai-tidy.user.js
// @downloadURL  https://raw.githubusercontent.com/hulatu/sspai-tidy/main/sspai-tidy.user.js
// @match        https://sspai.com/*
// @icon         https://sspai.com/favicon.ico
// @license      MIT
// @run-at       document-start
// @grant        none
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

    // ---- 新增：读起来更顺手 ----
    progressBar:   true,   // 文章页顶部 2px 阅读进度条
    imageViewer:   true,   // 点正文图片放大，用的是 data-original 里的原图
    codeCopy:      true,   // 代码块右上角「复制」
    markRead:      true    // 列表里把读过的文章压暗（记在 localStorage，只存最近 400 篇）
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
      不能连 wrapper 一起 display:none —— 底部那条「说点什么…」固定栏的
      占位元素就挂在里面，整个藏掉会让那条栏塌成 0×0（实测过）。
      所以只藏里面的内容块，再把 wrapper 自带的内边距清掉。
   ================================================================ */
${CFG.hideArticleCharge ? '.article__charge__card { display: none !important; }' : ''}
${CFG.hideArticleAd ? '.advertisement__box { display: none !important; }' : ''}
${CFG.hideArticleComments ? '.post__comments { display: none !important; }' : ''}
${CFG.hideArticleRelated ? '.related__read__wrapper { display: none !important; }' : ''}
${(CFG.hideArticleComments || CFG.hideArticleRelated) ? `.article__subsection__wrapper {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  min-height: 0 !important;
}` : ''}
${CFG.hideInlineComment ? `/* 正文每个章节末尾都插了一条「发表首评 + 表情 + 评论」互动条，
   7 处、每处 24px 高 + 32px 上边距，夹在正文里打断阅读节奏 */
.comment__footer__wrapper { display: none !important; }` : ''}

@media (min-width: 1000px) {
/* ---------- 首页：列表占满宽度 ---------- */
/* 整列外面还套了一层 .feed__wrapper，站点给它写了 max-width: 960px。
   只改 .feed 的话会被这层卡住（实测 960 / 卡片 904），必须一起放开 */
.feed__wrapper {
  max-width: 1120px !important;
}
.feed {
  width: 100% !important;
  max-width: 1120px !important;
  margin: 0 auto !important;
  padding: 0 28px !important;
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
  color: var(--B8-t) !important;
}
.article__card--important .article__card__meta,
.article__card--important .article__card__author,
.article__card--important .article__card__author__name,
.article__card--important .article__card__publish,
.article__card--important .article__card__summary {
  color: var(--B6-t) !important;
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
  width: ${CFG.thumb}px !important;
  height: ${Math.round(CFG.thumb * 0.56)}px !important;
  border-radius: 4px !important;
  overflow: hidden !important;
}
${CFG.thumb > 0 ? `
.article__card__cover {
  flex: 0 0 auto !important;
  width: ${CFG.thumb}px !important;
  height: ${Math.round(CFG.thumb * 0.56)}px !important;
  ${CFG.thumbSide === 'left' ? 'order: -1 !important; margin: 0 !important;' : 'margin-left: 20px !important;'}
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

/* ---------- Matrix ---------- */
.container {
  width: 100% !important;
  max-width: 1120px !important;
  padding: 0 28px !important;
  box-sizing: border-box !important;
}
main.main-container {
  flex: 1 1 auto !important;
  width: auto !important;
  max-width: none !important;
  padding: 0 !important;
}
.posts-list,
.posts-list-item {
  width: 100% !important;
}
.post-item.defalut {
  padding: ${CFG.compact ? '12px 16px' : '18px 18px 18px 20px'} !important;
  margin: 0 !important;
}
.posts-list-item {
  margin: 0 !important;
}
.post-title {
  font-size: ${CFG.compact ? '16px' : '18px'} !important;
  line-height: ${CFG.compact ? '1.5' : '1.6'} !important;
}
.post-cover {
  flex: 0 0 auto !important;
  width: ${Math.round(CFG.thumb * 0.94)}px !important;
  height: ${Math.round(CFG.thumb * 0.53)}px !important;
  object-fit: cover !important;
  border-radius: 4px !important;
  ${CFG.thumbSide === 'left' ? 'order: -1 !important; margin: 0 20px 0 0 !important;' : ''}
}
.post-item-bottom {
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
  max-width: 1120px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  padding-left: 28px !important;
  padding-right: 28px !important;
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
  color: var(--B8-t) !important;
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
  width: ${CFG.thumb}px !important;
  height: ${Math.round(CFG.thumb * 0.56)}px !important;
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
  color: var(--B6-t) !important;
  justify-content: flex-start !important;
}
.page__profile .user__update__item__type > span:not(.user__update__item__date) {
  display: none !important;
}
.page__profile .user__update__item__date {
  font-size: 13px !important;
  color: var(--B6-t) !important;
}
/* 日期行缩进到标题正下方，不要贴在缩略图底下 */
.page__profile .user__update__item__type:has(~ .user__update__item__card .user__content__card__image) {
  margin-left: ${CFG.thumb + 20}px !important;
}
` : ''}
}

/* ================================================================
   新增：进度条 / 图片放大 / 代码复制 / 已读标记
   —— 这几块和宽度无关，窄窗口下同样生效
   ================================================================ */

/* ---------- 阅读进度条 ---------- */
#sspai-tidy-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  width: 0;
  background: #e0342b;
  opacity: 0;
  z-index: 2147483000;
  pointer-events: none;
  transition: width .1s linear, opacity .2s;
}

/* ---------- 图片放大 ---------- */
.article__main__content figure.image img {
  cursor: zoom-in;
}
#sspai-tidy-viewer {
  position: fixed;
  inset: 0;
  z-index: 2147483001;
  background: rgba(0, 0, 0, .9);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  box-sizing: border-box;
}
#sspai-tidy-viewer img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 3px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, .55);
  cursor: zoom-in;
}
#sspai-tidy-viewer.is-zoomed {
  display: block;
  overflow: auto;
}
#sspai-tidy-viewer.is-zoomed img {
  max-width: none;
  max-height: none;
  margin: 28px auto;
  cursor: zoom-out;
}
#sspai-tidy-viewer .sspai-tidy-viewer__hint {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  color: #fff;
  opacity: .62;
  font-size: 12px;
  letter-spacing: .02em;
  pointer-events: none;
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
  color: var(--B8-t);
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

/* ---------- 已读标记 ---------- */
.sspai-tidy-read {
  opacity: .48;
  transition: opacity .15s;
}
.sspai-tidy-read:hover {
  opacity: 1;
}
`;

  /* ================================================================
     注入
     ================================================================ */
  const STYLE_ID = 'sspai-tidy-style';

  // @run-at document-start 触发时 <html> 可能还没被解析出来，
  // 这时 document.documentElement / head 都是 null，直接 appendChild 会抛错
  function whenDom(fn) {
    if (document.documentElement) { fn(); return; }
    const t = setInterval(() => {
      if (!document.documentElement) return;
      clearInterval(t);
      fn();
    }, 20);
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

  injectStyle();
  // 站点是 SPA，head 偶尔会被重建，兜一层
  setInterval(injectStyle, 2000);

  /* ================================================================
     滚到底自动加载（Matrix 的「加载更多」）
     ================================================================ */
  if (CFG.autoLoad) {
    let lastClick = 0;
    let bound = null;

    function clickMore() {
      // 只防「连点」，不拿数量做门槛：数量在按钮点下去之前是不会变的
      if (Date.now() - lastClick < 900) return;
      const btn = document.querySelector('.button-show-more');
      if (!btn) return;
      lastClick = Date.now();
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

    // 观察目标得等 <html> 建好
    whenDom(() => {
      // 新节点出现就重新绑定（切 tab、加载完一批都会换掉按钮）
      const mo = new MutationObserver(() => bindMore());
      mo.observe(document.documentElement, { childList: true, subtree: true });
      bindMore();
      setInterval(bindMore, 1500);   // MutationObserver 漏掉时的兜底
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
      try { history.replaceState(history.state, '', '/u/' + boot[1] + '/posts' + location.search); } catch (e) {}
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

    function fix(tries) {
      tries = tries || 0;
      // 直接落在 /u/:id/posts（比如刷新页面）时，标签文案也补一下
      if (RE_POST.test(location.pathname)) {
        setTimeout(syncTabLabel, 600);
        return;
      }
      const m = location.pathname.match(RE_ROOT) || location.pathname.match(RE_UPD);
      if (!m) return;
      if (seen.has(m[1])) return;                 // 用户自己点过「动态」，别抢
      if (clickPostsFilter()) return;
      if (tries < 8) setTimeout(() => fix(tries + 1), 400);   // 下拉还没渲染出来
    }

    function mark() {
      const m = location.pathname.match(RE_POST);
      if (m) seen.add(m[1]);
    }

    let timer = null;
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => { fix(); mark(); }, 500);
    }

    window.addEventListener('popstate', schedule);
    for (const k of ['pushState', 'replaceState']) {
      const orig = history[k];
      history[k] = function () {
        const r = orig.apply(this, arguments);
        schedule();
        return r;
      };
    }
    schedule();
  }

  /* ================================================================
     读起来更顺手：进度条 / 图片放大 / 代码复制 / 已读标记
     —— 站点是 SPA，这几块都用事件委托或「补挂」的方式，
        软导航之后不需要重新初始化
     ================================================================ */
  const isPostPage = () => /^\/post\/\d+/.test(location.pathname);
  const postIdOf = (href) => {
    const m = String(href || '').match(/^\/post\/(\d+)/);
    return m ? m[1] : null;
  };

  /* ---------- 阅读进度条 ---------- */
  if (CFG.progressBar) {
    const bar = document.createElement('div');
    bar.id = 'sspai-tidy-progress';
    whenDom(() => document.documentElement.appendChild(bar));

    let raf = 0;
    const update = () => {
      raf = 0;
      if (!isPostPage()) {
        bar.style.opacity = '0';
        bar.style.width = '0';
        return;
      }
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
      bar.style.width = (p * 100).toFixed(2) + '%';
      bar.style.opacity = '1';
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(update); };

    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick, { passive: true });
    // 图片陆续加载完时页面高度会变，隔一会儿重算一次
    whenDom(() => { update(); setInterval(update, 2000); });
  }

  /* ---------- 点图放大 ---------- */
  if (CFG.imageViewer) {
    const VIEWER_ID = 'sspai-tidy-viewer';
    let viewer = null;

    const closeViewer = () => {
      if (!viewer) return;
      viewer.remove();
      viewer = null;
      document.documentElement.style.overflow = '';
    };

    const openViewer = (img) => {
      // 站点把原图地址放在 data-original 里，正文那张是 1120px 的压缩版
      const src = img.getAttribute('data-original') || img.currentSrc || img.src;
      if (!src) return;
      closeViewer();

      viewer = document.createElement('div');
      viewer.id = VIEWER_ID;

      const big = document.createElement('img');
      big.src = src;
      big.alt = img.alt || '';

      const hint = document.createElement('div');
      hint.className = 'sspai-tidy-viewer__hint';
      hint.textContent = '点击图片切换原始大小 · Esc 或点空白关闭';

      viewer.append(big, hint);
      viewer.addEventListener('click', (e) => {
        if (e.target === big) viewer.classList.toggle('is-zoomed');
        else closeViewer();
      });

      document.documentElement.appendChild(viewer);
      document.documentElement.style.overflow = 'hidden';
    };

    // 用捕获阶段，免得站点自己的点击处理先跑
    document.addEventListener('click', (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (!img.closest('.article__main__content')) return;
      if (img.closest('a')) return;          // 图包在链接里时让链接自己走
      e.preventDefault();
      openViewer(img);
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeViewer();
    });
  }

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
      if (s.has(id)) return;
      s.add(id);
      localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-400)));
    } catch (e) { /* 隐私模式下 localStorage 会抛，忽略 */ }
  };

  if (CFG.markRead) {
    rememberRead(postIdOf(location.pathname));

    const paint = () => {
      const ids = readSet();
      if (!ids.size) return;
      for (const a of document.querySelectorAll('a[href^="/post/"]')) {
        const id = postIdOf(a.getAttribute('href'));
        if (!id || !ids.has(id)) continue;
        const card = a.closest('.article__card, .post-item, .user__update__item__wrapper');
        if (card) card.classList.add('sspai-tidy-read');
      }
    };

    let pt = 0;
    const kickPaint = () => { clearTimeout(pt); pt = setTimeout(paint, 400); };

    whenDom(() => {
      paint();
      new MutationObserver(kickPaint).observe(document.body, { childList: true, subtree: true });
    });

    // 软导航到文章页时也记一笔（列表是异步渲染的，靠 MutationObserver 补画）
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname === lastPath) return;
      lastPath = location.pathname;
      rememberRead(postIdOf(lastPath));
    }, 800);
  }

  /* ---------- 代码块复制 ---------- */
  if (CFG.codeCopy) {
    const copyText = (text, btn) => {
      const done = () => {
        btn.textContent = '已复制';
        setTimeout(() => { btn.textContent = '复制'; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
      done();
    };

    const attachCopy = () => {
      for (const pre of document.querySelectorAll('.article__main__content pre')) {
        if (pre.querySelector('.sspai-tidy-copy')) continue;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sspai-tidy-copy';
        btn.textContent = '复制';
        btn.addEventListener('click', () => {
          // 复制前先把按钮自己摘掉，否则会把「复制」两个字一起复制进去
          const clone = pre.cloneNode(true);
          const self = clone.querySelector('.sspai-tidy-copy');
          if (self) self.remove();
          copyText(clone.textContent.replace(/\s+$/, ''), btn);
        });

        pre.appendChild(btn);
      }
    };

    let ct = 0;
    const kickCopy = () => { clearTimeout(ct); ct = setTimeout(attachCopy, 300); };

    whenDom(() => {
      attachCopy();
      new MutationObserver(kickCopy).observe(document.body, { childList: true, subtree: true });
    });
  }
})();
