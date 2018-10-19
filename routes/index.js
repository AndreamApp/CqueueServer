let express = require('express');
let router = express.Router();

/*
 * Cookie读写：https://stackoverflow.com/questions/16209145/how-to-set-cookie-in-node-js-using-express-framework
 * 使用session：http://wiki.jikexueyuan.com/project/node-lessons/cookie-session.html
 * */

/*
 * login(stunum, password) / logout(stunum) / getUserInfo(stunum) / getUserList(stunum)
** getTable(stunum) / getExams(stunum) / getGrade(stunum)
 * uploadFeedback(stunum) / getFeedbacks(stunum)
 * crash(stunum) / getCrashList(stunum)
 * like(stunum) / checkUpdate(stunum)
 * */

const api = require('../main/api');

api.connect();


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

router.get('/getUserList', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.getUserList(stunum);
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

router.get('/searchCourse', async function(req, res) {
    let key = req.query.key;
    let stunum = req.session.stunum;
    let result = await api.searchCourse(stunum, key);
    res.set({'Cache-Control': 'public, max-age=60'});
    res.json(result);
});

router.get('/getCourseByAcademy', async function(req, res) {
    let academy = req.query.academy. page = req.query.page;
    let stunum = req.session.stunum;
    let result = await api.searchCourse(stunum, academy, page);
    res.set({'Cache-Control': 'public, max-age=60'});
    res.json(result);
});

router.get('/like', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.like(stunum);
    res.json(result);
});

router.post('/uploadFeedback', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.uploadFeedback(stunum, req.body.message, req.body.stackTrack);
    res.json(result);
});

router.get('/getFeedbacks', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.getFeedbacks(stunum);
    res.json(result);
});

router.get('/checkUpdate', async function(req, res) {
    let stunum = req.session.stunum;
    res.json({
        status: true,
        msg: null,
        err: null,
        data: {
            version_code: 2,
            version_name: '0.0.2',
            app_name: 'Cqueue',
            description: 'v0.0.2 自动计算开学日期，迎接新学期~',
            download_url: 'https://www.coolapk.com/apk/com.andreamapp.cqu'
        }
    });
});

router.post('/crash', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.crashReport(stunum, req.body);
    res.json(result);
});

router.get('/getCrashList', async function(req, res) {
    let stunum = req.session.stunum;
    let result = await api.getCrashList(stunum);
    res.json(result);
});

module.exports = router;
