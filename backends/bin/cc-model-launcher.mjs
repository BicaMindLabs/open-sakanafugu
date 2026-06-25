#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const binDir = dirname(fileURLToPath(import.meta.url));
const env = process.env;

const get = (name, fallback = "") => env[name] ?? fallback;
const set = (name, value) => {
  env[name] = String(value);
};
const unset = (...names) => {
  for (const name of names) delete env[name];
};
const pick = (...names) => {
  for (const name of names) {
    const value = env[name];
    if (value !== undefined && value.length > 0) return value;
  }
  return "";
};
const isTruthy = (value) => ["1", "true", "enabled"].includes(value);
const isFalsy = (value) => ["0", "false", "disabled"].includes(value);

const parseEnvValue = (raw) => {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const sourceSecrets = (realHome) => {
  const files = [
    join(realHome, ".config", "cc-model-secrets.env"),
    join(get("HOME"), ".config", "cc-model-secrets.env"),
  ];
  for (const file of [...new Set(files)]) {
    if (!file || !existsSync(file)) continue;
    for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith("#")) continue;
      const body = line.startsWith("export ") ? line.slice(7).trim() : line;
      const eq = body.indexOf("=");
      if (eq <= 0) continue;
      set(body.slice(0, eq).trim(), parseEnvValue(body.slice(eq + 1)));
    }
  }
};

const unsetProxies = () =>
  unset(
    "http_proxy",
    "https_proxy",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "all_proxy",
    "NO_PROXY",
    "no_proxy",
  );

const setupProviderHome = (realHome, provider) => {
  const home = join(realHome, ".claude-envs", provider);
  set("HOME", home);
  mkdirSync(join(home, ".claude"), { recursive: true });
  unsetProxies();
  return home;
};

const withModelArg = (
  argv,
  envName,
  defaultModel,
  normalize = (value) => value,
) => {
  const args = [...argv];
  let model = get(envName, defaultModel);
  if (
    (args[0] === "-m" || args[0] === "--model") &&
    (args[1] ?? "").length > 0
  ) {
    model = args[1];
    args.splice(0, 2);
  }
  return { args, model: normalize(model) };
};

const json = (value) => JSON.stringify(value);

