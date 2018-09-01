const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const request = require('request');
const fs = require("fs");
const htmlparser = require("htmlparser2");

const HOST = 'http://jxgl.cqu.edu.cn';
const HOST2 = 'http://202.202.1.41';
const period = 200;

const USERNAME_SELECTOR = '#txt_dsdsdsdjkjkjc';
const PASSWORD_SELECTOR = '#txt_dsdfdfgfouyy';
const LOGIN_SELECTOR = '[type=submit]';

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

/*
 * UserInfo对象，包含学生个人信息
 * stunum:      学号
 * name:        姓名
 * sex:         性别
 * birthday:    生日
 * nation:      民族
 * academy:     学院
 * class_name:  行政班级
 */
function UserInfo(stunum, name, sex, birthday, nation, academy, class_name){
    this.stunum = stunum;
    this.name = name;
    this.sex = sex;
    this.birthday = birthday;
    this.nation = nation;
    this.academy = academy;
    this.class_name = class_name;
}

/*
 * Course，包含课程信息
 * course_name:      课程名称
 * course_code:      课程代码
 * credit:           学分
 * hours_all:        总学时
 * hours_teach:      讲授学时
 * hours_practice:   上机学时
 * teacher:          老师
 */
function Course(course_name, course_code, credit, hours_all, hours_teach, hours_practice, teacher){
    this.course_name = course_name;
    this.course_code = course_code;
    this.credit = credit;
    this.hours_all = hours_all;
    this.hours_teach = hours_teach;
    this.hours_practice = hours_practice;
    this.teacher = teacher;
    this.schedule = new Array();
}

/*
 * course_name : "概率论与数理统计",
 * course_code : "MATH20001",
 * credit : 3,
 * time_str : "2017-12-10(14周 星期日)09:00-11:00",
 * start_time : "2017-12-10 09:00:00",
 * end_time : "2017-12-10 11:00:00",
 * classroom : "D区D一教学楼D1349",
 * seat : "12"
 */
function Exam(course_name, course_code, credit, time_str, start_time, end_time, classroom, seat){
    this.course_name = course_name;
    this.course_code = course_code;
    this.credit = credit;
    this.time_str = time_str;
    this.start_time = start_time;
    this.end_time = end_time;
    this.classroom = classroom;
    this.seat = seat;
}

/*
 * 登录教务网，之后访问教务网的网页将会自动持有cookie
 * page: 已经打开的Chromium页面
 * TODO: 返回登录状态
 */
async function login(host, page){
    await page.goto(host + '/_data/index_login.aspx');
    // 输入用户名
    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type('20151597');
    // 输入密码
    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type('237231');
    // 登录
    await page.click(LOGIN_SELECTOR);
    await page.waitForNavigation();
}

/*
 * 从教务网 -> 学生学籍 -> 学籍档案 -> 个人信息 中提取用户个人信息，返回UserInfo对象
 * content: 网页内容
 */
async function parseInfo(page){
    await page.goto(HOST + '/xsxj/Stu_MyInfo_RPT.aspx');
    return new Promise(async function (resolve, reject){
        var user = new UserInfo();
        var parser = new htmlparser.Parser({
            lastText: '',
            onopentag: function(name, attribs){
                if(name.toLowerCase() == "html"){
                }
            },
            ontext: function(text){
                switch (this.lastText){
                    case '学号':
                        user.stunum = text;
                        break;
                    case '姓名':
                        user.name = text;
                        break;
                    case '性别':
                        user.sex = text;
                        break;
                    case '出生日期':
                        user.birthday = text;
                        break;
                    case '民族':
                        user.nation = text;
                        break;
                    case '院(系)/部':
                        user.academy = text;
                        break;
                    case '行政班级':
                        user.class_name = text;
                        break;
                }
                this.lastText = text;
            },
            onclosetag: function(tagname){
                if(tagname.toLowerCase() == "html"){
                    resolve(user);
                }
            }
        }, {decodeEntities: true});
        parser.write((await page.content()).replaceAll('&nbsp;', '').replaceAll(' ', ''));
        parser.end();
    });
}

