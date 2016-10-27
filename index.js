"use strict";

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var gutil = require('gulp-util');
var through = require('through2');

var PLUGIN_NAME = 'gulp-asset-rev';

var ASSET_REG = {
    "SCRIPT": /(<script[^>]+src=)['"]([^'"]+)["']/ig,
    "STYLESHEET": /(<link[^>]+href=)['"]([^'"]+)["']/ig,
    "IMAGE": /(<img[^>]+src=)['"]([^'"]+)["']/ig,
    "BACKGROUND": /(url\()(?!data:|about:)([^)]*)/ig,
	"REQUIRE": /(Url\.Content\()['"]([^'"]+)["']/ig
};

var createHash = function (file, len) {
    return crypto.createHash('md5').update(file).digest('hex').substr(0, len);
};
var md5Dic  = {};

module.exports = function (options) {
    return through.obj(function (file, enc, cb) {

        options = options || {};

        if (file.isNull()) {
            this.push(file);
            return cb();
        }

        if (file.isStream()) {
            this.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
            return cb();
        }

        var content = file.contents.toString();

        var filePath = path.dirname(file.path);
		if(file.path.indexOf(options.requireJSConfig) != -1){
			content = content.replace(/requirejs.config\(\{(.|\n|\r)*paths\:/, function(str, tag, src){

				options.requireJSPaths.forEach(function(item, index){

					var assetPath = path.normalize(filePath+ '/'+ item);
					
					if(fs.lstatSync(assetPath).isDirectory()){
						
						var files = fs.readdirSync(assetPath);
						
						files.forEach(function(item,index){
							
							var p = assetPath + '/'+ item;
							
							if(!fs.lstatSync( p).isDirectory()){
								
								if (fs.existsSync( p)) {

								var buf = fs.readFileSync( p);

								var md5 = createHash(buf, options.hashLen || 7);

								var verStr = "v=" + (options.verConnecter || "") + md5;

								var key = path.basename( p);
								
								md5Dic[key] = verStr;
								}
							}
						});
					}
					else{
						if (fs.existsSync(assetPath)) {

								var buf = fs.readFileSync(assetPath);

								var md5 = createHash(buf, options.hashLen || 7);

								var verStr = "v=" + (options.verConnecter || "") + md5;

								var key = path.basename(assetPath);
								
								md5Dic[key] = verStr;
						}
					}
	
				}); 
			    return "requirejs.config({\n\tconfig:{ \n\t\tverConf :"+ JSON.stringify(md5Dic, null, 8) + "\n\t},\n\tpaths:";
			});
		}
        for (var type in ASSET_REG) {
            if (type === "BACKGROUND" && !/\.(css|scss|less)$/.test(file.path)) {

            } else {
                content = content.replace(ASSET_REG[type], function (str, tag, src) {
                    src = src.replace(/(^['"]|['"]$)/g, '');
                    if (!/\.[^\.]+$/.test(src)) {
                        return str;
                    }
					
                    if (options.verStr) {
                        src += options.verStr;
                        return tag + '"' + src + '"';
                    }
                
                    // remote resource
                    if (/^https?:\/\//.test(src)) {
                        return str;
                    }

                    var assetPath = path.join(filePath, src);
                    if (src.indexOf('/') == 0) {
                        if (options.resolvePath && typeof options.resolvePath === "function") {
                            assetPath = options.resolvePath(src);
                        } else {
                            assetPath = (options.rootPath || "") + src;
                        }
                    }
					if(src.indexOf('~') == 0){
						assetPath = path.relative(filePath,src.replace('~', (options.rootPath||filePath)));
					    assetPath = path.join(filePath, assetPath);
					}

                    if (fs.existsSync(assetPath)) {

                        var buf = fs.readFileSync(assetPath);

                        var md5 = createHash(buf, options.hashLen || 7);

                        var verStr = (options.verConnecter || "") + md5;

                        src=src+"?v="+verStr;
						
                    } else {
                        return str;
                    }

                    return tag + '"' + src + '"';
                });
            }
        }

        file.contents = new Buffer(content);
        this.push(file);
        cb();
    });
};

