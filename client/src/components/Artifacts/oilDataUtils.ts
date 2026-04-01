export type OilSchema =
  | 'oil-data'
  | 'drilling-daily'
  | 'pre-daily'
  | 'key-well'
  | 'analysis'
  | 'workover'
  | 'perforation'
  | 'diagram';

/** Maps artifact MIME type suffix to OilSchema key */
export const MIME_TO_SCHEMA: Record<string, OilSchema> = {
  'application/vnd.oil-data': 'oil-data',
  'application/vnd.oil-drilling-daily': 'drilling-daily',
  'application/vnd.oil-pre-daily': 'pre-daily',
  'application/vnd.oil-key-well': 'key-well',
  'application/vnd.oil-analysis': 'analysis',
  'application/vnd.oil-workover': 'workover',
  'application/vnd.oil-perforation': 'perforation',
  'application/vnd.oil-diagram': 'diagram',
};

// ---------------------------------------------------------------------------
// Field label maps (field key → Chinese label)
// ---------------------------------------------------------------------------

export const OIL_FIELD_LABELS: Record<string, string> = {
  well_name: '井名',
  qk: '区块',
  qkdm: '区块代码',
  ktxm: '勘探项目',
  ktxmlb: '勘探项目类别',
  ktzxm: '勘探子项目',
  jx: '井型',
  jb: '井别',
  jh: '井号',
  cw: '层位',
  sfzdj: '是否重点井',
  sjrq: '设计日期',
  sjjs: '设计井深(m)',
  sjzzbx: '设计钻至标高',
  sjhzby: '设计海拔标高',
  sjmdc: '设计目的层',
  sjwzcw: '设计完钻层位',
  ztmd: '钻探目的',
  wzyz: '完钻原则',
  dmhb: '地面海拔',
  ss: '所在省市',
  sywz: '水域位置',
  jpdzcx1: '井旁地质测线1',
  jpdzcx2: '井旁地质测线2',
  zh1: '桩号1',
  zh2: '桩号2',
  dcxjl1: '到测线距离1',
  dcxjl2: '到测线距离2',
  htqh: '合同区号',
  czr: '操作人',
  lrr: '录入人',
  bz: '备注',
};

export const DRILLING_DAILY_LABELS: Record<string, string> = {
  jh: '井号',
  rq: '日期',
  kzrq: '开钻日期',
  drjs: '当日井深(m)',
  zjrjc: '日进尺(m)',
  ztlx: '钻头类型',
  ztzj: '钻头直径(mm)',
  zy: '钻压(kN)',
  zs: '钻速(m/h)',
  bya: '泵压(MPa)',
  bpl: '排量(L/s)',
  zjymd: '钻井液密度(g/cm³)',
  zjynd: '钻井液粘度(s)',
  czjljsj: '纯钻进累计时间(h)',
  brzygz: '本日主要工作',
};

export const PRE_DAILY_LABELS: Record<string, string> = {
  jh: '井号',
  ktxm: '勘探项目',
  ssnd: '实施年度',
  jwzysj: '井位论证时间',
  jwtjxdsj: '井位条件下达时间',
  jwtclsj: '井位测量时间',
  tzxdsj: '投资下达时间',
  kjcgcwsj: '勘界成果完成时间',
  hpsbsj: '环评上报时间',
  ydsqsbsj: '用地申请上报时间',
  gcfatlsj: '工程方案讨论时间',
  zjdzsjspsj: '钻井地质设计审批时间',
  zjgcsjspsj: '钻井工程设计审批时间',
  hpxdsj: '环评下达时间',
  zdcwsj: '征地完成时间',
  tlsksj: '探临开始时间',
  tljssj: '探临结束时间',
  bjkssj: '搬家安装开始时间',
  bjjssj: '搬家安装结束时间',
};

export const KEY_WELL_LABELS: Record<string, string> = {
  jh: '井号',
  rq: '日期',
  qk: '区块',
  cw: '层位',
  cxh: '层序号',
  djsd1: '顶界深度1(m)',
  djsd2: '底界深度2(m)',
  zt: '状态',
  cyfs: '采油方式',
  yz: '油嘴',
  gzsj: '工作时间',
  gzzd: '工作制度',
  rcql: '日产气量(万方)',
  hs: '含水(%)',
  yysx: '油压上限(MPa)',
  yyxx: '油压下限(MPa)',
  tysx: '套压上限(MPa)',
  tyxx: '套压下限(MPa)',
  hysx: '回压上限(MPa)',
  hyxx: '回压下限(MPa)',
  d_ly: '流压',
  d_jy: '静压',
  d_bz: '施工内容/备注',
};