/*
 * 解析课程表的解析器函数，根据输入的html，resolve一个Course数组
 * 要求数据保存在table中，要求每一行拥有相同的列数，在thead中指明列名，需要包含以下几个列：
 * 课程 学分 总学时 讲授学时 上机学时 任课教师 时间 地点
 * 要求每一个表中的数据要对齐，`周次 节次 地点`必须按照这个顺序出现，具体格式可以参考table_rpt.html
 */
function getTableParser(resolve, reject){
    return {
        currentTag: '',                 // 记录当前在解析的标签，值可为thead或tbody
        rowIndex: 0,                    // 记录当前解析的列号，联合keyTransformer得到字段的key
        courses:[],                     // 保存已经解析的课程
        currentCourse:'',               // 保存当前正在解析的课程
        appendingSchedule: false,       // 记录是否在解析同一课程的时间表（一个课程的完整时间表可能需要解析多行）
        // 用于根据列表表头，生成key转换器，例如将'课程'转换为'course_name'
        // 之后遍历tr时，借助keyTransformer可以按key保存数据
        keyTransformer: '',             // 将表格的列名转换为key的数组
        transform: function(text){
            switch(text){
                case '课程':
                    return 'course_name';
                case '学分':
                    return 'credit';
                case '总学时':
                    return 'hours_all';
                case '讲授学时':
                    return 'hours_teach';
                case '上机学时':
                    return 'hours_practice';
                case '任课教师':
                    return 'teacher';
                case '时间':
                    // 跳过时间节点的处理，因为它还有特殊子节点
                    return null;
                case '地点':
                    return 'classroom';
                default:
                    return null;
            }
        },
        onopentag: function(name, attribs){
            switch(name.toLowerCase()){
                case 'thead':
                    this.currentTag = 'thead';
                    this.keyTransformer = new Array(); // 最多不会超过15个键
                    break;
                case 'tbody':
                    this.currentTag = 'tbody';
                    break;
                case 'tr':
                    this.rowIndex = -1;
                    break;
                case 'td':
                    if(this.currentTag == 'tbody'){
                        if(this.keyTransformer[this.rowIndex] == 'course_name'){
                            // 追加课程
                            if(attribs['hidevalue']){
                                appendingSchedule = true;
                            }
                            // 开启新课程
                            else{
                                if(this.currentCourse){
                                    this.courses.push(this.currentCourse);
                                }
                            }
                        }
                        this.rowIndex++;
                    }
                    break;
            }
        },
        ontext: function(text){
            //console.log(this.currentTag, text);
            switch(this.currentTag){
                // 生成keyTansformer
                case 'thead':
                    if('时间' == text){
                        // 跳过时间节点，用周次和节次替换
                        this.keyTransformer.push('weeks');
                        this.keyTransformer.push('classtime');
                    }
                    else{
                        this.keyTransformer.push(this.transform(text));
                    }
                    break;
                // 生成课表数据
                case 'tbody':
                    let key = this.keyTransformer[this.rowIndex];
                    switch(key){
                        case 'weeks':
                            this.currentCourse.schedule.push({
                                weeks: text,
                                classtime:'',
                                classroom:''
                            });
                            break;
                        case 'classtime':
                            this.currentCourse.schedule[this.currentCourse.schedule.length-1].classtime = text;
                            break;
                        case 'classroom':
                            this.currentCourse.schedule[this.currentCourse.schedule.length-1].classroom = text;
                            break;
                        default:
                            if(!this.appendingSchedule){
                                if(key == 'course_name'){
                                    if(this.currentCourse.course_name != text){
                                        let code = text.substring(text.indexOf('[') + 1, text.indexOf(']'));
                                        let name = text.substring(text.indexOf(']') + 1);
                                        this.currentCourse = new Course(name, code);
                                        appendingSchedule = false;
                                    }
                                }
                                else if(key){
                                    this.currentCourse[key] = text;
                                }
                            }
                            break;
                    }
                    break;
            }
        },
        onclosetag: function(tagname){
            if(tagname == 'thead'){
                this.currentTag = null;
            }
            if(tagname == 'tbody'){
                this.currentTag = null;
            }
            if(tagname == 'html'){
                resolve(this.courses);
            }
        }
    }
}

