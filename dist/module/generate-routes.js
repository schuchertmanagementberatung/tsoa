'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function(resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function() {
          return this;
        }),
      g
    );
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while (_)
        try {
          if (((f = 1), y && (t = op[0] & 2 ? y['return'] : op[0] ? y['throw'] || ((t = y['return']) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)) return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!((t = _.trys), (t = t.length > 0 && t[t.length - 1])) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, '__esModule', { value: true });
var path = require('path');
var metadataGenerator_1 = require('../metadataGeneration/metadataGenerator');
var routeGenerator_1 = require('../routeGeneration/routeGenerator');
var deprecations_1 = require('../utils/deprecations');
var mutualConfigValidation_1 = require('../utils/mutualConfigValidation');
exports.generateRoutes = function(
  routesConfig,
  minimalSwaggerConfig,
  compilerOptions,
  ignorePaths,
  /**
   * pass in cached metadata returned in a previous step to speed things up
   */
  metadata,
) {
  return __awaiter(void 0, void 0, void 0, function() {
    var routeGenerator, pathTransformer, template;
    return __generator(this, function(_a) {
      switch (_a.label) {
        case 0:
          // NOTE: I did not realize that the controllerPathGlobs was related to both swagger
          //   and route generation when I merged https://github.com/lukeautry/tsoa/pull/396
          //   So this allows tsoa consumers to submit it on either config and tsoa will respect the selection
          if (minimalSwaggerConfig.controllerPathGlobs && !routesConfig.controllerPathGlobs) {
            routesConfig.controllerPathGlobs = minimalSwaggerConfig.controllerPathGlobs;
          }
          mutualConfigValidation_1.validateMutualConfigs(routesConfig, minimalSwaggerConfig);
          if (!metadata) {
            metadata = new metadataGenerator_1.MetadataGenerator(routesConfig.entryFile, compilerOptions, ignorePaths, routesConfig.controllerPathGlobs).Generate();
          }
          routeGenerator = new routeGenerator_1.RouteGenerator(metadata, routesConfig, exactly(minimalSwaggerConfig));
          pathTransformer = function(path) {
            return path.replace(/{/g, ':').replace(/}/g, '');
          };
          switch (routesConfig.middleware) {
            case 'express':
              template = path.join(__dirname, '..', 'routeGeneration/templates/express.hbs');
              break;
            case 'hapi':
              template = path.join(__dirname, '..', 'routeGeneration/templates/hapi.hbs');
              pathTransformer = function(path) {
                return path;
              };
              break;
            case 'koa':
              template = path.join(__dirname, '..', 'routeGeneration/templates/koa.hbs');
              break;
            default:
              template = path.join(__dirname, '..', 'routeGeneration/templates/express.hbs');
          }
          if (routesConfig.middlewareTemplate) {
            template = routesConfig.middlewareTemplate;
          }
          return [4 /*yield*/, routeGenerator.GenerateCustomRoutes(template, pathTransformer)];
        case 1:
          _a.sent();
          return [2 /*return*/, metadata];
      }
    });
  });
};
var exactly = function(input) {
  // Validate the config values first
  if (input.noImplicitAdditionalProperties === true) {
    deprecations_1.warnAdditionalPropertiesDeprecation(input.noImplicitAdditionalProperties);
  } else if (input.noImplicitAdditionalProperties === false) {
    deprecations_1.warnAdditionalPropertiesDeprecation(input.noImplicitAdditionalProperties);
  } else if (input.noImplicitAdditionalProperties === undefined || input.noImplicitAdditionalProperties === 'throw-on-extras' || input.noImplicitAdditionalProperties === 'silently-remove-extras') {
    // then it's good to go
  } else {
    throw new Error('noImplicitAdditionalProperties is set to an invalid value. See https://github.com/lukeautry/tsoa/blob/master/src/config.ts for available options.');
  }
  if (input.specVersion && input.specVersion !== 2 && input.specVersion !== 3) {
    input.specVersion = 2;
  }
  // Make an exact copy that doesn't have other properties
  var recordOfProps = {
    noImplicitAdditionalProperties: 'right side does not matter',
    // tslint:disable-next-line: object-literal-sort-keys
    controllerPathGlobs: 'right side does not matter',
    specVersion: 'right side does not matter',
  };
  var exactObj = {};
  Object.keys(recordOfProps).forEach(function(key) {
    var strictKey = key;
    exactObj[strictKey] = input[strictKey];
  });
  return exactObj;
};
//# sourceMappingURL=generate-routes.js.map