export const ANALYSIS_LABELS: Record<string, string> = {
  // 基本信息
  jh: '井号',
  yplx: '样品类型',
  bgbh: '报告编号',
  ypbh: '样品编号',
  ypmc: '样品名称',
  qyrq: '取样日期',
  cyrq: '采样日期',
  cw: '层位',
  qydd: '取样地点',
  qyr: '取样人',
  // 气样组分
  ch4: '甲烷CH₄(mol%)',
  c2h6: '乙烷C₂H₆(mol%)',
  c3h8: '丙烷C₃H₈(mol%)',
  ic4h10: '异丁烷iC₄H₁₀(mol%)',
  nc4h10: '正丁烷nC₄H₁₀(mol%)',
  c4h10: '丁烷C₄H₁₀(mol%)',
  ic5h12: '异戊烷iC₅H₁₂(mol%)',
  nc5h12: '正戊烷nC₅H₁₂(mol%)',
  c5h12: '戊烷C₅H₁₂(mol%)',
  c6_plus: 'C₆+(mol%)',
  co2: '二氧化碳CO₂(mol%)',
  n2: '氮气N₂(mol%)',
  h2s: '硫化氢H₂S(mol%)',
  h2: '氢气H₂(mol%)',
  co: '一氧化碳CO(mol%)',
  o2: '氧气O₂(mol%)',
  // 气样物性
  molecular_weight: '计算分子量',
  standard_density: '标准密度(kg/m³)',
  relative_density: '相对密度',
  high_calorific_value: '高位发热量(kJ/m³)',
  low_calorific_value: '低位发热量(kJ/m³)',
  compressibility_factor: '压缩因子',
  // 水样离子
  ph: 'pH值',
  tds: '总溶解固体(mg/L)',
  cl_ion: '氯离子Cl⁻(mg/L)',
  so4_ion: '硫酸根SO₄²⁻(mg/L)',
  hco3_ion: '碳酸氢根HCO₃⁻(mg/L)',
  co3_ion: '碳酸根CO₃²⁻(mg/L)',
  ca_ion: '钙离子Ca²⁺(mg/L)',
  mg_ion: '镁离子Mg²⁺(mg/L)',
  na_k_ion: '钠钾离子Na⁺+K⁺(mg/L)',
  oh_ion: '氢氧根OH⁻(mg/L)',
  mineralization: '矿化度(mg/L)',
  total_hardness: '总硬度以CaCO₃计(mg/L)',
  total_alkalinity: '总碱度以CaCO₃计(mg/L)',
  water_type: '水型',
  density: '密度20°C(g/cm³)',
  // 其他
  hyj: '化验机构',
  bz: '备注',
};

/** Maps analysis field keys to their display category */
export const ANALYSIS_FIELD_GROUP: Record<string, string> = {
  jh: '基本信息', yplx: '基本信息', bgbh: '基本信息', ypbh: '基本信息',
  ypmc: '基本信息', qyrq: '基本信息', cyrq: '基本信息', cw: '基本信息',
  qydd: '基本信息', qyr: '基本信息',
  ch4: '气样组分', c2h6: '气样组分', c3h8: '气样组分',
  ic4h10: '气样组分', nc4h10: '气样组分', c4h10: '气样组分',
  ic5h12: '气样组分', nc5h12: '气样组分', c5h12: '气样组分',
  c6_plus: '气样组分', co2: '气样组分', n2: '气样组分',
  h2s: '气样组分', h2: '气样组分', co: '气样组分', o2: '气样组分',
  molecular_weight: '气样物性', standard_density: '气样物性',
  relative_density: '气样物性', high_calorific_value: '气样物性',
  low_calorific_value: '气样物性', compressibility_factor: '气样物性',
  ph: '水样离子', tds: '水样离子', cl_ion: '水样离子', so4_ion: '水样离子',
  hco3_ion: '水样离子', co3_ion: '水样离子', ca_ion: '水样离子',
  mg_ion: '水样离子', na_k_ion: '水样离子', oh_ion: '水样离子',
  mineralization: '水样离子', total_hardness: '水样离子', total_alkalinity: '水样离子',
  water_type: '水样离子', density: '水样离子',
  hyj: '其他', bz: '其他',
};

export const WORKOVER_LABELS: Record<string, string> = {
  jh: '井号',
  kssj: '作业开始日期',
  jssj: '作业结束日期',
  azlx: '作业类型',
  azmd: '作业目的',
  sgnr: '施工内容',
  sgsd: '作业深度(m)',
  azjg: '作业结果',
  sgdw: '施工单位',
  bz: '备注',
};