/*
 * 从教务网 -> 教学安排 -> 查看个人课表 中提取用户课表信息，返回Table对象
 * page: 已经登录成功的教务网页面
 */
async function parseTable(page){
    await page.setJavaScriptEnabled(false);
    await page.goto(HOST + '/znpk/Pri_StuSel.aspx');
    await page.setJavaScriptEnabled(true);

    // 选择排序方式：按课程/环节(0) or 按时间(1)
    await page.select('select[name=px]', '0');
    await page.select('select[name=Sel_XNXQ]', '20170');
    await page.$eval(':root', root => {	// 选择学期：如2017-2018第一学期：20170； 2017-2018第二学期20171
        // 检索
        form.action="Pri_StuSel_rpt.aspx";
        form.method="post";
        form.target="frmRpt";
        form.submit();
    });

    return new Promise(async function (resolve, reject){
        // 包含课表内容的frame
        // let frmRpt = page.frames()[2];
        // 等待内容加载完成
        page.once('response', async res => {
            // 这里不使用await page.frames()[2].content()
            // 而使用await res.text()，因为frame的执行环境是不好预估的
            if(res.status() == 200){
                let content = await res.text();
                // 设置自定义的解析器
                let parser = new htmlparser.Parser(getTableParser(resolve, reject), {decodeEntities: true});
                // 去掉换行
                parser.write(content.replaceAll('<br>', ''));
                parser.end();
            }
            else{
                reject('status='+res.status());
            }
        });

    });
}

/*
 * 解析一个html页面，返回一个tbody的数组，数组层级为：tbody[] -> tr[] -> td[] -> {value, attrs} （三维数组）
 * keepattrs: 想要保留的td的属性，默认为null即保留所有属性
 */
function getGeneralTBodyParser(resolve, reject, keepattrs){
    return {
        currentTag: '', // mark tag is <tbody> or <tr>
        tempHtml: null,
        tempTody: null,
        tempTr: null,
        tempTd: null,
        onopentag: function(name, attributes){
            switch (name.toLowerCase()){
                case 'html':
                    this.currentTag = 'html';
                    this.tempHtml = [];
                    break;
                case 'table':
                    this.currentTag = 'table';
                    this.tempTody = [];
                    break;
                case 'tr':
                    this.currentTag = 'tr';
                    // reset columnIndex
                    this.columnIndex = 0;
                    this.tempTr = [];
                    break;
                case 'td':
                    this.currentTag = 'td';
                    // 筛选指定的key
                    if(keepattrs != null){
                        let keep = {};
                        for(let k in attributes){
                            if(keepattrs.indexOf(k) >= 0){
                                keep[k] = attributes[k];
                            }
                        }
                        attributes = keep;
                    }
                    this.tempTd = {
                        value: '',
                        attrs: attributes
                    };
                    break;
            }
        },
        ontext: function(text){
            if(this.currentTag == 'td'){
                this.tempTd.value = text;
            }
        },
        onclosetag: function(name){
            switch (name.toLowerCase()){
                case 'html':
                    this.currentTag = '';
                    resolve(this.tempHtml);
                    break;
                case 'table':
                    this.currentTag = '';
                    this.tempHtml.push(this.tempTody);
                    break;
                case 'tr':
                    this.currentTag = '';
                    this.tempTody.push(this.tempTr);
                    break;
                case 'td':
                    this.currentTag = '';
                    this.tempTr.push(this.tempTd);
                    break;
            }
        }
    }
}

/*
 * 从html中解析出Exam数组（借助getGeneralTBodyParser）
 * text: 待解析的html
 */
