import path from "node:path";

const forbidden = {
  core: ["adapters", "server", "app", "worker"],
  adapters: ["server", "app", "worker"],
  server: ["app", "worker"],
  app: ["adapters"],
  worker: ["adapters"]
};

function targetCategory(filename) {
  const normalized = filename.replaceAll("\\", "/");
  for (const category of Object.keys(forbidden)) if (normalized.includes(`/src/${category}/`) || normalized.includes(`/${category}/`)) return category;
  return null;
}

function namesForbidden(source, category) {
  const normalized = source.replaceAll("\\", "/").replace(/^@\//, "");
  return forbidden[category]?.some((name) => normalized.split("/").includes(name)) ?? false;
}

export const noForbiddenRuntimeImports = {
  meta: { type: "problem", schema: [], docs: { description: "enforce prebuild runtime dependency directions" }, messages: { forbidden: "{{from}} runtime code cannot import {{source}} directly; use the allowed lower layer." } },
  create(context) {
    const category = targetCategory(context.filename);
    if (!category) return {};
    const check = (node) => { const source = node.source?.value; if (typeof source === "string" && namesForbidden(source, category)) context.report({ node: node.source, messageId: "forbidden", data: { from: category, source } }); };
    return { ImportDeclaration: check, ExportNamedDeclaration: check, ExportAllDeclaration: check };
  }
};
