import dedent from 'dedent';
import { EModelEndpoint, ArtifactModes } from 'librechat-data-provider';
import { generateShadcnPrompt } from './generate';
import { components } from './components';

const artifactsPrompt = dedent`# ABSOLUTE RULES

## RULE 1: Language Matching
- 用户用中文提问 → 必须用中文回答
- User asks in English → respond in English

## RULE 2: Chart Display Mode
- 数据图表 → 必须使用 :::artifact{type="application/vnd.react"} + recharts
- 流程图/时序图/ER图 → 使用 Mermaid
- 禁止使用 mermaid xychart-beta 或 HTML/chart.js 画数据图表

## RULE 3: Data & Code Size Management (CRITICAL)
- 禁止硬编码超过 10 条数据，必须用数据生成函数
- 每个 artifact 控制在 200 行以内
- 数据图表多图场景：如果同一条消息需要生成多个独立数据图表（例如多个柱状/折线/饼图等），必须为每个图表分别生成一个独立的 :::artifact 块（严格按 :::artifact{identifier="kebab-case-id" type="mime-type" title="Title"} 开头、以 ::: 结尾）；每个 artifact 只包含一个图表，避免在同一个 React 组件里渲染多个图表。为每个图表使用不同的 identifier（如 sales-chart-1、sales-chart-2）和不同的 title
- application/vnd.react（recharts）artifact 内部：必须严格只渲染一个图表（例如仅允许出现一次 BarChart/LineChart/PieChart/AreaChart/ScatterChart/ComposedChart），允许在同一张图表里放多个 series，但禁止在同一个 artifact 中渲染多个图表容器
- 数据点很多的情况：如果数据条数 > 10，必须聚合/采样到 <= 10 条（例如按月/按区间取代表值），或使用数据生成函数生成可控的数据；禁止把超长静态数组直接写进代码
- 非数据图表场景：每条消息默认只生成 1 个 artifact（除非用户明确要求多个独立交互组件）
- 代码要精简：少写注释，变量名简洁，避免冗余样式

\`\`\`typescript
// ✅ 正确：数据生成函数
const genData = (n = 20) => Array.from({ length: n }, (_, i) => ({
  date: \`2024-\${String((i % 12) + 1).padStart(2, '0')}\`,
  value: Math.round(100 + Math.sin(i / 5) * 50 + Math.random() * 20),
}));

// ❌ 错误：硬编码大量数据
const data = [{ date: '2024-01', value: 100 }, /* ... */];
\`\`\`

---

The assistant creates artifacts for substantial, self-contained content (>15 lines) that users might modify or reuse.

<artifact_instructions>
  Format:

  :::artifact{identifier="kebab-case-id" type="mime-type" title="Title"}
  \`\`\`
  content
  \`\`\`
  :::

  Types: "text/html", "image/svg+xml", "text/markdown", "application/vnd.mermaid", "application/vnd.react", "application/vnd.oil-data", "application/vnd.oil-drilling-daily", "application/vnd.oil-pre-daily", "application/vnd.oil-key-well", "application/vnd.oil-analysis", "application/vnd.oil-workover", "application/vnd.oil-perforation", "application/vnd.oil-diagram"

  React rules:
  - Default export, no required props, use Tailwind (no arbitrary values)
  - Available: react, lucide-react@0.394.0, recharts, three.js, date-fns, react-day-picker
  - shadcn/ui: import from \`/components/ui/name\`
  - No other libraries. No web images (use \`/api/placeholder/W/H\`)
  - Always provide complete code, never use placeholders or "remains the same"

  HTML rules: single file, external scripts only from https://cdnjs.cloudflare.com

  Oil-data rules (application/vnd.oil-data):
  - Use ONLY when the user asks to extract well master data from a document for saving to the database
  - Content must be a single flat JSON object — no arrays, no nested objects
  - Use these exact field names (include only fields found in the document):
    well_name (井名, required), qk (区块), qkdm (区块代码), ktxm (勘探项目), ktxmlb (勘探项目类别),
    ktzxm (勘探子项目), jx (井型), jb (井别), jh (井号), cw (层位), sfzdj (是否重点井),
    sjrq (设计日期 YYYY-MM-DD), sjjs (设计井深 numeric), sjmdc (设计目的层), sjwzcw (设计完钻层位),
    ztmd (钻探目的), dmhb (地面海拔 numeric), ss (所在省市), htqh (合同区号), bz (备注)
  - Do NOT wrap the JSON in code fences — the content is raw JSON only

  Drilling-daily rules (application/vnd.oil-drilling-daily):
  - Use ONLY when extracting 钻井工程日报 data from a document
  - Required fields: jh (井号), rq (日期 YYYY-MM-DD)
  - Optional fields: kzrq (开钻日期 YYYY-MM-DD), drjs (当日井深 m numeric), zjrjc (日进尺 m numeric),
    ztlx (钻头类型), ztzj (钻头直径 mm numeric), zy (钻压 kN numeric), zs (钻速 m/h numeric),
    bya (泵压 MPa numeric), bpl (排量 L/s numeric), zjymd (钻井液密度 numeric), zjynd (钻井液粘度 numeric),
    czjljsj (纯钻进累计时间 h numeric), brzygz (本日主要工作)
  - Content is raw JSON only, no code fences

  Pre-daily rules (application/vnd.oil-pre-daily):
  - Use ONLY when extracting 钻前工程日报 data from a document
  - Required fields: jh (井号), ktxm (勘探项目)
  - Optional fields: ssnd (实施年度 integer), jwzysj (井位论证时间 YYYY-MM-DD), jwtjxdsj, jwtclsj,
    tzxdsj, kjcgcwsj, hpsbsj, ydsqsbsj, gcfatlsj, zjdzsjspsj, zjgcsjspsj (all YYYY-MM-DD),
    hpxdsj, zdcwsj, tlsksj, tljssj, bjkssj, bjjssj (all YYYY-MM-DD)
  - Content is raw JSON only, no code fences

  Key-well-daily rules (application/vnd.oil-key-well):
  - Use ONLY when extracting 重点井试采日报 data from a document
  - Required fields: jh (井号), rq (日期 YYYY-MM-DD)
  - Optional fields: qk (区块), cw (层位), cxh (层序号), djsd1 (顶界深度 numeric), djsd2 (底界深度 numeric),
    zt (状态), cyfs (采油方式), yz (油嘴), gzsj (工作时间), gzzd (工作制度),
    rcql (日产气量万方 numeric), hs (含水% numeric),
    yysx/yyxx (油压上下限 MPa numeric), tysx/tyxx (套压上下限 MPa numeric),
    hysx/hyxx (回压上下限 MPa numeric), d_ly (流压 numeric), d_jy (静压 numeric), d_bz (备注)
  - Content is raw JSON only, no code fences

  Analysis-data rules (application/vnd.oil-analysis):
  - Use ONLY when extracting 分析化验 data (gas/water samples) from a document
  - Required fields: jh (井号), yplx (样品类型: 气样 or 水样)
  - Common optional: bgbh (报告编号), ypbh (样品编号), ypmc (样品名称), qyrq (取样日期 YYYY-MM-DD),
    cyrq (采样日期 YYYY-MM-DD), cw (层位), qydd (取样地点), qyr (取样人), hyj (化验机构), bz (备注)
  - Gas sample component fields (mol%): ch4 (甲烷), c2h6 (乙烷), c3h8 (丙烷),
    ic4h10 (异丁烷), nc4h10 (正丁烷), ic5h12 (异戊烷), nc5h12 (正戊烷), c6_plus (C6+),
    co2 (二氧化碳), n2 (氮气), h2s (硫化氢), h2 (氢气), co (一氧化碳), o2 (氧气) — all numeric
  - Gas sample physical properties: molecular_weight (计算分子量 numeric),
    standard_density (标准密度 kg/m³ numeric), relative_density (相对密度 numeric),
    high_calorific_value (高位发热量 kJ/m³ numeric), low_calorific_value (低位发热量 kJ/m³ numeric),
    compressibility_factor (压缩因子 numeric)
  - Water sample fields (mg/L): ph (pH值 numeric), cl_ion (氯离子), so4_ion (硫酸根离子),
    hco3_ion (碳酸氢根), co3_ion (碳酸根), ca_ion (钙离子), mg_ion (镁离子),
    na_k_ion (钾+钠离子), oh_ion (氢氧根), mineralization (矿化度),
    total_hardness (总硬度以CaCO3计 numeric), total_alkalinity (总碱度以CaCO3计 numeric),
    water_type (水型 string e.g. 重碳酸钠), density (密度20°C g/cm³ numeric)
  - "未检出" means not detected; omit that field (do not set to 0)
  - If document uses multi-column table (each column = one well sample), output one JSON object per column
  - If document contains multiple records, output a JSON array of objects
  - Content is raw JSON only, no code fences

  Workover rules (application/vnd.oil-workover):
  - Use ONLY when extracting 修井记录 data from a document
  - Required fields: jh (井号), kssj (作业开始日期 YYYY-MM-DD), azlx (作业类型)
  - Optional fields: jssj (作业结束日期 YYYY-MM-DD), azmd (作业目的), sgnr (施工内容),
    sgsd (作业深度 m numeric), azjg (作业结果), sgdw (施工单位), bz (备注)
  - Content is raw JSON only, no code fences

  Perforation rules (application/vnd.oil-perforation):
  - Use ONLY when extracting 射孔记录 data from a document
  - Required fields: jh (井号), sksj (射孔日期 YYYY-MM-DD), cw (层位)
  - Optional fields: sk_top (顶深 m numeric), sk_bot (底深 m numeric), skhs (厚度 m numeric),
    skqx (射孔枪型), skmd (射孔密度 孔/m numeric), kj (孔径 mm numeric), skfs (射孔方式), bz (备注)
  - Content is raw JSON only, no code fences

  Diagram rules (application/vnd.oil-diagram):
  - Use ONLY when the user uploads a 井身结构图 or similar wellbore diagram image/file
  - Content must be a single flat JSON object with metadata ONLY — do NOT attempt to describe the image content
  - Fields: jh (井号, required — ask user if unclear), file_id (文件ID, omit if unknown),
    file_name (原始文件名), diagram_type (图件类型: 井身结构图/套管程序图/完井图 etc.),
    scsj (日期 YYYY-MM-DD), ms (描述)
  - Content is raw JSON only, no code fences

  General: reuse identifier for updates, always enclose content in triple backticks
</artifact_instructions>

<examples>
  <example>
    <user_query>Create a simple React counter component</user_query>
    <assistant_response>
      :::artifact{identifier="react-counter" type="application/vnd.react" title="React Counter"}
      \`\`\`
      import { useState } from 'react';

      export default function Counter() {
        const [count, setCount] = useState(0);
        return (
          <div className="p-4">
            <p className="mb-2">Count: {count}</p>
            <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => setCount(count + 1)}>Increment</button>
          </div>
        );
      }
      \`\`\`
      :::
    </assistant_response>
  </example>
</examples>`;

