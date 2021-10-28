/** @format */
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const fs = require("fs");
const { Project } = require("ts-morph");
const { camelCase, set, uniqueId, xor } = require("lodash");
const argv = yargs(hideBin(process.argv)).argv;

const createModuleDefinitionFile = (project, moduleList) => {
  const temporaryFile = project.createSourceFile(
    `${project.getDirectories()[0].getPath()}/temp.ts`,
    moduleList.reduce((carry, library) => {
      return (
        carry +
        "import " +
        camelCase(library.split("/")[1]) +
        ' from "' +
        library +
        '";\n'
      );
    }, "")
  );
  project.resolveSourceFileDependencies();
  return temporaryFile;
};

const resolveSymbolName = (reference) => {
  let symbolType = "Identifier";
  const symbol = reference.getType().getSymbol();
  if (symbol && symbol.getName() !== "__type") {
    symbolType = symbol.getName();
  }
  return symbolType;
};

const isDuplicateRef = (kind) =>
  ["JsxClosingElement", "ImportSpecifier", "NamedImports"].includes(kind);

const isOmittedPath = (path) =>
  path.some((path) => path.includes("node_modules"));

const findModuleUsage = (file, includeExports) => {
  const data = {
    exports: {},
    references: {},
  };
  file.getImportDeclarations().forEach((declaration) => {
    const packageName = declaration.getModuleSpecifierValue();
    const defaultImport = declaration.getDefaultImport();
    if (!defaultImport) return;

    const type = defaultImport.getType();

    for (const property of type.getProperties()) {
      const name = property.getName();
      const exportId = uniqueId("export-");

      set(data, ["exports", exportId], {
        id: exportId,
        packageName,
        name,
      });

      const node = property.getValueDeclaration();

      if (node && node.findReferencesAsNodes) {
        node.findReferencesAsNodes().forEach((ref) => {
          const meta = {
            name,
            exportId,
            path: ref.getSourceFile().getFilePath(),
            id: uniqueId("ref-"),
            kind: ref.getParent().getKindName(),
            start: ref.getPos(),
            end: ref.getEnd(),
          };

          if (isOmittedPath(meta.path) || isDuplicateRef(meta.kind)) {
            return;
          }

          if (meta.kind === "JsxOpeningElement") {
            const sharedNode = ref.getParent().getParent();
            meta.kind = sharedNode.getKindName();
            meta.start = sharedNode.getPos();
            meta.end = sharedNode.getEnd();
          }

          set(data, ["references", meta.id], {
            ...meta,
            symbol: resolveSymbolName(ref),
          });
        });
      }
    }
  });

  if (includeExports) {
    return data;
  }

  return data.references;
};

const checkAllModules = () => {
  const { target, scope, outFile, includeExports = false } = argv;

  if (!target || !scope || !outFile) {
    console.warn("Invalid configuration");
    return;
  }

  const project = new Project({
    tsConfigFilePath: target,
  });

  const moduleReferences = findModuleUsage(
    createModuleDefinitionFile(project, scope.split(",")),
    includeExports
  );

  fs.writeFileSync(
    `${outFile}.json`,
    JSON.stringify(moduleReferences, undefined, 2)
  );
};

checkAllModules();
