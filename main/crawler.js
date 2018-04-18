const fs = require("fs");
const urlencode = require('urlencode')
const iconv = require('iconv-lite');
const md5 = require('./md5.js')
const FileCookieStore = require('tough-cookie-filestore');
let request = require('request');
//require('request-debug')(request);

/*
 * TODO:
 * 每个小时只登录一次
 * */

const DEFAULT_HOST = 'http://jxgl.cqu.edu.cn'; // 教务网域名
// const DEFAULT_HOST = 'http://202.202.1.41'; // 教务网域名

const DEFAULT_TIMEOUT = 10000;

function getJar(stunum){
    let cookiepath = __dirname + "\\cookies\\"+stunum+".json";
// create the json file if it does not exist
    if(!fs.existsSync(cookiepath)){
        fs.closeSync(fs.openSync(cookiepath, 'w'));
    }
// use the FileCookieStore with the request package
    let jar = new FileCookieStore(cookiepath);
    return request.jar(jar);
}

function deleteJar(stunum){
    let cookiepath = __dirname + "\\cookies\\"+stunum+".json";
    fs.writeFileSync(cookiepath, '');
    return true;
}

/*
 * 爬虫对象
 * host: 教务网域名，默认为jxgl.cqu.edu.cn
 * jar: cookiejar，用于持久化cookie
 * timeout: 超时时间，以毫秒为单位，默认为10000ms
 * */
function Crawler(host, stunum, timeout){
    this.host = host ? host : DEFAULT_HOST;
    this.stunum = stunum;
    this.jar = getJar(stunum);

    // console.log(this.jar);
    this.loginStatus = {
        status: true,
        msg: '保持登录状态'
    };
    this.timeout = timeout ? timeout : DEFAULT_TIMEOUT;
}

/*
 * 参考资料
 * Request使用方法：https://segmentfault.com/a/1190000000385867
 *                  https://github.com/request/request
 * Cookie保持：https://stackoverflow.com/questions/35053091/export-cookie-jar-to-json-with-node-request
 * 编码问题：https://stackoverflow.com/questions/12040643/nodejs-encoding-using-request
 * 选择编码解析库：http://www.cnblogs.com/ifantastic/p/3503667.html
 * await / async：只能在ES6中使用，其中await只能在函数体内部调用，且该函数必须声明为async
 * 正则表达式：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
 *
 * 网络响应速度测试：https://segmentfault.com/a/1190000011299825
 * */


function gbkEncodeURIComponent(s){
    return urlencode(s, 'gb2312');
}


/*
 * 检测响应结果是否正常
 * error: 响应回调参数
 * response: 响应回调参数
 * reject: Promise的拒绝接口
 * 如果error不为空，返回true
 * 或状态码为302，判定为登录身份过期，返回true
 * 否则返回false
 * */
Crawler.prototype.badResponse = function badResponse(error, response, reject){
    const self = this;
    if(error){
        reject(error);
        return true;
    }
    if(response && response.statusCode === 302 && response.headers['location'].indexOf('ID=001') !== -1){ // response.headers['location'] contains ID=001 means cookie expired
        self.loginStatus = {
            status: false,
            msg: '登录身份过期'
        };
        console.log(response);
        reject(self.loginStatus.msg);
        // reject(response);
        return true;
    }
    return false;
}

/*
 * 简单封装的get函数
 * url: 目标绝对地址，也可以是教务网域名的相对地址
 * callback: 回调函数，回调参数为(error, response, buf)
 * */
Crawler.prototype.get = function get(url, callback){
    this.getWithRedirect(url, true, callback);
}

/*
 * 简单封装的get函数
 * url: 目标绝对地址，也可以是教务网域名的相对地址
 * callback: 回调函数，回调参数为(error, response, buf)
 * */
Crawler.prototype.getWithRedirect = function get(url, redirect, callback){
    const self = this;
    // 为了方便，在此统一管理域名
    if(!url.startsWith('http')){
        url = self.host + url;
    }
    request.get({
        url:url,
        encoding: null,
        jar: self.jar,
        timeout: self.timeout,
        followRedirect: redirect,
        time: true,
        forever: true
    }, callback);
}