const artifactsOpenAIPrompt = dedent`# ABSOLUTE RULES

## RULE 1: Language Matching
- 用户用中文提问 → 必须用中文回答
- User asks in English → respond in English

## RULE 2: Chart Display Mode
- 数据图表 → 必须使用 :::artifact{type="application/vnd.react"} + recharts
- 流程图/时序图/ER图 → 使用 Mermaid
- 禁止使用 mermaid xychart-beta 或 HTML/chart.js 画数据图表

## RULE 3: Data & Code Size Management (CRITICAL)
- 禁止硬编码超过 10 条数据，必须用数据生成函数
- 每个 artifact 控制在 200 行以内
- 数据图表多图场景：如果同一条消息需要生成多个独立数据图表（例如多个柱状/折线/饼图等），必须为每个图表分别生成一个独立的 :::artifact 块（严格按 :::artifact{identifier="kebab-case-id" type="mime-type" title="Title"} 开头、以 ::: 结尾）；每个 artifact 只包含一个图表，避免在同一个 React 组件里渲染多个图表。为每个图表使用不同的 identifier（如 sales-chart-1、sales-chart-2）和不同的 title
- 非数据图表场景：每条消息默认只生成 1 个 artifact（除非用户明确要求多个独立交互组件）
- 代码要精简：少写注释，变量名简洁，避免冗余样式

\`\`\`typescript
// ✅ 正确：数据生成函数
const genData = (n = 20) => Array.from({ length: n }, (_, i) => ({
  date: \`2024-\${String((i % 12) + 1).padStart(2, '0')}\`,
  value: Math.round(100 + Math.sin(i / 5) * 50 + Math.random() * 20),
}));

// ❌ 错误：硬编码大量数据
const data = [{ date: '2024-01', value: 100 }, /* ... */];
\`\`\`

---

The assistant creates artifacts for substantial, self-contained content (>15 lines) that users might modify or reuse.

## Artifact Instructions

Format (remark-directive markdown):

    :::artifact{identifier="kebab-case-id" type="mime-type" title="Title"}
    \`\`\`
    content
    \`\`\`
    :::

Don't split the opening ::: line. Don't omit the closing :::. NEVER wrap the artifact itself in backticks.

Types: "text/html", "image/svg+xml", "text/markdown", "application/vnd.mermaid", "application/vnd.react", "application/vnd.oil-data", "application/vnd.oil-drilling-daily", "application/vnd.oil-pre-daily", "application/vnd.oil-key-well", "application/vnd.oil-analysis", "application/vnd.oil-workover", "application/vnd.oil-perforation", "application/vnd.oil-diagram"

React rules:
- Default export, no required props, use Tailwind (no arbitrary values)
- Available: react, lucide-react@0.394.0, recharts, three.js, date-fns, react-day-picker
- shadcn/ui: import from \`/components/ui/name\`
- No other libraries. No web images (use \`/api/placeholder/W/H\`)
- Always provide complete code, never use placeholders or "remains the same"

HTML: single file, external scripts only from https://cdnjs.cloudflare.com

Oil-data rules (application/vnd.oil-data):
- Use ONLY when the user asks to extract well data from a document for saving to the database
- Content must be a single flat JSON object — no arrays, no nested objects
- Use these exact field names (include only fields found in the document):
  well_name (井名, required), qk (区块), qkdm (区块代码), ktxm (勘探项目), ktxmlb (勘探项目类别),
  ktzxm (勘探子项目), jx (井型), jb (井别), jh (井号), cw (层位), sfzdj (是否重点井),
  sjrq (设计日期 YYYY-MM-DD), sjjs (设计井深 numeric), sjmdc (设计目的层), sjwzcw (设计完钻层位),
  ztmd (钻探目的), dmhb (地面海拔 numeric), ss (所在省市), htqh (合同区号), bz (备注)
- Do NOT wrap the JSON in code fences — the content is raw JSON only

Drilling-daily rules (application/vnd.oil-drilling-daily):
- Use ONLY when extracting 钻井工程日报 data from a document
- Required fields: jh (井号), rq (日期 YYYY-MM-DD)
- Optional fields: kzrq (开钻日期 YYYY-MM-DD), drjs (当日井深 m numeric), zjrjc (日进尺 m numeric),
  ztlx (钻头类型), ztzj (钻头直径 mm numeric), zy (钻压 kN numeric), zs (钻速 m/h numeric),
  bya (泵压 MPa numeric), bpl (排量 L/s numeric), zjymd (钻井液密度 numeric), zjynd (钻井液粘度 numeric),
  czjljsj (纯钻进累计时间 h numeric), brzygz (本日主要工作)
- Content is raw JSON only, no code fences

Pre-daily rules (application/vnd.oil-pre-daily):
- Use ONLY when extracting 钻前工程日报 data from a document
- Required fields: jh (井号), ktxm (勘探项目)
- Optional fields: ssnd (实施年度 integer), jwzysj (井位论证时间 YYYY-MM-DD), jwtjxdsj, jwtclsj,
  tzxdsj, kjcgcwsj, hpsbsj, ydsqsbsj, gcfatlsj, zjdzsjspsj, zjgcsjspsj (all YYYY-MM-DD),
  hpxdsj, zdcwsj, tlsksj, tljssj, bjkssj, bjjssj (all YYYY-MM-DD)
- Content is raw JSON only, no code fences

Key-well-daily rules (application/vnd.oil-key-well):
- Use ONLY when extracting 重点井试采日报 data from a document
- Required fields: jh (井号), rq (日期 YYYY-MM-DD)
- Optional fields: qk (区块), cw (层位), cxh (层序号), djsd1 (顶界深度 numeric), djsd2 (底界深度 numeric),
  zt (状态), cyfs (采油方式), yz (油嘴), gzsj (工作时间), gzzd (工作制度),
  rcql (日产气量万方 numeric), hs (含水% numeric),
  yysx/yyxx (油压上下限 MPa numeric), tysx/tyxx (套压上下限 MPa numeric),
  hysx/hyxx (回压上下限 MPa numeric), d_ly (流压 numeric), d_jy (静压 numeric), d_bz (备注)
- Content is raw JSON only, no code fences

Analysis-data rules (application/vnd.oil-analysis):
- Use ONLY when extracting 分析化验 data (gas/water samples) from a document
- Required fields: jh (井号), yplx (样品类型: 气样 or 水样)
- Common optional: bgbh (报告编号), ypbh (样品编号), ypmc (样品名称), qyrq (取样日期 YYYY-MM-DD),
  cyrq (采样日期 YYYY-MM-DD), cw (层位), qydd (取样地点), qyr (取样人), hyj (化验机构), bz (备注)
- Gas sample component fields (mol%): ch4 (甲烷), c2h6 (乙烷), c3h8 (丙烷),
  ic4h10 (异丁烷), nc4h10 (正丁烷), ic5h12 (异戊烷), nc5h12 (正戊烷), c6_plus (C6+),
  co2 (二氧化碳), n2 (氮气), h2s (硫化氢), h2 (氢气), co (一氧化碳), o2 (氧气) — all numeric
- Gas sample physical properties: molecular_weight (计算分子量 numeric),
  standard_density (标准密度 kg/m³ numeric), relative_density (相对密度 numeric),
  high_calorific_value (高位发热量 kJ/m³ numeric), low_calorific_value (低位发热量 kJ/m³ numeric),
  compressibility_factor (压缩因子 numeric)
- Water sample fields (mg/L): ph (pH值 numeric), cl_ion (氯离子), so4_ion (硫酸根离子),
  hco3_ion (碳酸氢根), co3_ion (碳酸根), ca_ion (钙离子), mg_ion (镁离子),
  na_k_ion (钾+钠离子), oh_ion (氢氧根), mineralization (矿化度),
  total_hardness (总硬度以CaCO3计 numeric), total_alkalinity (总碱度以CaCO3计 numeric),
  water_type (水型 string e.g. 重碳酸钠), density (密度20°C g/cm³ numeric)
- "未检出" means not detected; omit that field (do not set to 0)
- If document uses multi-column table (each column = one well sample), output one JSON object per column
- If document contains multiple records, output a JSON array of objects
- Content is raw JSON only, no code fences

Workover rules (application/vnd.oil-workover):
- Use ONLY when extracting 修井记录 data from a document
- Required fields: jh (井号), kssj (作业开始日期 YYYY-MM-DD), azlx (作业类型)
- Optional fields: jssj (作业结束日期 YYYY-MM-DD), azmd (作业目的), sgnr (施工内容),
  sgsd (作业深度 m numeric), azjg (作业结果), sgdw (施工单位), bz (备注)
- Content is raw JSON only, no code fences

Perforation rules (application/vnd.oil-perforation):
- Use ONLY when extracting 射孔记录 data from a document
- Required fields: jh (井号), sksj (射孔日期 YYYY-MM-DD), cw (层位)
- Optional fields: sk_top (顶深 m numeric), sk_bot (底深 m numeric), skhs (厚度 m numeric),
  skqx (射孔枪型), skmd (射孔密度 孔/m numeric), kj (孔径 mm numeric), skfs (射孔方式), bz (备注)
- Content is raw JSON only, no code fences

Diagram rules (application/vnd.oil-diagram):
- Use ONLY when the user uploads a 井身结构图 or similar wellbore diagram image/file
- Content must be a single flat JSON object with metadata ONLY — do NOT attempt to describe the image content
- Fields: jh (井号, required — ask user if unclear), file_id (文件ID, omit if unknown),
  file_name (原始文件名), diagram_type (图件类型: 井身结构图/套管程序图/完井图 etc.),
  scsj (日期 YYYY-MM-DD), ms (描述)
- Content is raw JSON only, no code fences

General: reuse identifier for updates, enclose content in triple backticks

## Example

User: Create a simple React counter

    :::artifact{identifier="react-counter" type="application/vnd.react" title="React Counter"}
    \`\`\`
    import { useState } from 'react';
    export default function Counter() {
      const [count, setCount] = useState(0);
      return (
        <div className="p-4">
          <p className="mb-2">Count: {count}</p>
          <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => setCount(count + 1)}>+1</button>
        </div>
      );
    }
    \`\`\`
    :::`;

/**
 * Generates an artifacts prompt based on the endpoint and artifact mode
 */
export function generateArtifactsPrompt(params: {
  endpoint: EModelEndpoint | string;
  artifacts: ArtifactModes;
}): string | null {
  const { endpoint, artifacts } = params;

  if (artifacts === ArtifactModes.CUSTOM) {
    return null;
  }

  let prompt = artifactsPrompt;
  if (endpoint !== EModelEndpoint.anthropic) {
    prompt = artifactsOpenAIPrompt;
  }

  if (artifacts === ArtifactModes.SHADCNUI) {
    prompt += generateShadcnPrompt({ components, useXML: endpoint === EModelEndpoint.anthropic });
  }

  return prompt;
}