async function parseExamFromHTML(text){
    let generalData = await new Promise(function (resolve, reject){
        let parser = new htmlparser.Parser(getGeneralTBodyParser(resolve, reject, []), {decodeEntities: true});
        // 去掉换行
        parser.write((text).replaceAll('<br>', ''));
        parser.end();
    });
    let examList = [];
    for(let i = 0; i < generalData.length; i++){
        let table = generalData[i];
        // 标题行
        if(table.length == 1 && table[0].length == 3){
            i++; // 跳过列名行
            continue;
        }
        // 考试数据
        for(let j = 0; j < table.length; j++){
            let tr = table[j];
            let exam = new Exam();
            let name = tr[1].value; // [EDS20502]科技翻译
            exam.course_name = name.substring(name.indexOf(']') + 1); // 科技翻译
            exam.course_code = name.substring(name.indexOf('[') + 1, name.indexOf(']')); //EDS20502
            exam.credit = tr[2].value; // 2
            exam.time_str = tr[5].value; // 2018-01-17(20周 星期三)14:30-16:30
            // parse time
            let t = tr[5].value;
            let date = t.substring(0, t.indexOf('('));
            exam.start_time = date + ' ' + t.substring(t.indexOf(')') + 1, t.lastIndexOf('-')) + ':00'; // 2018-01-17 14:30:00
            exam.end_time = date + ' ' + t.substring(t.lastIndexOf('-') + 1) + ':00'; // 2018-01-17 16:30:00

            exam.classroom = tr[6].value; // D区D一教学楼D1143
            exam.seat = tr[7].value; // 5
            examList.push(exam);
        }
    }
    return examList;
}

/*
 * 从教务网 -> 考试安排 中提取用户考试信息，返回Exam列表
 * page: 已经登录成功的教务网页面
 */
async function parseExam(page){
    await page.goto(HOST + '/KSSW/stu_ksap.aspx');

    let values = await page.$eval('select[name=sel_lc]', select => {
        let values = [];
        for(let i = 0; i < select.options.length; i++){
            values.push(select.options[i].value);
        }
        return values;
    });

    let arr = new Array();
    for(let i = 0; i < values.length; i++){
        // 选择下一个考试周
        await page.select('select[name=sel_lc]', values[i]);
        // 检索
        await page.click('[type=submit]');
        // 等待响应
        let examTable = await new Promise(async (resolve, reject) => {
            page.once('response', async res => {
                // 这里不使用await page.frames()[2].content()
                // 而使用await res.text()，因为frame的执行环境是不好预估的
                if(res.status() == 200){
                    // 如果status是302，这里await res.text()会卡死
                    let content = await res.text();
                    let examTable = await parseExamFromHTML(content);
                    resolve(examTable);
                }
                else{
                    resolve([]);
                }
            });
        });
        // 添加到考试数据列表
        arr = arr.concat(examTable);
    }
    return arr;
}

function SemesterGrade(semester, gpa, data){
    this.semester = semester;
    this.gpa = gpa;
    this.data = data;
}

function Grade(course_name, course_code, credit, grade){
    this.course_name = course_name;
    this.course_code = course_code;
    this.credit = credit;
    this.grade = grade;
}

/*
 * 从html中解析出Grade数组（借助getGeneralTBodyParser）
 * text: 待解析的html
         [
            semester : "2015-2016学年 第一学期",
            gpa : 3.12,
            data : [
                {
                    code : "MATH20001",
                    course_name : "概率论与数理统计",
                    score : 3.00,
                    grade : 90,
                    note : "类别：公共基础/必修\n考核方式：考试\n修读性质：初修\n辅修标记：主修"
                },
                {
                    code : "MATH20002",
                    course_name : "高等数学",
                    score : 5.00,
                    grade : 90,
                    note : "类别：公共基础/必修\n考核方式：考试\n修读性质：初修\n辅修标记：主修"
                }
            ]
        ]
 */

async function parseGradeFromHTML(text){
    let generalData = await new Promise(function (resolve, reject){
        let parser = new htmlparser.Parser(getGeneralTBodyParser(resolve, reject, []), {decodeEntities: true});
        // 去掉换行
        // 因为包含学期名字的Table没有</table>标签！出此下策
        parser.write((text).replaceAll('<br>', '').replaceAll('学期</td></tr>', '学期</td></tr></table>'));
        parser.end();
    });
    let gradeList = [];
    for(let i = 1; i < generalData.length; i++){ // i=1开始，忽略名字table
        let table = generalData[i];
        // 标题行
        let currSemester = new SemesterGrade();
        currSemester.semester = table[0][0].value;
        currSemester.data = new Array();

        i++;
        table = generalData[i];
        // 考试数据
        for(let j = 1; j < table.length; j++){ // j=1开始，忽略列名tr
            let tr = table[j];
            let grade = new Grade();
            let name = tr[1].value; // [EDS20502]科技翻译
            grade.course_name = name.substring(name.indexOf(']') + 1); // 科技翻译
            grade.course_code = name.substring(name.indexOf('[') + 1, name.indexOf(']')); //EDS20502
            grade.credit = tr[2].value; // 2
            grade.grade = tr[6].value; // 78
            currSemester.data.push(grade);
        }
        gradeList.push(currSemester);
    }
    return gradeList;
}