/*
 * 简单封装的post函数
 * url: 目标绝对地址，也可以是教务网域名的相对地址
 * form: 表单数据
 * callback: 回调函数，回调参数为(error, response, buf)
 * */
Crawler.prototype.post = function post(url, form, callback){
    const self = this;
    // 为了方便，在此统一管理域名
    if(!url.startsWith('http')){
        url = self.host + url;
    }
    request.post({
        url: url,
        form: form,
        qsStringifyOptions: {
            encoder: gbkEncodeURIComponent
        }, // 使用gb2312编码post数据
        encoding: null, // 接收buffer数据，不使用utf-8编码
        jar: self.jar,
        timeout: self.timeout,
        time: true,
        forever: true
    }, callback);
}

/*
 * 检查当前是否已经登录，在获取信息之前，一定要先调用这个函数
 * */
Crawler.prototype.checkLoginStatus = async function checkLoginStatus(){
    return new Promise((resolve, reject) => {
        this.getWithRedirect('/bbs/index.aspx', false, (error, response, buf) => {
            if(error){
                reject(error);
                return;
            }
            if(response.statusCode === 302){
                if(response.headers['location'] && response.headers['location'].indexOf('ID=001') !== -1){
                    resolve(false);
                }
                else{
                    resolve(true);
                }
            }
            else{
                let body = iconv.decode(buf, 'gb2312');
                reject('unknown response:' + body);
            }
        })
    });
}

/*
 * 使用指定的学号和密码登录到教务网，暂时只支持本科生账号
 * stunum: 学号
 * password: 密码
 * 返回Promise<LoginStatus>登录状态信息。如果登录成功，会自动保持cookie，以执行进一步的操作
 * TODO: 自动管理各个用户的cookie
 * */
Crawler.prototype.login = async function login(stunum, pass){
    const self = this;
    return new Promise(async (resolve, reject) => {
        let loginStatus = {
            status: false,
            msg: '未知错误'
        };
        // self.get('/_data/index_login.aspx', (error, response, buf) => {
        //     if(error){
        //         reject(error);
        //         return;
        //     }
            self.post('/_data/index_login.aspx',
                {Sel_Type:'STU', txt_dsdsdsdjkjkjc:stunum, efdfdfuuyyuuckjg: pass},
                (error, response, buf) => {
                    if(error){
                        reject(error);
                        return;
                    }
                    let body = iconv.decode(buf, 'gb2312');
                    if(body.indexOf('正在加载权限数据') != -1){
                        loginStatus.status = true;
                        loginStatus.msg = '登录成功';
                    }
                    else if(body.indexOf('账号或密码不正确') != -1){
                        loginStatus.status = false;
                        loginStatus.msg = '账号或密码不正确';
                    }
                    else if(body.indexOf('该账号尚未分配角色') != -1){
                        loginStatus.status = false;
                        loginStatus.msg = '该账号不存在';
                    }
                    else if(body.indexOf('此页面发现一个意外') != -1){
                        loginStatus.status = false;
                        loginStatus.msg = '参数错误';
                    }
                    self.loginStatus = loginStatus;
                    resolve(loginStatus);
            })
        // });
    });
}

/*
 * 注销账户，删除缓存的cookie
 * 返回Promise<boolean>
 * */
Crawler.prototype.logout = async function logout(){
    const self = this;
    return new Promise((resolve, reject) => {
        resolve(deleteJar(self.stunum));
    });
}

/*
 * 抓取当前登录账户的个人信息
 * 返回Promise<string>，包含个人信息的HTML
 * */
Crawler.prototype.info = async function info(){
    const self = this;
    return new Promise((resolve, reject) => {
        self.get('/xsxj/Stu_MyInfo_RPT.aspx', (error, response, buf) => {
            if(self.badResponse(error, response, reject)){
                return;
            }
            //console.log(response.timingPhases);
            let body = iconv.decode(buf, 'gb2312');
            resolve(body);
        });
    });
}

/*
 * 抓取当前登录用户的指定学期的课表
 * semester: 表示学期的字符串，如2017-2018学年第一学期表示为:20170
 * 注：一般来说，在教务网只能查到当前学期的课表，所以学期字符串可以通过当前日期大致计算出来
 * 返回Promise<string>，包含课表的HTML
 * */
