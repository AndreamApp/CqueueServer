let express = require('express');
let router = express.Router();

/*
 * Cookie读写：https://stackoverflow.com/questions/16209145/how-to-set-cookie-in-node-js-using-express-framework
 * 使用session：http://wiki.jikexueyuan.com/project/node-lessons/cookie-session.html
 * */

const api = require('../main/api');

api.connect();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/login', async function(req, res) {
    let stunum = req.query.stunum;
    let password = req.query.password;
    let result = await api.login(stunum, password);

    if(!req.session.stunum){
        req.session.stunum = stunum;
    }
    res.json(result);
});

router.post('/login', async function(req, res) {
    let stunum = req.body.stunum;
    let password = req.body.password;
    let result = await api.login(stunum, password);

    if(!req.session.stunum){
        req.session.stunum = stunum;
    }
    res.json(result);
});

router.get('/logout', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.logout(stunum);
    res.json(result);
});

router.post('/logout', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.logout(stunum);
    res.json(result);
});

router.get('/getUserInfo', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.getUserInfo(stunum);
    res.json(result);
});

router.get('/getTable', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.getTable(stunum);
    res.set({'Cache-Control': 'public, max-age=2592000'});
    res.json(result);
});

router.get('/getExams', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.getExams(stunum);
    res.set({'Cache-Control': 'public, max-age=60'});
    res.json(result);
});

router.get('/getGrade', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.getGrade(stunum);
    res.set({'Cache-Control': 'public, max-age=60'});
    res.json(result);
});

module.exports = router;
