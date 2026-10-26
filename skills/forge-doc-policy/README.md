# forge-doc-policy

规定文档放哪、什么时候归档

## 要解决的问题

AI 新建文档常放错位置：有的 forge Skill 约束了路径，项目 CLAUDE.md 的路径表不全，直接对话时完全没有约束。文档一多就散，找不到最新信息，也分不清哪份还在用、哪份已经过时。规则只写在某个项目的 CLAUDE.md 里，换个项目就得重抄一份。

## 运行方式

![forge-doc-policy 结构图](../../docs/diagrams/forge-doc-policy.jpg)

AI 每次建 .md 或新目录前，先对照 `doc-paths.md` 白名单：在白名单内就带上 frontmatter 直接写，不打断用户；不在、有歧义或要开新分类，就停下给用户 2—3 个候选路径。写错位置算 bug，用户指出后立即移走并记一条 feedback。规则通过项目 CLAUDE.md 里的引用段生效，新项目可以先跑 `init-project.sh` 建好骨架。

## 关键设计

文档规范要同时做到两件事：所有项目、所有 forge Skill 读同一套规则，AI 照规则写文档时少打断用户。forge-doc-policy 把规则写成三份规范：路径白名单、frontmatter 字段表、CLAUDE.md 引用段，项目和其他 Skill 只引用、不另抄，新项目再用一个脚本建好目录骨架。

- **规则只放一处，其他地方只引用**：共享规则只写在本 Skill 的几份规范里；项目 CLAUDE.md 照 `claude-md-snippet.md` 贴一段引用，下面只补本项目特有的规则，各 forge Skill 顶部用一行引用 `doc-paths.md`。
- **AI 写前自查，违规才打断用户**：自查的四条规则写在 `SKILL.md`，经引用段进入每个项目的 CLAUDE.md，AI 建文档前自己对照白名单。合规的写入不打断用户；打断少，这套检查才会一直开着。
- **按用途分层决定文档落点**：`doc-paths.md` 把路径分成当前事实、模块附录与运行文档、进行中的工作区、历史与原始材料四层，配一张快速决策树；根级 PRD、DESIGN 只写当前事实，AI 讨论原文和调研过程进原始材料层，默认不读。新项目跑 `init-project.sh`，一次建出这套目录和文档入口。
- **文档死活由 status 字段标明**：`frontmatter-schema.md` 规定 frontmatter 的四个必填字段和两个选填字段；status 分 live、draft、archive 三档，读的人看它判断文档还用不用，同一模块有多份时顺着 replaces 找最新一份。type 是封闭的取值表，要加新值先改定义。
- **文件清单只列已经能用的文件**：`SKILL.md` 的文件清单只写实现了的文件，规划中的审计、索引、回填脚本记在 `CHANGELOG.md` 的规划表里，AI 照清单执行时找到的都是真实存在的脚本。

```text
forge-doc-policy/
├── SKILL.md                自查规则、装载方式、触发场景
├── doc-paths.md            路径白名单、读取顺序、决策树
├── frontmatter-schema.md   新文档必填字段和取值
├── claude-md-snippet.md    贴进 CLAUDE.md 的引用段
├── CHANGELOG.md            版本记录和规划中的脚本
└── scripts/
    └── init-project.sh     新项目一键建文档骨架
```

## 其他

- 不处理：不主动产出代码或文档，它是供其他 Skill 和 AI 自查用的规范
- 注意：项目里有 `docs/modules/doc-system.md` 时，以项目自己的文档系统为准
- 注意：`init-project.sh` 幂等，只补缺的目录和文件，不覆盖已有内容，老项目也能跑
- 注意：项目引用时锁版本号；规则改动先在独立 worktree 改，到关联项目核对影响后再合并

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
