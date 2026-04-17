// Panel resize constraints
export const MIN_PANEL_WIDTH = 20; // percentage
export const MAX_PANEL_WIDTH = 80; // percentage
export const DEFAULT_PANEL_WIDTH = 35; // percentage

// Source tab bar: switch to icon-only mode once total tabs exceed this threshold
export const SOURCE_TAB_ICON_ONLY_THRESHOLD = 5;

// Modal constraints
export const DETAIL_MODAL_WIDTH = '65%';
export const DETAIL_MODAL_MAX_WIDTH = '1400px';
export const DETAIL_MODAL_MAX_HEIGHT = '85vh';
export const FILE_TREE_HEIGHT = '320px';

// Z-index layers
export const Z_INDEX = {
  DRAG_OVERLAY: 99999,
  IMPORTING_OVERLAY: 99999,
  DELETE_MODAL: 9999,
} as const;