// 在response回调处理结果，而不是使用waitFor(2000)，这样更可靠，更快
// 但是在处理Frame的时候，因为frame还在刷新，需要等待Frame的执行环境
/*
 * 从教务网 -> 查看个人成绩 中提取用户所有学年成绩信息，返回Grade列表
 * page: 已经登录成功的教务网页面
 */
async function parseGrade(page){
    return new Promise(async (resolve, reject) => {
        // 在response回调函数中接收数据
        let listener = page.on('response', async function(res) {
            if(res.request().method() == 'POST' && res.url().endsWith('Stu_MyScore_rpt.aspx')){
                let frame = page.frames()[1];
                // wait for frame's execute context !!!!!!!!!!!!!!!!!!!!!!!
                // await frame.executionContext();
                // 使用res.text()代替
                let content = await res.text();
                let grades = await parseGradeFromHTML(content);
                resolve(grades);
            }
        });
        // 访问个人成绩页面
        await page.goto('http://jxgl.cqu.edu.cn/xscj/Stu_MyScore.aspx');
        // 提交检索，一次检索所有学年的信息
        await page.$eval('[name=form1]', form =>{
            form.SelXNXQ_0.checked = true; // 入学以来
            form.ys_sj.checked = true; // 原始成绩
            form.submit(); // 检索
        });
        /*
        sel_xn: 学年(2017),(2016),...
        sel_xq: 第一学期(0), 第二学期(1)
        ys_sj: 原始成绩(0), 有效成绩(1)
        SelXNXQ: 入学以来(0), 学年(1), 学期(2)
        zfx_flag: 主修(0), 辅修(1)
        */
    });
}

async function interceptPage(page){
    await page.setRequestInterception(true);
    // 拦截图片、css，因为页面不需要渲染
    // 拦截MAINFRM.aspx，因为只需要保持cookie，不需要在主页做操作
    // 拦截ValidateCode.aspx，因为不需要验证码
    interceptions = ['.png', '.gif', '.jpg', 'ico', '.css', 'MAINFRM.aspx', 'ValidateCode.aspx',
        'ind_HTML_hr.js', 'ind_PrintSet.js', 'Sorry.aspx?str=NO_DATA']
    page.on('request', req => {
        //console.log(req.url);
        // total++;
        for(let i = 0; i < interceptions.length; i++){
            if(req.url().endsWith(interceptions[i]) || req.url().indexOf('Sorry.aspx') >= 0){
                req.abort();
                //console.log('aborted ' + req.url());
                // aborted++;
                return;
            }
        }
        // console.log(req.url());
        // console.log(req.postData);
        req.continue();
    });
}

async function checkCourse(host, page){
    await page.goto(host + '/wsxk/stu_btx.aspx');
    await page.click('[value=检索]');
    return new Promise((resolve, reject) => {
        page.on('response', async res => {
            if(res.url().endsWith('/wsxk/stu_btx_rpt.aspx')){
                if(res.status() === 200){
                    // 检索成功
                    console.log(await page.frames()[2].content());
                    resolve(await page.frames()[2].content());
                }
                else{
                    setTimeout(() => {
                        page.click('[value=检索]');
                    }, period);
                }
            }
            else{
            }
            console.log('检索课程:', res.status(), res.url());
        });
    });
}

