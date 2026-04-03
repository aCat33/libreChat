import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import { Database, FileUp, CheckCircle2, Loader2 } from 'lucide-react';
import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';
import { EToolResources } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import { useVectorizationStatus } from '~/hooks/Files/useVectorizationStatus';
import { useChatContext } from '~/Providers';
import { useFileHandling, useSubmitMessage, useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface ImportType {
  id: string;
  labelKey: TranslationKeys;
  prompt: string;
}

const IMPORT_TYPES: ImportType[] = [
  {
    id: 'auto',
    labelKey: 'com_ui_import_auto_detect',
    prompt:
      '请仔细分析上传文档的全部内容，识别其中包含的所有数据表类型，以 application/vnd.oil-composite artifact 格式输出。\n' +
      '输出格式为一个 JSON 对象，key 为数据类型标识，value 为该类型对应的记录数组。\n' +
      '可用的类型标识及对应含义：\n' +
      '- oil-data：井基础数据（井名、区块、井型、井别、设计参数等）\n' +
      '- drilling-daily：钻井日报（井深、进尺、钻头、钻井液等）\n' +
      '- pre-daily：开钻前日报（各阶段时间节点）\n' +
      '- key-well：重点井日报（产量、压力、状态等）\n' +
      '- analysis：化验分析（气样/水样，yplx 区分"气样"或"水样"）\n' +
      '- workover：修井记录（作业类型、施工内容等）\n' +
      '- perforation：射孔记录（射孔日期、层位、深度等）\n' +
      '- diagram：井身结构（图件类型、文件名等）\n\n' +
      '输出示例：{"analysis": [{...}, {...}], "workover": [{...}]}\n' +
      '⚠️ 重要规则：\n' +
      '- 只输出文档中实际存在的数据类型，不要编造或猜测数据\n' +
      '- 每种类型的字段定义与各单独类型完全相同\n' +
      '- 如果文档只包含一种类型的数据，也使用此格式输出\n' +
      '- 每种类型最多输出30条记录，如有更多请在该类型数组末尾追加一条 {"_truncated": true, "_total": 实际总数} 标记\n' +
      '- 内容为纯JSON，不加代码块',
  },
  {
    id: 'gas',
    labelKey: 'com_ui_import_gas_analysis',
    prompt:
      '从上传文档中提取气样化验数据，yplx 固定为"气样"。\n' +
      '必须提取的字段（如文档中存在）：\n' +
      '- 基本信息：jh（井号）、bgbh（报告编号）、ypbh（样品编号）、ypmc（样品名称，来自"样品名称"字段，不要推断）、qyrq（取样日期）、cyrq（采样/检测日期）、cw（层位）、qydd（取样地点）、qyr（取样人）\n' +
      '- 气体组分(mol%)：ch4(甲烷)、c2h6(乙烷)、c3h8(丙烷)、nc4h10(正丁烷)、ic4h10(异丁烷)、nc5h12(正戊烷)、ic5h12(异戊烷)、c6_plus(正己烷及C6+)、n2(氮气)、co2(二氧化碳)、co(一氧化碳)、h2s(硫化氢，注意单位可能是mg/m³)、o2(氧气)\n' +
      '- 气样物性：molecular_weight(计算分子量)、standard_density(真实密度 kg/m³)、relative_density(真实相对密度)、high_calorific_value(高位发热量 kJ/m³)、low_calorific_value(低位发热量 kJ/m³)、compressibility_factor(压缩因子)\n' +
      '- 文档格式注意：组分数据常以左右两列并排排列，需同时读取两列；氧气若无值则不填；备注若为"/"则不填\n' +
      '- 多个样品时输出JSON数组，单个样品输出JSON对象\n' +
      '必须严格使用以下格式输出，不要有任何其他文字或解释：\n' +
      ':::artifact{identifier="gas-analysis-import" type="application/vnd.oil-analysis" title="气样化验数据"}\n' +
      '[JSON数据，直接写JSON，不加代码块围栏]\n' +
      ':::',
  },
  {
    id: 'water',
    labelKey: 'com_ui_import_water_analysis',
    prompt:
      '从上传文档中提取水样化验数据，yplx 固定为"水样"。\n' +
      '⚠️ 重要：只输出文档中明确存在的数据，绝对不能猜测、估算或编造任何数值。如果文档内容无法正确读取，请告知用户，不要生成数据。\n' +
      '表格格式说明：检测结果表为多列格式——第一列是"检测项目"，后续每列是一口井的数据。"样品名称"行的每列值就是该列对应的井号（jh），如MYHW1001、MYHW1002。每列独立提取为一条记录。\n' +
      '字段映射（按行名称对应列值）：\n' +
      '- jh = "样品名称"行对应列的值（井名）\n' +
      '- bgbh = 报告编号（整份报告共用，从报告头部提取）\n' +
      '- ypbh = "样品编号"行对应列的值\n' +
      '- qyrq = "取样日期"行对应列（格式YYYY-MM-DD）\n' +
      '- ph = "pH值"行、co3_ion = "碳酸根"、hco3_ion = "碳酸氢根"、oh_ion = "氢氧根"\n' +
      '- ca_ion = "钙离子"、mg_ion = "镁离子"、cl_ion = "氯离子"、so4_ion = "硫酸根离子"\n' +
      '- na_k_ion = "钾+钠离子"、mineralization = "矿化度"、water_type = "水型"（字符串）\n' +
      '- total_hardness = "总硬度"、total_alkalinity = "总碱度"、density = "密度(20°C)"(g/cm³)\n' +
      '- "未检出"→不填该字段；备注"/"→不填；所有数值字段为 numeric\n' +
      '输出JSON数组（每口井一条对象）\n' +
      '必须严格使用以下格式输出，不要有任何其他文字或解释：\n' +
      ':::artifact{identifier="water-analysis-import" type="application/vnd.oil-analysis" title="水样化验数据"}\n' +
      '[JSON数据，直接写JSON，不加代码块围栏]\n' +
      ':::',
  },
  {
    id: 'workover',
    labelKey: 'com_ui_import_workover',
    prompt:
      '从上传文档中提取修井记录。\n' +
      '提取字段：jh(井号)、kssj(作业开始日期)、jssj(作业结束日期)、azlx(作业类型)、azmd(作业目的)、sgnr(施工内容)、sgsd(作业深度m)、azjg(作业结果)、sgdw(施工单位)、bz(备注)\n' +
      '多条记录时输出JSON数组\n' +
      '必须严格使用以下格式输出，不要有任何其他文字或解释：\n' +
      ':::artifact{identifier="workover-import" type="application/vnd.oil-workover" title="修井记录"}\n' +
      '[JSON数据，直接写JSON，不加代码块围栏]\n' +
      ':::',
  },
  {
    id: 'perforation',
    labelKey: 'com_ui_import_perforation',
    prompt:
      '从上传文档中提取射孔记录。\n' +
      '提取字段：jh(井号)、sksj(射孔日期)、cw(层位)、sk_top(射孔顶深m)、sk_bot(射孔底深m)、skhs(射孔厚度m)、skqx(射孔枪型)、skmd(射孔密度孔/m)、kj(孔径mm)、skfs(射孔方式)、bz(备注)\n' +
      '多条记录时输出JSON数组\n' +
      '必须严格使用以下格式输出，不要有任何其他文字或解释：\n' +
      ':::artifact{identifier="perforation-import" type="application/vnd.oil-perforation" title="射孔记录"}\n' +
      '[JSON数据，直接写JSON，不加代码块围栏]\n' +
      ':::',
  },
  {
    id: 'diagram',
    labelKey: 'com_ui_import_wellbore_diagram',
    prompt:
      '从上传文档中提取井身结构信息。\n' +
      '提取字段：jh(井号)、diagram_type(图件类型)、file_name(文件名)、ms(描述)\n' +
      '必须严格使用以下格式输出，不要有任何其他文字或解释：\n' +
      ':::artifact{identifier="diagram-import" type="application/vnd.oil-diagram" title="井身结构图"}\n' +
      '[JSON数据，直接写JSON，不加代码块围栏]\n' +
      ':::',
  },
];

function ImportData() {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [pendingFileKey, setPendingFileKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialFileKeysRef = useRef<Set<string>>(new Set());

  const { files } = useChatContext();
  const { handleFileChange } = useFileHandling();
  const { submitMessage } = useSubmitMessage();

  const pendingFile = pendingFileKey != null ? files.get(pendingFileKey) : null;
  const isFileReady = pendingFile != null && pendingFile.progress === 1;
  const isUploading = pendingFile != null && pendingFile.progress < 1;

  const pendingFileId = (isFileReady && pendingFile?.file_id) ? pendingFile.file_id : null;
  const { isVectorizing } = useVectorizationStatus(pendingFileId, !!pendingFileId);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) {
        initialFileKeysRef.current = new Set(files.keys());
      } else {
        setSelectedTypeId(null);
        setPendingFileKey(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [files],
  );

  useEffect(() => {
    if (!open) return;
    for (const [key] of files) {
      if (!initialFileKeysRef.current.has(key)) {
        setPendingFileKey(key);
        return;
      }
    }
  }, [files, open]);

  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleTypeSelect = useCallback((typeId: string) => {
    setSelectedTypeId(typeId);
    setPendingFileKey(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleExtract = useCallback(() => {
    const selectedType = IMPORT_TYPES.find((t) => t.id === selectedTypeId);
    if (!selectedType || !isFileReady) return;
    setOpen(false);
    submitMessage({ text: selectedType.prompt });
  }, [selectedTypeId, isFileReady, submitMessage]);

  const canPickFile = selectedTypeId != null && !isUploading;

  return (
    <>
      <button
        type="button"
        aria-label={localize('com_ui_import_data')}
        onClick={() => handleOpenChange(true)}
        className={cn(
          'group relative inline-flex items-center justify-center gap-1.5',
          'rounded-full border border-border-medium text-sm font-medium',
          'size-9 p-2 transition-all md:w-full md:p-3',
          'bg-transparent shadow-sm hover:bg-surface-hover hover:shadow-md active:shadow-inner',
        )}
      >
        <span className="icon-md text-text-primary">
          <Database className="icon-md" aria-hidden="true" />
        </span>
        <span className="hidden truncate md:block">{localize('com_ui_import_data')}</span>
      </button>

      <OGDialog open={open} onOpenChange={handleOpenChange}>
        <OGDialogContent className="w-[90vw] max-w-md bg-white dark:border-gray-700 dark:bg-gray-850 dark:text-gray-300">
          <OGDialogHeader>
            <OGDialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Database className="size-4" aria-hidden="true" />
              {localize('com_ui_import_data')}
            </OGDialogTitle>
          </OGDialogHeader>

          <div className="space-y-4 px-6 pb-6">
            <div>
              <p className="mb-2 text-sm text-text-secondary">
                {localize('com_ui_import_data_select_type')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {IMPORT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleTypeSelect(type.id)}
                    className={cn(
                      'rounded-lg border px-2 py-3 text-center text-xs font-medium transition-all',
                      'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                      selectedTypeId === type.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-border-medium bg-surface-secondary text-text-primary',
                    )}
                  >
                    {localize(type.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={canPickFile ? handlePickFile : undefined}
              disabled={!canPickFile}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-all',
                canPickFile
                  ? 'cursor-pointer border-border-medium hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                  : 'cursor-not-allowed border-border-light opacity-40',
              )}
            >
              {isUploading && (
                <>
                  <Loader2 className="size-6 animate-spin text-blue-500" />
                  <span className="text-sm text-text-secondary">上传中…</span>
                </>
              )}
              {isFileReady && (
                <>
                  <CheckCircle2 className="size-6 text-green-500" />
                  <span className="max-w-full truncate text-sm text-green-600 dark:text-green-400">
                    {pendingFile?.filename ?? pendingFile?.file?.name ?? '文件已上传'}
                  </span>
                  <span className="text-xs text-text-secondary">点击重新选择</span>
                </>
              )}
              {!isUploading && !isFileReady && (
                <>
                  <FileUp className="size-6 text-text-secondary" />
                  <span className="text-sm text-text-secondary">
                    {localize('com_ui_import_upload_file')}
                  </span>
                  <span className="text-xs text-text-secondary opacity-70">
                    PDF / 图片 → OCR识别 · Word/WPS → 文档解析
                  </span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.wps,.et,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                const useFileSearch = file != null && /\.(doc|wps|et)$/i.test(file.name);
                handleFileChange(e, useFileSearch ? EToolResources.file_search : EToolResources.context);
              }}
            />

            {isVectorizing && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <Loader2 className="mr-1 inline size-3 animate-spin" />
                {localize('com_ui_import_vectorizing')}
              </div>
            )}
            <button
              type="button"
              onClick={handleExtract}
              disabled={!isFileReady || selectedTypeId == null || isVectorizing}
              className={cn(
                'w-full rounded-lg py-2.5 text-sm font-medium transition-all',
                isFileReady && selectedTypeId != null && !isVectorizing
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  : 'cursor-not-allowed bg-surface-tertiary text-text-secondary opacity-50',
              )}
            >
              {isVectorizing
                ? localize('com_ui_import_wait_indexing')
                : localize('com_ui_import_start_extract')}
            </button>
          </div>
        </OGDialogContent>
      </OGDialog>
    </>
  );
}

export default memo(ImportData);
