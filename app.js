/*
* Desc:启动文件
* Date:2014-08-15
* Author:Ravior
*/

var http=require('http');
var url=require('url');
var zlib=require('zlib');
var path=require('path');
var fs=require('fs');
var config=require('./config');
var mime=require('./mime').types;

//在Web页面上显示文件列表
var formatBody=function(pathname,realpath,files){
    var str="<!doctype><html><head><meta charset='utf-8' /><title>FileServer</title></head><body><ul>";
    files.forEach(function(val,index){
        var stat=fs.statSync(realpath+"/"+val);
        if(stat.isDirectory()){
            val+="/";
        }
        str+="<li><a href='"+pathname+"/"+val+"'>"+val+"</a></li>";
    });
    str+="</ul></body></html>";
    return str;
}


var handler=function(req,res){
    //反序列化
    var pathname=url.parse(req.url).pathname.replace(/%20/g,' ').replace(/\/$/,'');
    //实际路径(绝对路径)
    var realpath=__dirname+'/'+config.basedir+pathname;
    if (!fs.existsSync(realpath)) {
        //文件不存在
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.write('This request URL ' + pathname + ' was not found on this server.');
        res.end();
    } else {
        var fileStat=fs.statSync(realpath);
        //文件修改时间
        var lastModified = fileStat.mtime.toUTCString();
        //文件夹
        if(fileStat.isDirectory()){
            var fileArr=fs.readdirSync(realpath);
            var html=formatBody(pathname,realpath,fileArr);
            res.setHeader('Server',config.server+'/'+config.version);
            res.setHeader('Content-Length',Buffer.byteLength(html,'utf8'));
            res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
            res.end(html);

        }
        else if(req.headers['if-modified-since'] && lastModified === req.headers['if-modified-since']) {
            res.setHeader('Server',config.server+'/'+config.version);
            res.writeHead(304, 'Not Modified');
            res.end();
        } else{
            //浏览器缓存
            var expires = new Date();
            expires.setTime(expires.getTime() + config.maxAge * 1000);
            res.setHeader('Expires', expires.toUTCString());
            res.setHeader('Cache-Control', 'max-age=' + config.maxAge);
            res.setHeader('Server',config.server+'/'+config.version);
            res.setHeader('Last-Modified', lastModified);

            //扩展名
            var ext = path.extname(realpath);
            ext = ext ? ext.slice(1) : 'unknown';
            var contentType = mime[ext] || 'text/plain';
            res.setHeader('Content-Type',contentType);

            //客户端接受的编码格式
            var acceptEncoding = req.headers['accept-encoding'];
            if(acceptEncoding&&acceptEncoding.indexOf('gzip') != -1){
                //gzip压缩
                var fileStream=fs.createReadStream(realpath);
                var gzipStream = zlib.createGzip();
                // 设置返回头content-encoding为gzip
                res.setHeader("Content-Encoding", "gzip");
                res.writeHead(200,'OK');
                fileStream.pipe(gzipStream).pipe(res);
            }
            else{
                fs.readFile(realpath, 'binary', function (err, file) {
                    if (err) {
                        res.setHeader('Server',config.server+'/'+config.version);
                        res.writeHead(500, {'Content-Type': 'text/plain'});
                        res.end('Error occurred on the server');
                    }else {
                        res.writeHead(200,'OK');
                        res.write(file, 'binary');
                        res.end();
                    }
                });
            } 
        }
    }
}

http.createServer(handler).listen(config.port);
console.log('Server Started | Running at Port:'+config.port);
