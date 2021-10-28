#! /usr/bin/env node
/** @format */

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols);
  }
  return keys;
}

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(
          target,
          key,
          Object.getOwnPropertyDescriptor(source, key)
        );
      });
    }
  }
  return target;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  } else {
    obj[key] = value;
  }
  return obj;
}

function _createForOfIteratorHelper(o, allowArrayLike) {
  var it =
    (typeof Symbol !== "undefined" && o[Symbol.iterator]) || o["@@iterator"];
  if (!it) {
    if (
      Array.isArray(o) ||
      (it = _unsupportedIterableToArray(o)) ||
      (allowArrayLike && o && typeof o.length === "number")
    ) {
      if (it) o = it;
      var i = 0;
      var F = function F() {};
      return {
        s: F,
        n: function n() {
          if (i >= o.length) return { done: true };
          return { done: false, value: o[i++] };
        },
        e: function e(_e) {
          throw _e;
        },
        f: F,
      };
    }
    throw new TypeError(
      "Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."
    );
  }
  var normalCompletion = true,
    didErr = false,
    err;
  return {
    s: function s() {
      it = it.call(o);
    },
    n: function n() {
      var step = it.next();
      normalCompletion = step.done;
      return step;
    },
    e: function e(_e2) {
      didErr = true;
      err = _e2;
    },
    f: function f() {
      try {
        if (!normalCompletion && it["return"] != null) it["return"]();
      } finally {
        if (didErr) throw err;
      }
    },
  };
}

function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
    return _arrayLikeToArray(o, minLen);
}

function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }
  return arr2;
}

/** @format */
var yargs = require("yargs/yargs");

var _require = require("yargs/helpers"),
  hideBin = _require.hideBin;

var fs = require("fs");

var _require2 = require("ts-morph"),
  Project = _require2.Project;

var _require3 = require("lodash"),
  camelCase = _require3.camelCase,
  set = _require3.set,
  uniqueId = _require3.uniqueId;

var argv = yargs(hideBin(process.argv)).argv;

var createModuleDefinitionFile = function createModuleDefinitionFile(
  project,
  moduleList
) {
  var temporaryFile = project.createSourceFile(
    "".concat(project.getDirectories()[0].getPath(), "/temp.ts"),
    moduleList.reduce(function (carry, library) {
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

var resolveSymbolName = function resolveSymbolName(reference) {
  var symbolType = "Identifier";
  var symbol = reference.getType().getSymbol();

  if (symbol && symbol.getName() !== "__type") {
    symbolType = symbol.getName();
  }

  return symbolType;
};

var isDuplicateRef = function isDuplicateRef(kind) {
  return ["JsxClosingElement", "ImportSpecifier", "NamedImports"].includes(
    kind
  );
};

var isOmittedPath = function isOmittedPath(path) {
  return path.some(function (path) {
    return path.includes("node_modules");
  });
};

var findModuleUsage = function findModuleUsage(file, includeExports) {
  var data = {
    exports: {},
    references: {},
  };
  file.getImportDeclarations().forEach(function (declaration) {
    var packageName = declaration.getModuleSpecifierValue();
    var defaultImport = declaration.getDefaultImport();
    if (!defaultImport) return;
    var type = defaultImport.getType();

    var _iterator = _createForOfIteratorHelper(type.getProperties()),
      _step;

    try {
      var _loop = function _loop() {
        var property = _step.value;
        var name = property.getName();
        var exportId = uniqueId("export-");
        set(data, ["exports", exportId], {
          id: exportId,
          packageName: packageName,
          name: name,
        });
        var node = property.getValueDeclaration();

        if (node && node.findReferencesAsNodes) {
          node.findReferencesAsNodes().forEach(function (ref) {
            var meta = {
              name: name,
              exportId: exportId,
              path: ref.getSourceFile().getFilePath(),
              id: uniqueId("ref-"),
              kind: ref.getParent().getKindName(),
              start: ref.getPos(),
              end: ref.getEnd(),
            };

            if (isOmittedPath(meta.path) || isDuplicateRef(meta.kind)) {
              return;
            }

            if (kind === "JsxOpeningElement") {
              var sharedNode = ref.getParent().getParent();
              meta.kind = sharedNode.getKindName();
              meta.start = sharedNode.getPos();
              meta.end = sharedNode.getEnd();
            }

            set(
              data,
              ["references", meta.id],
              _objectSpread(
                _objectSpread({}, meta),
                {},
                {
                  symbol: resolveSymbolName(ref),
                }
              )
            );
          });
        }
      };

      for (_iterator.s(); !(_step = _iterator.n()).done; ) {
        _loop();
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
  });

  if (includeExports) {
    return data;
  }

  return data.references;
};

var checkAllModules = function checkAllModules() {
  var target = argv.target,
    scope = argv.scope,
    outFile = argv.outFile,
    _argv$includeExports = argv.includeExports,
    includeExports =
      _argv$includeExports === void 0 ? false : _argv$includeExports;

  if (!target || !scope || !outFile) {
    console.warn("Invalid configuration");
    return;
  }

  var project = new Project({
    tsConfigFilePath: target,
  });
  var moduleReferences = findModuleUsage(
    createModuleDefinitionFile(project, scope.split(",")),
    includeExports
  );
  fs.writeFileSync(
    "".concat(outFile, ".json"),
    JSON.stringify(moduleReferences, undefined, 2)
  );
};

checkAllModules();
