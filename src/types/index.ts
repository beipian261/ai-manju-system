// ============================================================
// 共享类型定义 — 项目级通用接口
// ============================================================

/** 分镜数据（用于预览/质量检查等只读场景） */
export interface StoryboardSnapshot {
  sceneNum: number;
  id: string;
  title: string | null;
  description: string | null;
  dialogue: string | null;
  emotion: string | null;
  duration: number | null;
  imageUrls: string | null;
  charactersInScene: string | null;
  cameraAngle: string | null;
  location: string | null;
}

/** 自定义场景排序项 */
export interface SceneOrderItem {
  title?: string;
  description?: string;
  emotion?: string;
  cameraAngle?: string;
  location?: string;
  timeOfDay?: string;
  characters?: string[];
  dialogue?: string;
}

/** 角色简要信息（配音/质量检查等场景） */
export interface CharacterInfo {
  id: string;
  name: string;
  gender?: string | null;
  personality?: string | null;
}

/** 平台信息 */
export interface PlatformInfo {
  id: string;
  name: string;
  ratio: string;
  resolution: string;
}

/** 一致性检查问题 */
export interface ConsistencyIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/** 对话对象（兼容脚本中 dialogue 为非字符串的场景） */
export interface DialogueObject {
  text?: string;
  [key: string]: unknown;
}
