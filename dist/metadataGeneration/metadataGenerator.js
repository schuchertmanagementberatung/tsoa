'use strict';
var __values =
  (this && this.__values) ||
  function(o) {
    var s = typeof Symbol === 'function' && Symbol.iterator,
      m = s && o[s],
      i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === 'number')
      return {
        next: function() {
          if (o && i >= o.length) o = void 0;
          return { value: o && o[i++], done: !o };
        },
      };
    throw new TypeError(s ? 'Object is not iterable.' : 'Symbol.iterator is not defined.');
  };
Object.defineProperty(exports, '__esModule', { value: true });
var mm = require('minimatch');
var ts = require('typescript');
var importClassesFromDirectories_1 = require('../utils/importClassesFromDirectories');
var controllerGenerator_1 = require('./controllerGenerator');
var exceptions_1 = require('./exceptions');
var typeResolver_1 = require('./typeResolver');
var MetadataGenerator = /** @class */ (function() {
  function MetadataGenerator(entryFile, compilerOptions, ignorePaths, controllers) {
    this.compilerOptions = compilerOptions;
    this.ignorePaths = ignorePaths;
    this.nodes = new Array();
    this.referenceTypeMap = {};
    this.circularDependencyResolvers = new Array();
    typeResolver_1.TypeResolver.clearCache();
    this.program = !!controllers ? this.setProgramToDynamicControllersFiles(controllers) : ts.createProgram([entryFile], compilerOptions || {});
    this.typeChecker = this.program.getTypeChecker();
  }
  MetadataGenerator.prototype.IsExportedNode = function(node) {
    return true;
  };
  MetadataGenerator.prototype.Generate = function() {
    var _this = this;
    this.extractNodeFromProgramSourceFiles();
    var controllers = this.buildControllers();
    this.circularDependencyResolvers.forEach(function(c) {
      return c(_this.referenceTypeMap);
    });
    return {
      controllers: controllers,
      referenceTypeMap: this.referenceTypeMap,
    };
  };
  MetadataGenerator.prototype.setProgramToDynamicControllersFiles = function(controllers) {
    var allGlobFiles = importClassesFromDirectories_1.importClassesFromDirectories(controllers);
    if (allGlobFiles.length === 0) {
      throw new exceptions_1.GenerateMetadataError('[' + controllers.join(', ') + '] globs found 0 controllers.');
    }
    return ts.createProgram(allGlobFiles, this.compilerOptions || {});
  };
  MetadataGenerator.prototype.extractNodeFromProgramSourceFiles = function() {
    var _this = this;
    this.program.getSourceFiles().forEach(function(sf) {
      var e_1, _a;
      if (_this.ignorePaths && _this.ignorePaths.length) {
        try {
          for (var _b = __values(_this.ignorePaths), _c = _b.next(); !_c.done; _c = _b.next()) {
            var path = _c.value;
            if (mm(sf.fileName, path)) {
              return;
            }
          }
        } catch (e_1_1) {
          e_1 = { error: e_1_1 };
        } finally {
          try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
          } finally {
            if (e_1) throw e_1.error;
          }
        }
      }
      ts.forEachChild(sf, function(node) {
        _this.nodes.push(node);
      });
    });
  };
  MetadataGenerator.prototype.TypeChecker = function() {
    return this.typeChecker;
  };
  MetadataGenerator.prototype.AddReferenceType = function(referenceType) {
    if (!referenceType.refName) {
      return;
    }
    this.referenceTypeMap[referenceType.refName] = referenceType;
  };
  MetadataGenerator.prototype.GetReferenceType = function(refName) {
    return this.referenceTypeMap[refName];
  };
  MetadataGenerator.prototype.OnFinish = function(callback) {
    this.circularDependencyResolvers.push(callback);
  };
  MetadataGenerator.prototype.buildControllers = function() {
    var _this = this;
    return this.nodes
      .filter(function(node) {
        return node.kind === ts.SyntaxKind.ClassDeclaration && _this.IsExportedNode(node);
      })
      .map(function(classDeclaration) {
        return new controllerGenerator_1.ControllerGenerator(classDeclaration, _this);
      })
      .filter(function(generator) {
        return generator.IsValid();
      })
      .map(function(generator) {
        return generator.Generate();
      });
  };
  return MetadataGenerator;
})();
exports.MetadataGenerator = MetadataGenerator;
//# sourceMappingURL=metadataGenerator.js.map
