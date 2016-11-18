/**
 * Created by aliandie on 10/28/16.
 */

var db = require('./dbconn.js');
var conn = db.connexion();
var nodemailer = require('nodemailer');
var urlencode = require('urlencode');
var shortid = require('shortid');
var passwordHash = require('password-hash');

exports.connect = function(req, res) {
    var  user_name = req.body.u_name;
    var user_mail = req.body.u_mail;
    var cle = shortid.generate();
    conn.query("UPDATE users SET u_restore_key = ? WHERE u_name = ? AND u_mail = ?", [cle, user_name, user_mail], function(err, rows){
        var result;
        var num = rows.affectedRows;
        if(err) throw err;
        if(num > 0) {
            var transporter = nodemailer.createTransport();
            var mailOptions = {
                from: "Hypertube@hypertube.fr",
                to: user_mail,
                subject: "Reset your hypertube password",
                html: "<b>Hello! <b> To reset you're password, please follow this link : <a  href='http://localhost:3000/?log=" + urlencode(user_name)+ "&cle=" + urlencode(cle) +"'>Recuperation du mot de passe</a><br><br></b>"
            };
            transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    return console.log(error);
                }
            });
            result = 'OK';
        }
        else
            result = 'Wrong details';
        res.send(result);
        res.end();
    });
};

exports.get_user_data = function(req, res){
    conn.query('SELECT u_name, u_mail, u_fname, u_pic, u_lname from users where u_name = ?', [req.body.login ? req.body.login : req.session.login], function(err, rows){
        res.send(rows);
        res.end();
    });
};

exports.update_profile = function(req, res) {
    var modif = 0;
    var sql = 'UPDATE users SET u_restore_key = null';
    if (req.body.username) {
        sql += ', u_name = ' + conn.escape(req.body.username);
        modif++;
    }
    if (req.body.firstname) {
        sql += ', u_fname = ' + conn.escape(req.body.firstname);
        modif++;
    }
    if (req.body.lastname) {
        sql += ',u_lname = ' + conn.escape(req.body.lastname);
        modif++;
    }
    if (req.body.email){
        sql += ', u_mail = ' + conn.escape(req.body.email);
        modif++;
    }
    if (req.body.password) {
        sql += ', u_pass = ' + conn.escape(passwordHash.generate(req.body.password));
        modif++;
        console.log(modif);
    }
    sql += ' WHERE u_name = ' + conn.escape(req.session.login);
    conn.query(sql, function(err, rows){
        if(err) throw err;
        if (rows.affectedRows > 0 && modif != 0) {
            res.send({res : "OK", nb : modif});
            res.end();
        }
        else {
            res.send({res : "KO"});
            res.end();
        }
    });
};

exports.upload_picture = function(req, res){
    if (typeof(req.file) == 'undefined') {
        res.send({res : "NO PICTURE"});
        res.end();
    }
    else {
        var url = req.file.path.substring(req.file.path.indexOf('/') + 1);
        if (req.file.originalname && (req.file.originalname.substr(-3) == 'png' || req.file.originalname.substr(-3) == 'jpg' || req.file.originalname.substr(-4) == 'jpeg' || req.file.originalname.substr(-3) == 'JPG' || req.file.originalname.substr(-4) == 'JPEG')) {
            conn.query('UPDATE users SET u_pic = ? WHERE u_name = ?', [url, req.session.login], function (err, rows) {
                if(req.body.username)
                    req.session.login = req.body.username;
                if (rows.affectedRows > 0) {
                    res.send({res : "OK"});
                    res.end();
                }
                else {
                    res.send({res : "KO"});
                    res.end();
                }
            });
        }
        else {
            res.send({res : "MAUVAIS FORMAT"});
            res.end();
        }
    }
};
