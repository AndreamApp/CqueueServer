
const Crawler = require('./crawler')
const Parser = require('./parser')
const DB = require('./db')


function API(){
    this.crawler = null;
    this.parser = new Parser();
    this.db = new DB();
    this.curr_semester = '20171';
}

API.prototype.connect = async function connect(){
    await this.db.connect();
}

API.prototype.close = async function close(){
    await this.db.close();
}

function good(data, msg){
    return {
        status: true,
        msg: msg,
        err: null,
        data: data
    };
}

function bad(err){
    return {
        status: false,
        msg: null,
        err: err,
        data: null
    };
}

API.prototype.login = async function login(stunum, password){
    this.crawler = new Crawler(null, stunum);
    if(!(stunum && password)){
        return bad('请输入学号和密码！');
    }
    let loginStatus = await this.crawler.checkLoginStatus();//this.crawler.login(stunum, password);
    let userInfo = await this.db.getUserInfo(stunum);
    // 登录Cookie缓存有效
    if(loginStatus){
        // 核对密码
        if(password !== userInfo['password']){
            return bad('账号或密码不正确');
        }
    }
    // 登录Cookie过期 或 尚未登录
    else{
        let loginResult = await this.crawler.login(stunum, password);
        if(loginResult.status){
            // first login or data changed, save to database
            if(!userInfo || password !== userInfo['password']){
                let infoHtml = await this.crawler.info();
                let info = await this.parser.parseInfoFromHTML(infoHtml);
                await this.db.register(stunum, password, info);
                userInfo = await this.db.getUserInfo(stunum);
            }
            // use cached
            else{
            }

            /*
            // Don't fetch all data as login, we can fetch it later
            let tableHtml = await this.crawler.table(this.curr_semester);
            let table = await this.parser.parseTableFromHTML(tableHtml);
            await this.db.setTable(stunum, table);

            let examsHtml = await this.crawler.exams(this.curr_semester);
            let exams = await this.parser.parseExamsFromHTMLArr(examsHtml);
            await this.db.setExams(stunum, exams);

            let gradeHtml = await this.crawler.grade();
            let grade = await this.parser.parseGradesFromHTML(gradeHtml);
            await this.db.setGrade(stunum, grade);
            */
        }
        else{
            return bad(loginResult.msg);
        }
    }

    // filter some private field
    delete userInfo['password'];

    return good(userInfo);
}

API.prototype.logout = async function logout(stunum){
    if(!stunum || stunum === ''){
        return bad('登录身份已过期');
    }
    this.crawler = new Crawler(null, stunum);
    return good(await this.crawler.logout(stunum));
}


API.prototype.getUserInfo = async function getUserInfo(stunum){
    let userInfo = this.db.getUserInfo(stunum);
    return await this.login(stunum, userInfo.password);
}

API.prototype.getTable = async function getTable(stunum){
    if(!stunum || stunum === ''){
        return bad('登录身份已过期');
    }
    let userInfo = await this.db.getUserInfo(stunum);
    if(!userInfo){
        return bad('请先登录');
    }
    this.crawler = new Crawler(null, stunum);
    let loginResult = await this.crawler.login(stunum, userInfo.password);
    if(loginResult.status){
        let tableHtml = await this.crawler.table(this.curr_semester);
        let table = await this.parser.parseTableFromHTML(tableHtml);
        await this.db.setTable(stunum, table);
        return good(table);
    }
    else{
        return bad(loginResult.msg);
    }
}

API.prototype.getExams = async function getExams(stunum){
    if(!stunum || stunum === ''){
        return bad('登录身份已过期');
    }
    let userInfo = await this.db.getUserInfo(stunum);
    if(!userInfo){
        return bad('请先登录');
    }
    this.crawler = new Crawler(null, stunum);
    let loginResult = await this.crawler.login(stunum, userInfo.password);
    if(loginResult.status){
        let examsHtml = await this.crawler.exams(this.curr_semester);
        let exams = await this.parser.parseExamsFromHTMLArr(examsHtml);
        await this.db.setExams(stunum, exams);
        return good(exams);
    }
    else{
        return bad(loginResult.msg);
    }
}

API.prototype.getGrade = async function getGrade(stunum){
    if(!stunum || stunum === ''){
        return bad('登录身份已过期');
    }
    let userInfo = await this.db.getUserInfo(stunum);
    if(!userInfo){
        return bad('请先登录');
    }
    this.crawler = new Crawler(null, stunum);
    let loginResult = await this.crawler.login(stunum, userInfo.password);
    if(loginResult.status){
        let gradeHtml = await this.crawler.grade();
        let grade = await this.parser.parseGradesFromHTML(gradeHtml);
        await this.db.setGrade(stunum, grade);
        return good(grade);
    }
    else{
        return bad(loginResult.msg);
    }
}

API.prototype.like = async function like(stunum) {
    if(!stunum || stunum === ''){
        return bad('登录身份已过期');
    }
    let likeNum = await this.db.like(stunum);
    return good(null, '有'+likeNum+'位小伙伴和你一样喜欢我');
}

API.prototype.uploadFeedback = async function uploadFeedback(stunum, message, stackTrack) {
    if(!stunum || stunum === ''){
        return bad('登录身份已过期');
    }
    let res = await this.db.uploadFeedback(stunum, message, stackTrack);
    return good(res);
}

API.prototype.getFeedbacks = async function getFeedbacks(stunum) {
    if(!stunum || stunum === ''){
        return bad('登录身份已过期');
    }
    let res = await this.db.getFeedbacks();
    return good(res);
}


API.prototype.crashReport = async function crashReport(stunum, data) {
    if(!stunum || stunum === ''){
        return bad('登录身份已过期');
    }
    let res = await this.db.crashReport(stunum, data);
    return good(res);
}

async function synctest(){
    let api = new API();
    await api.connect();

    console.time('parse');
    console.log(JSON.stringify(await api.login('20151597', '237231'), null, 4));
    // console.log(JSON.stringify(await api.getTable('20151597'), null, 4));
    // console.log(JSON.stringify(await api.getGrade('20151597'), null, 4));
    // console.log(JSON.stringify(await api.getExams('20151597'), null, 4));

    console.log(JSON.stringify(await api.like('20151597'), null, 4));
    // console.log(JSON.stringify(await api.uploadFeedback('20151597', 'test message', 'test stack trace'), null, 4));
    console.log(JSON.stringify(await api.getFeedbacks('20151597'), null, 4));

    console.timeEnd('parse');
    await api.close();
}

// synctest();

module.exports = new API();
