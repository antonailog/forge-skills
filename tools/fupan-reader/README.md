# fupan-reader

forge-fupan 的复盘阅读页源码：React 19 + Vite + Tailwind 4 + shadcn/ui（radix-ui），代码高亮用 Shiki，流程图用 Mermaid，md 用 react-markdown；知识页的 3D 关键词地图用 three + react-force-graph-3d（位置按同心球事先算好、不跑力导布局，three-spritetext 画文字）；动效用 motion，背景点阵和进场淡入取自 Magic UI。构建成一个单文件 html，拷进 `skills/forge-fupan/assets/reader.html`；复盘时 `build.py` 再把它拷成 `记录/复盘/index.html`。

一份页面管整个 `记录/复盘/`，复盘汇总、经验、知识三页顶上有一排切换（`src/shell/TopBar.tsx`，单篇和旧复盘页不放）。地址里 `#r=<项目>/<模块>/<日期-标题>` 是单篇（读那个文件夹的 `data.js`），`#o=` 是旧复盘，`#sop`、`#d=领域`、`#s=编号` 是经验（`src/sops/`，读 `经验.data.js`），`#kb`、`#k=编号` 是知识（`src/kb/`，读 `知识.data.js`），其余是复盘汇总（读 `index.data.js`）。经验、知识两份数据由 `skills/forge-fupan/scripts/workbench.py` 从经验库、知识库生成。数据文件是 `window.__FUPAN__ = {...}` 的脚本，因为 file:// 下 fetch 读不了本地文件。

## 改页面

```bash
npm install
npm run dev        # http://127.0.0.1:4371 ；先把一份 data.js、index.data.js、经验.data.js、知识.data.js 拷进 public/ 才有数据（public/ 不进 git）
npm run typecheck
npm run release    # 构建 + 拷进 skill 的 assets/（reader.html、icons.json）
```

- 关键术语能用的品牌图标在 `scripts/gen-brands.mjs` 的 WANT 里加，再跑 `npm run brands`
- 数据结构：复盘在 `src/types.ts`，改了字段同步改 `skills/forge-fupan/references/schema.md` 和 `scripts/build.py` 的校验；经验在 `src/sops/types.ts`、知识在 `src/kb/types.ts`，改了同步改 `scripts/workbench.py`
- 字号阶梯在 `src/typo.ts`，共用的方框和按钮在 `src/components/kit.tsx`，状态图标在 `src/components/StatusIcon.tsx`
