import type { ComponentType, SVGProps } from 'react';

import IconAccountTree from '~icons/material-symbols/account-tree-outline';
import IconAdd from '~icons/material-symbols/add';
import IconApi from '~icons/material-symbols/api';
import IconApps from '~icons/material-symbols/apps';
import IconArrowBack from '~icons/material-symbols/arrow-back';
import IconAutorenew from '~icons/material-symbols/autorenew';
import IconBackup from '~icons/material-symbols/backup-outline';
import IconBolt from '~icons/material-symbols/bolt-outline';
import IconBrightnessAuto from '~icons/material-symbols/brightness-auto-outline';
import IconBugReport from '~icons/material-symbols/bug-report-outline';
import IconBuild from '~icons/material-symbols/build-outline';
import IconChat from '~icons/material-symbols/chat-outline';
import IconCheck from '~icons/material-symbols/check';
import IconCheckCircle from '~icons/material-symbols/check-circle-outline';
import IconChevronLeft from '~icons/material-symbols/chevron-left';
import IconChevronRight from '~icons/material-symbols/chevron-right';
import IconClose from '~icons/material-symbols/close';
import IconCloudDownload from '~icons/material-symbols/cloud-download-outline';
import IconCloudSync from '~icons/material-symbols/cloud-sync-outline';
import IconCode from '~icons/material-symbols/code';
import IconContentCopy from '~icons/material-symbols/content-copy-outline';
import IconCss from '~icons/material-symbols/css';
import IconDarkMode from '~icons/material-symbols/dark-mode-outline';
import IconDataObject from '~icons/material-symbols/data-object';
import IconDatabase from '~icons/material-symbols/database-outline';
import IconDelete from '~icons/material-symbols/delete-outline';
import IconDescription from '~icons/material-symbols/description-outline';
import IconDragIndicator from '~icons/material-symbols/drag-indicator';
import IconDownload from '~icons/material-symbols/download';
import IconDownloadForOffline from '~icons/material-symbols/download-for-offline-outline';
import IconDriveFolderUpload from '~icons/material-symbols/drive-folder-upload-outline';
import IconEdit from '~icons/material-symbols/edit-outline';
import IconError from '~icons/material-symbols/error-outline';
import IconExpandLess from '~icons/material-symbols/expand-less';
import IconExpandMore from '~icons/material-symbols/expand-more';
import IconExtension from '~icons/material-symbols/extension-outline';
import IconFilterAltOff from '~icons/material-symbols/filter-alt-off-outline';
import IconFolderOpen from '~icons/material-symbols/folder-open-outline';
import IconFunctions from '~icons/material-symbols/functions';
import IconGridView from '~icons/material-symbols/grid-view-outline';
import IconHelp from '~icons/material-symbols/help-outline';
import IconHistory from '~icons/material-symbols/history';
import IconHome from '~icons/material-symbols/home-outline';
import IconHourglassTop from '~icons/material-symbols/hourglass-top';
import IconHtml from '~icons/material-symbols/html';
import IconHub from '~icons/material-symbols/hub-outline';
import IconInfo from '~icons/material-symbols/info-outline';
import IconIntegrationInstructions from '~icons/material-symbols/integration-instructions-outline';
import IconJavascript from '~icons/material-symbols/javascript';
import IconKeep from '~icons/material-symbols/keep-outline';
import IconKeepOff from '~icons/material-symbols/keep-off-outline';
import IconLanguage from '~icons/material-symbols/language';
import IconLightMode from '~icons/material-symbols/light-mode-outline';
import IconLink from '~icons/material-symbols/link';
import IconLocalFireDepartment from '~icons/material-symbols/local-fire-department-outline';
import IconLock from '~icons/material-symbols/lock-outline';
import IconMemory from '~icons/material-symbols/memory-outline';
import IconOpenInNew from '~icons/material-symbols/open-in-new';
import IconPalette from '~icons/material-symbols/palette-outline';
import IconPerson from '~icons/material-symbols/person-outline';
import IconPsychology from '~icons/material-symbols/psychology-outline';
import IconRadioButtonUnchecked from '~icons/material-symbols/radio-button-unchecked';
import IconRefresh from '~icons/material-symbols/refresh';
import IconRocketLaunch from '~icons/material-symbols/rocket-launch-outline';
import IconSchema from '~icons/material-symbols/schema-outline';
import IconSearch from '~icons/material-symbols/search';
import IconSearchOff from '~icons/material-symbols/search-off';
import IconSettings from '~icons/material-symbols/settings-outline';
import IconSettingsSuggest from '~icons/material-symbols/settings-suggest-outline';
import IconSmartToy from '~icons/material-symbols/smart-toy-outline';
import IconSourceNotes from '~icons/material-symbols/source-notes-outline';
import IconStar from '~icons/material-symbols/star-outline';
import IconStorage from '~icons/material-symbols/storage';
import IconSubdirectoryArrowRight from '~icons/material-symbols/subdirectory-arrow-right';
import IconTerminal from '~icons/material-symbols/terminal';
import IconToken from '~icons/material-symbols/token-outline';
import IconTransform from '~icons/material-symbols/transform';
import IconTrendingUp from '~icons/material-symbols/trending-up';
import IconTune from '~icons/material-symbols/tune';
import IconUpdate from '~icons/material-symbols/update';
import IconVisibility from '~icons/material-symbols/visibility-outline';
import IconVisibilityOff from '~icons/material-symbols/visibility-off-outline';
import IconWarning from '~icons/material-symbols/warning-outline';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * 项目内统一图标注册表。
 * key 为 snake_case 名称（与原 Material Symbols ligature 名一致），value 为 SVG 组件。
 *
 * 维护规则：
 * - 新增图标：去 https://icon-sets.iconify.design/material-symbols/ 找名字，
 *   优先使用 -outline 后缀；没有 outline 变体的图标用基础名（其本身就是单一形态）。
 * - cloud_upload / source 在 iconify 集合中缺失，分别映射为语义最近的
 *   cloud-sync-outline / source-notes-outline。
 */
