/**
 * Created by pbie on 11/30/16.
 */

 // - 42 -brew reinstall ffmpeg --with-libvpx --with-libvorbis

var express = require('express'),
    app = express(),
    fs = require("fs"),
    url = require("url"),
    path = require("path"),
    jade = require('jade'),
    ffmpeg = require('fluent-ffmpeg'),
    pump = require('pump'),
    torrentStream = require('torrent-stream'),
    Promise = require("bluebird"),
    db = require('./dbconn.js'),
    conn = db.connexion();

var uri = 'magnet:?xt=urn:btih:11a2ac68a11634e980f265cb1433c599d017a759';

var mkvtest = 'magnet:?xt=urn:btih:8e8d3090fcb57079631455179ceb4c6ab6c5f2b6';

var mimeTypes = {
	"f4v":		"video/mp4",
	"f4p":		"video/mp4",
	"mp4":		"video/mp4",
	"mkv":		"video/webm",
	"avi":		"video/webm",
	"mpa":		"video/mpeg",
	"mpe":		"video/mpeg",
	"mpeg":		"video/mpeg",
	"mpg":		"video/mpeg",
	"mpv2":		"video/mpeg",
	"mp2":		"video/mpeg",
	"webm":		"video/webm",
	"ogg":		"video/ogg",
    "wmv":    "video/webm"
};

var mimeToConvert = {
    "wmv" : "webm",
    "avi" : "webm",
    "mkv" : "webm"
}

var runningCommands = {};

var runningEngines = {}

function randomIntInc (low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

let engineGo = function (magnet, id) {
  return new Promise(function (resolve, reject) {
    //console.log("entering engineGo");
    if (runningEngines[id] == undefined) {
      var engine = torrentStream(magnet);
      engine.on('ready', function() {
          //console.log(engine.files);
          engine.files.forEach(function(file) {
            if (file.name.substr(file.name.length - 3) == 'mkv' || file.name.substr(file.name.length - 3) == 'mp4') {
              //console.log('filename:', file.name);
              var stream = file.createReadStream();
              var writable = fs.createWriteStream('public/movie/' + file.name);
              //console.log("about to write file");
              runningEngines[id] = engine;
              pump(stream, writable);
              engine.on('download', function () {
                //console.log(file.name);
                console.log(engine.swarm.downloaded / file.length * 100 + "%");
                resolve(file);
              });
            }
              // stream is readable stream to containing the file content
          });
      });
    } else {
      runningEngines[id].files.forEach(function (file) {
        if (file.name.substr(file.name.length - 3) == 'mkv' || file.name.substr(file.name.length - 3) == 'mp4') {
          resolve(file)
        }
      })
    }
  });
};

var which_quality = function(input){
    var quality = '';
    if (input == '720p')
        quality = 'm.torrent_720_id';
    else if (input == '1080p')
        quality = 'm.torrent_1080_id';
    else if (input == '3D')
        quality = 'm.torrent_3D_id';
    return quality;
};

var escape_space = function(string){
    return (string.replace(" ", "+"));
};

let downloadTorrent = function(quality, id) {
  //console.log(quality, id);
  return new Promise(function(resolve, reject) {
    conn.query('select * from movies as m left join torrent as t on '+quality+' = t.id where m.id = ?', id, function (err, rows) {
        if (err) throw err;
        //console.log(rows);
        magnet = "magnet:?xt=urn:btih:" + rows[0].hash + "&dn=" + escape_space(rows[0].title) + "&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Fzer0day.ch%3A1337&tr=udp%3A%2F%2Fopen.demonii.com%3A1337&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Fexodus.desync.com%3A6969";
        //console.log(magnet);
        resolve(magnet);
    });
  });
};

var quality;
var id;
var background;

exports.stream = function (req, res) {
  //console.log("the requested url is " + req.url);
    if (req.url != "/play/Guardians.of.the.Galaxy.2014.1080p.BluRay.x264.YIFY.mp4"
      && req.url != "/play/Guardians.of.the.Galaxy.2014.1080p.BluRay.x264.YIFY.webm"
      && req.url != "/play/Guardians.of.the.Galaxy.2014.1080p.BluRay.x264.YIFY.ogg") {
      quality = req.query.quality;
      id = req.query.id;
      background = req.query.background;
      console.log(background);
      var rpath = __dirname + '/../views/play.jade';
      fs.readFile(rpath, 'utf8', function (err, str) {
        if (err) {
          throw err;
        }
        var fn = jade.compile(str);
        //console.log(fn);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.write(fn({background: background}));
        res.end();
      });
    }
    else {
      downloadTorrent(quality, id).then(function (magnet) {
        engineGo(magnet, id).delay(5000).then(function (result) {
          //console.log('engineGo has happened');
          var filer = path.resolve(__dirname,"../public/movie/" + result.name);
          fs.stat(filer, function(err, stats) {
            if (err) {
              console.log(err);
              if (err.code === 'ENOENT') {
                // 404 Error if file not found
                return res.sendStatus(404);
              }
            res.end(err);
            }
            var range = req.headers.range;
            //console.log("range is " + range);
            if (!range) {
              console.log("no range");
             // 416 Wrong range
             return res.sendStatus(416);
            }
            //console.log(range);
            var positions = range.replace(/bytes=/, "").split("-");
            var start = parseInt(positions[0], 10);
            var total = stats.size;
            var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
            var chunksize = (end - start) + 1;

            res.writeHead(206, {
              "Content-Range": "bytes " + start + "-" + end + "/" + total,
              "Accept-Ranges": "bytes",
              'Connection': 'keep-alive',
              "Content-Length": chunksize,
              "Content-Type": "video/mp4"
            });
            if (result.name.substr(result.name.length - 3) == 'mkv') {
              var target = null;
              target = result;
              var ext = target.name.split('.').pop();
              if (mimeTypes[ext] === -1 || result.name.indexOf("sample") !== -1) {
                //console.log("getting in here");
                return;
              }
              var stream = target.createReadStream({start: start, end: end});
              //var writer = fs.createWriteStream(target.name);
              if (mimeToConvert[ext] !== undefined) {
                var id = randomIntInc(1, 10000);
                //console.log("the new id is " + id);
                runningCommands[id] = ffmpeg(stream).videoCodec('libvpx').audioCodec('libvorbis').format('webm')
                .audioBitrate(128)
                .videoBitrate(1024)
                .outputOptions([
                  '-threads 8',
                  '-deadline realtime',
                  '-error-resilient 1'
                ])
                .on('start', function (cmd) {
                  //console.log('this has started ' + cmd);

                })
                .on('end', function () {
                  delete runningCommands[id];
                })
                .on('error', function (err) {
                  console.log("error now happening");
                  console.log(err);
                  delete runningCommands[id];
                  console.log("runningCommands[id] is deleted from id " + id);
                });
                //console.log(convert);
                pump(runningCommands[id], res);
              }

            } else {
              //console.log("about to write");
              var stream = fs.createReadStream(filer, {start: start, end: end});
              pump(stream, res);
            }
          });
        })
      }).catch((error) => {
        console.log(error);
      });
    }
};