async function submitCourse(host, page){
    await page.click('[value=提交]');
    return new Promise((resolve, reject) => {
        page.on('response', async res => {
            if(res.url().endsWith('/wsxk/stu_btx_rpt.aspx')){
                if(res.status() === 200){
                    // 检索成功
                    console.log(await page.frames()[2].content());
                    resolve(await page.frames()[2].content());
                }
                else{
                    setTimeout(() => {
                        page.click('[value=提交]');
                    }, period);
                }
            }
            else{
            }
            console.log('检索英语:', res.status(), res.url());
        });
    });
}

async function checkEnglish(host, page){
    await page.goto(host + '/wsxk/stu_yytgk_bx.aspx');
    await page.click('[value=检索]');
    return new Promise((resolve, reject) => {
        page.on('response', async res => {
            if(res.url().endsWith('/wsxk/stu_btx_rpt.aspx')){
                if(res.status() === 200){
                    // 检索成功
                    console.log(await page.frames()[2].content());
                    resolve(await page.frames()[2].content());
                }
                else{
                    setTimeout(() => {
                        page.click('[value=检索]');
                    }, period);
                }
            }
            else{
            }
            console.log('检索英语:', res.status(), res.url());
        });
    });
}

async function main(){
    let start = Date.now();

    const browser = await puppeteer.launch({headless: false});


    // 拦截不必要的请求，提高速度
    let aborted = 0;
    let total = 0;

    // 登录
    const page = await browser.newPage();
    //await page.emulate(devices['iPhone 6']);
    await interceptPage(page);
    await login(HOST2, page);
    checkCourse(HOST2, page)
        .then(() => {
            //submitCourse(HOST2, page);
        });

    let page2 = await browser.newPage();
    await interceptPage(page2);
    checkEnglish(HOST2, page2);

    /*
    // 查看个人信息
    let info = await parseInfo(page);
    console.log('time in info:', Date.now() - start); start = Date.now();

    // 查看课表
    let table = await parseTable(page);
    console.log('time in table:', Date.now() - start); start = Date.now();

    // 查看考试
    let exams = await parseExam(page);
    console.log('time in exams:', Date.now() - start); start = Date.now();

    // 查看成绩
    let grades = await parseGrade(page);
    console.log('time in grade:', Date.now() - start); start = Date.now();

    console.log('total request count:', total);
    console.log('aborted req count:', aborted);

    console.log('time in millons:', Date.now() - start);
    */

    //await browser.close();
}

async function debug(page){
    page.on('console', msg => {
        for (let i = 0; i < msg.args.length; ++i)
            console.log('${i}: ${msg.args[i]}');
    });
    page.on('error', err => {
        console.log('Error:');
        console.log(err);
    });
    page.on('frameattached', frame => {
        console.log('Frame attached:' + frame.name());
    });
    page.on('framedetached', frame => {
        console.log('Frame detached:' + frame.name());
    });
    page.on('framenavigated', frame => {
        console.log('Frame navigated:' + frame.name());
    });
    page.on('load', () => {
        console.log('Page loaded');
    });
    page.on('pageerror', msg => {
        console.log('Page error:' + msg);
    });
    page.on('request', req => {
        console.log('request:');
    });
    page.on('requestfailed', req => {
        console.log('requestfailed:');
    });
    page.on('requestfinished', req => {
        console.log('requestfinished:');
    });
    page.on('response', res => {
        console.log('response:');
    });
}

main();

/* 尝试全程模拟用户操作
let frmBody = page.frames()[3];

// fetch user info
await frmBody.waitFor(1000);
    openTheBar(0);  await frmBody.$eval(':root', root => {

    showLay('D0102');
});
let itemInfo = await frmBody.$('td[value="../xsxj/Stu_MyInfo.aspx"]');
itemInfo.click();

await frmBody.waitFor(1000);
let frmMain = frmBody.childFrames()[0];
*/

/*
  await page.$eval(':root', root => {
  // 尝试强行获取2016年第一学期的课表，但是没有返回任何数据
  var select = document.all.Sel_XNXQ;
  var option = document.createElement("option");
  var text = document.createTextNode('2016-2017学年第一学期');
  option.appendChild(text);
  option.value = '20160';
  select.appendChild(option);
  select.value = '20160';
  	ChkValue();
  });
*/