Crawler.prototype.table = async function table(semester) {
    const self = this;
    return new Promise((resolve, reject) => {
        self.post('/znpk/Pri_StuSel_rpt.aspx',
            {Sel_XNXQ:semester, px:'0'},
            (error, response, buf) => {
                if(self.badResponse(error, response, reject)){
                    return;
                }
                let body = iconv.decode(buf, 'gb2312');
                //console.log(response.timingPhases);
                resolve(body);
            });
    });
}

/*
 * 抓取当前登录用户的考试信息
 * semester: 当前学期的字符串，如20170
 * 返回Promise<string>，包含课表的HTML
 * */
Crawler.prototype.exams = async function exams(semester) {
    const self = this;
    return new Promise((resolve, reject) => {
        self.get('/KSSW/Private/list_xnxqkslc.aspx?id=' + semester + '&wd=220&vP=xnxqkslc&vT=stu', (error, response, buf) => {
            if(self.badResponse(error, response, reject)){
                return;
            }
            let body = iconv.decode(buf, 'gb2312');
            let reg = /(value..)(\S+?)(['"])/g;
            let examArr = [];
            let arr;
            while((arr = reg.exec(body)) != null){
                examArr.push(arr[2]);
            }
            let htmlArr = [];
            for(let i = 0; i < examArr.length; i++){
                let form = {sel_xnxq:semester, sel_lc:examArr[i], btn_search:'检索'};
                self.post('/KSSW/stu_ksap_rpt.aspx',
                    form,
                    (error, response, buf) => {
                        if(self.badResponse(error, response, reject)){
                            return;
                        }
                        let body = iconv.decode(buf, 'gb2312');
                        htmlArr.push(body);
                        //console.log(response.timingPhases);
                        if(htmlArr.length == examArr.length){
                            resolve(htmlArr);
                        }
                    });
            }
        });

    });
}

/*
 * 抓取当前登录用户的所有学年学期的成绩
 * semester: 表示学期的字符串，如2017-2018学年第一学期表示为:20170
 * 注：一般来说，在教务网只能查到当前学期的课表，所以学期字符串可以通过当前日期大致计算出来
 * 返回Promise<string>，包含课表的HTML
 * */
Crawler.prototype.grade = async function grade() {
    const self = this;
    return new Promise((resolve, reject) => {
        self.post('/xscj/Stu_MyScore_rpt.aspx',
            {SelXNXQ:'0', SJ:'0'},
            (error, response, buf) => {
                if(self.badResponse(error, response, reject)){
                    return;
                }
                let body = iconv.decode(buf, 'gb2312');
                //console.log(response.timingPhases);
                resolve(body);
            });
    });
}

async function synctest(){
    let crawler = new Crawler(null, 20151597);
    let start = Date.now();
    let end;
    let origin = start;

    let result = await crawler.login('20151597', '976655');
    console.log(result.msg);

    let infoBody = await crawler.info();
    // console.log(infoBody);
    console.log('info', (end = Date.now()) - start); start = end;

    let tableBody = await crawler.table('20170');
    // console.log(tableBody);
    console.log('table', (end = Date.now()) - start); start = end;

    let examArr = await crawler.exams('20170');
    // console.log(examArr);
    console.log('exams', (end = Date.now()) - start); start = end;

    let gradeBody = await crawler.grade();
    // console.log(gradeBody);
    console.log('grade', (end = Date.now()) - start); start = end;

    console.log('total', end - origin);
}

function asynctest(){
    let crawler = new Crawler(null, '20151597');
    let start = Date.now();
    let end;
    let origin = start;

    crawler.login('20151597', '976655');

    crawler.info().then(body => {
        console.log('async:info', (end = Date.now()) - start);
    });

    crawler.table('20170').then(body => {
        console.log('async:table', (end = Date.now()) - start);
    });

    crawler.exams('20170').then(arr => {
        console.log('async:exams', (end = Date.now()) - start);
    });

    crawler.grade().then(body => {
        console.log('async:grade', (end = Date.now()) - start);
    });

    console.log('async:total', (Date.now() - origin));
}

// asynctest();
// synctest();

// (async () => {
//     let crawler = new Crawler(null, 20151597);
//     await crawler.checkLoginStatus();
// })();

module.exports = Crawler;
