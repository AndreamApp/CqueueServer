
const Crawler = require('./crawler')
const Parser = require('./parser')
const DB = require('./db')


function API(){
    this.crawler = null;
    this.parser = new Parser();
    this.db = new DB();
    this.curr_semester = '20170';
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
    let loginResult = await this.crawler.login(stunum, password);
    if(loginResult.status){
        if(!await this.db.getUserInfo(stunum)){
            let infoHtml = await this.crawler.info();
            let info = await this.parser.parseInfoFromHTML(infoHtml);
            await this.db.register(stunum, password, info);
        }

        let tableHtml = await this.crawler.table(this.curr_semester);
        let table = await this.parser.parseTableFromHTML(tableHtml);
        await this.db.setTable(stunum, table);

        let examsHtml = await this.crawler.exams(this.curr_semester);
        let exams = await this.parser.parseExamsFromHTMLArr(examsHtml);
        await this.db.setExams(stunum, exams);

        let gradeHtml = await this.crawler.grade();
        let grade = await this.parser.parseGradesFromHTML(gradeHtml);
        await this.db.setGrade(stunum, grade);
        return good(await this.db.getUserInfo(stunum));
    }
    else{
        return bad(loginResult.msg);
    }
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


async function synctest(){
    let api = new API();
    await api.connect();

    console.time('parse');
    console.log(JSON.stringify(await api.login('20151597', '976655'), null, 4));
    console.log(JSON.stringify(await api.getTable('20151597'), null, 4));
    console.log(JSON.stringify(await api.getGrade('20151597'), null, 4));
    console.log(JSON.stringify(await api.getExams('20151597'), null, 4));

    console.timeEnd('parse');
    await api.close();
}

// synctest();

module.exports = new API();
