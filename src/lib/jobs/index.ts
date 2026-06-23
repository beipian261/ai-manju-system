// ============================================================
// 集中导入所有 job handler，触发 handler 注册
// 在调用 enqueueJob 前必须 import 此模块，否则 worker 找不到 handler
// ============================================================

import './generate-script';
import './generate-storyboards';
import './generate-full-workflow';

// 显式标记已加载（便于调试）
export const JOBS_REGISTERED = true;