const configs = {
  deepseek(argv, ctx) {
    const home = setupProviderHome(ctx.realHome, "deepseek");
    set("ANTHROPIC_BASE_URL", "https://api.deepseek.com/anthropic");
    set("ANTHROPIC_AUTH_TOKEN", get("DEEPSEEK_API_KEY"));
    unset("ANTHROPIC_API_KEY", "ANTHROPIC_API_BASE");

    const models = [
      "deepseek-v4-pro[1m]",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
    ];
    const profile = get("DEEPSEEK_PROFILE", "agent");
    let def;
    let opus;
    let sonnet;
    let haiku;
    let effort;
    let maxOutput;
    if (profile === "flash" || profile === "cheap") {
      def = "deepseek-v4-flash";
      opus = def;
      sonnet = def;
      haiku = def;
      effort = "auto";
      maxOutput = "65536";
    } else if (profile === "instant") {
      def = "deepseek-v4-flash";
      opus = def;
      sonnet = def;
      haiku = def;
      effort = "none";
      maxOutput = "65536";
    } else {
      def = "deepseek-v4-pro[1m]";
      opus = "deepseek-v4-pro[1m]";
      sonnet = "deepseek-v4-pro";
      haiku = "deepseek-v4-flash";
      effort = "max";
      maxOutput = "262144";
    }

    const selected = withModelArg(argv, "DEEPSEEK_MODEL", def);
    set("CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK", "1");
    set("CLAUDE_CODE_EFFORT_LEVEL", get("DEEPSEEK_REASONING", effort));
    set("CLAUDE_CODE_MAX_OUTPUT_TOKENS", get("DEEPSEEK_MAX_OUTPUT", maxOutput));
    set("API_TIMEOUT_MS", get("DEEPSEEK_API_TIMEOUT_MS", "3000000"));
    if (get("DEEPSEEK_NO_THINKING").length > 0 || profile === "instant") {
      set("MAX_THINKING_TOKENS", "0");
      set("CLAUDE_CODE_DISABLE_THINKING", "1");
      set("ANTHROPIC_THINKING", "disabled");
      set("CLAUDE_CODE_EFFORT_LEVEL", "none");
      set("CLAUDE_CODE_EXTRA_BODY", json({ thinking: { type: "disabled" } }));
    } else if (get("DEEPSEEK_FORCE_THINKING_BODY", "0") === "1") {
      set(
        "CLAUDE_CODE_EXTRA_BODY",
        json({
          thinking: { type: "enabled" },
          output_config: { effort: get("CLAUDE_CODE_EFFORT_LEVEL") },
        }),
      );
    }

    return {
      ...selected,
      provider: "deepseek",
      command: "cc-deepseek",
      display: "DeepSeek Code",
      models,
      opus: get("DEEPSEEK_OPUS", opus),
      sonnet: get("DEEPSEEK_SONNET", sonnet),
      haiku: get("DEEPSEEK_HAIKU", haiku),
      fast: get("DEEPSEEK_FAST", get("DEEPSEEK_HAIKU", haiku)),
      subagent: get("DEEPSEEK_SUBAGENT", get("DEEPSEEK_HAIKU", haiku)),
      patchMarker: "DeepSeek Code",
      promptFile: join(home, "prompts", "deepseek-proactive-tools.md"),
      authLabel: "DEEPSEEK_API_KEY",
      authValue: get("DEEPSEEK_API_KEY"),
    };
  },

  doubao(argv, ctx) {
    const home = setupProviderHome(ctx.realHome, "doubao");
    set("ANTHROPIC_BASE_URL", "https://ark.cn-beijing.volces.com/api/coding");
    set(
      "ANTHROPIC_AUTH_TOKEN",
      pick("ARK_API_KEY", "VOLC_API_KEY", "DOUBAO_API_KEY"),
    );
    unset("ANTHROPIC_API_KEY", "ANTHROPIC_API_BASE");

    const models = [
      "doubao-seed-code-preview-latest",
      "doubao-seed-code-preview-251028",
      "ark-code-latest",
      "doubao-seed-2.0-code",
      "doubao-seed-2.0-pro",
      "doubao-seed-2.0-lite",
      "doubao-seed-code",
    ];
    const profile = get("DOUBAO_PROFILE", "latest");
    const table = {
      agent: [
        "doubao-seed-code-preview-latest",
        "doubao-seed-code-preview-latest",
        "doubao-seed-code-preview-latest",
        "doubao-seed-2.0-lite",
      ],
      vision: [
        "doubao-seed-code-preview-latest",
        "doubao-seed-code-preview-latest",
        "doubao-seed-code-preview-latest",
        "doubao-seed-code-preview-latest",
      ],
      frontend: [
        "doubao-seed-code-preview-latest",
        "doubao-seed-code-preview-latest",
        "doubao-seed-code-preview-latest",
        "doubao-seed-code-preview-latest",
      ],
      pinned: [
        "doubao-seed-code-preview-251028",
        "doubao-seed-code-preview-251028",
        "doubao-seed-code-preview-251028",
        "doubao-seed-code-preview-251028",
      ],
      router: [
        "ark-code-latest",
        "ark-code-latest",
        "ark-code-latest",
        "doubao-seed-2.0-lite",
      ],
      cheap: [
        "doubao-seed-2.0-lite",
        "doubao-seed-2.0-lite",
        "doubao-seed-2.0-lite",
        "doubao-seed-2.0-lite",
      ],
      seed20: [
        "doubao-seed-2.0-code",
        "doubao-seed-2.0-code",
        "doubao-seed-2.0-code",
        "doubao-seed-2.0-lite",
      ],
      reasoning: [
        "doubao-seed-2.0-code",
        "doubao-seed-2.0-code",
        "doubao-seed-2.0-code",
        "doubao-seed-2.0-lite",
      ],
      latest: [
        "doubao-seed-code-preview-latest",
        "doubao-seed-code-preview-latest",
        "doubao-seed-2.0-pro",
        "doubao-seed-2.0-lite",
      ],
    };
    const [def, opus, sonnet, haiku] = table[profile] ?? table.latest;
    const selected = withModelArg(argv, "DOUBAO_MODEL", def);
    if (
      selected.model.endsWith("lite") ||
      selected.model.endsWith("pro") ||
      selected.model === "ark-code-latest"
    ) {
      set("CLAUDE_CODE_MAX_OUTPUT_TOKENS", get("DOUBAO_MAX_OUTPUT", "131072"));
    } else {
      set("CLAUDE_CODE_MAX_OUTPUT_TOKENS", get("DOUBAO_MAX_OUTPUT", "32768"));
    }
    if (get("DOUBAO_REASONING").length > 0)
      set("CLAUDE_CODE_EFFORT_LEVEL", get("DOUBAO_REASONING"));
    const extraBody = {};
    if (get("DOUBAO_ENABLE_THINKING", "0") !== "1") {
      set("MAX_THINKING_TOKENS", "0");
      set("CLAUDE_CODE_DISABLE_THINKING", "1");
      set("ANTHROPIC_THINKING", "disabled");
      unset("CLAUDE_CODE_EFFORT_LEVEL");
      extraBody.thinking = { type: "disabled" };
    }
    if (/^[0-9]+$/u.test(get("DOUBAO_MAX_COMPLETION_TOKENS"))) {
      extraBody.max_completion_tokens = Number(
        get("DOUBAO_MAX_COMPLETION_TOKENS"),
      );
    } else if (get("DOUBAO_COMPLETION_BUDGET") === "full") {
      extraBody.max_completion_tokens = 64000;
    }
    if (Object.keys(extraBody).length > 0)
      set("CLAUDE_CODE_EXTRA_BODY", json(extraBody));

    return {
      ...selected,
      provider: "doubao",
      command: "cc-doubao",
      display: "Doubao Coding",
      models,
      opus: get("DOUBAO_OPUS", opus),
      sonnet: get("DOUBAO_SONNET", sonnet),
      haiku: get("DOUBAO_HAIKU", haiku),
      fast: get("DOUBAO_FAST", get("DOUBAO_HAIKU", haiku)),
      subagent: get("DOUBAO_SUBAGENT", get("DOUBAO_SONNET", sonnet)),
      patchMarker: "Doubao Coding",
      promptFile: join(home, "prompts", "doubao-proactive-tools.md"),
      authLabel: "ARK_API_KEY/VOLC_API_KEY/DOUBAO_API_KEY",
      authValue: get("ANTHROPIC_AUTH_TOKEN"),
    };
  },

  glm(argv, ctx) {
    const home = setupProviderHome(ctx.realHome, "glm");
    set(
      "ANTHROPIC_BASE_URL",
      get("GLM_BASE_URL", "https://api.z.ai/api/anthropic"),
    );
    set(
      "ANTHROPIC_AUTH_TOKEN",
      pick("GLM_API_KEY", "ZAI_API_KEY", "BIGMODEL_API_KEY"),
    );
    unset("ANTHROPIC_API_KEY", "ANTHROPIC_API_BASE");

    const models = [
      "glm-5.2",
      "glm-5.1",
      "glm-5-turbo",
      "glm-5",
      "glm-4.7",
      "glm-4.6",
      "glm-4.5",
      "glm-4.5-air",
    ];
    const profile = get("GLM_PROFILE", "balanced");
    const table = {
      max: ["glm-5.2", "glm-5.2", "glm-5.2", "glm-4.5-air"],
      opus: ["glm-5.2", "glm-5.2", "glm-5.2", "glm-4.5-air"],
      turbo: ["glm-5-turbo", "glm-5.2", "glm-5-turbo", "glm-4.5-air"],
      cheap: ["glm-4.5-air", "glm-4.7", "glm-4.7", "glm-4.5-air"],
      lite: ["glm-4.5-air", "glm-4.7", "glm-4.7", "glm-4.5-air"],
      balanced: ["glm-5.2", "glm-5.2", "glm-5.1", "glm-5-turbo"],
    };
    const [def, opus, sonnet, haiku] = table[profile] ?? table.balanced;
    const selected = withModelArg(argv, "GLM_MODEL", def, (value) =>
      value.startsWith("glm-") ? value : `glm-${value}`,
    );
    set("CLAUDE_CODE_MAX_OUTPUT_TOKENS", get("GLM_MAX_OUTPUT", "128000"));
    set("CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS", "1");
    if (get("GLM_THINKING_BUDGET").length > 0)
      set("MAX_THINKING_TOKENS", get("GLM_THINKING_BUDGET"));
    const extraBody = {};
    const thinking = get("GLM_THINKING", "auto");
    if (isTruthy(thinking)) extraBody.thinking = { type: "enabled" };
    else if (isFalsy(thinking)) extraBody.thinking = { type: "disabled" };
    else if (
      thinking === "auto" &&
      ["max", "opus", "turbo"].includes(profile)
    ) {
      extraBody.thinking = { type: "enabled" };
    }
    if (get("GLM_DO_SAMPLE") === "false") extraBody.do_sample = false;
    if (Object.keys(extraBody).length > 0)
      set("CLAUDE_CODE_EXTRA_BODY", json(extraBody));

    return {
      ...selected,
      provider: "glm",
      command: "cc-glm",
      display: "GLM Coding",
      models,
      opus: get("GLM_OPUS", opus),
      sonnet: get("GLM_SONNET", sonnet),
      haiku: get("GLM_HAIKU", haiku),
      fast: get("GLM_FAST", get("GLM_HAIKU", haiku)),
      subagent: get("GLM_SUBAGENT", "glm-4.5-air"),
      patchMarker: "GLM Coding",
      promptFile: join(home, "prompts", "glm-proactive-tools.md"),
      authLabel: "GLM_API_KEY/ZAI_API_KEY/BIGMODEL_API_KEY",
      authValue: get("ANTHROPIC_AUTH_TOKEN"),
    };
  },

  kimi(argv, ctx) {
    const home = setupProviderHome(ctx.realHome, "kimi");
    set("ANTHROPIC_BASE_URL", "https://api.kimi.com/coding/");
    set("ANTHROPIC_API_KEY", get("KIMI_API_KEY"));
    unset("ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_BASE");
    const models = ["kimi-for-coding"];
    const selected = withModelArg(argv, "KIMI_MODEL", "kimi-for-coding");
    if (get("KIMI_NO_CACHE").length > 0) set("DISABLE_PROMPT_CACHING", "1");
    set("CLAUDE_CODE_MAX_OUTPUT_TOKENS", get("KIMI_MAX_OUTPUT", "65535"));
    if (get("KIMI_SAFETY").length > 0)
      set(
        "CLAUDE_CODE_EXTRA_METADATA",
        json({ safety_level: get("KIMI_SAFETY") }),
      );
    if (get("KIMI_THINKING_BUDGET").length > 0)
      set("MAX_THINKING_TOKENS", get("KIMI_THINKING_BUDGET"));
    return {
      ...selected,
      provider: "kimi",
      command: "cc-kimi",
      display: "Kimi Coding",
      models,
      opus: selected.model,
      sonnet: selected.model,
      haiku: selected.model,
      fast: selected.model,
      subagent: selected.model,
      patchMarker: "Kimi Coding",
      promptFile: join(home, "prompts", "kimi-proactive-tools.md"),
      authLabel: "KIMI_API_KEY",
      authValue: get("KIMI_API_KEY"),
    };
  },

  longcat(argv, ctx) {
    const home = setupProviderHome(ctx.realHome, "longcat");
    if (get("LONGCAT_API_KEY").length === 0) {
      const result = spawnSync(
        "zsh",
        ["-lic", 'printf %s "$LONGCAT_API_KEY"'],
        {
          env: { ...env, HOME: ctx.realHome },
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      if (result.status === 0 && result.stdout.length > 0)
        set("LONGCAT_API_KEY", result.stdout);
    }
    set("ANTHROPIC_BASE_URL", "https://api.longcat.chat/anthropic");
    set("ANTHROPIC_AUTH_TOKEN", get("LONGCAT_API_KEY"));
    unset("ANTHROPIC_API_KEY", "ANTHROPIC_API_BASE");
    const models = [
      "LongCat-2.0-Preview",
      "LongCat-Flash-Chat",
      "LongCat-Flash-Lite",
      "LongCat-Flash-Thinking",
      "LongCat-Flash-Thinking-2601",
    ];
    const profile = get("LONGCAT_PROFILE", "agent");
    const table = {
      fast: [
        "LongCat-Flash-Lite",
        "LongCat-2.0-Preview",
        "LongCat-Flash-Lite",
        "LongCat-Flash-Lite",
      ],
      lite: [
        "LongCat-Flash-Lite",
        "LongCat-2.0-Preview",
        "LongCat-Flash-Lite",
        "LongCat-Flash-Lite",
      ],
      stable: [
        "LongCat-Flash-Chat",
        "LongCat-2.0-Preview",
        "LongCat-Flash-Chat",
        "LongCat-Flash-Lite",
      ],
      chat: [
        "LongCat-Flash-Chat",
        "LongCat-2.0-Preview",
        "LongCat-Flash-Chat",
        "LongCat-Flash-Lite",
      ],
      thinking: [
        "LongCat-Flash-Thinking-2601",
        "LongCat-Flash-Thinking-2601",
        "LongCat-Flash-Thinking-2601",
        "LongCat-Flash-Lite",
      ],
      agent: [
        "LongCat-2.0-Preview",
        "LongCat-2.0-Preview",
        "LongCat-2.0-Preview",
        "LongCat-Flash-Lite",
      ],
    };
    const [def, opus, sonnet, haiku] = table[profile] ?? table.agent;
    const selected = withModelArg(argv, "LONGCAT_MODEL", def);
    if (get("LONGCAT_ENABLE_THINKING").length === 0 && profile !== "thinking") {
      set("MAX_THINKING_TOKENS", "0");
      set("CLAUDE_CODE_DISABLE_THINKING", "1");
      set("ANTHROPIC_THINKING", "disabled");
    }
    set("DISABLE_PROMPT_CACHING", "1");
    set("API_TIMEOUT_MS", get("LONGCAT_API_TIMEOUT_MS", "3000000"));
    const maxByModel =
      selected.model === "LongCat-2.0-Preview"
        ? "64000"
        : selected.model === "LongCat-Flash-Chat"
          ? "131072"
          : "262144";
    set("CLAUDE_CODE_MAX_OUTPUT_TOKENS", get("LONGCAT_MAX_OUTPUT", maxByModel));
    return {
      ...selected,
      provider: "longcat",
      command: "cc-longcat",
      display: "LongCat Code",
      models,
      opus: get("LONGCAT_OPUS", opus),
      sonnet: get("LONGCAT_SONNET", sonnet),
      haiku: get("LONGCAT_HAIKU", haiku),
      fast: get("LONGCAT_FAST", get("LONGCAT_HAIKU", haiku)),
      subagent: get("LONGCAT_SUBAGENT", get("LONGCAT_SONNET", sonnet)),
      patchMarker: "LongCat Code",
      promptFile: join(home, "prompts", "longcat-proactive-tools.md"),
      authLabel: "LONGCAT_API_KEY",
      authValue: get("ANTHROPIC_AUTH_TOKEN"),
    };
  },

  mimo(argv, ctx) {
    const home = setupProviderHome(ctx.realHome, "mimo");
    const region = get("MIMO_REGION", "sgp");
    const baseUrls = {
      cn: "https://token-plan-cn.xiaomimimo.com/anthropic",
      ams: "https://token-plan-ams.xiaomimimo.com/anthropic",
      public: "https://api.mimo-v2.com/anthropic",
      official: "https://api.xiaomimimo.com/anthropic",
      sgp: "https://token-plan-sgp.xiaomimimo.com/anthropic",
    };
    set(
      "ANTHROPIC_BASE_URL",
      get("MIMO_BASE_URL", baseUrls[region] ?? baseUrls.sgp),
    );
    set("ANTHROPIC_AUTH_TOKEN", pick("MIMO_API_KEY", "XIAOMI_API_KEY"));
    unset("ANTHROPIC_API_KEY", "ANTHROPIC_API_BASE");

    const profile = get("MIMO_PROFILE");
    const wantsV25 = ["latest", "v25", "multimodal"].includes(profile)
      ? "1"
      : get("MIMO_ENABLE_V25", "1");
    let models;
    let fast;
    if (region === "public") {
      models = [
        "mimo-v2.5-pro",
        "mimo-v2.5",
        "mimo-v2-pro",
        "mimo-v2-flash",
        "mimo-v2-omni",
      ];
      fast = "mimo-v2-flash";
    } else if (wantsV25 === "1" && get("MIMO_ENABLE_FLASH", "0") === "1") {
      models = [
        "mimo-v2.5-pro",
        "mimo-v2.5",
        "mimo-v2-pro",
        "mimo-v2-flash",
        "mimo-v2-omni",
      ];
      fast = "mimo-v2-pro";
    } else if (wantsV25 === "1") {
      models = ["mimo-v2.5-pro", "mimo-v2.5", "mimo-v2-pro", "mimo-v2-omni"];
      fast = "mimo-v2-pro";
    } else if (get("MIMO_ENABLE_FLASH", "0") === "1") {
      models = ["mimo-v2-pro", "mimo-v2-flash", "mimo-v2-omni"];
      fast = "mimo-v2-pro";
    } else {
      models = ["mimo-v2-pro", "mimo-v2-omni"];
      fast = "mimo-v2-pro";
    }

    let def;
    let opus;
    let sonnet;
    let haiku;
    if (profile === "latest" || profile === "v25") {
      def = "mimo-v2.5-pro";
      opus = "mimo-v2.5-pro";
      sonnet = "mimo-v2.5-pro";
      haiku = fast;
    } else if (profile === "multimodal" || profile === "omni") {
      if (region === "public" || get("MIMO_ENABLE_V25", "0") === "1") {
        def = "mimo-v2.5";
        opus = "mimo-v2.5-pro";
        sonnet = "mimo-v2.5";
      } else {
        def = "mimo-v2-omni";
        opus = "mimo-v2-pro";
        sonnet = "mimo-v2-omni";
      }
      haiku = fast;
    } else if (profile === "fast" || profile === "flash") {
      def = fast;
      opus = "mimo-v2-pro";
      sonnet = fast;
      haiku = fast;
    } else {
      def = "mimo-v2.5-pro";
      opus = "mimo-v2.5-pro";
      sonnet = "mimo-v2.5";
      haiku = fast;
    }
    const selected = withModelArg(argv, "MIMO_MODEL", def);
    set(
      "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
      get(
        "MIMO_MAX_OUTPUT",
        selected.model.includes("flash") ? "64000" : "128000",
      ),
    );
    set("ANTHROPIC_BETAS", "");
    set("DISABLE_PROMPT_CACHING", "1");
    if (
      get("MIMO_ENABLE_THINKING", "0") === "1" ||
      get("MIMO_THINKING_BUDGET").length > 0
    ) {
      if (get("MIMO_THINKING_BUDGET").length > 0)
        set("MAX_THINKING_TOKENS", get("MIMO_THINKING_BUDGET"));
    } else {
      set("MAX_THINKING_TOKENS", "0");
      set("CLAUDE_CODE_DISABLE_THINKING", "1");
      set("ANTHROPIC_THINKING", "disabled");
      set("CLAUDE_CODE_EXTRA_BODY", json({ thinking: { type: "disabled" } }));
      unset("CLAUDE_CODE_ENABLE_THINKING");
    }
    if (get("MIMO_REASONING").length > 0)
      set("CLAUDE_CODE_EFFORT_LEVEL", get("MIMO_REASONING"));
    const headers = [];
    if (get("MIMO_SAFETY").length > 0)
      headers.push(`x-mimo-safety: ${get("MIMO_SAFETY")}`);
    if (get("MIMO_WEB_SEARCH", "0") === "1")
      headers.push("x-mimo-use-search: true");
    if (headers.length > 0) set("ANTHROPIC_CUSTOM_HEADERS", headers.join("\n"));
    return {
      ...selected,
      provider: "mimo",
      command: "cc-mimo",
      display: "MiMo Coding",
      models,
      opus: get("MIMO_OPUS", opus),
      sonnet: get("MIMO_SONNET", sonnet),
      haiku: get("MIMO_HAIKU", haiku),
      fast: get("MIMO_FAST", get("MIMO_HAIKU", haiku)),
      subagent: get("MIMO_SUBAGENT", get("MIMO_SONNET", sonnet)),
      patchMarker: "MiMo Coding",
      promptFile: join(home, "prompts", "mimo-proactive-tools.md"),
      authLabel:
        get("MIMO_API_KEY").length > 0 ? "MIMO_API_KEY" : "XIAOMI_API_KEY",
      authValue: pick("MIMO_API_KEY", "XIAOMI_API_KEY"),
      postHook: [join(ctx.realHome, "bin", "mimo-usage"), ["--update"]],
    };
  },

  minimax(argv, ctx) {
    const home = setupProviderHome(ctx.realHome, "minimax");
    const baseUrl = ["global", "intl", "io"].includes(
      get("MINIMAX_REGION", "cn"),
    )
      ? "https://api.minimax.io/anthropic"
      : "https://api.minimaxi.com/anthropic";
    set("ANTHROPIC_BASE_URL", get("MINIMAX_BASE_URL", baseUrl));
    set("ANTHROPIC_AUTH_TOKEN", get("MINIMAX_API_KEY"));
    unset("ANTHROPIC_API_KEY", "ANTHROPIC_API_BASE");
    const models = [
      "MiniMax-M3",
      "MiniMax-M2.7",
      "MiniMax-M2.7-highspeed",
      "MiniMax-M2.5",
      "MiniMax-M2.5-highspeed",
      "MiniMax-M2.1",
      "MiniMax-M2.1-highspeed",
      "MiniMax-M2",
    ];
    const profile = get("MINIMAX_PROFILE", "stable");
    const table = {
      highspeed: [
        "MiniMax-M2.7-highspeed",
        "MiniMax-M2.7",
        "MiniMax-M2.7-highspeed",
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.7-highspeed",
      ],
      payg: [
        "MiniMax-M2.7-highspeed",
        "MiniMax-M2.7",
        "MiniMax-M2.7-highspeed",
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.7-highspeed",
      ],
      cheap: [
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.7",
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.5-highspeed",
      ],
      lite: [
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.7",
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.5-highspeed",
      ],
      stable: [
        "MiniMax-M3",
        "MiniMax-M3",
        "MiniMax-M2.7",
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.7",
      ],
      token: [
        "MiniMax-M3",
        "MiniMax-M3",
        "MiniMax-M2.7",
        "MiniMax-M2.5-highspeed",
        "MiniMax-M2.7",
      ],
    };
    const [def, opus, sonnet, haiku, sub] = table[profile] ?? table.stable;
    const selected = withModelArg(argv, "MINIMAX_MODEL", def, (value) => {
      if (value.startsWith("MiniMax-")) return value;
      if (value.startsWith("M")) return `MiniMax-${value}`;
      if (/^[0-9]/u.test(value)) return `MiniMax-M${value}`;
      return value;
    });
    set("CLAUDE_CODE_MAX_OUTPUT_TOKENS", get("MINIMAX_MAX_OUTPUT", "64000"));
    set("CLAUDE_CODE_MAX_RETRIES", get("MINIMAX_MAX_RETRIES", "5"));
    if (get("MINIMAX_THINKING_BUDGET").length > 0)
      set("MAX_THINKING_TOKENS", get("MINIMAX_THINKING_BUDGET"));
    const extraBody = {};
    if (get("MINIMAX_PARALLEL_TOOLS", "0") === "1")
      extraBody.parallel_tool_calls = true;
    if (get("MINIMAX_TEMPERATURE").length > 0)
      extraBody.temperature = Number(get("MINIMAX_TEMPERATURE"));
    if (Object.keys(extraBody).length > 0)
      set("CLAUDE_CODE_EXTRA_BODY", json(extraBody));
    return {
      ...selected,
      provider: "minimax",
      command: "cc-minimax",
      display: "MiniMax Coding",
      models,
      opus: get("MINIMAX_OPUS", opus),
      sonnet: get("MINIMAX_SONNET", sonnet),
      haiku: get("MINIMAX_HAIKU", haiku),
      fast: get("MINIMAX_FAST", get("MINIMAX_HAIKU", haiku)),
      subagent: get("MINIMAX_SUBAGENT", sub),
      patchMarker: "MiniMax Coding",
      promptFile: join(home, "prompts", "minimax-proactive-tools.md"),
      authLabel: "MINIMAX_API_KEY",
      authValue: get("MINIMAX_API_KEY"),
    };
  },

  qwen(argv, ctx) {
    const home = setupProviderHome(ctx.realHome, "qwen");
    set(
      "ANTHROPIC_AUTH_TOKEN",
      pick("DASHSCOPE_API_KEY", "QWEN_API_KEY", "BAILIAN_API_KEY"),
    );
    unset("ANTHROPIC_API_KEY", "ANTHROPIC_API_BASE");
    const models = [
      "qwen3-coder-plus",
      "qwen3-coder-next",
      "qwen3-coder-flash",
      "qwen3-coder-480b-a35b-instruct",
      "qwen3.7-max",
      "qwen3.7-plus",
      "qwen3.6-plus",
      "qwen3.6-flash",
      "qwen3.5-plus",
      "qwen3.5-flash",
      "qwen3-max",
      "qwen3-235b-a22b-instruct-2507",
      "qwen3-30b-a3b-instruct-2507",
    ];
    const profile = get("QWEN_PROFILE", "coder");
    const table = {
      coding: [
        "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic",
        "qwen3.6-plus",
        "qwen3.6-plus",
        "qwen3.6-plus",
        "qwen3.6-plus",
      ],
      "coding-plan": [
        "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic",
        "qwen3.6-plus",
        "qwen3.6-plus",
        "qwen3.6-plus",
        "qwen3.6-plus",
      ],
      plan: [
        "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic",
        "qwen3.6-plus",
        "qwen3.6-plus",
        "qwen3.6-plus",
        "qwen3.6-plus",
      ],
      token: [
        "https://token-plan.ap-southeast-1.maas.aliyuncs.com/apps/anthropic",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.6-flash",
      ],
      "token-plan": [
        "https://token-plan.ap-southeast-1.maas.aliyuncs.com/apps/anthropic",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.6-flash",
      ],
      team: [
        "https://token-plan.ap-southeast-1.maas.aliyuncs.com/apps/anthropic",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.6-flash",
      ],
      max: [
        "https://dashscope-intl.aliyuncs.com/apps/anthropic",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.6-flash",
      ],
      payg: [
        "https://dashscope-intl.aliyuncs.com/apps/anthropic",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.6-flash",
      ],
      intl: [
        "https://dashscope-intl.aliyuncs.com/apps/anthropic",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.7-max",
        "qwen3.6-flash",
      ],
      cheap: [
        "https://dashscope.aliyuncs.com/apps/anthropic",
        "qwen3-coder-flash",
        "qwen3-coder-next",
        "qwen3-coder-flash",
        "qwen3-coder-flash",
      ],
      flash: [
        "https://dashscope.aliyuncs.com/apps/anthropic",
        "qwen3-coder-flash",
        "qwen3-coder-next",
        "qwen3-coder-flash",
        "qwen3-coder-flash",
      ],
      coder: [
        "https://dashscope.aliyuncs.com/apps/anthropic",
        "qwen3-coder-next",
        "qwen3-coder-plus",
        "qwen3-coder-next",
        "qwen3-coder-flash",
      ],
    };
    const [baseUrl, def, opus, sonnet, haiku] = table[profile] ?? table.coder;
    set("ANTHROPIC_BASE_URL", get("QWEN_BASE_URL", baseUrl));
    const selected = withModelArg(argv, "QWEN_MODEL", def);
    set("CLAUDE_CODE_MAX_OUTPUT_TOKENS", get("QWEN_MAX_OUTPUT", "65536"));
    const thinking = get("QWEN_ENABLE_THINKING");
    if (isTruthy(thinking))
      set("CLAUDE_CODE_EXTRA_BODY", json({ enable_thinking: true }));
    else if (isFalsy(thinking))
      set("CLAUDE_CODE_EXTRA_BODY", json({ enable_thinking: false }));
    return {
      ...selected,
      provider: "qwen",
      command: "cc-qwen",
      display: "Qwen Coding",
      models,
      opus: get("QWEN_OPUS", opus),
      sonnet: get("QWEN_SONNET", sonnet),
      haiku: get("QWEN_HAIKU", haiku),
      fast: get("QWEN_FAST", get("QWEN_HAIKU", haiku)),
      subagent: get("QWEN_SUBAGENT", get("QWEN_SONNET", sonnet)),
      patchMarker: "Qwen Coding",
      promptFile: join(home, "prompts", "qwen-proactive-tools.md"),
      authLabel: "DASHSCOPE_API_KEY/QWEN_API_KEY/BAILIAN_API_KEY",
      authValue: get("ANTHROPIC_AUTH_TOKEN"),
    };
  },

  stepfun(argv, ctx) {
    const home = setupProviderHome(ctx.realHome, "stepfun");
    set(
      "ANTHROPIC_BASE_URL",
      get("STEPFUN_BASE_URL", "https://api.stepfun.com/step_plan"),
    );
    set("ANTHROPIC_AUTH_TOKEN", pick("STEPFUN_API_KEY", "STEP_API_KEY"));
    unset("ANTHROPIC_API_KEY", "ANTHROPIC_API_BASE");
    const models = [
      "step-3.7-flash",
      "step-3.5-flash-2603",
      "step-3.5-flash",
      "step-router-v1",
    ];
    const profile = get("STEPFUN_PROFILE", "reasoning");
    const table = {
      router: [
        "step-router-v1",
        "step-router-v1",
        "step-router-v1",
        "step-3.5-flash",
      ],
      fast: [
        "step-3.5-flash",
        "step-3.5-flash-2603",
        "step-3.5-flash",
        "step-3.5-flash",
      ],
      flash: [
        "step-3.5-flash",
        "step-3.5-flash-2603",
        "step-3.5-flash",
        "step-3.5-flash",
      ],
      reasoning: [
        "step-3.7-flash",
        "step-3.7-flash",
        "step-3.5-flash-2603",
        "step-3.5-flash",
      ],
    };
    const [def, opus, sonnet, haiku] = table[profile] ?? table.reasoning;
    const selected = withModelArg(argv, "STEPFUN_MODEL", def);
    set("CLAUDE_CODE_MAX_OUTPUT_TOKENS", get("STEPFUN_MAX_OUTPUT", "65536"));
    const reasoning = get("STEPFUN_REASONING");
    if (reasoning === "low" || reasoning === "high") {
      set("CLAUDE_CODE_EFFORT_LEVEL", reasoning);
      if (
        selected.model === "step-3.5-flash-2603" ||
        get("STEPFUN_FORCE_EFFORT", "0") === "1"
      ) {
        set(
          "CLAUDE_CODE_EXTRA_BODY",
          json({ output_config: { effort: reasoning } }),
        );
      } else {
        console.error(
          `[cc-stepfun] ⚠️  output_config.effort only takes effect on step-3.5-flash-2603; not injecting for current ${selected.model}`,
        );
      }
    } else if (reasoning === "none") {
      set("MAX_THINKING_TOKENS", "0");
      set("CLAUDE_CODE_DISABLE_THINKING", "1");
      set("CLAUDE_CODE_EFFORT_LEVEL", "none");
      set("CLAUDE_CODE_EXTRA_BODY", json({ thinking: { type: "disabled" } }));
    } else if (reasoning.length > 0) {
      console.error(
        "[cc-stepfun] ⚠️  STEPFUN_REASONING only supports low/high/none",
      );
    }
    if (get("STEPFUN_NO_THINKING", "0") === "1") {
      set("MAX_THINKING_TOKENS", "0");
      set("CLAUDE_CODE_DISABLE_THINKING", "1");
      set("CLAUDE_CODE_EFFORT_LEVEL", "none");
      set("CLAUDE_CODE_EXTRA_BODY", json({ thinking: { type: "disabled" } }));
    }
    return {
      ...selected,
      provider: "stepfun",
      command: "cc-stepfun",
      display: "Step Coding",
      models,
      opus: get("STEPFUN_OPUS", opus),
      sonnet: get("STEPFUN_SONNET", sonnet),
      haiku: get("STEPFUN_HAIKU", haiku),
      fast: get("STEPFUN_FAST", get("STEPFUN_HAIKU", haiku)),
      subagent: get("STEPFUN_SUBAGENT", get("STEPFUN_SONNET", sonnet)),
      patchMarker: "Step Coding",
      promptFile: join(home, "prompts", "stepfun-proactive-tools.md"),
      authLabel: "STEPFUN_API_KEY/STEP_API_KEY",
      authValue: get("ANTHROPIC_AUTH_TOKEN"),
    };
  },
};

const jsonOptions = (models, descriptionPrefix, valuePrefix = "") =>
  models.map((model) => ({
    value: `${valuePrefix}${model}`,
    label: model,
    description: `${descriptionPrefix} · ${model}`,
  }));

const resetPlugins = () => {
  const plugDir = join(get("HOME"), ".claude", "plugins");
  if (!existsSync(plugDir)) return;
  try {
    writeFileSync(
      join(plugDir, "installed_plugins.json"),
      '{"version":2,"plugins":{}}\n',
    );
    writeFileSync(join(plugDir, "known_marketplaces.json"), "{}\n");
  } catch {
    // Best-effort parity with the former launcher.
  }
  for (const sub of ["cache", "marketplaces"]) {
    const dir = join(plugDir, sub);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      if (entry === "claude-plugins-official") continue;
      rmSync(join(dir, entry), { recursive: true, force: true });
    }
  }
};

const syncAvailableModels = (models) => {
  if (models.length === 0) return;
  const file = join(get("HOME"), ".claude", "settings.json");
  let data = {};
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
    if (typeof data !== "object" || data === null || Array.isArray(data))
      data = {};
  } catch {
    data = {};
  }
  if (JSON.stringify(data.availableModels) === JSON.stringify(models)) return;
  data.availableModels = models;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

const cliPath = () => {
  const nativeCli = join(
    get("HOME"),
    "opt",
    "node_modules",
    "@anthropic-ai",
    "claude-code",
    "bin",
    "claude.exe",
  );
  if (existsSync(nativeCli)) return nativeCli;
  return join(
    get("HOME"),
    "opt",
    "node_modules",
    "@anthropic-ai",
    "claude-code",
    "cli.js",
  );
};

const usage = (state) => {
  const defaultModel = state.model || get("MODEL");
  console.error(`Usage: ${state.command} [options] [claude-code args...]

Options:
  -l, --list           List configured models
  -m, --model MODEL    Pick the startup model
  --doctor             Check launcher config without starting Claude Code
  --env                Print non-secret runtime environment
  -h, --help           Show this help

Default model: ${defaultModel || "unknown"}`);
};

const printEnv = () => {
  const keys = Object.keys(env).sort();
  for (const key of keys) {
    if (!/^(ANTHROPIC_|CLAUDE_CODE_|MAX_|API_TIMEOUT_MS|BASH_)/u.test(key))
      continue;
    if (key === "ANTHROPIC_API_KEY" || key === "ANTHROPIC_AUTH_TOKEN")
      console.log(`${key}=<redacted>`);
    else console.log(`${key}=${env[key] ?? ""}`);
  }
};

const validJsonStatus = (name, label) => {
  const value = get(name);
  if (value.length === 0) return true;
  try {
    JSON.parse(value);
    console.log(`  ${label}: ok`);
    return true;
  } catch {
    console.log(`  ${label}: invalid JSON (${name})`);
    return false;
  }
};

const doctor = (state) => {
  let ok = true;
  const cli = get("CC_MODEL_CLI");
  console.log(`${state.command} doctor`);
  console.log(`  provider: ${state.provider}`);
  console.log(`  home:     ${get("HOME") || "unknown"}`);
  console.log(`  endpoint: ${get("ANTHROPIC_BASE_URL") || "unknown"}`);
  console.log(`  model:    ${state.model || "unknown"}`);
  if (get("ANTHROPIC_DEFAULT_OPUS_MODEL").length > 0)
    console.log(`  opus:     ${get("ANTHROPIC_DEFAULT_OPUS_MODEL")}`);
  if (get("ANTHROPIC_DEFAULT_SONNET_MODEL").length > 0)
    console.log(`  sonnet:   ${get("ANTHROPIC_DEFAULT_SONNET_MODEL")}`);
  if (get("ANTHROPIC_DEFAULT_HAIKU_MODEL").length > 0)
    console.log(`  haiku:    ${get("ANTHROPIC_DEFAULT_HAIKU_MODEL")}`);
  if (get("ANTHROPIC_SMALL_FAST_MODEL").length > 0)
    console.log(`  fast:     ${get("ANTHROPIC_SMALL_FAST_MODEL")}`);
  if (get("CLAUDE_CODE_SUBAGENT_MODEL").length > 0)
    console.log(`  subagent: ${get("CLAUDE_CODE_SUBAGENT_MODEL")}`);
  if (get("CLAUDE_CODE_MAX_OUTPUT_TOKENS").length > 0)
    console.log(`  max_out:  ${get("CLAUDE_CODE_MAX_OUTPUT_TOKENS")}`);
  if (
    get("CLAUDE_CODE_DISABLE_THINKING").length > 0 ||
    get("MAX_THINKING_TOKENS").length > 0
  ) {
    const thinking =
      get("CLAUDE_CODE_DISABLE_THINKING", "0") === "1" ||
      get("MAX_THINKING_TOKENS") === "0"
        ? "disabled"
        : "enabled";
    console.log(
      `  thinking: ${thinking} / max=${get("MAX_THINKING_TOKENS", "default")}`,
    );
  }
  console.log(
    `  auth:     ${state.authLabel || "api key"} = ${state.authValue ? "set" : "missing"}`,
  );

  try {
    const settings = JSON.parse(
      readFileSync(join(get("HOME"), ".claude", "settings.json"), "utf8"),
    );
    const count = Array.isArray(settings.availableModels)
      ? settings.availableModels.length
      : -1;
    if (count > 0)
      console.log(
        `  models:   ${count} selectable via '/model <name>' or -m (picker shows default+tiers only)`,
      );
    else
      console.log(
        `  models:   availableModels not synced — run cc-${state.provider} once`,
      );
  } catch {
    console.log(
      `  models:   availableModels not synced — run cc-${state.provider} once`,
    );
  }

  if (!validJsonStatus("CLAUDE_CODE_EXTRA_BODY", "extra_body")) ok = false;
  if (!validJsonStatus("CLAUDE_CODE_EXTRA_METADATA", "metadata")) ok = false;

  if (cli.length > 0 && existsSync(cli)) {
    console.log(`  cli:      ok (${cli})`);
    if (state.patchMarker && !cli.endsWith("claude.exe")) {
      const text = readFileSync(cli, "utf8");
      if (text.includes(state.patchMarker))
        console.log(`  patch:    ok (${state.patchMarker})`);
      else {
        console.log(`  patch:    missing marker (${state.patchMarker})`);
        ok = false;
      }
    }
  } else {
    console.log(`  cli:      missing (${cli || "unset"})`);
    ok = false;
  }

  if (state.promptFile) {
    console.log(
      existsSync(state.promptFile)
        ? `  prompt:   ok (${state.promptFile})`
        : `  prompt:   absent (${state.promptFile})`,
    );
  }
  return ok ? 0 : 1;
};

const applyCommonEnv = (state) => {
  set(
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS",
    get("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "1"),
  );
  set("ANTHROPIC_MODEL", state.model);
  set("ANTHROPIC_CUSTOM_MODEL_OPTION", state.model);
  set("ANTHROPIC_CUSTOM_MODEL_OPTION_NAME", state.model);
  set(
    "ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION",
    `${state.display || state.provider} · ${state.model}`,
  );
  set(
    "ANTHROPIC_CUSTOM_MODEL_OPTIONS_JSON",
    json(jsonOptions(state.models, state.display || state.provider)),
  );
  set("ANTHROPIC_DEFAULT_OPUS_MODEL", state.opus || state.model);
  set("ANTHROPIC_DEFAULT_SONNET_MODEL", state.sonnet || state.model);
  set("ANTHROPIC_DEFAULT_HAIKU_MODEL", state.haiku || state.model);
  set("ANTHROPIC_SMALL_FAST_MODEL", state.fast || state.haiku || state.model);
  set(
    "CLAUDE_CODE_SUBAGENT_MODEL",
    state.subagent || state.sonnet || state.model,
  );
  set("ENABLE_TOOL_SEARCH", get("ENABLE_TOOL_SEARCH", "false"));
  set(
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    get("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1"),
  );
  set("DISABLE_TELEMETRY", get("DISABLE_TELEMETRY", "1"));
  set("DISABLE_ERROR_REPORTING", get("DISABLE_ERROR_REPORTING", "1"));
  set("DISABLE_BUG_COMMAND", get("DISABLE_BUG_COMMAND", "1"));
  set("DISABLE_AUTOUPDATER", get("DISABLE_AUTOUPDATER", "1"));
  set("MAX_MCP_OUTPUT_TOKENS", get("MAX_MCP_OUTPUT_TOKENS", "25000"));
  set("API_TIMEOUT_MS", get("API_TIMEOUT_MS", "3000000"));
  set("BASH_DEFAULT_TIMEOUT_MS", get("BASH_DEFAULT_TIMEOUT_MS", "600000"));
  set("BASH_MAX_TIMEOUT_MS", get("BASH_MAX_TIMEOUT_MS", "1200000"));
  set("CC_MODEL_SELECTED", state.model);
  set("CC_MODEL_CLI", cliPath());
};

const handleCommonCommand = (state) => {
  const first = state.args[0] ?? "";
  if (first === "-h" || first === "--help") {
    usage(state);
    process.exit(0);
  }
  if (first === "--doctor" || first === "doctor") process.exit(doctor(state));
  if (first === "--env") {
    printEnv();
    process.exit(0);
  }
  syncAvailableModels(state.models);
};

const launch = (state, ctx) => {
  const cli = get("CC_MODEL_CLI");
  const tag = state.command;
  if (!existsSync(cli)) {
    console.error(`[${tag}] ❌ Claude Code executable does not exist: ${cli}`);
    console.error(
      `      first: cd ${get("HOME")}/opt && npm install @anthropic-ai/claude-code`,
    );
    process.exit(1);
  }
  if (!cli.endsWith("claude.exe") && state.patchMarker) {
    const text = readFileSync(cli, "utf8");
    if (!text.includes(state.patchMarker)) {
      const patch = join(
        ctx.realHome,
        "bin",
        `apply-${state.provider}-patch.sh`,
      );
      const result = spawnSync(patch, { stdio: "inherit" });
      if (result.status !== 0) {
        console.error(`[${tag}] patch failed`);
        process.exit(1);
      }
    }
  }

  resetPlugins();
  console.error(
    `[${tag}] model=${state.model}  (opus→${get("ANTHROPIC_DEFAULT_OPUS_MODEL")} sonnet→${get("ANTHROPIC_DEFAULT_SONNET_MODEL")} haiku→${get("ANTHROPIC_DEFAULT_HAIKU_MODEL")})  endpoint=${get("ANTHROPIC_BASE_URL")}`,
  );
  if (!state.authValue)
    console.error(`[${tag}] ⚠️  ${state.authLabel || "API key"} not set`);

  const extra = [];
  if (state.promptFile && existsSync(state.promptFile)) {
    extra.push(
      "--append-system-prompt",
      readFileSync(state.promptFile, "utf8"),
    );
  }
  const result = spawnSync(cli, [...extra, ...state.args], {
    stdio: "inherit",
    env,
  });
  if (state.postHook && existsSync(state.postHook[0])) {
    spawnSync(state.postHook[0], state.postHook[1], { stdio: "ignore", env });
  }
  process.exit(result.status ?? 1);
};

export const launchProvider = (provider, argv) => {
  const configure = configs[provider];
  if (configure === undefined) {
    console.error(`unknown provider: ${provider}`);
    process.exit(2);
  }
  const realHome = get("REAL_HOME", get("HOME"));
  if (realHome.length === 0) {
    console.error("HOME is not set");
    process.exit(2);
  }
  sourceSecrets(realHome);
  const ctx = { binDir, realHome };
  const state = configure(argv, ctx);
  if (state.args[0] === "-l" || state.args[0] === "--list") {
    console.log(state.models.join("\n"));
    process.exit(0);
  }
  applyCommonEnv(state);
  handleCommonCommand(state);
  launch(state, ctx);
};
