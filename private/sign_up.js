/**
 * Created by aliandie on 10/27/16.
 */


var db = require('./dbconn.js');
var conn = db.connexion();

exports.inscription = function(req, res) {
    var passwordHash = require('password-hash');
    req.body.u_pass = passwordHash.generate(req.body.u_pass);
    conn.query('INSERT INTO users SET ?', req.body, function(err){
        if(err) throw err;
    });
    res.send('ok');
    res.end();
};