export const PERFORATION_LABELS: Record<string, string> = {
  jh: '井号',
  sksj: '射孔日期',
  cw: '层位',
  sk_top: '射孔顶深(m)',
  sk_bot: '射孔底深(m)',
  skhs: '射孔厚度(m)',
  skqx: '射孔枪型',
  skmd: '射孔密度(孔/m)',
  kj: '孔径(mm)',
  skfs: '射孔方式',
  bz: '备注',
};

export const DIAGRAM_LABELS: Record<string, string> = {
  jh: '井号',
  file_id: '文件ID',
  file_name: '文件名',
  file_url: '文件URL',
  diagram_type: '图件类型',
  scsj: '上传日期',
  ms: '描述',
};

const SCHEMA_LABEL_MAP: Record<OilSchema, Record<string, string>> = {
  'oil-data': OIL_FIELD_LABELS,
  'drilling-daily': DRILLING_DAILY_LABELS,
  'pre-daily': PRE_DAILY_LABELS,
  'key-well': KEY_WELL_LABELS,
  analysis: ANALYSIS_LABELS,
  workover: WORKOVER_LABELS,
  perforation: PERFORATION_LABELS,
  diagram: DIAGRAM_LABELS,
};

/** Per-schema field → Chinese category group mapping (for flat schemas) */
const SCHEMA_GROUP_MAP: Partial<Record<OilSchema, Record<string, string>>> = {
  analysis: ANALYSIS_FIELD_GROUP,
};

// ---------------------------------------------------------------------------
// Group labels (only needed for oil-data which uses nested groups)
// ---------------------------------------------------------------------------

/** 常见模型输出的分组键 → 中文段落标题 */
export const OIL_GROUP_LABELS: Record<string, string> = {
  well_info: '井位与标识',
  well_basic: '井位与标识',
  project_info: '项目分类',
  well_type_info: '井别与层位',
  design_parameters: '设计参数',
  design_info: '设计参数',
  drilling_info: '钻探与完钻',
  geographic_info: '地理位置',
  location_info: '地理位置',
  contract_info: '合同与管理',
  management_info: '合同与管理',
  meta: '元数据',
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatLeafValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => (isPlainRecord(item) ? JSON.stringify(item) : String(item))).join('；');
  }
  return JSON.stringify(value);
}

export type OilDataDisplayRow = {
  id: string;
  groupLabel: string;
  fieldLabel: string;
  fieldKey: string;
  valueText: string;
};

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ');
}

/**
 * Converts nested or flat oil JSON into table rows (Chinese group + field labels + display text).
 * Accepts an optional schema to select the correct label map.
 */
export function buildOilDataDisplayRows(
  data: Record<string, unknown>,
  schema: OilSchema = 'oil-data',
): OilDataDisplayRow[] {
  const rows: OilDataDisplayRow[] = [];
  const fieldLabels = SCHEMA_LABEL_MAP[schema] ?? OIL_FIELD_LABELS;
  const fieldGroups = SCHEMA_GROUP_MAP[schema];

  const walk = (node: Record<string, unknown>, path: string[]) => {
    for (const [key, raw] of Object.entries(node)) {
      if (raw === null || raw === undefined || raw === '') {
        continue;
      }

      if (isPlainRecord(raw)) {
        walk(raw, [...path, key]);
        continue;
      }

      const valueText = formatLeafValue(raw);
      if (valueText === '') {
        continue;
      }

      const topSegment = path[0];
      const groupLabel =
        fieldGroups?.[key] ??
        (topSegment != null ? OIL_GROUP_LABELS[topSegment] ?? humanizeKey(topSegment) : '');
      const fieldLabel = fieldLabels[key] ?? humanizeKey(key);
      const dottedPath = [...path, key].join('.');
      rows.push({
        id: dottedPath,
        groupLabel,
        fieldLabel,
        fieldKey: key,
        valueText,
      });
    }
  };

  walk(data, []);
  return rows;
}

/**
 * Deep-flattens to a single-level object whose leaf keys match the DB column names.
 * If different groups contain the same key name, the last one wins (consistent with single-row DB semantics).
 */
export function flattenOilDataForSave(
  input: Record<string, unknown>,
  _schema?: OilSchema,
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  const walk = (node: unknown) => {
    if (!isPlainRecord(node)) {
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (v === null || v === undefined || v === '') {
        continue;
      }
      if (isPlainRecord(v)) {
        walk(v);
        continue;
      }
      if (Array.isArray(v)) {
        flat[k] = v.every((item) => !isPlainRecord(item))
          ? v.join(', ')
          : JSON.stringify(v);
        continue;
      }
      flat[k] = v;
    }
  };

  walk(input);
  return flat;
}
