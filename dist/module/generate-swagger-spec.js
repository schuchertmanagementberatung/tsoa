"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var YAML = require("yamljs");
var metadataGenerator_1 = require("../metadataGeneration/metadataGenerator");
var specGenerator2_1 = require("../swagger/specGenerator2");
var specGenerator3_1 = require("../swagger/specGenerator3");
var fs_1 = require("../utils/fs");
var mutualConfigValidation_1 = require("../utils/mutualConfigValidation");
exports.generateSwaggerSpec = function (swaggerConfig, routesConfigRelatedToSwagger, compilerOptions, ignorePaths, 
/**
 * pass in cached metadata returned in a previous step to speed things up
 */
metadata) { return __awaiter(void 0, void 0, void 0, function () {
    var spec, exists, data, ext;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                // NOTE: I did not realize that the controllerPathGlobs was related to both swagger
                //   and route generation when I merged https://github.com/lukeautry/tsoa/pull/396
                //   So this allows tsoa consumers to submit it on either config and tsoa will respect the selection
                if (routesConfigRelatedToSwagger.controllerPathGlobs && !swaggerConfig.controllerPathGlobs) {
                    swaggerConfig.controllerPathGlobs = routesConfigRelatedToSwagger.controllerPathGlobs;
                }
                mutualConfigValidation_1.validateMutualConfigs(routesConfigRelatedToSwagger, swaggerConfig);
                if (!metadata) {
                    metadata = new metadataGenerator_1.MetadataGenerator(swaggerConfig.entryFile, compilerOptions, ignorePaths, swaggerConfig.controllerPathGlobs).Generate();
                }
                if (swaggerConfig.specVersion && swaggerConfig.specVersion === 3) {
                    spec = new specGenerator3_1.SpecGenerator3(metadata, swaggerConfig).GetSpec();
                }
                else {
                    spec = new specGenerator2_1.SpecGenerator2(metadata, swaggerConfig).GetSpec();
                }
                return [4 /*yield*/, fs_1.fsExists(swaggerConfig.outputDirectory)];
            case 1:
                exists = _a.sent();
                if (!!exists) return [3 /*break*/, 3];
                return [4 /*yield*/, fs_1.fsMkDir(swaggerConfig.outputDirectory)];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                data = JSON.stringify(spec, null, '\t');
                if (swaggerConfig.yaml) {
                    data = YAML.stringify(JSON.parse(data), 10);
                }
                ext = swaggerConfig.yaml ? 'yaml' : 'json';
                return [4 /*yield*/, fs_1.fsWriteFile(swaggerConfig.outputDirectory + "/swagger." + ext, data, { encoding: 'utf8' })];
            case 4:
                _a.sent();
                return [2 /*return*/, metadata];
        }
    });
}); };
//# sourceMappingURL=generate-swagger-spec.js.map