const ICONS: Record<string, IconComponent> = {
  account_tree: IconAccountTree,
  add: IconAdd,
  api: IconApi,
  apps: IconApps,
  arrow_back: IconArrowBack,
  autorenew: IconAutorenew,
  backup: IconBackup,
  bolt: IconBolt,
  brightness_auto: IconBrightnessAuto,
  bug_report: IconBugReport,
  build: IconBuild,
  chat: IconChat,
  check: IconCheck,
  check_circle: IconCheckCircle,
  chevron_left: IconChevronLeft,
  chevron_right: IconChevronRight,
  close: IconClose,
  cloud_download: IconCloudDownload,
  cloud_sync: IconCloudSync,
  cloud_upload: IconCloudSync,
  code: IconCode,
  content_copy: IconContentCopy,
  css: IconCss,
  dark_mode: IconDarkMode,
  data_object: IconDataObject,
  database: IconDatabase,
  delete: IconDelete,
  description: IconDescription,
  drag_indicator: IconDragIndicator,
  download: IconDownload,
  download_for_offline: IconDownloadForOffline,
  drive_folder_upload: IconDriveFolderUpload,
  edit: IconEdit,
  error: IconError,
  expand_less: IconExpandLess,
  expand_more: IconExpandMore,
  extension: IconExtension,
  filter_alt_off: IconFilterAltOff,
  folder_open: IconFolderOpen,
  functions: IconFunctions,
  grid_view: IconGridView,
  help: IconHelp,
  history: IconHistory,
  home: IconHome,
  hourglass_top: IconHourglassTop,
  html: IconHtml,
  hub: IconHub,
  info: IconInfo,
  integration_instructions: IconIntegrationInstructions,
  javascript: IconJavascript,
  keep: IconKeep,
  keep_off: IconKeepOff,
  language: IconLanguage,
  light_mode: IconLightMode,
  link: IconLink,
  local_fire_department: IconLocalFireDepartment,
  lock: IconLock,
  memory: IconMemory,
  open_in_new: IconOpenInNew,
  palette: IconPalette,
  person: IconPerson,
  psychology: IconPsychology,
  radio_button_unchecked: IconRadioButtonUnchecked,
  refresh: IconRefresh,
  rocket_launch: IconRocketLaunch,
  schema: IconSchema,
  search: IconSearch,
  search_off: IconSearchOff,
  settings: IconSettings,
  settings_suggest: IconSettingsSuggest,
  smart_toy: IconSmartToy,
  source: IconSourceNotes,
  star: IconStar,
  storage: IconStorage,
  subdirectory_arrow_right: IconSubdirectoryArrowRight,
  terminal: IconTerminal,
  token: IconToken,
  transform: IconTransform,
  trending_up: IconTrendingUp,
  tune: IconTune,
  update: IconUpdate,
  visibility: IconVisibility,
  visibility_off: IconVisibilityOff,
  warning: IconWarning,
};

export type IconName = keyof typeof ICONS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  /** 图标名称（snake_case，与原 Material Symbols ligature 名保持一致） */
  name: string;
  /** 透传给 svg 元素的 className，可用 Tailwind 的 text-xxx 控制尺寸/颜色 */
  className?: string;
}

/**
 * 项目统一图标组件。
 *
 * - 内部走 unplugin-icons 编译期内联 SVG，零运行时字体依赖。
 * - 默认使用 1em 尺寸 + currentColor，可直接用 Tailwind 的 text-xxx 控制。
 * - 用法：<Icon name="folder_open" className="text-xl text-slate-600" />
 */
export function Icon({ name, className, ...rest }: IconProps) {
  const Cmp = ICONS[name];
  if (!Cmp) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[Icon] Missing icon: "${name}". Add it to app/src/components/Icon.tsx.`);
    }
    return null;
  }
  return <Cmp className={className} {...rest} />;
}

export default Icon;
