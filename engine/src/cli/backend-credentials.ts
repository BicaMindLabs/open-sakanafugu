export const BACKEND_CREDENTIAL_SPECS = [
  { launcher: 'cc-deepseek', keys: ['DEEPSEEK_API_KEY'] },
  { launcher: 'cc-glm', keys: ['GLM_API_KEY', 'ZAI_API_KEY', 'BIGMODEL_API_KEY'] },
  { launcher: 'cc-kimi', keys: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'] },
  { launcher: 'cc-qwen', keys: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY', 'BAILIAN_API_KEY'] },
  { launcher: 'cc-doubao', keys: ['DOUBAO_API_KEY', 'ARK_API_KEY', 'VOLC_API_KEY'] },
  { launcher: 'cc-minimax', keys: ['MINIMAX_API_KEY'] },
  { launcher: 'cc-mimo', keys: ['MIMO_API_KEY', 'XIAOMI_API_KEY'] },
  { launcher: 'cc-stepfun', keys: ['STEPFUN_API_KEY', 'STEP_API_KEY'] },
  { launcher: 'cc-longcat', keys: ['LONGCAT_API_KEY'] },
] as const;

export const SECRET_KEYS = [
  ...new Set([...BACKEND_CREDENTIAL_SPECS.flatMap((backend) => backend.keys), 'OPENAI_API_KEY']),
] as const;
