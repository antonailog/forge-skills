# forge-doc-policy

文档放哪、怎么标生命周期

## 要解决的问题

AI 新建文档常放错位置：有的 forge Skill 约束了路径，项目 CLAUDE.md 的路径表不全，直接对话时完全没有约束。文档一多就散，找不到最新信息，也分不清哪份还在用、哪份已经过时。规则只写在某个项目的 CLAUDE.md 里，换个项目就得重抄一份。

## 运行方式

![forge-doc-policy 结构图](../../docs/diagrams/forge-doc-policy.jpg)

AI 每次建 .md 或新目录前，先对照 `doc-paths.md` 白名单：在白名单内就带上 frontmatter 直接写，不打断用户；不在、有歧义或要开新分类，就停下给用户 2—3 个候选路径。写错位置算 bug，用户指出后立即移走并记一条 feedback。规则通过项目 CLAUDE.md 里的引用段生效，新项目可以先跑 `init-project.sh` 建好骨架。

## 关键设计

- **不用 PreToolUse hook，靠 AI 自查、违规才问**：hook 误伤会频繁打断，用户被打断三次就会把它关掉，规则反而失效
- **规则只放一处**：项目 CLAUDE.md 只放 3 行引用段和本项目特有的规则，共享规则不复制；14 个 forge Skill 顶部统一引用 `doc-paths.md`，所有项目读同一份源头
- **文档死活看 frontmatter 的 status**：live / draft / archive 三档，读的人看这个字段，不靠最后修改日期去猜；同一模块有多份，顺着 `replaces` 找最新一份
- **当前事实和历史材料分开放**：根级 PRD、DESIGN 等只写当前事实，AI 讨论原文、调研过程、已结案的 bug 报告进 `docs/archive/raw/`，默认不读
- **没实现的脚本不写进文件清单**：规划中的审计、索引、回填脚本只列在 CHANGELOG 的 Roadmap 里，免得 AI 照着清单去跑不存在的脚本

## 其他

- 不处理：本身不产出代码或文档，它是供其他 Skill 和 AI 自查用的规范
- 注意：项目里有 `docs/modules/doc-system.md` 时，以项目自己的文档系统为准
- 注意：`init-project.sh` 幂等，只补缺的目录和文件，不覆盖已有内容，老项目也能跑
- 注意：项目引用时锁版本号；规则改动先在独立 worktree 改，到关联项目核对影响后再合并

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
